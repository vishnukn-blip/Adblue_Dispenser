# Copyright (c) 2026 Nimble Vision Technologies Pvt. Ltd.
"""End-to-end dispensing simulation against the real API.

	bench --site <site> execute nimble_kharj.demo.simulate_dispense.run
	bench --site <site> execute nimble_kharj.demo.simulate_dispense.run \
		--kwargs "{'barcode':'6101015999','qty':45,'offline':True}"

Prints the same state tape the React console shows, so the pitch demo and the
server log tell an identical story.
"""
import json
import time
import uuid

import frappe
from frappe.utils import flt, now_datetime

from nimble_kharj.api import dispensing, telemetry, sap

UNIT = "ADB-DU-01"
FLOW_LPM = 38.0          # AdBlue nozzle, typical
TICK_SECONDS = 0.35      # wall-clock pause between flow updates


def _line(state, detail=""):
	print(f"  {now_datetime().strftime('%H:%M:%S')}  {state:<16} {detail}")


def run(barcode="6101015888", qty=42.5, offline=False, vehicle_no=None):
	qty = flt(qty)
	bill = frappe.db.get_value("Kharj Waybill", {"waybill_no": barcode},
		["vehicle", "entitlement_qty", "dispensed_qty"], as_dict=True)
	vehicle_no = vehicle_no or (bill.vehicle if bill else None)
	pos = frappe.db.get_value("Kharj Fleet Vehicle", vehicle_no,
		["last_latitude", "last_longitude"], as_dict=True) or frappe._dict()

	print(f"\n=== Kharj AdBlue dispensing simulation — waybill {barcode} ===")
	telemetry.heartbeat(UNIT, buffered_records=0)

	# vehicle rolls onto the forecourt
	telemetry.gps_ping(vehicle_no, 24.155380, 47.334510, speed_kmph=6)
	_line("ARRIVED", f"{vehicle_no} inside station geofence")

	# 1. scan
	res = dispensing.scan(barcode, UNIT, vehicle_no, 24.155380, 47.334510)
	_line("SCANNED", f"aTOMS barcode {barcode}")
	for c in res["checks"]:
		print(f"        [{'PASS' if c['passed'] else 'FAIL'}] {c['label']}: {c['detail']}")
	if res["decision"] == "REJECTED":
		_line("REJECTED", res.get("reason"))
		return res

	balance = res["waybill"]["balance_qty"]
	preset = min(qty, balance)
	_line("VALIDATED", f"balance {balance:.2f} L, preset {preset:.2f} L")

	# 2. authorise
	key = f"{UNIT}-{uuid.uuid4().hex[:12]}"
	auth = dispensing.authorise(barcode, UNIT, preset, key, nozzle=1,
		vehicle_no=vehicle_no, latitude=24.155380, longitude=47.334510,
		captured_offline=1 if offline else 0)
	txn = auth["txn"]
	_line("AUTHORISED", f"{txn} token {auth['auth_token']} — pump released")

	# 3. flow
	delivered, t0 = 0.0, time.time()
	while delivered < preset - 0.01:
		time.sleep(TICK_SECONDS)
		delivered = min(preset, delivered + FLOW_LPM * (TICK_SECONDS / 60.0) * 12)
		if not offline:
			dispensing.flow(txn, round(delivered, 2), FLOW_LPM, auth["auth_token"])
		print(f"        flow  {delivered:6.2f} L   {FLOW_LPM:.1f} L/min", end="\r")
	print()
	_line("DISPENSING", f"{delivered:.2f} L in {time.time() - t0:.1f}s at {FLOW_LPM:.0f} L/min")

	# 4. complete
	if offline:
		_line("LINK_DOWN", "cloud unreachable — buffering to local cache")
		frappe.db.set_value("Kharj Dispensing Unit", UNIT, "buffered_records", 1)
		time.sleep(1.0)
		_line("LINK_UP", "replaying buffer with idempotency key")
		out = dispensing.sync_offline_batch(UNIT, json.dumps([{
			"idempotency_key": key, "barcode": barcode, "vehicle_no": vehicle_no,
			"requested_qty": preset, "dispensed_qty": round(delivered, 2),
			"latitude": 24.155380, "longitude": 47.334510,
		}]))
		_line("SYNCED", json.dumps(out["results"]))
	else:
		out = dispensing.complete(txn, round(delivered, 2), auth_token=auth["auth_token"])
		_line("COMPLETED", f"{out['dispensed_qty']:.2f} L posted")
		_line("WAYBILL", f"balance {out['waybill_balance']:.2f} L, status {out['waybill_status']}")

	# 5. SAP
	sap.drain_outbox()
	doc = frappe.get_doc("Kharj Dispense Transaction", txn)
	_line("SAP_POSTED", f"document {doc.sap_document_no}, txn status {doc.status}")
	frappe.db.commit()

	print(f"\n=== done — {txn} ===\n")
	return {"txn": txn, "dispensed": round(delivered, 2), "sap": doc.sap_document_no}


def run_rejection_demo():
	"""Same pump, wrong truck. Shows the deny path an auditor asks about."""
	return run(barcode="6101015888", qty=40, vehicle_no="ALM-TRK-1119")

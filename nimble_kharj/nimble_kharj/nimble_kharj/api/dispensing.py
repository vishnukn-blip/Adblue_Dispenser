# Copyright (c) 2026 Nimble Vision Technologies Pvt. Ltd.
"""Dispensing state machine.

	IDLE -> SCANNED -> VALIDATED -> AUTHORISED -> DISPENSING -> COMPLETED -> RECONCILED
	                 |
	                 +-> REJECTED (pump never released)

Every endpoint is idempotent on `idempotency_key`, which the dispenser mints
before it opens the nozzle. That is what makes the offline buffer replay-safe.
"""
import json
import secrets

import frappe
from frappe import _
from frappe.utils import cint, flt, now_datetime

from nimble_kharj.api import validation, waybill as wb


def _unit(unit_id):
	return frappe.get_doc("Kharj Dispensing Unit", unit_id)


def _ok(**kw):
	kw.setdefault("ok", True)
	return kw


# --------------------------------------------------------------------------- #
# 1. SCAN
# --------------------------------------------------------------------------- #
@frappe.whitelist(allow_guest=True)
def scan(barcode, unit_id, vehicle_no=None, latitude=None, longitude=None):
	"""Dispenser scans the aTOMS barcode. Returns the authorisation decision."""
	unit = _unit(unit_id)
	doc = wb.resolve(barcode)
	decision, checks = validation.run_checks(doc, unit, vehicle_no, latitude, longitude)

	payload = {
		"decision": decision,
		"checks": checks,
		"scanned_at": now_datetime(),
	}
	if doc:
		payload["waybill"] = {
			"waybill_no": doc.waybill_no,
			"freight_order": doc.freight_order,
			"vehicle": doc.vehicle,
			"product": doc.product,
			"route": doc.route,
			"entitlement_qty": flt(doc.entitlement_qty),
			"dispensed_qty": flt(doc.dispensed_qty),
			"balance_qty": flt(doc.entitlement_qty) - flt(doc.dispensed_qty),
			"valid_to": doc.valid_to,
		}
	if decision == "REJECTED":
		payload["reason"] = validation.first_failure(checks)
		frappe.log_error(title="Kharj dispense rejected", message=json.dumps(payload, default=str))
	return _ok(**payload)


# --------------------------------------------------------------------------- #
# 2. AUTHORISE
# --------------------------------------------------------------------------- #
@frappe.whitelist(allow_guest=True)
def authorise(barcode, unit_id, requested_qty, idempotency_key, nozzle=1,
			  vehicle_no=None, latitude=None, longitude=None, captured_offline=0):
	"""Create the transaction and release the pump. Safe to call twice."""
	existing = frappe.db.get_value("Kharj Dispense Transaction",
		{"idempotency_key": idempotency_key}, "name")
	if existing:
		txn = frappe.get_doc("Kharj Dispense Transaction", existing)
		return _ok(txn=txn.name, status=txn.status, auth_token=txn.auth_token, replayed=True)

	unit = _unit(unit_id)
	doc = wb.resolve(barcode)
	decision, checks = validation.run_checks(
		doc, unit, vehicle_no, latitude, longitude, requested_qty)

	txn = frappe.new_doc("Kharj Dispense Transaction")
	txn.update({
		"idempotency_key": idempotency_key,
		"waybill": doc.name if doc else None,
		"vehicle": (doc.vehicle if doc else None) or vehicle_no,
		"dispensing_unit": unit.name,
		"nozzle": cint(nozzle),
		"product": unit.product,
		"authorised_qty": flt(requested_qty),
		"totalizer_start": flt(unit.totalizer_l),
		"scanned_at": now_datetime(),
		"latitude": flt(latitude) if latitude else None,
		"longitude": flt(longitude) if longitude else None,
		"geofence_ok": next((c["passed"] for c in checks if c["code"] == "GEOFENCE"), 0),
		"captured_offline": cint(captured_offline),
		"validation_trace": json.dumps(checks, default=str, indent=1),
	})
	txn.log("SCANNED", f"Barcode {barcode} read at {unit.name}", "Dispenser")

	if decision == "REJECTED":
		txn.status = "Rejected"
		txn.rejection_reason = validation.first_failure(checks)
		txn.log("REJECTED", txn.rejection_reason)
		txn.insert(ignore_permissions=True)
		return _ok(txn=txn.name, decision="REJECTED", reason=txn.rejection_reason, checks=checks)

	txn.status = "Authorised"
	txn.auth_token = secrets.token_hex(8).upper()
	txn.authorised_at = now_datetime()
	txn.log("VALIDATED", f"{len(checks)} checks passed")
	txn.log("AUTHORISED", f"Preset {flt(requested_qty):.2f} L, token {txn.auth_token}")
	txn.insert(ignore_permissions=True)

	return _ok(txn=txn.name, decision="APPROVED", auth_token=txn.auth_token,
			   authorised_qty=flt(requested_qty), checks=checks)


# --------------------------------------------------------------------------- #
# 3. FLOW TELEMETRY
# --------------------------------------------------------------------------- #
@frappe.whitelist(allow_guest=True)
def flow(txn, dispensed_qty, flow_rate_lpm=0, auth_token=None):
	"""Sub-second flow updates. Written to the doc sparsely, streamed always."""
	doc = frappe.get_doc("Kharj Dispense Transaction", txn)
	if auth_token and auth_token != doc.auth_token:
		frappe.throw(_("Invalid authorisation token"))
	if doc.status == "Authorised":
		doc.status = "Dispensing"
		doc.started_at = now_datetime()
		doc.log("DISPENSING", "Nozzle lifted, flow detected", "Dispenser")
		doc.save(ignore_permissions=True)

	frappe.publish_realtime("kharj_flow", {
		"txn": txn, "dispensed_qty": flt(dispensed_qty),
		"flow_rate_lpm": flt(flow_rate_lpm),
	})
	frappe.db.set_value("Kharj Dispense Transaction", txn, {
		"dispensed_qty": flt(dispensed_qty), "flow_rate_lpm": flt(flow_rate_lpm),
	}, update_modified=False)
	return _ok()


# --------------------------------------------------------------------------- #
# 4. COMPLETE
# --------------------------------------------------------------------------- #
@frappe.whitelist(allow_guest=True)
def complete(txn, dispensed_qty, totalizer_end=None, auth_token=None):
	"""Nozzle stowed. Posts against the waybill and queues the SAP message."""
	doc = frappe.get_doc("Kharj Dispense Transaction", txn)
	if doc.status in ("Completed", "Reconciled"):
		return _ok(txn=doc.name, status=doc.status, replayed=True)
	if auth_token and auth_token != doc.auth_token:
		frappe.throw(_("Invalid authorisation token"))

	qty = flt(dispensed_qty)
	doc.dispensed_qty = qty
	doc.totalizer_end = flt(totalizer_end) if totalizer_end else flt(doc.totalizer_start) + qty
	doc.completed_at = now_datetime()
	doc.status = "Completed"
	doc.log("COMPLETED", f"{qty:.2f} L delivered", "Dispenser")

	# post against the waybill under a row lock
	bill = frappe.get_doc("Kharj Waybill", doc.waybill, for_update=True)
	bill.consume(qty)
	doc.log("WAYBILL_POSTED", f"Balance now {flt(bill.balance_qty):.2f} L")

	frappe.db.set_value("Kharj Dispensing Unit", doc.dispensing_unit,
		"totalizer_l", doc.totalizer_end)

	from nimble_kharj.api.sap import queue_dispense_posting
	msg = queue_dispense_posting(doc, bill)
	doc.sap_status = "Queued"
	doc.synced_at = now_datetime()
	doc.log("SAP_QUEUED", f"Outbox message {msg}", "SAP")
	doc.save(ignore_permissions=True)

	return _ok(txn=doc.name, dispensed_qty=qty, waybill_balance=flt(bill.balance_qty),
			   waybill_status=bill.status, sap_message=msg)


@frappe.whitelist(allow_guest=True)
def abort(txn, dispensed_qty=0, reason="Operator abort"):
	doc = frappe.get_doc("Kharj Dispense Transaction", txn)
	doc.status = "Aborted"
	doc.dispensed_qty = flt(dispensed_qty)
	doc.rejection_reason = reason
	doc.log("ABORTED", reason, "Dispenser")
	doc.save(ignore_permissions=True)
	if flt(dispensed_qty) > 0:
		bill = frappe.get_doc("Kharj Waybill", doc.waybill, for_update=True)
		bill.consume(flt(dispensed_qty))
	return _ok(txn=doc.name)


# --------------------------------------------------------------------------- #
# 5. OFFLINE REPLAY
# --------------------------------------------------------------------------- #
@frappe.whitelist(allow_guest=True)
def sync_offline_batch(unit_id, records):
	"""Replay a dispenser's local cache once the link is back.

	`records` is a JSON list of {idempotency_key, barcode, vehicle_no, requested_qty,
	dispensed_qty, latitude, longitude, started_at, completed_at}.
	"""
	if isinstance(records, str):
		records = json.loads(records)

	results = []
	for r in records:
		try:
			auth = authorise(
				barcode=r["barcode"], unit_id=unit_id,
				requested_qty=r.get("requested_qty") or r["dispensed_qty"],
				idempotency_key=r["idempotency_key"], nozzle=r.get("nozzle", 1),
				vehicle_no=r.get("vehicle_no"), latitude=r.get("latitude"),
				longitude=r.get("longitude"), captured_offline=1)
			if auth.get("decision") == "REJECTED":
				results.append({"key": r["idempotency_key"], "status": "Rejected",
								"reason": auth.get("reason")})
				continue
			res = complete(auth["txn"], r["dispensed_qty"])
			results.append({"key": r["idempotency_key"], "status": "Posted",
							"txn": res["txn"], "replayed": res.get("replayed", False)})
		except Exception as e:  # noqa: BLE001
			frappe.log_error(title="Kharj offline replay failed", message=frappe.get_traceback())
			results.append({"key": r.get("idempotency_key"), "status": "Failed", "reason": str(e)})

	frappe.db.set_value("Kharj Dispensing Unit", unit_id, "buffered_records",
		max(0, cint(frappe.db.get_value("Kharj Dispensing Unit", unit_id, "buffered_records")) - len(records)))
	return _ok(results=results, accepted=len(results))


def on_txn_update(doc, method=None):
	"""Hook: keep the console live without polling."""
	frappe.publish_realtime("kharj_txn_update", {
		"txn": doc.name, "status": doc.status,
		"dispensed_qty": flt(doc.dispensed_qty), "waybill": doc.waybill,
	})

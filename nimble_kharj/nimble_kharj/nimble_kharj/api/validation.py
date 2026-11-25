# Copyright (c) 2026 Nimble Vision Technologies Pvt. Ltd.
"""Waybill authorisation rules.

Every rule returns a dict so the dispenser HMI, the console and the audit trail
all show the same checklist. Rules are ordered the way an auditor reads them.
"""
import math

import frappe
from frappe.utils import flt, get_datetime, now_datetime

EARTH_R = 6371000.0


def haversine_m(lat1, lon1, lat2, lon2):
	p1, p2 = math.radians(flt(lat1)), math.radians(flt(lat2))
	dp = p2 - p1
	dl = math.radians(flt(lon2) - flt(lon1))
	a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
	return 2 * EARTH_R * math.asin(math.sqrt(a))


def check(code, label, passed, detail=""):
	return {"code": code, "label": label, "passed": bool(passed), "detail": detail}


def run_checks(waybill, unit, vehicle_no=None, lat=None, lng=None, requested_qty=None):
	"""Returns (decision, checks). decision is 'APPROVED' or 'REJECTED'."""
	checks = []
	now = now_datetime()

	checks.append(check("WB_FOUND", "Waybill resolved from barcode", bool(waybill),
		waybill.waybill_no if waybill else "Barcode not registered"))
	if not waybill:
		return "REJECTED", checks

	checks.append(check("WB_STATUS", "Waybill open for dispensing",
		waybill.status in ("Open", "Partially Dispensed"), f"Status: {waybill.status}"))

	valid_window = get_datetime(waybill.valid_from) <= now <= get_datetime(waybill.valid_to)
	checks.append(check("WB_WINDOW", "Inside validity window", valid_window,
		f"{waybill.valid_from} to {waybill.valid_to}"))

	checks.append(check("PROD_MATCH", "Product matches nozzle",
		waybill.product == unit.product, f"{waybill.product} vs {unit.product}"))

	if vehicle_no:
		checks.append(check("VEH_MATCH", "Vehicle matches waybill",
			vehicle_no == waybill.vehicle, f"At pump: {vehicle_no} / on waybill: {waybill.vehicle}"))

	if waybill.station:
		checks.append(check("STN_MATCH", "Station authorised on waybill",
			waybill.station == unit.station, f"{unit.station}"))

	balance = flt(waybill.entitlement_qty) - flt(waybill.dispensed_qty)
	checks.append(check("ENTITLEMENT", "Entitlement balance available", balance > 0.001,
		f"{balance:.2f} L of {flt(waybill.entitlement_qty):.2f} L remaining"))

	if requested_qty is not None:
		checks.append(check("QTY_LIMIT", "Requested quantity within balance",
			flt(requested_qty) <= balance + 0.001,
			f"Requested {flt(requested_qty):.2f} L, balance {balance:.2f} L"))

	if lat is not None and lng is not None and waybill.station:
		stn = frappe.db.get_value("Kharj Station", unit.station,
			["latitude", "longitude", "geofence_radius_m"], as_dict=True)
		dist = haversine_m(lat, lng, stn.latitude, stn.longitude)
		checks.append(check("GEOFENCE", "Vehicle inside station geofence",
			dist <= flt(stn.geofence_radius_m), f"{dist:.0f} m from station centre"))

	dup = frappe.db.exists("Kharj Dispense Transaction", {
		"waybill": waybill.name, "status": ["in", ["Authorised", "Dispensing"]],
	})
	checks.append(check("NO_OPEN_TXN", "No transaction already in progress", not dup,
		dup or "None open"))

	decision = "APPROVED" if all(c["passed"] for c in checks) else "REJECTED"
	return decision, checks


def first_failure(checks):
	for c in checks:
		if not c["passed"]:
			return f"{c['label']} — {c['detail']}"
	return ""

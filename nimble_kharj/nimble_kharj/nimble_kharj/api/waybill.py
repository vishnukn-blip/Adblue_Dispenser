# Copyright (c) 2026 Nimble Vision Technologies Pvt. Ltd.
"""Waybill lookup. Barcodes are generated SAP-side by aTOMS; we only read them."""
import re

import frappe
from frappe.utils import now_datetime

# aTOMS payloads seen in the field: bare FO number, or FO prefixed/padded.
FO_PATTERN = re.compile(r"(\d{10})")


def normalise(payload: str) -> str:
	payload = (payload or "").strip().upper()
	m = FO_PATTERN.search(payload)
	return m.group(1) if m else payload


def resolve(payload: str):
	"""Resolve a scanned aTOMS barcode to a Kharj Waybill document."""
	fo = normalise(payload)
	name = frappe.db.get_value("Kharj Waybill", {"barcode_payload": payload}) \
		or frappe.db.get_value("Kharj Waybill", {"waybill_no": fo}) \
		or frappe.db.get_value("Kharj Waybill", {"freight_order": fo})
	return frappe.get_doc("Kharj Waybill", name) if name else None


def expire_stale_waybills():
	stale = frappe.get_all("Kharj Waybill", filters={
		"status": ["in", ["Open", "Partially Dispensed"]],
		"valid_to": ["<", now_datetime()],
	}, pluck="name")
	for name in stale:
		frappe.db.set_value("Kharj Waybill", name, "status", "Expired")
	if stale:
		frappe.db.commit()
	return len(stale)


@frappe.whitelist()
def create_waybill(vehicle, product="AdBlue", entitlement_qty=50.0, route=None, station="KHARJ-01", valid_hours=48):
	"""Create a new manual Kharj Waybill (Fuel Order)."""
	from frappe.utils import add_to_date, flt, now_datetime
	import random

	# Generate a 10-digit FO number in the 610101xxxx series
	fo_no = f"610101{random.randint(6000, 9999)}"
	while frappe.db.exists("Kharj Waybill", fo_no):
		fo_no = f"610101{random.randint(6000, 9999)}"

	now = now_datetime()
	doc = frappe.get_doc({
		"doctype": "Kharj Waybill",
		"waybill_no": fo_no,
		"barcode_payload": fo_no,
		"freight_order": fo_no,
		"vehicle": vehicle,
		"station": station,
		"product": product,
		"entitlement_qty": flt(entitlement_qty),
		"dispensed_qty": 0.0,
		"balance_qty": flt(entitlement_qty),
		"status": "Open",
		"route": route or "Kharj DC -> Regional Route",
		"valid_from": now,
		"valid_to": add_to_date(now, hours=int(valid_hours)),
		"trip_start": now,
	})
	doc.insert(ignore_permissions=True)
	frappe.db.commit()
	return doc.as_dict()


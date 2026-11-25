# Copyright (c) 2026 Nimble Vision Technologies Pvt. Ltd.
"""SAP integration as a transactional outbox.

Nothing calls SAP inline. A dispense completes locally, drops a message in the
outbox, and the scheduler drains it. The pump never waits on SAP, and a network
outage costs nothing but latency.
"""
import json

import frappe
from frappe.utils import cint, flt, now_datetime

MAX_ATTEMPTS = 8


def queue_dispense_posting(txn, bill):
	payload = {
		"freight_order": bill.freight_order,
		"waybill_no": bill.waybill_no,
		"vehicle": txn.vehicle,
		"material": txn.product,
		"quantity_l": flt(txn.dispensed_qty),
		"uom": "L",
		"plant": frappe.db.get_value("Kharj Station",
			frappe.db.get_value("Kharj Dispensing Unit", txn.dispensing_unit, "station"),
			"sap_plant"),
		"dispenser": txn.dispensing_unit,
		"posting_time": str(txn.completed_at),
		"totalizer_start": flt(txn.totalizer_start),
		"totalizer_end": flt(txn.totalizer_end),
		"captured_offline": cint(txn.captured_offline),
		"geo": {"lat": flt(txn.latitude), "lng": flt(txn.longitude),
				"geofence_ok": cint(txn.geofence_ok)},
		"idempotency_key": txn.idempotency_key,
	}
	msg = frappe.get_doc({
		"doctype": "Kharj SAP Message", "direction": "Outbound",
		"message_type": "Dispense Posting", "reference_doctype": txn.doctype,
		"reference_name": txn.name, "status": "Queued",
		"payload": json.dumps(payload, indent=1, default=str),
	}).insert(ignore_permissions=True)
	return msg.name


def _post_to_sap(payload):
	"""Replace with the customer's PI/PO or OData endpoint.

	Kept behind a single function so the demo can run with a stub while the
	integration team wires the real service.
	"""
	settings = frappe.conf.get("kharj_sap") or {}
	if not settings.get("endpoint"):
		# demo stub: acknowledge with a synthetic document number
		return {"document_no": "49" + frappe.generate_hash(length=8).upper(), "status": "S"}

	import requests
	res = requests.post(settings["endpoint"], json=payload,
		auth=(settings.get("user"), settings.get("password")), timeout=20)
	res.raise_for_status()
	return res.json()


def drain_outbox(limit=50):
	queued = frappe.get_all("Kharj SAP Message",
		filters={"status": ["in", ["Queued", "Failed"]], "attempts": ["<", MAX_ATTEMPTS]},
		pluck="name", limit=limit, order_by="creation asc")

	for name in queued:
		msg = frappe.get_doc("Kharj SAP Message", name)
		try:
			response = _post_to_sap(json.loads(msg.payload))
			msg.status = "Acknowledged"
			msg.sap_document_no = response.get("document_no")
			msg.response = json.dumps(response, indent=1)
			msg.save(ignore_permissions=True)

			if msg.reference_doctype == "Kharj Dispense Transaction":
				txn = frappe.get_doc("Kharj Dispense Transaction", msg.reference_name)
				txn.sap_status = "Posted"
				txn.sap_document_no = msg.sap_document_no
				txn.status = "Reconciled"
				txn.log("SAP_POSTED", f"SAP document {msg.sap_document_no}", "SAP")
				txn.save(ignore_permissions=True)
				frappe.db.set_value("Kharj Waybill", txn.waybill, "sap_sync_status", "Synced")
			frappe.db.commit()
		except Exception as e:  # noqa: BLE001
			msg.status = "Failed"
			msg.attempts = cint(msg.attempts) + 1
			msg.last_error = str(e)[:500]
			msg.save(ignore_permissions=True)
			frappe.db.commit()
			frappe.log_error(title="Kharj SAP post failed", message=frappe.get_traceback())
	return len(queued)


@frappe.whitelist()
def reconciliation(from_date, to_date):
	"""Dispensed vs SAP-posted, the report the fuel controller actually opens."""
	rows = frappe.db.sql("""
		SELECT t.waybill, t.vehicle, t.product,
			SUM(t.dispensed_qty) AS dispensed,
			SUM(CASE WHEN t.sap_status = 'Posted' THEN t.dispensed_qty ELSE 0 END) AS posted,
			SUM(CASE WHEN t.captured_offline = 1 THEN 1 ELSE 0 END) AS offline_captures
		FROM `tabKharj Dispense Transaction` t
		WHERE t.status IN ('Completed', 'Reconciled')
			AND DATE(t.completed_at) BETWEEN %s AND %s
		GROUP BY t.waybill, t.vehicle, t.product
	""", (from_date, to_date), as_dict=True)
	for r in rows:
		r["variance"] = flt(r.dispensed) - flt(r.posted)
	return {"as_of": now_datetime(), "rows": rows}

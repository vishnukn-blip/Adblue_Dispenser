# Copyright (c) 2026 Nimble Vision Technologies Pvt. Ltd.
"""GPS ingestion, geofencing and dispenser heartbeat."""
import json

import frappe
from frappe.utils import add_to_date, cint, flt, now_datetime

from nimble_kharj.api.validation import haversine_m


@frappe.whitelist(allow_guest=True)
def gps_ping(vehicle, latitude, longitude, speed_kmph=0, heading=0, ignition=1, ts=None):
	ts = ts or now_datetime()
	station = frappe.db.get_value("Kharj Station", {"is_active": 1},
		["name", "latitude", "longitude", "geofence_radius_m"], as_dict=True)

	event = None
	if station:
		dist = haversine_m(latitude, longitude, station.latitude, station.longitude)
		event = "Inside" if dist <= flt(station.geofence_radius_m) else "Outside"

	frappe.get_doc({
		"doctype": "Kharj GPS Ping", "vehicle": vehicle, "ts": ts,
		"latitude": flt(latitude), "longitude": flt(longitude),
		"speed_kmph": flt(speed_kmph), "heading": flt(heading), "ignition": ignition,
		"geofence_event": event, "station": station.name if station else None,
	}).insert(ignore_permissions=True)

	frappe.db.set_value("Kharj Fleet Vehicle", vehicle, {
		"last_latitude": flt(latitude), "last_longitude": flt(longitude),
		"last_speed_kmph": flt(speed_kmph), "last_ping_at": ts,
	}, update_modified=False)

	frappe.publish_realtime("kharj_gps", {
		"vehicle": vehicle, "latitude": flt(latitude), "longitude": flt(longitude),
		"speed_kmph": flt(speed_kmph), "geofence": event, "ts": str(ts),
	})
	return {"ok": True, "geofence": event}


@frappe.whitelist(allow_guest=True)
def heartbeat(unit_id, totalizer_l=None, buffered_records=0, firmware_version=None):
	values = {"last_heartbeat": now_datetime(), "status": "Online",
			  "buffered_records": buffered_records}
	if totalizer_l is not None:
		values["totalizer_l"] = flt(totalizer_l)
	if firmware_version:
		values["firmware_version"] = firmware_version
	frappe.db.set_value("Kharj Dispensing Unit", unit_id, values, update_modified=False)
	return {"ok": True, "server_time": now_datetime()}


def watchdog_dispensers():
	cutoff = add_to_date(now_datetime(), minutes=-3)
	stale = frappe.get_all("Kharj Dispensing Unit",
		filters={"status": "Online", "last_heartbeat": ["<", cutoff]}, pluck="name")
	for unit in stale:
		frappe.db.set_value("Kharj Dispensing Unit", unit, "status", "Offline")
	if stale:
		frappe.db.commit()
	return stale


@frappe.whitelist(allow_guest=True)
def record_iot_dispense(vehicle_id, dispensed_liters, date_time=None):
	"""Records an IoT dispense event from MQTT or direct HTTP ping."""
	if not vehicle_id:
		frappe.throw("vehicle_id is required")
	
	dt = date_time or now_datetime()
	liters = flt(dispensed_liters)

	doc = frappe.get_doc({
		"doctype": "Kharj IoT Dispense Log",
		"vehicle_id": str(vehicle_id).strip(),
		"dispensed_liters": liters,
		"date_time": dt,
	}).insert(ignore_permissions=True)

	payload = {
		"name": doc.name,
		"vehicle_id": doc.vehicle_id,
		"dispensed_liters": flt(doc.dispensed_liters),
		"date_time": str(doc.date_time),
	}

	# Stream real-time event to connected web dashboard
	frappe.publish_realtime("kharj_iot_dispense", payload)

	return {"ok": True, "status": "saved to db", "result": "saved to db", "data": payload}


@frappe.whitelist(allow_guest=True)
def clear_iot_dispense_logs():
	"""Clears all dispense records (hardcoded/test data) from the Frappe database."""
	frappe.db.delete("Kharj IoT Dispense Log")
	frappe.db.commit()
	return {"ok": True, "message": "All dispense logs cleared from database"}


@frappe.whitelist(allow_guest=True)
def get_iot_dispense_logs(limit=50):
	"""Returns the most recent IoT dispense logs."""
	return frappe.get_all(
		"Kharj IoT Dispense Log",
		fields=["name", "vehicle_id", "dispensed_liters", "date_time"],
		order_by="date_time desc",
		limit=cint(limit) or 50,
	)


@frappe.whitelist(allow_guest=True)
def dashboard():
	"""Single payload for the React console."""
	return {
		"vehicles": frappe.get_all("Kharj Fleet Vehicle",
			fields=["name", "vehicle_no", "driver_name", "last_latitude", "last_longitude",
					"last_speed_kmph", "last_ping_at"], filters={"is_active": 1}),
		"units": frappe.get_all("Kharj Dispensing Unit",
			fields=["name", "status", "product", "totalizer_l", "buffered_records",
					"last_heartbeat"]),
		"open_waybills": frappe.get_all("Kharj Waybill",
			fields=["name", "waybill_no", "vehicle", "product", "entitlement_qty",
					"dispensed_qty", "balance_qty", "status", "valid_to"],
			filters={"status": ["in", ["Open", "Partially Dispensed"]]}, limit=50),
		"recent_txns": frappe.get_all("Kharj Dispense Transaction",
			fields=["name", "waybill", "vehicle", "status", "dispensed_qty",
					"sap_status", "completed_at", "captured_offline"],
			order_by="creation desc", limit=20),
		"iot_dispenses": frappe.get_all("Kharj IoT Dispense Log",
			fields=["name", "vehicle_id", "dispensed_liters", "date_time"],
			order_by="date_time desc", limit=30),
		"sap_outbox": frappe.db.count("Kharj SAP Message", {"status": ["in", ["Queued", "Failed"]]}),
	}

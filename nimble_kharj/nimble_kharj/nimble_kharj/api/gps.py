# Copyright (c) 2026 Nimble Vision Technologies Pvt. Ltd.
"""GPS integration.

Three ways in, one way out:

	1. `webhook`  — tracker vendors push here (Teltonika/Traccar/Wialon shapes are
	   normalised in `_normalise`). Guest-allowed, device-token authenticated.
	2. `ingest_batch` — the NV50 edge board flushes its own buffer here after a
	   dead zone, same idempotency discipline as dispensing.
	3. `telemetry.gps_ping` — single position, used by the console and tests.

Everything lands in Kharj GPS Ping, updates the vehicle's last-known position,
runs geofence state transition detection, and streams to any open console.
"""
import json
from datetime import datetime

import frappe
from frappe import _
from frappe.utils import cint, cstr, flt, get_datetime, now_datetime

from nimble_kharj.api.validation import haversine_m

STALE_FIX_SECONDS = 120
MIN_MOVE_M = 15  # below this the vehicle is parked; don't spam pings


# --------------------------------------------------------------------------- #
# ingestion
# --------------------------------------------------------------------------- #
def _normalise(raw):
	"""Flatten the vendor payloads we've seen into one shape."""
	if isinstance(raw, str):
		raw = json.loads(raw)

	# Traccar / OsmAnd style
	if "deviceid" in {k.lower() for k in raw}:
		lower = {k.lower(): v for k, v in raw.items()}
		return {
			"device_id": cstr(lower.get("deviceid")),
			"latitude": flt(lower.get("lat") or lower.get("latitude")),
			"longitude": flt(lower.get("lon") or lower.get("lng") or lower.get("longitude")),
			"speed_kmph": flt(lower.get("speed")) * 1.852 if lower.get("speedunit") == "kn" else flt(lower.get("speed")),
			"heading": flt(lower.get("bearing") or lower.get("course")),
			"ignition": cint(lower.get("ignition", 1)),
			"ts": lower.get("timestamp") or lower.get("fixtime"),
		}

	# Teltonika AVL decoded by the vendor gateway
	if "imei" in raw:
		pos = raw.get("position") or raw
		return {
			"device_id": cstr(raw["imei"]),
			"latitude": flt(pos.get("latitude")),
			"longitude": flt(pos.get("longitude")),
			"speed_kmph": flt(pos.get("speed")),
			"heading": flt(pos.get("angle") or pos.get("heading")),
			"ignition": cint((raw.get("io") or {}).get("ignition", 1)),
			"ts": raw.get("timestamp"),
		}

	# native NV50 payload
	return {
		"device_id": cstr(raw.get("device_id") or raw.get("vehicle")),
		"latitude": flt(raw.get("latitude")), "longitude": flt(raw.get("longitude")),
		"speed_kmph": flt(raw.get("speed_kmph")), "heading": flt(raw.get("heading")),
		"ignition": cint(raw.get("ignition", 1)), "ts": raw.get("ts"),
	}


def _resolve_vehicle(device_id):
	return (frappe.db.get_value("Kharj Fleet Vehicle", {"gps_device_id": device_id})
			or frappe.db.get_value("Kharj Fleet Vehicle", device_id))


@frappe.whitelist(allow_guest=True)
def webhook():
	"""Tracker vendor push endpoint.

	Expects header `X-Kharj-Device-Token` matching site_config `kharj_gps_token`.
	Returns fast — vendors retry aggressively on anything slower than a second.
	"""
	token = frappe.get_request_header("X-Kharj-Device-Token")
	if not token or token != (frappe.conf.get("kharj_gps_token") or ""):
		frappe.throw(_("Unauthorised device"), frappe.AuthenticationError)

	fix = _normalise(frappe.request.get_data(as_text=True))
	return record_fix(**fix)


@frappe.whitelist(allow_guest=True)
def ingest_batch(records):
	"""Edge-board flush after a dead zone. Ordered oldest first."""
	if isinstance(records, str):
		records = json.loads(records)
	out = []
	for raw in records:
		try:
			out.append(record_fix(**_normalise(raw)))
		except Exception as e:  # noqa: BLE001
			frappe.log_error(title="Kharj GPS batch", message=frappe.get_traceback())
			out.append({"ok": False, "error": str(e)})
	return {"ok": True, "accepted": len(out), "results": out}


def record_fix(device_id=None, latitude=None, longitude=None, speed_kmph=0,
			   heading=0, ignition=1, ts=None, vehicle=None):
	vehicle = vehicle or _resolve_vehicle(device_id)
	if not vehicle:
		return {"ok": False, "error": f"Unknown device {device_id}"}

	ts = get_datetime(ts) if ts else now_datetime()
	prev = frappe.db.get_value("Kharj Fleet Vehicle", vehicle,
		["last_latitude", "last_longitude", "geofence_state", "odometer_km"], as_dict=True)

	moved = haversine_m(prev.last_latitude, prev.last_longitude, latitude, longitude) \
		if prev.last_latitude else 9999

	state, station, distance = classify(latitude, longitude)
	transition = None
	if state != (prev.geofence_state or "Outside"):
		transition = "Entry" if state == "Inside" else "Exit"

	if moved >= MIN_MOVE_M or transition:
		frappe.get_doc({
			"doctype": "Kharj GPS Ping", "vehicle": vehicle, "ts": ts,
			"latitude": flt(latitude), "longitude": flt(longitude),
			"speed_kmph": flt(speed_kmph), "heading": flt(heading), "ignition": cint(ignition),
			"geofence_event": transition or state, "station": station,
		}).insert(ignore_permissions=True)

	frappe.db.set_value("Kharj Fleet Vehicle", vehicle, {
		"last_latitude": flt(latitude), "last_longitude": flt(longitude),
		"last_speed_kmph": flt(speed_kmph), "last_heading": flt(heading),
		"last_ping_at": ts, "geofence_state": state,
		"odometer_km": flt(prev.odometer_km) + (moved / 1000.0 if moved < 9999 else 0),
	}, update_modified=False)

	if transition:
		on_geofence_transition(vehicle, station, transition, latitude, longitude, ts)

	frappe.publish_realtime("kharj_gps", {
		"vehicle": vehicle, "latitude": flt(latitude), "longitude": flt(longitude),
		"speed_kmph": flt(speed_kmph), "heading": flt(heading),
		"geofence": state, "distance_m": round(distance), "transition": transition,
		"ts": str(ts),
	})
	return {"ok": True, "vehicle": vehicle, "geofence": state,
			"distance_m": round(distance), "transition": transition}


# --------------------------------------------------------------------------- #
# geofencing
# --------------------------------------------------------------------------- #
def classify(latitude, longitude):
	"""Nearest active station, and whether we are inside its fence."""
	stations = frappe.get_all("Kharj Station", filters={"is_active": 1},
		fields=["name", "latitude", "longitude", "geofence_radius_m"])
	if not stations:
		return "Outside", None, 0.0

	nearest, best = None, float("inf")
	for s in stations:
		d = haversine_m(latitude, longitude, s.latitude, s.longitude)
		if d < best:
			nearest, best = s, d
	return ("Inside" if best <= flt(nearest.geofence_radius_m) else "Outside"), nearest.name, best


def on_geofence_transition(vehicle, station, transition, lat, lng, ts):
	"""Entry arms the pump; exit closes the visit and flags any open transaction."""
	frappe.publish_realtime("kharj_geofence", {
		"vehicle": vehicle, "station": station, "transition": transition, "ts": str(ts),
	})

	if transition == "Exit":
		open_txn = frappe.get_all("Kharj Dispense Transaction",
			filters={"vehicle": vehicle, "status": ["in", ["Authorised", "Dispensing"]]},
			pluck="name")
		for name in open_txn:
			doc = frappe.get_doc("Kharj Dispense Transaction", name)
			doc.log("GEOFENCE_EXIT", "Vehicle left the station with the pump authorised", "GPS")
			doc.save(ignore_permissions=True)


@frappe.whitelist(allow_guest=True)
def vehicles_at_station(station=None):
	"""Who is on the forecourt right now — drives the console map."""
	rows = frappe.get_all("Kharj Fleet Vehicle",
		filters={"is_active": 1},
		fields=["name", "vehicle_no", "driver_name", "last_latitude", "last_longitude",
				"last_speed_kmph", "last_heading", "last_ping_at", "geofence_state"])
	now = now_datetime()
	for r in rows:
		age = (now - get_datetime(r.last_ping_at)).total_seconds() if r.last_ping_at else 9999
		r["fix_age_s"] = round(age)
		r["fix_stale"] = age > STALE_FIX_SECONDS
		if r.last_latitude:
			_, r["nearest_station"], d = classify(r.last_latitude, r.last_longitude)
			r["distance_m"] = round(d)
	return {"station": frappe.db.get_value("Kharj Station", {"is_active": 1},
				["name", "station_name", "latitude", "longitude", "geofence_radius_m"], as_dict=True),
			"vehicles": rows}


@frappe.whitelist(allow_guest=True)
def track(vehicle, from_time, to_time, max_points=500):
	"""Route replay for a vehicle — the trail drawn on the console map."""
	pings = frappe.get_all("Kharj GPS Ping",
		filters={"vehicle": vehicle, "ts": ["between", [from_time, to_time]]},
		fields=["ts", "latitude", "longitude", "speed_kmph", "geofence_event"],
		order_by="ts asc", limit=cint(max_points))

	distance = 0.0
	for a, b in zip(pings, pings[1:]):
		distance += haversine_m(a.latitude, a.longitude, b.latitude, b.longitude)

	moving = [p.speed_kmph for p in pings if flt(p.speed_kmph) > 3]
	return {
		"vehicle": vehicle, "points": pings,
		"distance_km": round(distance / 1000.0, 2),
		"avg_moving_kmph": round(sum(moving) / len(moving), 1) if moving else 0,
		"max_kmph": round(max([flt(p.speed_kmph) for p in pings] or [0]), 1),
		"stops": sum(1 for p in pings if p.geofence_event in ("Entry", "Exit")),
	}


@frappe.whitelist(allow_guest=True)
def dispense_positions(from_date, to_date):
	"""Every dispense plotted — the map an auditor asks for when litres look odd."""
	return frappe.get_all("Kharj Dispense Transaction",
		filters={"completed_at": ["between", [from_date, to_date]],
				 "status": ["in", ["Completed", "Reconciled"]]},
		fields=["name", "vehicle", "waybill", "dispensed_qty", "latitude", "longitude",
				"geofence_ok", "completed_at", "captured_offline"])


def prune_pings(keep_days=90):
	"""Positions are high-volume. Keep 90 days; dispense positions live on the
	transaction and are never pruned."""
	from frappe.utils import add_days
	cutoff = add_days(now_datetime(), -cint(keep_days))
	frappe.db.delete("Kharj GPS Ping", {"ts": ["<", cutoff]})
	frappe.db.commit()

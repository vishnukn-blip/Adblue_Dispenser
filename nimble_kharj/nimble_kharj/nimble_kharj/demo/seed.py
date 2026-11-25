# Copyright (c) 2026 Nimble Vision Technologies Pvt. Ltd.
"""Demo master data.

	bench --site <site> execute nimble_kharj.demo.seed.run
"""
import frappe
from frappe.utils import add_days, add_to_date, now_datetime

STATION = {
	"doctype": "Kharj Station", "station_code": "KHARJ-01",
	"station_name": "Almarai Kharj Fuel Station",
	"latitude": 24.155400, "longitude": 47.334600,
	"geofence_radius_m": 250, "sap_plant": "1000", "is_active": 1,
}

UNITS = [
	{"doctype": "Kharj Dispensing Unit", "unit_id": "ADB-DU-01", "station": "KHARJ-01",
	 "product": "AdBlue", "nozzle_count": 2, "firmware_version": "nv-kharj-1.4.2"},
	{"doctype": "Kharj Dispensing Unit", "unit_id": "DSL-DU-01", "station": "KHARJ-01",
	 "product": "Diesel", "nozzle_count": 4, "firmware_version": "nv-kharj-1.4.2"},
]

VEHICLES = [
	{"vehicle_no": "ALM-TRK-1041", "plate_no": "8412 KHA", "driver_name": "R. Fernandes",
	 "sap_equipment_no": "EQ-1041", "adblue_tank_capacity": 60,
	 "device": "356938035643809", "lat": 24.155100, "lng": 47.334200, "speed": 56},
	{"vehicle_no": "ALM-TRK-1082", "plate_no": "3927 RSH", "driver_name": "M. Haddad",
	 "sap_equipment_no": "EQ-1082", "adblue_tank_capacity": 60,
	 "device": "356938035643810", "lat": 24.211900, "lng": 47.401700, "speed": 48},
	{"vehicle_no": "ALM-TRK-1119", "plate_no": "6650 JDH", "driver_name": "S. Kurian",
	 "sap_equipment_no": "EQ-1119", "adblue_tank_capacity": 75,
	 "device": "356938035643811", "lat": 24.098300, "lng": 47.276500, "speed": 62},
]

# Waybill numbers as printed by aTOMS on the freight order
WAYBILLS = [
	{"waybill_no": "6101015888", "vehicle": "ALM-TRK-1041", "entitlement_qty": 60,
	 "route": "Kharj DC -> Riyadh North"},
	{"waybill_no": "6101015999", "vehicle": "ALM-TRK-1082", "entitlement_qty": 45,
	 "route": "Kharj DC -> Dammam"},
	{"waybill_no": "6101015777", "vehicle": "ALM-TRK-1119", "entitlement_qty": 75,
	 "route": "Kharj DC -> Jeddah"},
]


def run():
	if not frappe.db.exists("Kharj Station", "KHARJ-01"):
		frappe.get_doc(STATION).insert(ignore_permissions=True)

	for u in UNITS:
		if not frappe.db.exists("Kharj Dispensing Unit", u["unit_id"]):
			frappe.get_doc(u).insert(ignore_permissions=True)

	for v in VEHICLES:
		if not frappe.db.exists("Kharj Fleet Vehicle", v["vehicle_no"]):
			frappe.get_doc({
				"doctype": "Kharj Fleet Vehicle", "vehicle_no": v["vehicle_no"],
				"plate_no": v["plate_no"], "driver_name": v["driver_name"],
				"sap_equipment_no": v["sap_equipment_no"],
				"adblue_tank_capacity": v["adblue_tank_capacity"],
				"gps_device_id": v["device"], "gps_vendor": "NV50 Edge",
				"last_latitude": v["lat"], "last_longitude": v["lng"],
				"last_speed_kmph": v["speed"], "last_ping_at": now_datetime(),
			}).insert(ignore_permissions=True)

	for w in WAYBILLS:
		if frappe.db.exists("Kharj Waybill", w["waybill_no"]):
			continue
		frappe.get_doc({
			"doctype": "Kharj Waybill", "waybill_no": w["waybill_no"],
			"barcode_payload": w["waybill_no"],  # aTOMS prints the bare FO number
			"freight_order": w["waybill_no"], "vehicle": w["vehicle"],
			"station": "KHARJ-01", "product": "AdBlue",
			"entitlement_qty": w["entitlement_qty"], "route": w["route"],
			"valid_from": add_to_date(now_datetime(), hours=-6),
			"valid_to": add_days(now_datetime(), 2),
			"trip_start": add_to_date(now_datetime(), hours=-6),
		}).insert(ignore_permissions=True)

	frappe.db.commit()
	print("Seeded: 1 station, 2 dispensers, 3 vehicles, 3 waybills")

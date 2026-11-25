# Copyright (c) 2026 Nimble Vision Technologies Pvt. Ltd.
"""Drive a truck to the station over GPS, so the geofence fires for real.

	bench --site <site> execute nimble_kharj.demo.simulate_track.run \
		--kwargs "{'vehicle':'ALM-TRK-1082','steps':40}"

Run this in one terminal and simulate_dispense.run in another to see the
arrival, the entry event and the authorisation land in the same tape.
"""
import time

import frappe

from nimble_kharj.api import gps

STATION = (24.155400, 47.334600)


def run(vehicle="ALM-TRK-1082", steps=40, interval=0.4):
	start = frappe.db.get_value("Kharj Fleet Vehicle", vehicle,
		["last_latitude", "last_longitude"], as_dict=True)
	lat0, lng0 = start.last_latitude, start.last_longitude
	print(f"\n=== {vehicle}: {lat0:.5f}, {lng0:.5f} -> station ===")

	for i in range(1, steps + 1):
		f = i / steps
		lat = lat0 + (STATION[0] - lat0) * f
		lng = lng0 + (STATION[1] - lng0) * f
		speed = max(4, 62 * (1 - f) ** 0.6)
		res = gps.record_fix(vehicle=vehicle, latitude=lat, longitude=lng,
							 speed_kmph=round(speed, 1), heading=round(200 * f))
		if res.get("transition"):
			print(f"  >>> GEOFENCE {res['transition'].upper()} at {res['distance_m']} m")
		print(f"  {lat:.5f}, {lng:.5f}  {speed:5.1f} km/h  {res['distance_m']:6d} m  {res['geofence']}", end="\r")
		frappe.db.commit()
		time.sleep(interval)

	print("\n=== parked on the forecourt ===\n")
	return gps.vehicles_at_station()

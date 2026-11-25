#!/usr/bin/env python3
# Copyright (c) 2026 Nimble Vision Technologies Pvt. Ltd.
"""MQTT Ingestion Worker for AdBlue IoT Dispense Telemetry.

Listens to MQTT topic (default: adblue/iot/dispense), extracts:
  - vehicle_id
  - dispensed_liters
  - date_time
And records it into AdBlue IoT Dispense Log while triggering real-time UI updates.
"""

import json
import logging
import os
import signal
import sys
import time
from datetime import datetime

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("kharj_mqtt_worker")

try:
    import paho.mqtt.client as mqtt
except ImportError:
    logger.error("paho-mqtt is required. Run: pip install paho-mqtt")
    sys.exit(1)

# Configuration from Environment Variables
BROKER_HOST = os.getenv("MQTT_BROKER_HOST", "127.0.0.1")
BROKER_PORT = int(os.getenv("MQTT_BROKER_PORT", "1883"))
MQTT_TOPIC = os.getenv("MQTT_TOPIC", "adblue/iot/dispense")
MQTT_USERNAME = os.getenv("MQTT_USERNAME", "")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "")
SITE_NAME = os.getenv("FRAPPE_SITE", "site1.local")
FRAPPE_BASE_URL = os.getenv("FRAPPE_BASE_URL", "http://127.0.0.1:8000")

# Check if running inside Frappe environment
HAS_FRAPPE = False
try:
    import frappe
    HAS_FRAPPE = True
except ImportError:
    import urllib.request
    HAS_FRAPPE = False


def init_frappe_if_needed():
    """Initializes Frappe context if running within bench environment."""
    if HAS_FRAPPE:
        try:
            if not frappe.db:
                frappe.init(site=SITE_NAME)
                frappe.connect()
                logger.info(f"Connected to Frappe site: {SITE_NAME}")
        except Exception as e:
            logger.warning(f"Could not connect Frappe directly ({e}). Will use HTTP API.")


def save_dispense_record(vehicle_id, dispensed_liters, date_time):
    """Saves the record to Database and publishes real-time notification."""
    # Ensure date_time is formatted string
    if not date_time:
        date_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Method 1: Direct Frappe DB insert (Zero HTTP overhead)
    if HAS_FRAPPE and frappe.db:
        try:
            doc = frappe.get_doc({
                "doctype": "Kharj IoT Dispense Log",
                "vehicle_id": str(vehicle_id).strip(),
                "dispensed_liters": float(dispensed_liters),
                "date_time": str(date_time),
            }).insert(ignore_permissions=True)
            frappe.db.commit()

            payload = {
                "name": doc.name,
                "vehicle_id": doc.vehicle_id,
                "dispensed_liters": float(doc.dispensed_liters),
                "date_time": str(doc.date_time),
            }
            frappe.publish_realtime("kharj_iot_dispense", payload)
            logger.info(f"[DB SAVED] {doc.name}: Vehicle={doc.vehicle_id}, Liters={doc.dispensed_liters}L, Time={doc.date_time}")
            return True
        except Exception as e:
            logger.error(f"Frappe direct insert failed: {e}. Attempting fallback...")

    # Method 2: HTTP API Fallback
    try:
        url = f"{FRAPPE_BASE_URL}/api/method/nimble_kharj.api.telemetry.record_iot_dispense"
        body = json.dumps({
            "vehicle_id": str(vehicle_id).strip(),
            "dispensed_liters": float(dispensed_liters),
            "date_time": str(date_time),
        }).encode("utf-8")

        req = urllib.request.Request(
            url,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            if resp.status == 200:
                logger.info(f"[API SAVED] Vehicle={vehicle_id}, Liters={dispensed_liters}L, Time={date_time}")
                return True
            else:
                logger.error(f"API returned status {resp.status}")
                return False
    except Exception as ex:
        logger.error(f"Failed to save via API: {ex}")
        return False


def on_connect(client, userdata, flags, rc):
    """Callback triggered when connected to MQTT Broker."""
    if rc == 0:
        logger.info(f"Connected to Mosquitto Broker at {BROKER_HOST}:{BROKER_PORT}")
        client.subscribe(MQTT_TOPIC)
        logger.info(f"Subscribed to topic: {MQTT_TOPIC}")
    else:
        logger.error(f"Connection failed with code {rc}")


def on_message(client, userdata, msg):
    """Callback triggered when an IoT dispense payload is received."""
    try:
        raw_str = msg.payload.decode("utf-8")
        logger.info(f"Received payload on [{msg.topic}]: {raw_str}")
        data = json.loads(raw_str)

        # Extract only the 3 required fields
        vehicle_id = data.get("vehicle_id") or data.get("vehicle") or data.get("vehicleId")
        dispensed_liters = data.get("dispensed_liters") or data.get("liters") or data.get("dispensed_qty")
        date_time = data.get("date_time") or data.get("datetime") or data.get("timestamp")

        if not vehicle_id or dispensed_liters is None:
            logger.warning(f"Skipping invalid packet: missing vehicle_id or dispensed_liters in {data}")
            return

        success = save_dispense_record(vehicle_id, dispensed_liters, date_time)
        if success:
            reply_payload = json.dumps({
                "status": "saved to db",
                "result": "saved to db",
                "vehicle_id": str(vehicle_id).strip(),
                "dispensed_liters": float(dispensed_liters),
                "date_time": str(date_time or datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
                "message": f"Saved to db: vehicle {vehicle_id}, {dispensed_liters}L at {date_time}"
            })
            client.publish("adblue/iot/dispense/reply", reply_payload, qos=1)
            client.publish("adblue/iot/dispense/result", reply_payload, qos=1)
            logger.info(f"Published dispense confirmation reply: {reply_payload}")

    except json.JSONDecodeError:
        logger.error(f"Failed to parse JSON payload: {msg.payload}")
    except Exception as e:
        logger.exception(f"Unexpected error processing message: {e}")


def main():
    logger.info("Starting Kharj MQTT Ingestion Worker...")
    init_frappe_if_needed()

    try:
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="kharj_backend_worker", clean_session=True)
    except (AttributeError, TypeError):
        client = mqtt.Client(client_id="kharj_backend_worker", clean_session=True)

    if MQTT_USERNAME and MQTT_PASSWORD:
        client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

    client.on_connect = on_connect
    client.on_message = on_message

    def handle_exit(signum, frame):
        logger.info("Stopping worker gracefully...")
        client.disconnect()
        if HAS_FRAPPE and frappe.db:
            frappe.destroy()
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_exit)
    signal.signal(signal.SIGTERM, handle_exit)

    while True:
        try:
            logger.info(f"Connecting to MQTT broker at {BROKER_HOST}:{BROKER_PORT}...")
            client.connect(BROKER_HOST, BROKER_PORT, keepalive=60)
            client.loop_forever()
        except Exception as e:
            logger.warning(f"MQTT Broker connection lost: {e}. Retrying in 5 seconds...")
            time.sleep(5)


if __name__ == "__main__":
    main()


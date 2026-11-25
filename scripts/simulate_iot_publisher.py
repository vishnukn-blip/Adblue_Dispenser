#!/usr/bin/env python3
"""IoT Hardware Simulator for Nimble Kharj AdBlue Dispensing.

Supports two modes:
  1. Dispense mode  — sends dispensed liters to adblue/iot/dispense
  2. Validate mode  — sends vehicle_id to adblue/iot/validate and waits for reply

Usage:
  # Send a dispense event (authenticated):
  python scripts/simulate_iot_publisher.py --host 13.206.207.146 --vehicle KL11BV2662 --liters 50.0 --username adblue_iot --password adblue@2026

  # Validate a vehicle ID:
  python scripts/simulate_iot_publisher.py --host 13.206.207.146 --vehicle KL11BV2662 --validate --username adblue_iot --password adblue@2026
"""

import argparse
import json
import random
import time
from datetime import datetime

try:
    import paho.mqtt.client as mqtt
except ImportError:
    print("paho-mqtt library required. Install using: pip install paho-mqtt")
    exit(1)

SAMPLE_VEHICLES = [
    "ALM-TRK-1041",
    "ALM-TRK-1082",
    "ALM-TRK-5520",
    "KL11BV2662",
    "KL11AB1234ABCDEF",
]

TOPIC_DISPENSE       = "adblue/iot/dispense"
TOPIC_DISPENSE_REPLY = "adblue/iot/dispense/reply"
TOPIC_VALIDATE       = "adblue/iot/validate"
TOPIC_REPLY          = "adblue/iot/validate/reply"

validate_reply_received = {"data": None}
dispense_reply_received = {"data": None}


# ─── Callbacks ────────────────────────────────────────────────────────────────
def on_connect(client, userdata, flags, rc, properties=None):
    if rc == 0:
        client.subscribe(TOPIC_REPLY, qos=1)
        client.subscribe(TOPIC_DISPENSE_REPLY, qos=1)
        client.subscribe("adblue/iot/dispense/result", qos=1)
    else:
        print(f"❌ MQTT connection failed, rc={rc}")

def on_mqtt_message(client, userdata, msg):
    try:
        data = json.loads(msg.payload.decode())
        topic = msg.topic
        if topic == TOPIC_REPLY:
            validate_reply_received["data"] = data
            status = data.get("status", "unknown").upper()
            vid    = data.get("vehicle_id", "")
            icon   = "✅" if status == "VALID" else "❌"
            print(f"\n{icon} VALIDATE REPLY from server:")
            print(f"   Vehicle : {vid}")
            print(f"   Status  : {status}")
            print("-" * 50)
        elif topic in (TOPIC_DISPENSE_REPLY, "adblue/iot/dispense/result"):
            dispense_reply_received["data"] = data
            status = data.get("result") or data.get("status") or "saved to db"
            vid    = data.get("vehicle_id", "")
            liters = data.get("dispensed_liters", "")
            dt     = data.get("date_time", "")
            log_id = data.get("id", "")
            txn    = data.get("txn_id", "")
            disp   = data.get("dispenser_id", "")
            wb     = data.get("waybill_no", "")
            trl    = data.get("trailer_no", "")
            t_s    = data.get("totaliser_start", "")
            t_e    = data.get("totaliser_end", "")
            op     = data.get("operator", "")
            em     = data.get("entry_mode", "")
            sr     = data.get("stop_reason", "")
            ec     = data.get("error_code", "")

            print(f"\n✅ DISPENSE RESULT from server (Saved to DB - 13 Telemetry Fields):")
            print(f"   1. Status / DB ID : {status} (Record #{log_id})")
            print(f"   2. Transaction ID : {txn}")
            print(f"   3. Dispenser ID   : {disp}")
            print(f"   4. Vehicle ID     : {vid}")
            print(f"   5. Trailer No     : {trl}")
            print(f"   6. Waybill No     : {wb}")
            print(f"   7. Dispensed      : {liters} L")
            print(f"   8. Date & Time    : {dt} (IST)")
            print(f"   9. Totaliser Start: {t_s} L")
            print(f"  10. Totaliser End  : {t_e} L")
            print(f"  11. Operator       : {op}")
            print(f"  12. Entry Mode     : {em}")
            print(f"  13. Stop / Err     : {sr} (Error: {ec})")
            print("-" * 60)
    except Exception as e:
        print(f"❌ Error reading reply from [{msg.topic}]: {e}")


# ─── Actions ──────────────────────────────────────────────────────────────────
def send_validate(client, vehicle_id):
    validate_reply_received["data"] = None
    payload = json.dumps({"vehicle_id": vehicle_id})
    print(f"\n📡 Sending VALIDATE request...")
    print(f"   Vehicle  : {vehicle_id}")
    print(f"   Topic    : {TOPIC_VALIDATE}")
    print(f"   Payload  : {payload}")
    print("-" * 50)
    client.subscribe(TOPIC_REPLY, qos=1)
    client.publish(TOPIC_VALIDATE, payload, qos=1)
    # Wait up to 5 seconds for reply
    for _ in range(50):
        time.sleep(0.1)
        if validate_reply_received["data"] is not None:
            break
    else:
        print("⏱️  No reply received within 5 seconds. Check broker connection.")


def send_dispense(
    client,
    vehicle_id=None,
    liters=None,
    txn_id=None,
    dispenser_id=None,
    waybill_no=None,
    trailer_no=None,
    totaliser_start=None,
    totaliser_end=None,
    operator=None,
    entry_mode=None,
    stop_reason=None,
    error_code=None,
    wait_reply=True
):
    dispense_reply_received["data"] = None
    vehicle   = vehicle_id or random.choice(SAMPLE_VEHICLES)
    dispensed = liters if liters is not None else round(random.uniform(25.0, 75.0), 2)
    now_str   = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    tot_s = totaliser_start if totaliser_start is not None else 14820.5
    tot_e = totaliser_end if totaliser_end is not None else round(tot_s + dispensed, 2)

    payload = {
        "txn_id":           txn_id or f"TXN-{datetime.now().strftime('%Y%m%d')}-{random.randint(1000, 9999)}",
        "dispenser_id":     dispenser_id or "ADB-DU-01",
        "vehicle_id":       vehicle,
        "waybill_no":       waybill_no or f"WB-28082026{random.randint(1000, 9999)}",
        "trailer_no":       trailer_no or f"TR-{random.randint(1000, 9999)}",
        "dispensed_liters": dispensed,
        "date_time":        now_str,
        "totaliser_start":  tot_s,
        "totaliser_end":    tot_e,
        "operator":         operator or "Tarun Kumar",
        "entry_mode":       entry_mode or "AUTO_MQTT",
        "stop_reason":      stop_reason or "NOZZLE_STOWED",
        "error_code":       error_code or "NONE",
    }
    payload_json = json.dumps(payload)
    client.subscribe(TOPIC_DISPENSE_REPLY, qos=1)
    res = client.publish(TOPIC_DISPENSE, payload_json, qos=1)
    res.wait_for_publish()

    print(f"[{now_str}] 🚀 Published to [{TOPIC_DISPENSE}] (13 fields):")
    print(f"   Txn ID:    {payload['txn_id']}")
    print(f"   Dispenser: {payload['dispenser_id']}")
    print(f"   Vehicle:   {vehicle} | Trailer: {payload['trailer_no']}")
    print(f"   Waybill:   {payload['waybill_no']}")
    print(f"   Dispensed: {dispensed} L")
    print(f"   Totaliser: {tot_s} ➔ {tot_e} L")
    print(f"   Operator:  {payload['operator']} ({payload['entry_mode']})")
    print(f"   Date Time: {now_str}")
    print("⏳ Waiting for server confirmation (saved to DB)...")

    if wait_reply:
        for _ in range(50):
            time.sleep(0.1)
            if dispense_reply_received["data"] is not None:
                break
        else:
            print("⏱️  No dispense reply received within 5 seconds.")


# ─── Main ─────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Simulate IoT Dispenser MQTT messages.")
    parser.add_argument("--host",       default="127.0.0.1",         help="MQTT Broker host (e.g. 13.206.207.146)")
    parser.add_argument("--port",       type=int, default=1883,       help="MQTT Broker port (default: 1883)")
    parser.add_argument("--vehicle",    help="Vehicle ID or Barcode")
    parser.add_argument("--liters",     type=float,                   help="Dispensed liters (e.g. 50.0)")
    parser.add_argument("--txn",        help="Transaction ID (e.g. TXN-20261125-0001)")
    parser.add_argument("--dispenser",  default="ADB-DU-01",          help="Dispenser ID (default: ADB-DU-01)")
    parser.add_argument("--waybill",    help="Waybill number (e.g. WB-280820260001)")
    parser.add_argument("--trailer",    help="Trailer number (e.g. TR-9941)")
    parser.add_argument("--tot-start",  type=float,                   help="Totaliser start reading")
    parser.add_argument("--tot-end",    type=float,                   help="Totaliser end reading")
    parser.add_argument("--operator",   default="Tarun Kumar",        help="Operator name")
    parser.add_argument("--entry-mode", default="AUTO_MQTT",          help="Entry mode (e.g. AUTO_MQTT, RFID_SCAN)")
    parser.add_argument("--stop-reason", default="NOZZLE_STOWED",     help="Stop reason (e.g. NOZZLE_STOWED, PRESET_REACHED)")
    parser.add_argument("--error-code", default="NONE",               help="Error code (e.g. NONE, E00)")
    parser.add_argument("--username",   default="",                   help="MQTT username")
    parser.add_argument("--password",   default="",                   help="MQTT password")
    parser.add_argument("--validate",   action="store_true",          help="Send a validate request instead of dispense")
    parser.add_argument("--continuous", action="store_true",          help="Send dispense events in a loop")
    parser.add_argument("--interval",   type=int, default=5,          help="Interval in seconds for continuous mode")
    parser.add_argument("--clean-db",   action="store_true",          help="Clean all hardcoded/test logs from database via REST API")
    parser.add_argument("--api-port",   type=int, default=8001,       help="REST API port for cleaning database (default: 8001)")

    args = parser.parse_args()

    # Handle cleaning database if requested
    if args.clean_db:
        import urllib.request
        url = f"http://{args.host}:{args.api_port}/api/logs"
        print(f"🧹 Clearing all hardcoded records from DB at {url}...")
        try:
            req = urllib.request.Request(url, method="DELETE")
            with urllib.request.urlopen(req, timeout=10) as resp:
                res_body = resp.read().decode()
                print(f"✅ DB Cleaned: {res_body}")
        except Exception as ex:
            print(f"❌ Failed to clear DB: {ex}")
        return

    print("=" * 60)
    print(" Nimble Kharj - IoT MQTT Simulator")
    print(f" Broker: {args.host}:{args.port}")
    print(f" Mode  : {'VALIDATE' if args.validate else 'DISPENSE'}")
    print("=" * 60)

    # Initialize MQTT client
    try:
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="kharj_iot_simulator")
    except (AttributeError, TypeError):
        client = mqtt.Client(client_id="kharj_iot_simulator")

    # Set credentials if provided
    if args.username:
        client.username_pw_set(args.username, args.password)

    client.on_connect = on_connect
    client.on_message = on_mqtt_message

    try:
        client.connect(args.host, args.port, keepalive=60)
        client.loop_start()
        time.sleep(0.5)  # wait for connection
    except Exception as e:
        print(f"\n❌ Failed to connect to MQTT broker at {args.host}:{args.port}: {e}\n")
        if args.host in ("127.0.0.1", "localhost"):
            print("💡 Mosquitto is on AWS, not local PC.")
            print("   Use: --host 13.206.207.146 --username adblue_iot --password adblue@2026\n")
        return

    try:
        if args.validate:
            # Validate mode
            vehicle_id = args.vehicle
            if not vehicle_id:
                print("❌ --vehicle is required for validate mode")
                print("   Example: --vehicle KL11BV2662")
                return
            send_validate(client, vehicle_id)
            time.sleep(1)

        elif args.continuous:
            # Continuous dispense mode
            print(f"Running in continuous mode (every {args.interval}s). Press Ctrl+C to stop.\n")
            while True:
                send_dispense(
                    client=client,
                    vehicle_id=args.vehicle,
                    liters=args.liters,
                    txn_id=args.txn,
                    dispenser_id=args.dispenser,
                    waybill_no=args.waybill,
                    trailer_no=args.trailer,
                    totaliser_start=args.tot_start,
                    totaliser_end=args.tot_end,
                    operator=args.operator,
                    entry_mode=args.entry_mode,
                    stop_reason=args.stop_reason,
                    error_code=args.error_code,
                )
                time.sleep(args.interval)

        else:
            # Single dispense
            send_dispense(
                client=client,
                vehicle_id=args.vehicle,
                liters=args.liters,
                txn_id=args.txn,
                dispenser_id=args.dispenser,
                waybill_no=args.waybill,
                trailer_no=args.trailer,
                totaliser_start=args.tot_start,
                totaliser_end=args.tot_end,
                operator=args.operator,
                entry_mode=args.entry_mode,
                stop_reason=args.stop_reason,
                error_code=args.error_code,
            )
            time.sleep(1)

    except KeyboardInterrupt:
        print("\nStopping simulator.")
    finally:
        client.loop_stop()
        client.disconnect()


if __name__ == "__main__":
    main()

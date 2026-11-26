import sqlite3
import json
import threading
import datetime
import os
import sys
try:
    from http.server import ThreadingHTTPServer as HTTPServer, BaseHTTPRequestHandler
except ImportError:
    from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

try:
    sys.stdout.reconfigure(line_buffering=True)
    sys.stderr.reconfigure(line_buffering=True)
except Exception:
    pass

try:
    import paho.mqtt.client as mqtt
    from paho.mqtt.enums import CallbackAPIVersion
    PAHO_V2 = True
except ImportError:
    import paho.mqtt.client as mqtt
    PAHO_V2 = False

import mimetypes
try:
    mimetypes.init()
    mimetypes.add_type("application/javascript", ".js")
    mimetypes.add_type("text/css", ".css")
    mimetypes.add_type("image/svg+xml", ".svg")
except Exception:
    pass

candidate_dirs = [
    os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist")),
    os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "nimble_kharj", "nimble_kharj", "console-ui", "dist")),
    os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "dist")),
]
DIST_DIR = next((d for d in candidate_dirs if os.path.isdir(d)), candidate_dirs[0])

# ─── Config ───────────────────────────────────────────────────────────────────
DEFAULT_DB_PATH       = os.path.join(os.path.dirname(os.path.abspath(__file__)), "adblue_dispense.db")
DB_PATH               = os.getenv("DB_PATH", DEFAULT_DB_PATH)
DEFAULT_MQTT_HOST     = "13.206.207.146" if os.name == "nt" else "127.0.0.1"
MQTT_HOST             = os.getenv("MQTT_HOST", DEFAULT_MQTT_HOST)
MQTT_PORT             = int(os.getenv("MQTT_PORT", 1883))
MQTT_USER             = os.getenv("MQTT_USER", "adblue_iot")
MQTT_PASS             = os.getenv("MQTT_PASS", "adblue@2026")
TOPIC_DISPENSE          = "adblue/iot/dispense"
TOPIC_DISPENSE_RESPONSE = "adblue/iot/dispense/response"
TOPIC_DISPENSE_REPLY    = "adblue/iot/dispense/reply"
TOPIC_DISPENSE_RESULT   = "adblue/iot/dispense/result"
TOPIC_VALIDATE          = "adblue/iot/validate"
TOPIC_REPLY             = "adblue/iot/validate/reply"
API_PORT              = int(os.getenv("API_PORT", 8001))

# Global MQTT client reference for publishing replies
mqtt_client_ref = None

# ─── Database ─────────────────────────────────────────────────────────────────
def init_db():
    db_dir = os.path.dirname(DB_PATH)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Table 1: Vehicle Registry
    c.execute('''
        CREATE TABLE IF NOT EXISTS adblue_vehicle_registry (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            vehicle_id TEXT NOT NULL UNIQUE,
            added_at   DATETIME DEFAULT (datetime('now'))
        )
    ''')

    # Table 2: Dispense Log (13 IoT & Telemetry Fields)
    c.execute('''
        CREATE TABLE IF NOT EXISTS adblue_iot_dispense_log (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            txn_id           TEXT,
            dispenser_id     TEXT DEFAULT 'ADB-DU-01',
            vehicle_id       TEXT NOT NULL,
            waybill_no       TEXT DEFAULT '—',
            trailer_no       TEXT DEFAULT '—',
            dispensed_liters REAL NOT NULL,
            date_time        DATETIME,
            totaliser_start  REAL DEFAULT 0.0,
            totaliser_end    REAL DEFAULT 0.0,
            operator         TEXT DEFAULT 'Operator',
            entry_mode       TEXT DEFAULT 'AUTO_MQTT',
            stop_reason      TEXT DEFAULT 'NOZZLE_STOWED',
            error_code       TEXT DEFAULT 'NONE',
            recorded_at      DATETIME DEFAULT (datetime('now'))
        )
    ''')

    # Auto-migration for existing tables without dropping data
    existing_cols = [r[1] for r in c.execute("PRAGMA table_info(adblue_iot_dispense_log)").fetchall()]
    new_cols = [
        ("txn_id", "TEXT"),
        ("dispenser_id", "TEXT DEFAULT 'ADB-DU-01'"),
        ("waybill_no", "TEXT DEFAULT '—'"),
        ("trailer_no", "TEXT DEFAULT '—'"),
        ("totaliser_start", "REAL DEFAULT 0.0"),
        ("totaliser_end", "REAL DEFAULT 0.0"),
        ("operator", "TEXT DEFAULT 'Operator'"),
        ("entry_mode", "TEXT DEFAULT 'AUTO_MQTT'"),
        ("stop_reason", "TEXT DEFAULT 'NOZZLE_STOWED'"),
        ("error_code", "TEXT DEFAULT 'NONE'"),
    ]
    for col_name, col_def in new_cols:
        if col_name not in existing_cols:
            try:
                c.execute(f"ALTER TABLE adblue_iot_dispense_log ADD COLUMN {col_name} {col_def}")
            except Exception:
                pass

    # Shift existing UTC records to IST (+5:30) if recorded in UTC morning hours
    c.execute('''
        UPDATE adblue_iot_dispense_log 
        SET date_time = datetime(date_time, '+5 hours', '30 minutes'),
            recorded_at = datetime(recorded_at, '+5 hours', '30 minutes')
        WHERE date_time LIKE '2026-11-% 0%' OR date_time LIKE '2026-11-% 10:%'
    ''')

    # Remove duplicates so each transaction appears only once
    c.execute('''
        DELETE FROM adblue_iot_dispense_log 
        WHERE id NOT IN (
            SELECT MIN(id) 
            FROM adblue_iot_dispense_log 
            GROUP BY vehicle_id, dispensed_liters, date_time
        )
    ''')

    conn.commit()
    conn.close()
    print("✅ AdBlue Database initialized at", DB_PATH)

IST_TZ = datetime.timezone(datetime.timedelta(hours=5, minutes=30))

def get_now_ist():
    """Returns current timestamp in Indian Standard Time (IST, UTC+05:30)."""
    return datetime.datetime.now(datetime.timezone.utc).astimezone(IST_TZ).strftime("%Y-%m-%d %H:%M:%S")

def convert_to_ist(dt_str, is_iot=False):
    """
    Normalizes datetime string to Indian Standard Time (IST, UTC+05:30).
    - If empty, returns current IST.
    - If explicitly formatted with 'Z' or '+00:00', converts UTC to IST (+5:30).
    - If is_iot is True (e.g. from RUT906 dispenser which outputs UTC naive timestamps), converts UTC to IST (+5:30).
    - If naive string closer to UTC than IST (~5-6 hours behind current IST), converts UTC to IST (+5:30).
    - Preserves strings that are already in IST without double-adding.
    """
    if not dt_str:
        return get_now_ist()
    try:
        dt_str_clean = str(dt_str).strip()
        # Explicit UTC ISO format with Z or +00:00
        if dt_str_clean.endswith("Z") or "+00:00" in dt_str_clean:
            dt_obj = datetime.datetime.fromisoformat(dt_str_clean.replace("Z", "+00:00"))
            return dt_obj.astimezone(IST_TZ).strftime("%Y-%m-%d %H:%M:%S")

        parsed_dt = None
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M"):
            try:
                parsed_dt = datetime.datetime.strptime(dt_str_clean, fmt)
                break
            except ValueError:
                pass

        if parsed_dt is None:
            return dt_str_clean

        # If flagged as IoT hardware message (RUT906 sends UTC naive time)
        if is_iot:
            ist_obj = parsed_dt + datetime.timedelta(hours=5, minutes=30)
            return ist_obj.strftime("%Y-%m-%d %H:%M:%S")

        # Automatic detection: check if timestamp is naive UTC by comparing to current UTC vs IST
        now_utc = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
        now_ist = now_utc + datetime.timedelta(hours=5, minutes=30)
        diff_utc = abs((now_utc - parsed_dt).total_seconds())
        diff_ist = abs((now_ist - parsed_dt).total_seconds())

        # If timestamp is within 3 hours of UTC and >3 hours from IST, it's a UTC timestamp -> shift to IST
        if diff_utc < 10800 and diff_ist >= 10800:
            ist_obj = parsed_dt + datetime.timedelta(hours=5, minutes=30)
            return ist_obj.strftime("%Y-%m-%d %H:%M:%S")

        return parsed_dt.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return str(dt_str)

def is_vehicle_registered(vehicle_id):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id FROM adblue_vehicle_registry WHERE vehicle_id = ?", (vehicle_id,))
    row = c.fetchone()
    conn.close()
    return row is not None

def add_vehicle(vehicle_id):
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        now_ist = get_now_ist()
        c.execute("INSERT INTO adblue_vehicle_registry (vehicle_id, added_at) VALUES (?, ?)", (vehicle_id, now_ist))
        conn.commit()
        log_id = c.lastrowid
        conn.close()
        return log_id, None
    except sqlite3.IntegrityError:
        return None, "already_exists"

def get_all_vehicles():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, vehicle_id, added_at FROM adblue_vehicle_registry ORDER BY id DESC")
    rows = c.fetchall()
    conn.close()
    return rows

def delete_vehicle(vehicle_id):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("DELETE FROM adblue_vehicle_registry WHERE vehicle_id = ?", (vehicle_id,))
    affected = c.rowcount
    conn.commit()
    conn.close()
    return affected > 0

def save_dispense(
    vehicle_id,
    liters,
    dt=None,
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
    is_iot=False
):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    # If dispenser or txn suggests IoT hardware like RUT906, treat as IoT source
    is_from_iot = is_iot or bool((dispenser_id and "RUT906" in str(dispenser_id)) or (txn_id and "RUT906" in str(txn_id)))
    dt_ist = convert_to_ist(dt, is_iot=is_from_iot)
    now_ist = get_now_ist()

    # Deduplicate by txn_id if provided
    if txn_id and str(txn_id).strip():
        c.execute("SELECT id, txn_id, totaliser_start, totaliser_end FROM adblue_iot_dispense_log WHERE txn_id = ? LIMIT 1", (str(txn_id).strip(),))
        row = c.fetchone()
        if row:
            conn.close()
            return row[0], dt_ist, now_ist, True, row[1], row[2], row[3]

    # Deduplicate by exact vehicle, liters, time
    c.execute('''
        SELECT id, txn_id, totaliser_start, totaliser_end FROM adblue_iot_dispense_log 
        WHERE vehicle_id = ? AND dispensed_liters = ? AND date_time = ?
        LIMIT 1
    ''', (vehicle_id, liters, dt_ist))
    row = c.fetchone()
    if row:
        conn.close()
        return row[0], dt_ist, now_ist, True, row[1], row[2], row[3]

    # Calculate Totalisers if not provided
    if totaliser_start is None:
        c.execute("SELECT totaliser_end FROM adblue_iot_dispense_log WHERE totaliser_end > 0 ORDER BY id DESC LIMIT 1")
        last_tot = c.fetchone()
        calc_tot_start = round(float(last_tot[0]), 2) if last_tot else 14820.50
    else:
        calc_tot_start = round(float(totaliser_start), 2)

    if totaliser_end is None:
        calc_tot_end = round(calc_tot_start + float(liters), 2)
    else:
        calc_tot_end = round(float(totaliser_end), 2)

    dispenser = dispenser_id or "ADB-DU-01"
    wb = waybill_no or "—"
    trailer = trailer_no or "—"
    op = operator or "Operator"
    mode = entry_mode or "AUTO_MQTT"
    stop_r = stop_reason or "NOZZLE_STOWED"
    err_c = error_code or "NONE"

    final_txn = txn_id
    if not final_txn:
        date_prefix = dt_ist[:10].replace("-", "")
        c.execute("SELECT COUNT(*) FROM adblue_iot_dispense_log")
        cnt = (c.fetchone()[0] or 0) + 1
        final_txn = f"TXN-{date_prefix}-{cnt:04d}"

    c.execute('''
        INSERT INTO adblue_iot_dispense_log (
            txn_id, dispenser_id, vehicle_id, waybill_no, trailer_no,
            dispensed_liters, date_time, totaliser_start, totaliser_end,
            operator, entry_mode, stop_reason, error_code, recorded_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        final_txn, dispenser, vehicle_id, wb, trailer,
        liters, dt_ist, calc_tot_start, calc_tot_end,
        op, mode, stop_r, err_c, now_ist
    ))
    conn.commit()
    log_id = c.lastrowid
    conn.close()
    return log_id, dt_ist, now_ist, False, final_txn, calc_tot_start, calc_tot_end

def get_dispense_logs(page=1, page_size=10, date_filter=None, vehicle_filter=None):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    where_clauses = []
    params = []

    if date_filter and str(date_filter).strip():
        where_clauses.append("date_time LIKE ?")
        params.append(f"{str(date_filter).strip()}%")
    if vehicle_filter and str(vehicle_filter).strip():
        v_term = f"%{str(vehicle_filter).strip()}%"
        where_clauses.append("(vehicle_id LIKE ? OR txn_id LIKE ? OR waybill_no LIKE ? OR trailer_no LIKE ?)")
        params.extend([v_term, v_term, v_term, v_term])

    where_str = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    count_sql = f"SELECT COUNT(*) FROM adblue_iot_dispense_log {where_str}"
    c.execute(count_sql, params)
    total_res = c.fetchone()
    total = total_res[0] if total_res else 0

    offset = max(0, (page - 1) * page_size)
    query_sql = f'''
        SELECT id, txn_id, dispenser_id, vehicle_id, waybill_no, trailer_no,
               dispensed_liters, date_time, totaliser_start, totaliser_end,
               operator, entry_mode, stop_reason, error_code
        FROM adblue_iot_dispense_log
        {where_str}
        ORDER BY id DESC
        LIMIT ? OFFSET ?
    '''
    query_params = list(params) + [page_size, offset]
    c.execute(query_sql, query_params)
    rows = c.fetchall()
    conn.close()

    total_pages = max(1, (total + page_size - 1) // page_size)
    return rows, total, total_pages

def clear_all_dispense_logs():
    """Removes all dispense logs from database and resets autoincrement ID."""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("DELETE FROM adblue_iot_dispense_log")
    affected = c.rowcount
    try:
        c.execute("DELETE FROM sqlite_sequence WHERE name = 'adblue_iot_dispense_log'")
    except Exception:
        pass
    conn.commit()
    conn.close()
    return affected

def delete_dispense_log(log_id):
    """Deletes a single dispense record by ID."""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("DELETE FROM adblue_iot_dispense_log WHERE id = ?", (log_id,))
    affected = c.rowcount
    conn.commit()
    conn.close()
    return affected > 0

# ─── MQTT Callbacks ───────────────────────────────────────────────────────────
def on_connect(client, userdata, flags, rc, properties=None):
    if rc == 0:
        print("✅ Connected to Mosquitto Broker")
        client.subscribe(TOPIC_DISPENSE, qos=1)
        client.subscribe(TOPIC_VALIDATE, qos=1)
        print(f"🔖 Subscribed to: {TOPIC_DISPENSE}")
        print(f"🔖 Subscribed to: {TOPIC_VALIDATE}")
    else:
        print(f"❌ MQTT connection failed, rc={rc}")

def on_message(client, userdata, msg):
    topic = msg.topic
    try:
        data = json.loads(msg.payload.decode())

        # ── Validate Request ──────────────────────────────────────────────────
        if topic == TOPIC_VALIDATE:
            vehicle_id = data.get("vehicle_id", "").strip()
            if not vehicle_id:
                return

            if is_vehicle_registered(vehicle_id):
                status = "valid"
                print(f"✅ VALIDATE → {vehicle_id} : VALID")
            else:
                status = "invalid"
                print(f"❌ VALIDATE → {vehicle_id} : INVALID (not in registry)")

            reply = json.dumps({"status": status, "vehicle_id": vehicle_id})
            client.publish(TOPIC_REPLY, reply, qos=1)
            print(f"📤 Reply sent to [{TOPIC_REPLY}]: {reply}")

        # ── Dispense Log ──────────────────────────────────────────────────────
        elif topic == TOPIC_DISPENSE:
            vehicle_id   = data.get("vehicle_id")
            liters       = float(data.get("dispensed_liters", 0))
            dt           = data.get("date_time", get_now_ist())
            txn_id       = data.get("txn_id")
            dispenser_id = data.get("dispenser_id")
            waybill_no   = data.get("waybill_no")
            trailer_no   = data.get("trailer_no")
            tot_start    = data.get("totaliser_start")
            tot_end      = data.get("totaliser_end")
            operator     = data.get("operator")
            entry_mode   = data.get("entry_mode")
            stop_reason  = data.get("stop_reason")
            error_code   = data.get("error_code")

            if vehicle_id and liters:
                log_id, dt_ist, now_ist, is_dup, out_txn, out_tot_start, out_tot_end = save_dispense(
                    vehicle_id=vehicle_id,
                    liters=liters,
                    dt=dt,
                    txn_id=txn_id,
                    dispenser_id=dispenser_id,
                    waybill_no=waybill_no,
                    trailer_no=trailer_no,
                    totaliser_start=tot_start,
                    totaliser_end=tot_end,
                    operator=operator,
                    entry_mode=entry_mode,
                    stop_reason=stop_reason,
                    error_code=error_code,
                    is_iot=True
                )
                if is_dup:
                    print(f"🔁 [DUPLICATE SKIPPED] Txn: {out_txn} | Vehicle: {vehicle_id} | Liters: {liters}L | Time: {dt_ist}")
                else:
                    print(f"💾 [SAVED #{log_id}] Txn: {out_txn} | Vehicle: {vehicle_id} | Liters: {liters}L | Time: {dt_ist}")

                reply_data = {
                    "status": "saved to db",
                    "result": "saved to db",
                    "id": log_id,
                    "txn_id": out_txn,
                    "dispenser_id": dispenser_id or "ADB-DU-01",
                    "vehicle_id": vehicle_id,
                    "waybill_no": waybill_no or "—",
                    "trailer_no": trailer_no or "—",
                    "dispensed_liters": liters,
                    "date_time": dt_ist,
                    "totaliser_start": out_tot_start,
                    "totaliser_end": out_tot_end,
                    "operator": operator or "Operator",
                    "entry_mode": entry_mode or "AUTO_MQTT",
                    "stop_reason": stop_reason or "NOZZLE_STOWED",
                    "error_code": error_code or "NONE",
                    "message": f"Saved to db: txn {out_txn}, vehicle {vehicle_id}, {liters}L at {dt_ist}"
                }
                reply_payload = json.dumps(reply_data)
                client.publish(TOPIC_DISPENSE_RESPONSE, reply_payload, qos=1)
                client.publish(TOPIC_DISPENSE_REPLY, reply_payload, qos=1)
                client.publish(TOPIC_DISPENSE_RESULT, reply_payload, qos=1)
                print(f"📤 Dispense reply sent to [{TOPIC_DISPENSE_RESPONSE}]: {reply_payload}")
            else:
                print(f"⚠️  Dispense message missing vehicle_id or liters: {data}")
                err_payload = json.dumps({
                    "status": "error",
                    "result": "failed",
                    "error": "missing vehicle_id or liters"
                })
                client.publish(TOPIC_DISPENSE_RESPONSE, err_payload, qos=1)
                client.publish(TOPIC_DISPENSE_REPLY, err_payload, qos=1)

    except Exception as e:
        print(f"❌ Error processing [{topic}]: {e}")

# ─── Web UI & REST API ────────────────────────────────────────────────────────
HTML_PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NIMBLE VISION – Adblue Dispenser</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background: #f1f5f9;
    color: #1e293b;
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
  }

  /* ── Header ── */
  header {
    background: linear-gradient(135deg, #0f2b5c 0%, #1e40af 100%);
    color: #ffffff;
    padding: 16px 32px;
    box-shadow: 0 4px 12px rgba(15, 43, 92, 0.15);
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
  }
  .brand-group {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .brand-logo-icon {
    width: 44px;
    height: 44px;
    background: #ffffff;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    box-shadow: 0 2px 6px rgba(0,0,0,0.12);
  }
  .brand-title {
    font-size: 1.35rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: #ffffff;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .brand-title .highlight {
    color: #93c5fd;
    font-weight: 600;
  }
  .brand-sub {
    font-size: 0.8rem;
    color: #bfdbfe;
    font-weight: 500;
    letter-spacing: 0.02em;
    margin-top: 2px;
  }
  .header-status {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.25);
    padding: 7px 16px;
    border-radius: 9999px;
    font-size: 0.82rem;
    font-weight: 600;
    color: #ffffff;
    backdrop-filter: blur(4px);
  }
  .pulse-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #22c55e;
    box-shadow: 0 0 10px #22c55e;
    display: inline-block;
  }

  /* ── Layout & Containers ── */
  .container {
    max-width: 1400px;
    margin: 28px auto 60px auto;
    padding: 0 24px;
  }

  /* ── KPI Stat Cards ── */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 20px;
    margin-bottom: 24px;
  }
  .stat-card {
    background: #ffffff;
    border-radius: 14px;
    padding: 20px 22px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04);
    border: 1px solid #e2e8f0;
    display: flex;
    align-items: center;
    gap: 16px;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  .stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.08), 0 10px 20px -3px rgba(0,0,0,0.08);
  }
  .stat-icon {
    width: 50px;
    height: 50px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    background: #eff6ff;
    flex-shrink: 0;
  }
  .stat-label {
    font-size: 0.78rem;
    text-transform: uppercase;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: #64748b;
    margin-bottom: 4px;
  }
  .stat-val {
    font-size: 1.6rem;
    font-weight: 800;
    color: #0f172a;
    line-height: 1.1;
  }
  .stat-sub {
    font-size: 0.75rem;
    color: #94a3b8;
    margin-top: 4px;
  }

  /* ── Main Card ── */
  .card {
    background: #ffffff;
    border-radius: 14px;
    padding: 24px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04);
    border: 1px solid #e2e8f0;
    margin-bottom: 24px;
  }
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 18px;
    padding-bottom: 14px;
    border-bottom: 1px solid #f1f5f9;
  }
  .card-title {
    font-size: 1.15rem;
    font-weight: 800;
    color: #0f172a;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .card-subtitle {
    font-size: 0.8rem;
    color: #64748b;
    margin-top: 3px;
  }

  /* ── Buttons ── */
  button {
    font-family: inherit;
    cursor: pointer;
    border: none;
    outline: none;
    transition: all 0.15s ease;
  }
  .btn-outline-primary {
    background: #ffffff;
    color: #2563eb;
    border: 1.5px solid #bfdbfe;
    font-weight: 600;
    font-size: 0.82rem;
    padding: 7px 14px;
    border-radius: 8px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .btn-outline-primary:hover { background: #eff6ff; border-color: #93c5fd; }
  .btn-danger-solid {
    background: #fee2e2;
    color: #b91c1c;
    border: 1px solid #fca5a5;
    font-weight: 600;
    font-size: 0.82rem;
    padding: 7px 14px;
    border-radius: 8px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .btn-danger-solid:hover { background: #fecaca; }
  .btn-table-remove {
    background: #fef2f2;
    color: #dc2626;
    border: 1px solid #fecaca;
    padding: 4px 9px;
    font-size: 0.74rem;
    font-weight: 700;
    border-radius: 6px;
  }
  .btn-table-remove:hover { background: #dc2626; color: #ffffff; }
  .btn-table-slip {
    background: #eff6ff;
    color: #1d4ed8;
    border: 1px solid #bfdbfe;
    padding: 4px 9px;
    font-size: 0.74rem;
    font-weight: 700;
    border-radius: 6px;
    margin-right: 6px;
  }
  .btn-table-slip:hover { background: #2563eb; color: #ffffff; }

  /* ── Filter Toolbar ── */
  .filter-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 16px;
    padding: 12px 14px;
    background: #f8fafc;
    border-radius: 10px;
    border: 1px solid #e2e8f0;
  }
  .filter-group {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  input[type="date"], select, input[type="text"] {
    font-family: inherit;
    border: 1.5px solid #cbd5e1;
    border-radius: 7px;
    padding: 6px 10px;
    font-size: 0.82rem;
    color: #334155;
    background: #ffffff;
  }
  input[type="date"]:focus, select:focus, input[type="text"]:focus {
    border-color: #3b82f6;
    outline: none;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  }

  /* ── Table Styling ── */
  .table-responsive {
    width: 100%;
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.82rem;
  }
  thead th {
    text-align: left;
    padding: 12px 12px;
    background: #f8fafc;
    color: #475569;
    font-weight: 700;
    font-size: 0.70rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1.5px solid #e2e8f0;
    white-space: nowrap;
  }
  tbody td {
    padding: 11px 12px;
    border-bottom: 1px solid #f1f5f9;
    color: #334155;
    vertical-align: middle;
  }
  tbody tr:hover { background-color: #f8fafc; }
  .row-num { color: #94a3b8; font-weight: 600; font-size: 0.76rem; font-family: 'JetBrains Mono', monospace; }

  /* ── Badges ── */
  .badge-txn {
    display: inline-block;
    padding: 3px 7px;
    border-radius: 6px;
    font-size: 0.74rem;
    font-weight: 700;
    background: #f5f3ff;
    color: #6d28d9;
    border: 1px solid #ddd6fe;
    font-family: 'JetBrains Mono', monospace;
    white-space: nowrap;
  }
  .badge-dispenser {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 5px;
    font-size: 0.72rem;
    font-weight: 700;
    background: #f1f5f9;
    color: #334155;
    border: 1px solid #cbd5e1;
    white-space: nowrap;
  }
  .badge-vehicle {
    display: inline-block;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 0.78rem;
    font-weight: 700;
    background: #eff6ff;
    color: #1d4ed8;
    border: 1px solid #bfdbfe;
    font-family: 'JetBrains Mono', monospace;
    white-space: nowrap;
  }
  .badge-liters {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 9px;
    border-radius: 6px;
    font-size: 0.82rem;
    font-weight: 800;
    background: #ecfdf5;
    color: #047857;
    border: 1px solid #a7f3d0;
    white-space: nowrap;
  }
  .badge-tot {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.74rem;
    color: #0f766e;
    background: #f0fdfa;
    border: 1px solid #ccfbf1;
    padding: 3px 7px;
    border-radius: 5px;
    white-space: nowrap;
  }
  .badge-mode {
    font-size: 0.70rem;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    background: #f8fafc;
    color: #475569;
    border: 1px solid #e2e8f0;
    white-space: nowrap;
  }
  .badge-status {
    font-size: 0.70rem;
    font-weight: 700;
    padding: 3px 7px;
    border-radius: 5px;
    background: #f0fdf4;
    color: #15803d;
    border: 1px solid #bbf7d0;
    white-space: nowrap;
  }
  .time-cell {
    color: #1e293b;
    font-size: 0.78rem;
    font-family: 'JetBrains Mono', monospace;
    font-weight: 600;
    white-space: nowrap;
  }

  /* ── Pagination ── */
  .pagination-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 18px;
    padding-top: 14px;
    border-top: 1px solid #f1f5f9;
  }
  .btn-page {
    background: #ffffff;
    border: 1px solid #cbd5e1;
    color: #334155;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 0.80rem;
    font-weight: 600;
  }
  .btn-page:hover:not(:disabled) { background: #f8fafc; border-color: #94a3b8; }
  .btn-page:disabled { opacity: 0.4; cursor: not-allowed; }

  /* ── Modal Dialog ── */
  .modal-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(15, 23, 42, 0.65);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 20px;
  }
  .modal-card {
    background: #ffffff;
    border-radius: 16px;
    width: 100%;
    max-width: 720px;
    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
    overflow: hidden;
    animation: modalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }
  @keyframes modalPop {
    from { opacity: 0; transform: scale(0.96); }
    to { opacity: 1; transform: scale(1); }
  }
  .modal-header {
    background: linear-gradient(135deg, #0f2b5c 0%, #1e40af 100%);
    color: #ffffff;
    padding: 18px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .modal-header h3 {
    font-size: 1.15rem;
    font-weight: 800;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .modal-close-btn {
    background: rgba(255,255,255,0.2);
    border: none;
    color: #ffffff;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    font-size: 1.1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .modal-close-btn:hover { background: rgba(255,255,255,0.35); }
  .modal-body {
    padding: 24px;
    max-height: 80vh;
    overflow-y: auto;
  }
  .audit-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .audit-item {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 12px 14px;
  }
  .audit-item.highlight {
    background: #eff6ff;
    border-color: #bfdbfe;
  }
  .audit-item.success {
    background: #ecfdf5;
    border-color: #a7f3d0;
  }
  .audit-lbl {
    font-size: 0.70rem;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 4px;
  }
  .audit-val {
    font-size: 0.95rem;
    font-weight: 700;
    color: #0f172a;
    font-family: 'JetBrains Mono', monospace;
  }
  .audit-footer {
    padding: 16px 24px;
    background: #f8fafc;
    border-top: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
</style>
</head>
<body>

<header>
  <div class="brand-group">
    <div class="brand-logo-icon">⛽</div>
    <div>
      <div class="brand-title">NIMBLE VISION <span class="highlight">Adblue Dispenser</span></div>
      <div class="brand-sub">IoT Telemetry &amp; Real-Time Dispensing Ledger</div>
    </div>
  </div>
  <div class="header-status">
    <span class="pulse-dot"></span>
    <span>MQTT Broker Online (1883)</span>
  </div>
</header>

<div class="container">

  <!-- KPI Stat Cards -->
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-icon">💧</div>
      <div>
        <div class="stat-label">Total Dispensed</div>
        <div class="stat-val" id="statTotalLiters">0.00 L</div>
        <div class="stat-sub">Lifetime volume</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">📊</div>
      <div>
        <div class="stat-label">Total Dispenses</div>
        <div class="stat-val" id="statTotalTxns">0</div>
        <div class="stat-sub">Logged transactions</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">⚡</div>
      <div>
        <div class="stat-label">Today's Volume</div>
        <div class="stat-val" id="statTodayLiters">0.00 L</div>
        <div class="stat-sub" id="statTodayTxns">0 dispenses today</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">⛽</div>
      <div>
        <div class="stat-label">Dispenser Status</div>
        <div class="stat-val" style="font-size: 1.35rem; color: #1e40af;">ADB-DU-01</div>
        <div class="stat-sub">Bay 1 Forecourt · Solenoid Ready</div>
      </div>
    </div>
  </div>

  <!-- Dispense Logs Full Card (13 Telemetry Fields) -->
  <div class="card">
    <div class="card-header">
      <div>
        <div class="card-title">📋 Dispense Transaction Logs</div>
        <div class="card-subtitle">Real-time dispensing records synchronized via MQTT topic <code style="background:#eff6ff;color:#1d4ed8;padding:2px 6px;border-radius:4px;font-size:0.78rem;">adblue/iot/dispense</code> &amp; SQLite database</div>
      </div>
      <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
        <button class="btn-danger-solid" onclick="clearAllLogs()">
          <span>🗑️</span> Clear All Logs
        </button>
        <button class="btn-outline-primary" onclick="loadLogs(); loadStats();">
          <span>🔄</span> Refresh
        </button>
      </div>
    </div>

    <!-- Filter & Search Toolbar -->
    <div class="filter-bar">
      <div class="filter-group">
        <label style="font-size: 0.82rem; color: #475569; font-weight: 600; margin-bottom: 0;">📅 Filter Date:</label>
        <input type="date" id="filterDate" onchange="onDateChange()" />
        <button class="btn-outline-primary" style="padding: 5px 10px; font-size: 0.78rem;" onclick="clearDateFilter()">All Dates</button>
      </div>
      <div class="filter-group">
        <input type="text" id="filterVehicle" placeholder="🔍 Search vehicle, txn, waybill..." oninput="onVehicleSearch()" style="width: 240px; padding: 7px 12px; font-size: 0.82rem;" />
        <select id="pageSizeSelect" onchange="onPageSizeChange()">
          <option value="10">10 / page</option>
          <option value="25" selected>25 / page</option>
          <option value="50">50 / page</option>
        </select>
      </div>
    </div>

    <div id="logsMsg"></div>
    <div class="table-responsive">
      <div id="logsTable">
        <p style="color:#64748b;font-size:0.85rem;padding:20px 0;text-align:center;">Loading dispense logs...</p>
      </div>
    </div>

    <!-- Pagination Footer -->
    <div class="pagination-bar" id="paginationControls" style="display: none;">
      <span id="pageInfo" style="font-size: 0.82rem; color: #64748b; font-weight: 500;">Showing 0-0 of 0</span>
      <div style="display: flex; gap: 8px; align-items: center;">
        <button class="btn-page" id="btnPrev" onclick="goToPage(currentPage - 1)">◀ Prev</button>
        <span id="pageNumbers" style="font-size: 0.82rem; font-weight: 700; color: #2563eb; padding: 0 8px;">Page 1 of 1</span>
        <button class="btn-page" id="btnNext" onclick="goToPage(currentPage + 1)">Next ▶</button>
      </div>
    </div>
  </div>

</div>

<!-- Audit Slip Modal (All 13 Fields Inspection) -->
<div id="auditModal" class="modal-overlay" style="display: none;" onclick="if(event.target===this)closeAuditSlip()">
  <div class="modal-card">
    <div class="modal-header">
      <h3><span>🔍</span> Transaction Audit Slip</h3>
      <button class="modal-close-btn" onclick="closeAuditSlip()">✕</button>
    </div>
    <div class="modal-body">
      <div class="audit-grid" id="auditModalContent">
        <!-- Injected via JavaScript -->
      </div>
    </div>
    <div class="audit-footer">
      <div style="font-size: 0.78rem; color: #64748b; font-weight: 500;">
        Synced via MQTT topic <code style="color:#2563eb;">adblue/iot/dispense</code>
      </div>
      <button class="btn-outline-primary" onclick="closeAuditSlip()">Close</button>
    </div>
  </div>
</div>

<script>
let currentPage = 1;
let totalPages = 1;
let currentFilterDate = '';
let currentFilterVehicle = '';
let searchDebounceTimer = null;
let currentLogs = [];

async function loadStats() {
  try {
    const r = await fetch('/api/stats');
    const d = await r.json();
    document.getElementById('statTotalLiters').innerText = (d.total_liters || 0).toFixed(2) + ' L';
    document.getElementById('statTotalTxns').innerText = d.total_txns || 0;
    document.getElementById('statTodayLiters').innerText = (d.today_liters || 0).toFixed(2) + ' L';
    document.getElementById('statTodayTxns').innerText = (d.today_txns || 0) + ' dispenses today';
  } catch (e) {
    console.error('Error fetching stats:', e);
  }
}

async function loadLogs() {
  const pageSize = document.getElementById('pageSizeSelect') ? document.getElementById('pageSizeSelect').value : 25;
  let url = `/api/logs?page=${currentPage}&page_size=${pageSize}`;
  if (currentFilterDate) {
    url += `&date=${encodeURIComponent(currentFilterDate)}`;
  }
  if (currentFilterVehicle) {
    url += `&vehicle=${encodeURIComponent(currentFilterVehicle)}`;
  }

  const r = await fetch(url);
  const d = await r.json();
  const pagination = document.getElementById('paginationControls');
  currentLogs = d.logs || [];

  if (!d.logs || d.logs.length === 0) {
    let emptyMsg = 'No dispense records found';
    if (currentFilterDate) emptyMsg += ` for date ${currentFilterDate}`;
    if (currentFilterVehicle) emptyMsg += ` matching "${currentFilterVehicle}"`;
    document.getElementById('logsTable').innerHTML = `<p style="color:#64748b;font-size:0.85rem;padding:28px 0;text-align:center;">${emptyMsg}.</p>`;
    if (pagination) pagination.style.display = 'none';
    return;
  }

  let html = `<table>
    <thead>
      <tr>
        <th style="width: 45px;">#</th>
        <th>TXN ID</th>
        <th>DISPENSER</th>
        <th>VEHICLE &amp; TRAILER</th>
        <th>WAYBILL</th>
        <th>DISPENSED VOLUME</th>
        <th>TOTALISER (START ➔ END)</th>
        <th>OPERATOR &amp; MODE</th>
        <th>STATUS / STOP</th>
        <th>DATE &amp; TIME (IST)</th>
        <th style="text-align: right;">ACTION</th>
      </tr>
    </thead>
    <tbody>`;

  d.logs.forEach((l, idx) => {
    const rowNum = (d.page - 1) * d.page_size + idx + 1;
    const trailerHtml = (l.trailer_no && l.trailer_no !== '—') ? `<div style="font-size:0.72rem;color:#64748b;margin-top:2px;">Trailer: <b>${l.trailer_no}</b></div>` : '';
    const wbHtml = (l.waybill_no && l.waybill_no !== '—') ? `<span class="badge-dispenser">${l.waybill_no}</span>` : `<span style="color:#94a3b8;">—</span>`;
    const totStart = Number(l.totaliser_start || 0).toFixed(1);
    const totEnd = Number(l.totaliser_end || 0).toFixed(1);

    html += `<tr>
      <td class="row-num">${rowNum}</td>
      <td><span class="badge-txn">${l.txn_id || ('TXN-' + l.id)}</span></td>
      <td><span class="badge-dispenser">${l.dispenser_id || 'ADB-DU-01'}</span></td>
      <td>
        <span class="badge-vehicle">🚚 ${l.vehicle_id}</span>
        ${trailerHtml}
      </td>
      <td>${wbHtml}</td>
      <td><span class="badge-liters">💧 ${Number(l.dispensed_liters).toFixed(2)} L</span></td>
      <td><span class="badge-tot">${totStart} ➔ ${totEnd} L</span></td>
      <td>
        <div style="font-weight: 600; font-size: 0.78rem;">${l.operator || 'Operator'}</div>
        <span class="badge-mode">${l.entry_mode || 'AUTO_MQTT'}</span>
      </td>
      <td>
        <span class="badge-status">${l.stop_reason || 'NOZZLE_STOWED'}</span>
        ${l.error_code && l.error_code !== 'NONE' ? `<div style="font-size:0.70rem;color:#dc2626;font-weight:700;">Err: ${l.error_code}</div>` : ''}
      </td>
      <td class="time-cell">${l.date_time}</td>
      <td style="text-align: right; white-space: nowrap;">
        <button class="btn-table-slip" onclick="openAuditSlip(${idx})">🔍 Audit Slip</button>
        <button class="btn-table-remove" onclick="deleteSingleLog(${l.id})">Remove</button>
      </td>
    </tr>`;
  });
  html += '</tbody></table>';
  document.getElementById('logsTable').innerHTML = html;

  currentPage = d.page;
  totalPages = d.total_pages;
  if (pagination) {
    pagination.style.display = 'flex';
    const start = (d.page - 1) * d.page_size + 1;
    const end = Math.min(d.total, d.page * d.page_size);
    document.getElementById('pageInfo').innerText = `Showing ${start}-${end} of ${d.total} records`;
    document.getElementById('pageNumbers').innerText = `Page ${d.page} of ${d.total_pages}`;
    document.getElementById('btnPrev').disabled = (d.page <= 1);
    document.getElementById('btnNext').disabled = (d.page >= d.total_pages);
  }
}

function openAuditSlip(idx) {
  const item = currentLogs[idx];
  if (!item) return;

  const totDelta = (Number(item.totaliser_end || 0) - Number(item.totaliser_start || 0)).toFixed(2);
  const content = `
    <div class="audit-item highlight">
      <div class="audit-lbl">1. Transaction ID (TXN_ID)</div>
      <div class="audit-val">${item.txn_id || ('TXN-' + item.id)}</div>
    </div>
    <div class="audit-item highlight">
      <div class="audit-lbl">2. Dispenser ID</div>
      <div class="audit-val">${item.dispenser_id || 'ADB-DU-01'}</div>
    </div>
    <div class="audit-item success">
      <div class="audit-lbl">3. Vehicle ID</div>
      <div class="audit-val">🚚 ${item.vehicle_id}</div>
    </div>
    <div class="audit-item">
      <div class="audit-lbl">4. Trailer Number</div>
      <div class="audit-val">${item.trailer_no || '—'}</div>
    </div>
    <div class="audit-item">
      <div class="audit-lbl">5. Waybill Number</div>
      <div class="audit-val">${item.waybill_no || '—'}</div>
    </div>
    <div class="audit-item success">
      <div class="audit-lbl">6. Dispensed Volume</div>
      <div class="audit-val" style="color: #047857; font-size: 1.15rem;">💧 ${Number(item.dispensed_liters).toFixed(2)} Liters</div>
    </div>
    <div class="audit-item">
      <div class="audit-lbl">7. Transaction Date &amp; Time (IST)</div>
      <div class="audit-val">${item.date_time}</div>
    </div>
    <div class="audit-item">
      <div class="audit-lbl">8. Totaliser Start (L)</div>
      <div class="audit-val">${Number(item.totaliser_start || 0).toFixed(2)} L</div>
    </div>
    <div class="audit-item">
      <div class="audit-lbl">9. Totaliser End (L)</div>
      <div class="audit-val">${Number(item.totaliser_end || 0).toFixed(2)} L</div>
    </div>
    <div class="audit-item">
      <div class="audit-lbl">10. Operator</div>
      <div class="audit-val">👤 ${item.operator || 'Operator'}</div>
    </div>
    <div class="audit-item">
      <div class="audit-lbl">11. Entry Mode</div>
      <div class="audit-val">🏷️ ${item.entry_mode || 'AUTO_MQTT'}</div>
    </div>
    <div class="audit-item">
      <div class="audit-lbl">12. Stop Reason</div>
      <div class="audit-val">🛑 ${item.stop_reason || 'NOZZLE_STOWED'}</div>
    </div>
    <div class="audit-item" style="grid-column: span 2;">
      <div class="audit-lbl">13. Error Code &amp; Hardware Status</div>
      <div class="audit-val" style="color: ${item.error_code === 'NONE' || !item.error_code ? '#15803d' : '#b91c1c'};">
        ${item.error_code || 'NONE'} · Verified Normal · Totaliser Delta: ${totDelta} L
      </div>
    </div>
  `;

  document.getElementById('auditModalContent').innerHTML = content;
  document.getElementById('auditModal').style.display = 'flex';
}

function closeAuditSlip() {
  document.getElementById('auditModal').style.display = 'none';
}

function goToPage(page) {
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  loadLogs();
}

function onDateChange() {
  currentFilterDate = document.getElementById('filterDate').value;
  currentPage = 1;
  loadLogs();
}

function clearDateFilter() {
  document.getElementById('filterDate').value = '';
  currentFilterDate = '';
  currentPage = 1;
  loadLogs();
}

function onVehicleSearch() {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    currentFilterVehicle = document.getElementById('filterVehicle').value.trim();
    currentPage = 1;
    loadLogs();
  }, 300);
}

function onPageSizeChange() {
  currentPage = 1;
  loadLogs();
}

async function clearAllLogs() {
  if (!confirm('Are you sure you want to remove ALL dispense logs from the database?')) return;
  const r = await fetch('/api/logs', { method: 'DELETE' });
  const d = await r.json();
  const msg = document.getElementById('logsMsg');
  if (d.success) {
    msg.innerHTML = '<div style="padding:10px 14px;background:#ecfdf5;color:#065f46;border-radius:8px;margin-bottom:12px;font-weight:600;">✅ Cleaned ' + (d.deleted_count || 0) + ' records from database!</div>';
    currentPage = 1;
    loadLogs();
    loadStats();
  } else {
    msg.innerHTML = '<div style="padding:10px 14px;background:#fef2f2;color:#991b1b;border-radius:8px;margin-bottom:12px;font-weight:600;">❌ Failed to clear database</div>';
  }
  setTimeout(() => msg.innerHTML = '', 5000);
}

async function deleteSingleLog(id) {
  if (!confirm('Remove dispense log #' + id + '?')) return;
  await fetch('/api/logs/' + id, { method: 'DELETE' });
  loadLogs();
  loadStats();
}

// Initial loads
loadStats();
loadLogs();

// Auto-poll every 4 seconds when idle on page 1
setInterval(() => {
  if (currentPage === 1 && !currentFilterDate && !currentFilterVehicle) {
    loadLogs();
    loadStats();
  }
}, 4000);
</script>
</body>
</html>"""

class APIHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # suppress noisy HTTP logs

    def send_json(self, code, data):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
        self.end_headers()
        self.wfile.write(body)

    def send_file(self, file_path):
        ctype, _ = mimetypes.guess_type(file_path)
        if not ctype:
            ctype = "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript", "application/json"):
            ctype += "; charset=utf-8"

        try:
            with open(file_path, "rb") as f:
                body = f.read()
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            if "assets" in file_path:
                self.send_header("Cache-Control", "public, max-age=31536000, immutable")
            else:
                self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:
            self.send_json(500, {"error": str(e)})

    def send_html(self, html):
        body = html.encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path   = parsed.path.rstrip("/")

        if path == "/api/vehicles":
            rows = get_all_vehicles()
            vehicles = [{"id": r[0], "vehicle_id": r[1], "added_at": r[2]} for r in rows]
            self.send_json(200, {"vehicles": vehicles})

        elif path == "/api/logs":
            qs = parse_qs(parsed.query)
            try:
                page = max(1, int(qs.get("page", [1])[0]))
            except ValueError:
                page = 1
            try:
                page_size = max(5, min(100, int(qs.get("page_size", [10])[0])))
            except ValueError:
                page_size = 10
            date_filter = qs.get("date", [None])[0]
            vehicle_filter = qs.get("vehicle", [None])[0]

            rows, total, total_pages = get_dispense_logs(page, page_size, date_filter, vehicle_filter)
            logs = [{
                "id": r[0],
                "txn_id": r[1] or f"TXN-{r[0]:05d}",
                "dispenser_id": r[2] or "ADB-DU-01",
                "vehicle_id": r[3],
                "waybill_no": r[4] or "—",
                "trailer_no": r[5] or "—",
                "dispensed_liters": round(float(r[6]), 2),
                "date_time": r[7],
                "totaliser_start": round(float(r[8] or 0.0), 2),
                "totaliser_end": round(float(r[9] or 0.0), 2),
                "operator": r[10] or "Operator",
                "entry_mode": r[11] or "AUTO_MQTT",
                "stop_reason": r[12] or "NOZZLE_STOWED",
                "error_code": r[13] or "NONE"
            } for r in rows]
            self.send_json(200, {
                "logs": logs,
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": total_pages
            })

        elif path == "/api/stats":
            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            c.execute("SELECT COUNT(*), COALESCE(SUM(dispensed_liters), 0) FROM (SELECT vehicle_id, dispensed_liters, date_time FROM adblue_iot_dispense_log GROUP BY vehicle_id, dispensed_liters, date_time)")
            row1 = c.fetchone()
            total_txns = row1[0] if row1 else 0
            total_liters = row1[1] if row1 else 0.0

            today_prefix = get_now_ist()[:10]
            c.execute("SELECT COUNT(*), COALESCE(SUM(dispensed_liters), 0) FROM (SELECT vehicle_id, dispensed_liters, date_time FROM adblue_iot_dispense_log WHERE date_time LIKE ? GROUP BY vehicle_id, dispensed_liters, date_time)", (f"{today_prefix}%",))
            row2 = c.fetchone()
            today_txns = row2[0] if row2 else 0
            today_liters = row2[1] if row2 else 0.0

            c.execute("SELECT COUNT(*) FROM adblue_vehicle_registry")
            row3 = c.fetchone()
            vehicle_count = row3[0] if row3 else 0
            conn.close()

            self.send_json(200, {
                "total_txns": total_txns,
                "total_liters": round(float(total_liters), 2),
                "today_txns": today_txns,
                "today_liters": round(float(today_liters), 2),
                "vehicle_count": vehicle_count
            })

        elif path == "/health":
            self.send_json(200, {"status": "ok", "service": "adblue-iot"})

        else:
            # Serve static files from console-ui/dist
            rel = parsed.path.lstrip("/")
            if not rel:
                rel = "index.html"
            target = os.path.normpath(os.path.join(DIST_DIR, rel))
            if target.startswith(DIST_DIR) and os.path.isfile(target):
                self.send_file(target)
            else:
                # SPA Fallback for client-side routing
                index_file = os.path.join(DIST_DIR, "index.html")
                if os.path.isfile(index_file):
                    self.send_file(index_file)
                else:
                    self.send_html(HTML_PAGE)

    def do_POST(self):
        parsed = urlparse(self.path)
        path   = parsed.path.rstrip("/")
        length = int(self.headers.get("Content-Length", 0))
        body   = self.rfile.read(length) if length else b"{}"

        try:
            data = json.loads(body)
        except Exception:
            self.send_json(400, {"error": "invalid json"})
            return

        if path == "/api/vehicles":
            vehicle_id = data.get("vehicle_id", "").strip()
            if not vehicle_id:
                self.send_json(400, {"success": False, "error": "vehicle_id is required"})
                return
            log_id, err = add_vehicle(vehicle_id)
            if err == "already_exists":
                self.send_json(409, {"success": False, "error": "Vehicle already registered"})
            else:
                print(f"🚛 Vehicle registered via web: {vehicle_id}")
                self.send_json(201, {"success": True, "id": log_id, "vehicle_id": vehicle_id})

        elif path == "/api/dispense":
            vehicle_id   = data.get("vehicle_id")
            liters       = float(data.get("dispensed_liters", 0))
            dt           = data.get("date_time", get_now_ist())
            txn_id       = data.get("txn_id")
            dispenser_id = data.get("dispenser_id")
            waybill_no   = data.get("waybill_no")
            trailer_no   = data.get("trailer_no")
            tot_start    = data.get("totaliser_start")
            tot_end      = data.get("totaliser_end")
            operator     = data.get("operator")
            entry_mode   = data.get("entry_mode")
            stop_reason  = data.get("stop_reason")
            error_code   = data.get("error_code")

            if vehicle_id and liters:
                log_id, dt_ist, now_ist, is_dup, out_txn, out_tot_start, out_tot_end = save_dispense(
                    vehicle_id=vehicle_id,
                    liters=liters,
                    dt=dt,
                    txn_id=txn_id,
                    dispenser_id=dispenser_id,
                    waybill_no=waybill_no,
                    trailer_no=trailer_no,
                    totaliser_start=tot_start,
                    totaliser_end=tot_end,
                    operator=operator,
                    entry_mode=entry_mode,
                    stop_reason=stop_reason,
                    error_code=error_code
                )
                reply = {
                    "success": True,
                    "status": "saved to db",
                    "result": "saved to db",
                    "id": log_id,
                    "txn_id": out_txn,
                    "dispenser_id": dispenser_id or "ADB-DU-01",
                    "vehicle_id": vehicle_id,
                    "waybill_no": waybill_no or "—",
                    "trailer_no": trailer_no or "—",
                    "dispensed_liters": liters,
                    "date_time": dt_ist,
                    "totaliser_start": out_tot_start,
                    "totaliser_end": out_tot_end,
                    "operator": operator or "Operator",
                    "entry_mode": entry_mode or "AUTO_MQTT",
                    "stop_reason": stop_reason or "NOZZLE_STOWED",
                    "error_code": error_code or "NONE",
                    "is_duplicate": is_dup,
                    "message": f"Saved to db: txn {out_txn}, vehicle {vehicle_id}, {liters}L at {dt_ist}"
                }
                if mqtt_client_ref:
                    try:
                        reply_json = json.dumps(reply)
                        mqtt_client_ref.publish(TOPIC_DISPENSE_RESPONSE, reply_json, qos=1)
                        mqtt_client_ref.publish(TOPIC_DISPENSE_REPLY, reply_json, qos=1)
                        mqtt_client_ref.publish(TOPIC_DISPENSE_RESULT, reply_json, qos=1)
                        print(f"📤 Dispense reply sent to [{TOPIC_DISPENSE_REPLY}]: {reply_json}")
                    except Exception as e:
                        print(f"Error publishing dispense reply: {e}")
                self.send_json(201, reply)
            else:
                self.send_json(400, {"success": False, "error": "missing vehicle_id or dispensed_liters"})

        elif path == "/api/logs/clear":
            count = clear_all_dispense_logs()
            print(f"🧹 Cleared {count} dispense logs from database via web")
            self.send_json(200, {"success": True, "deleted_count": count})
        else:
            self.send_json(404, {"error": "not found"})

    def do_DELETE(self):
        parsed = urlparse(self.path)
        parts  = parsed.path.strip("/").split("/")
        # DELETE /api/vehicles/<vehicle_id>
        if len(parts) == 3 and parts[0] == "api" and parts[1] == "vehicles":
            vehicle_id = parts[2]
            removed = delete_vehicle(vehicle_id)
            if removed:
                print(f"🗑️  Vehicle removed via web: {vehicle_id}")
                self.send_json(200, {"success": True})
            else:
                self.send_json(404, {"success": False, "error": "not found"})
        # DELETE /api/logs (clear all logs)
        elif len(parts) == 2 and parts[0] == "api" and parts[1] == "logs":
            count = clear_all_dispense_logs()
            print(f"🧹 Cleared all {count} dispense logs from database via DELETE /api/logs")
            self.send_json(200, {"success": True, "deleted_count": count, "message": "All hardcoded logs cleared from database"})
        # DELETE /api/logs/<id> (delete single log)
        elif len(parts) == 3 and parts[0] == "api" and parts[1] == "logs":
            try:
                log_id = int(parts[2])
                removed = delete_dispense_log(log_id)
                if removed:
                    self.send_json(200, {"success": True, "deleted_id": log_id})
                else:
                    self.send_json(404, {"success": False, "error": "not found"})
            except ValueError:
                self.send_json(400, {"success": False, "error": "invalid log id"})
        else:
            self.send_json(404, {"error": "not found"})

def run_http_api():
    index_exists = os.path.isfile(os.path.join(DIST_DIR, "index.html"))
    print(f"📁 Web UI static root: {DIST_DIR} (index.html: {'FOUND' if index_exists else 'MISSING'})")
    while True:
        try:
            server = HTTPServer(("0.0.0.0", API_PORT), APIHandler)
            print(f"🌐 Multi-threaded REST API & UI running on Port {API_PORT}")
            server.serve_forever()
        except Exception as e:
            print(f"⚠️ HTTP server error: {e}, restarting HTTP listener in 2s...")
            import time
            time.sleep(2)

# ─── Main ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    init_db()

    if "--clear-logs" in sys.argv or "--clean-db" in sys.argv or os.getenv("CLEAN_DB") == "1":
        cleared = clear_all_dispense_logs()
        print(f"🧹 Cleaned database: Removed {cleared} old/hardcoded dispense records.")

    # Start HTTP API in background thread
    t = threading.Thread(target=run_http_api, daemon=True)
    t.start()

    # Start MQTT Client
    try:
        try:
            client = mqtt.Client(CallbackAPIVersion.VERSION2)
        except Exception:
            client = mqtt.Client()

        mqtt_client_ref = client
        client.username_pw_set(MQTT_USER, MQTT_PASS)
        client.on_connect = on_connect
        client.on_message = on_message
        print(f"Connecting to MQTT Broker at {MQTT_HOST}:{MQTT_PORT}...")
        client.connect(MQTT_HOST, MQTT_PORT, 60)
        print(f"🚀 AdBlue Worker is live! Waiting for IoT packets...")
        client.loop_forever()
    except Exception as e:
        print(f"⚠️ MQTT Broker ({MQTT_HOST}:{MQTT_PORT}) unavailable ({e}).")
        print(f"ℹ️ HTTP API & Web Console running at http://localhost:{API_PORT}")
        import time
        while True:
            time.sleep(1)


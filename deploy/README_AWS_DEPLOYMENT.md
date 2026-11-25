# AWS Deployment & MQTT Broker Setup Guide

This guide explains how to deploy **Mosquitto MQTT Broker**, the **Backend**, and the **Dashboard** on the same AWS EC2 instance.

---

## 1. AWS EC2 Instance Requirements

* **OS**: Ubuntu 22.04 LTS
* **Instance Type**: `t3.medium` (4GB RAM) or `t3.large` (8GB RAM)
* **Elastic IP**: Recommended (static public IP for IoT devices)

### AWS Security Group (Firewall) Inbound Rules
| Port | Protocol | Source | Description |
| :--- | :--- | :--- | :--- |
| **22** | TCP | Your IP | Secure SSH Access |
| **80** | TCP | `0.0.0.0/0` | HTTP (Web & Let's Encrypt SSL) |
| **443** | TCP | `0.0.0.0/0` | HTTPS (Dashboard UI) |
| **1883** | TCP | `0.0.0.0/0` | Mosquitto MQTT Broker (IoT Dispenser pings) |

---

## 2. Install Mosquitto MQTT Broker

Run on the Ubuntu EC2 terminal:

```bash
sudo apt update
sudo apt install -y mosquitto mosquitto-clients
```

Copy the configuration:
```bash
sudo cp deploy/mosquitto.conf /etc/mosquitto/conf.d/kharj_mosquitto.conf
sudo systemctl enable mosquitto
sudo systemctl restart mosquitto
sudo systemctl status mosquitto
```

Test local broker connection:
```bash
# In terminal 1 (subscribe):
mosquitto_sub -t "kharj/iot/dispense"

# In terminal 2 (publish test packet):
mosquitto_pub -t "kharj/iot/dispense" -m '{"vehicle_id": "ALM-TRK-1041", "dispensed_liters": 45.5, "date_time": "2026-11-03 16:30:00"}'
```

---

## 3. Database Migration (Frappe DocType)

To create the `tabKharj IoT Dispense Log` table in MariaDB, run within your Frappe bench directory:

```bash
cd /home/frappe/frappe-bench
bench --site site1.local migrate
```

Verify in MariaDB:
```sql
DESC `tabKharj IoT Dispense Log`;
```
The table contains:
* `name` (e.g. `IOT-2026-00001`)
* `vehicle_id`
* `dispensed_liters`
* `date_time`

---

## 4. Deploy MQTT Ingest Background Worker

Install Python MQTT client in the bench virtual environment:
```bash
/home/frappe/frappe-bench/env/bin/pip install paho-mqtt
```

Install and start the systemd background service:
```bash
sudo cp deploy/kharj-mqtt.service /etc/systemd/system/kharj-mqtt.service
sudo systemctl daemon-reload
sudo systemctl enable kharj-mqtt
sudo systemctl start kharj-mqtt
sudo systemctl status kharj-mqtt
```

View live logs of incoming IoT messages:
```bash
sudo journalctl -u kharj-mqtt -f
```

---

## 5. Build and Deploy React Dashboard UI

Inside `console-ui`:
```bash
cd nimble_kharj/nimble_kharj/console-ui
npm install
npm run build
```

The production assets in `dist/` are served by Nginx directly at your domain root (`/`).

---

## 6. Testing From IoT Hardware / Simulator

To test with the Python simulator:
```bash
# Single test packet:
python scripts/simulate_iot_publisher.py --host <YOUR_AWS_PUBLIC_IP> --vehicle ALM-TRK-1041 --liters 55.2

# Continuous stream every 5 seconds:
python scripts/simulate_iot_publisher.py --host <YOUR_AWS_PUBLIC_IP> --continuous --interval 5
```

Open your browser dashboard, go to the **📡 IoT Live Feed (MQTT)** tab, and watch the records stream in live in real time!


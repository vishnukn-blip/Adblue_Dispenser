app_name = "nimble_kharj"
app_title = "Kharj Fuel"
app_publisher = "Nimble Vision Technologies Pvt. Ltd."
app_description = "Waybill-authorised AdBlue / diesel dispensing, GPS analytics and SAP reconciliation for the Almarai Kharj station"
app_email = "info@nimblevision.in"
app_license = "Proprietary"

# React/Vite console is served as a Frappe web page (built assets land in
# nimble_kharj/public/console). See www/console.html.
website_route_rules = [
    {"from_route": "/console/<path:app_path>", "to_route": "console"},
]

scheduler_events = {
    "cron": {
        # drain the SAP outbox every minute (store-and-forward, idempotent)
        "* * * * *": ["nimble_kharj.api.sap.drain_outbox"],
        # mark dispensers offline if no heartbeat in 3 minutes
        "*/2 * * * *": ["nimble_kharj.api.telemetry.watchdog_dispensers"],
    },
    "hourly": [
        "nimble_kharj.api.waybill.expire_stale_waybills",
    ],
    "daily": [
        # keep the ping table lean; keep 90 days of track history
        "nimble_kharj.api.gps.prune_pings",
    ],
}

doc_events = {
    "Kharj Dispense Transaction": {
        "on_update": "nimble_kharj.api.dispensing.on_txn_update",
    }
}

fixtures = []

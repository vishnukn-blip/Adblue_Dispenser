# Copyright (c) 2026 Nimble Vision Technologies Pvt. Ltd.
import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime


class KharjDispenseTransaction(Document):
	def log(self, state, detail="", source="Cloud"):
		"""Append a state-machine event and stream it to any open console."""
		self.append("events", {
			"event_time": now_datetime(),
			"state": state,
			"detail": detail,
			"source": source,
		})
		frappe.publish_realtime(
			"kharj_dispense_event",
			{"txn": self.name, "state": state, "detail": detail, "source": source},
			doctype="Kharj Dispense Transaction",
			docname=self.name,
		)

	def on_update(self):
		frappe.publish_realtime("kharj_txn_update", self.as_dict(), doctype=self.doctype, docname=self.name)

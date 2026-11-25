# Copyright (c) 2026 Nimble Vision Technologies Pvt. Ltd.
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import now_datetime, get_datetime, flt


class KharjWaybill(Document):
	def validate(self):
		if flt(self.entitlement_qty) <= 0:
			frappe.throw(_("Entitlement quantity must be greater than zero"))
		self.balance_qty = flt(self.entitlement_qty) - flt(self.dispensed_qty)
		if self.balance_qty < 0:
			frappe.throw(_("Dispensed quantity cannot exceed the entitlement"))
		self.set_status()

	def set_status(self):
		if self.status in ("Cancelled",):
			return
		if flt(self.balance_qty) <= 0.001:
			self.status = "Closed"
		elif flt(self.dispensed_qty) > 0:
			self.status = "Partially Dispensed"
		elif get_datetime(self.valid_to) < now_datetime():
			self.status = "Expired"
		else:
			self.status = "Open"

	def consume(self, qty):
		"""Post a dispensed quantity against this waybill. Row-locked by the caller."""
		self.dispensed_qty = flt(self.dispensed_qty) + flt(qty)
		self.balance_qty = flt(self.entitlement_qty) - flt(self.dispensed_qty)
		self.set_status()
		self.save(ignore_permissions=True)

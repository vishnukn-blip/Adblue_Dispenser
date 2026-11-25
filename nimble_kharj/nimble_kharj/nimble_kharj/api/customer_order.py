# Copyright (c) 2026 Nimble Vision Technologies Pvt. Ltd.
"""Customer Order & Delivery Lifecycle API endpoints for Frappe Backend."""
import random
import frappe
from frappe.utils import now_datetime, flt

def generate_next_waybill_no():
	"""Generate sequential date-based waybill number: DDMMYYYY#### (e.g. 280820260001)."""
	now = now_datetime()
	prefix = now.strftime("%d%m%Y")
	try:
		if frappe.db.exists("DocType", "Kharj Waybill"):
			count = frappe.db.count("Kharj Waybill", filters={"waybill_no": ["like", f"{prefix}%"]})
			seq = count + 1
			return f"{prefix}{seq:04d}"
	except Exception:
		pass
	return f"{prefix}0001"

@frappe.whitelist()
def create_customer_order(customer_name, product, qty_litres, delivery_address, delivery_lat=None, delivery_lng=None, customer_code=None, waybill_no=None):
	"""Create a new customer fuel delivery order in MariaDB."""
	order_id = f"ORD-{random.randint(100000, 999999)}"
	wb_no = waybill_no or generate_next_waybill_no()
	now = now_datetime()
	
	order_data = {
		"order_id": order_id,
		"customer_name": customer_name,
		"customer_code": customer_code or "CUST-01",
		"product": product,
		"qty_litres": flt(qty_litres),
		"delivery_address": delivery_address,
		"delivery_lat": flt(delivery_lat or 24.713),
		"delivery_lng": flt(delivery_lng or 46.674),
		"status": "pending",
		"placed_at": now.strftime("%H:%M:%S"),
		"estimated_eta": "45 mins",
		"waybill_no": wb_no,
	}
	
	# If Kharj Waybill exists or custom DocType, persist
	try:
		if frappe.db.exists("DocType", "Kharj Customer Order"):
			doc = frappe.get_doc({
				"doctype": "Kharj Customer Order",
				**order_data
			})
			doc.insert(ignore_permissions=True)
			frappe.db.commit()
	except Exception as e:
		frappe.log_error(f"Error creating order: {str(e)}")
		
	return order_data

@frappe.whitelist()
def get_customer_orders():
	"""Retrieve all customer orders from MariaDB."""
	try:
		if frappe.db.exists("DocType", "Kharj Customer Order"):
			return frappe.get_all("Kharj Customer Order", fields=["*"], order_by="creation desc")
	except Exception:
		pass
	return []

@frappe.whitelist()
def update_order_status(order_id, status, assigned_truck=None, assigned_driver=None, waybill_no=None, sap_doc_no=None):
	"""Update customer delivery order status in MariaDB."""
	now = now_datetime()
	updates = { "status": status }
	if assigned_truck: updates["assigned_truck"] = assigned_truck
	if assigned_driver: updates["assigned_driver"] = assigned_driver
	if waybill_no: updates["waybill_no"] = waybill_no
	if sap_doc_no: updates["sap_doc_no"] = sap_doc_no
	if status == "delivered": updates["delivered_at"] = now.strftime("%H:%M:%S")

	try:
		if frappe.db.exists("Kharj Customer Order", order_id):
			frappe.db.set_value("Kharj Customer Order", order_id, updates)
			frappe.db.commit()
	except Exception as e:
		frappe.log_error(f"Error updating order: {str(e)}")
		
	return {"success": True, "order_id": order_id, "status": status, **updates}

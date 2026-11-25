import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { db } from "./db";

/* ============================================================
   CUSTOMER ORDER TYPE (exported for use in DispensingConsole)
   ============================================================ */
export type CustomerOrderStatus =
  | "pending"
  | "accepted"
  | "refilling"
  | "in_transit"
  | "delivered";

export type CustomerOrder = {
  order_id: string;
  customer_name: string;
  customer_code: string;
  product: "AdBlue";
  qty_litres: number;
  delivery_address: string;
  delivery_lat: number;
  delivery_lng: number;
  status: CustomerOrderStatus;
  waybill_no?: string;
  assigned_truck?: string;
  assigned_driver?: string;
  placed_at: string;
  estimated_eta?: string;
  delivered_at?: string;
  sap_doc_no?: string;
};

const STATUS_CONFIG: Record<CustomerOrderStatus, { label: string; color: string; bg: string; icon: string; step: number }> = {
  pending:    { label: "Order Placed",       color: "#D97706", bg: "#FEF3C7", icon: "⏳", step: 1 },
  accepted:   { label: "Driver Accepted",    color: "#2563EB", bg: "#EFF6FF", icon: "🚛", step: 2 },
  refilling:  { label: "Refilling at Depot", color: "#EA580C", bg: "#FFF7ED", icon: "⛽", step: 3 },
  in_transit: { label: "Out for Delivery",   color: "#16A34A", bg: "#F0FDF4", icon: "🚗", step: 4 },
  delivered:  { label: "Delivered",          color: "#059669", bg: "#D1FAE5", icon: "✅", step: 5 },
};

const DELIVERY_HUBS = [
  { label: "CPP RIYADH SOUTH FOODS 01", code: "CPP-RSDP-01", lat: 24.713, lng: 46.674, arabic: "(سي بي بي - الرياض الجنوبي (أغذية) 01" },
  { label: "NUPCO RIYADH EAST DEPOT",   code: "NUPCO-RED-01", lat: 24.775, lng: 46.855, arabic: "نوبكو - مستودع الرياض الشرقي" },
  { label: "RIYADH SOUTH DEPOT",        code: "RSD-01",       lat: 24.613, lng: 46.772, arabic: "مستودع الرياض الجنوبي" },
  { label: "DAMMAM CENTRAL DEPOT",      code: "DMM-CD-01",    lat: 26.432, lng: 50.103, arabic: "مستودع الدمام المركزي" },
  { label: "JEDDAH NORTH HUB",          code: "JED-NH-01",    lat: 21.542, lng: 39.172, arabic: "مركز جدة الشمالي" },
];

const DEPOT_LAT = 24.1554;
const DEPOT_LNG = 47.3346;

interface Props {
  orders: CustomerOrder[];
  onPlaceOrder: (order: CustomerOrder) => void;
  onViewWaybill?: (order: CustomerOrder) => void;
  onOpenJourney?: (order: CustomerOrder) => void;
}

const CustomerPortal: React.FC<Props> = ({ orders, onPlaceOrder, onViewWaybill, onOpenJourney }) => {
  const [form, setForm] = useState({
    hub_index: 0,
    product: "AdBlue" as const,
    qty: 100,
    scheduled: "Today - Morning Shift (06:00-14:00)",
  });
  const [placing, setPlacing] = useState(false);
  const [placedId, setPlacedId] = useState<string | null>(null);
  const [focusOrderId, setFocusOrderId] = useState<string | null>(null);
  const focusOrder = orders.find((o) => o.order_id === focusOrderId) || orders[0] || null;

  const miniMapRef = useRef<HTMLDivElement>(null);
  const miniLeafletRef = useRef<L.Map | null>(null);
  const truckMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const customerPinRef = useRef<L.Marker | null>(null);
  const depotPinRef = useRef<L.Marker | null>(null);
  const truckAnimRef = useRef<any>(null);

  useEffect(() => {
    if (!miniMapRef.current || miniLeafletRef.current) return;
    const map = L.map(miniMapRef.current, {
      center: [24.45, 46.9],
      zoom: 8,
      zoomControl: true,
      attributionControl: false,
    });
    L.tileLayer("https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", { maxZoom: 18 }).addTo(map);
    miniLeafletRef.current = map;
    setTimeout(() => map.invalidateSize(), 300);
    return () => {
      map.remove();
      miniLeafletRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = miniLeafletRef.current;
    if (!map) return;
    if (routeLineRef.current) {
      routeLineRef.current.remove();
      routeLineRef.current = null;
    }
    if (truckMarkerRef.current) {
      truckMarkerRef.current.remove();
      truckMarkerRef.current = null;
    }
    if (customerPinRef.current) {
      customerPinRef.current.remove();
      customerPinRef.current = null;
    }
    if (depotPinRef.current) {
      depotPinRef.current.remove();
      depotPinRef.current = null;
    }
    if (truckAnimRef.current) {
      clearInterval(truckAnimRef.current);
      truckAnimRef.current = null;
    }
    if (!focusOrder) return;

    const dLat = focusOrder.delivery_lat;
    const dLng = focusOrder.delivery_lng;

    // 3D Depot Pin
    const depotIcon = L.divIcon({
      className: "journey-depot-divicon",
      html: `
        <div class="journey-pin-container">
          <div class="journey-avatar-circle depot-circle">
            <span class="journey-emoji">⛽</span>
          </div>
          <div class="journey-pin-pill dark">
            <span>Kharj Depot (Bay 1)</span>
          </div>
        </div>
      `,
      iconSize: [130, 60],
      iconAnchor: [65, 30],
    });
    depotPinRef.current = L.marker([DEPOT_LAT, DEPOT_LNG], { icon: depotIcon }).addTo(map);

    // 3D Customer Pin
    const customerIcon = L.divIcon({
      className: "journey-dest-divicon",
      html: `
        <div class="journey-pin-container">
          <div class="journey-avatar-circle dest-circle">
            <span class="journey-emoji">🏢</span>
          </div>
          <div class="journey-pin-pill emerald">
            <span>${focusOrder.customer_name.substring(0, 20)}</span>
          </div>
        </div>
      `,
      iconSize: [150, 60],
      iconAnchor: [75, 30],
    });
    customerPinRef.current = L.marker([dLat, dLng], { icon: customerIcon }).addTo(map);

    // High-contrast blue corridor line
    routeLineRef.current = L.polyline(
      [[DEPOT_LAT, DEPOT_LNG], [dLat, dLng]],
      { color: "#2563EB", weight: 4, dashArray: "8, 6", opacity: 0.85 }
    ).addTo(map);
    map.fitBounds([[DEPOT_LAT, DEPOT_LNG], [dLat, dLng]], { padding: [50, 50] });

    const status = focusOrder.status;
    let truckLat = DEPOT_LAT,
      truckLng = DEPOT_LNG;
    if (status === "in_transit") {
      truckLat = (DEPOT_LAT + dLat) / 2;
      truckLng = (DEPOT_LNG + dLng) / 2;
    } else if (status === "delivered") {
      truckLat = dLat;
      truckLng = dLng;
    }

    const truckIcon = L.divIcon({
      className: "journey-truck-divicon",
      html: `
        <div class="journey-pin-container">
          <div class="journey-avatar-circle truck-circle pulse-wave">
            <span class="journey-emoji">🚛</span>
          </div>
          <div class="journey-pin-pill blue">
            <span class="truck-name-bold">${focusOrder.assigned_truck || "ALM-TRK-1041"}</span>
          </div>
        </div>
      `,
      iconSize: [130, 60],
      iconAnchor: [65, 30],
    });
    truckMarkerRef.current = L.marker([truckLat, truckLng], { icon: truckIcon }).addTo(map);

    if (status === "in_transit" || status === "accepted" || status === "refilling") {
      let step = 0;
      const steps = 60;
      const sLat = status === "refilling" || status === "accepted" ? DEPOT_LAT : truckLat;
      const sLng = status === "refilling" || status === "accepted" ? DEPOT_LNG : truckLng;
      truckAnimRef.current = setInterval(() => {
        step = (step + 1) % (steps * 2);
        const frac = step < steps ? step / steps : (steps * 2 - step) / steps;
        truckMarkerRef.current?.setLatLng([sLat + (dLat - sLat) * frac, sLng + (dLng - sLng) * frac]);
      }, 200);
    }
    setTimeout(() => map.invalidateSize(), 100);
  }, [focusOrder?.order_id, focusOrder?.status]);

  const handlePlace = () => {
    setPlacing(true);
    setTimeout(() => {
      const hub = DELIVERY_HUBS[form.hub_index];
      const orderId = "ORD-" + Math.floor(100000 + Math.random() * 900000);
      const waybillNo = db.generateNextWaybillNo();
      const newOrder: CustomerOrder = {
        order_id: orderId,
        customer_name: hub.label,
        customer_code: hub.code,
        product: form.product,
        qty_litres: form.qty,
        delivery_address: hub.label,
        delivery_lat: hub.lat,
        delivery_lng: hub.lng,
        status: "pending",
        placed_at: new Date().toLocaleTimeString("en-GB", { hour12: false }),
        estimated_eta: "45 mins",
        waybill_no: waybillNo,
      };
      onPlaceOrder(newOrder);
      setPlacedId(orderId);
      setFocusOrderId(orderId);
      setPlacing(false);
    }, 1000);
  };

  const activeOrders = orders.filter((o) => o.status !== "delivered");
  const historyOrders = orders.filter((o) => o.status === "delivered");
  const totalVolume = orders.reduce((sum, o) => sum + (o.qty_litres || 0), 0);

  return (
    <div className="cp-root animate-fade-in">
      {/* ENTERPRISE HERO HEADER */}
      <div className="cp-hero">
        <div className="cp-hero-text">
          <div className="cp-hero-icon">🏢</div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <h2 className="cp-hero-title">Customer AdBlue Portal</h2>
              <span className="cp-live-tag">
                <span className="led-pulse" /> ALMARAI LOGISTICS NETWORK
              </span>
            </div>
            <p className="cp-hero-sub">
              Direct B2B Depot Dispensing &amp; High-Speed Highway 65 Delivery Fulfillment
            </p>
          </div>
        </div>

        <div className="cp-hero-stats">
          <div className="cp-stat-pill">
            <span className="cp-stat-num">{orders.length}</span>
            <span className="cp-stat-lbl">TOTAL ORDERS</span>
          </div>
          <div className="cp-stat-pill blue">
            <span className="cp-stat-num">{activeOrders.length}</span>
            <span className="cp-stat-lbl">IN PROGRESS</span>
          </div>
          <div className="cp-stat-pill green">
            <span className="cp-stat-num">{historyOrders.length}</span>
            <span className="cp-stat-lbl">DELIVERED</span>
          </div>
          <div className="cp-stat-pill purple">
            <span className="cp-stat-num">{totalVolume} L</span>
            <span className="cp-stat-lbl">TOTAL VOLUME</span>
          </div>
        </div>
      </div>

      {/* MAIN TWO-COLUMN WORKSPACE */}
      <div className="cp-body">
        {/* LEFT COLUMN: ORDER REQUISITION & SHIPMENTS */}
        <div className="cp-left">
          {/* Order Placement Card */}
          <div className="cp-card cp-order-form">
            <div className="cp-card-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span>🛒</span>
                <span>Place New AdBlue Requisition</span>
              </div>
              {placedId && <span className="cp-success-badge">✓ Order #{placedId} Placed!</span>}
            </div>

            <div className="cp-field">
              <label className="cp-label">📍 Destination Hub &amp; Receiving Depot</label>
              <select
                className="cp-select"
                value={form.hub_index}
                onChange={(e) => setForm((f) => ({ ...f, hub_index: Number(e.target.value) }))}
              >
                {DELIVERY_HUBS.map((h, i) => (
                  <option key={i} value={i}>
                    {h.label} ({h.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="cp-field">
              <label className="cp-label">💧 Select AdBlue DEF Grade</label>
              <div className="cp-product-pick">
                <button
                  className="cp-prod-btn active adblue"
                  onClick={() => setForm((f) => ({ ...f, product: "AdBlue" }))}
                  style={{ width: "100%" }}
                >
                  <div style={{ fontWeight: 800, fontSize: "13px" }}>💧 AdBlue DEF (ISO 22241 / AUS 32)</div>
                  <div style={{ fontSize: "10px", opacity: 0.8, marginTop: "2px" }}>High Purity 32.5% Aqueous Urea Solution for SCR Systems</div>
                </button>
              </div>
            </div>

            <div className="cp-field">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <label className="cp-label" style={{ margin: 0 }}>📊 Quantity (Litres)</label>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#16A34A" }}>
                  Est. Quota: {form.qty} Litres
                </span>
              </div>
              <div className="cp-qty-presets">
                {[50, 100, 200, 500].map((q) => (
                  <button
                    key={q}
                    className={"cp-qty-btn" + (form.qty === q ? " active" : "")}
                    onClick={() => setForm((f) => ({ ...f, qty: q }))}
                  >
                    {q} L
                  </button>
                ))}
                <input
                  className="cp-qty-input"
                  type="number"
                  min={10}
                  max={5000}
                  value={form.qty}
                  onChange={(e) => setForm((f) => ({ ...f, qty: Number(e.target.value) }))}
                />
              </div>
            </div>

            <button className={"cp-place-btn" + (placing ? " loading" : "")} onClick={handlePlace} disabled={placing}>
              {placing ? "⏳ Authorizing & Dispatching Order..." : "🛒 Place AdBlue Requisition Order"}
            </button>
          </div>

          {/* Active Orders List */}
          <div className="cp-card">
            <div className="cp-card-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span>📋</span>
                <span>Active Shipments &amp; Live Orders</span>
              </div>
              {activeOrders.length > 0 && <span className="cp-badge">{activeOrders.length} ACTIVE</span>}
            </div>

            {activeOrders.length === 0 && (
              <div className="cp-empty">No active orders in transit. Place your requisition above!</div>
            )}

            {activeOrders.map((order) => {
              const cfg = STATUS_CONFIG[order.status];
              return (
                <div
                  key={order.order_id}
                  className={"cp-order-card" + (focusOrderId === order.order_id ? " focused" : "")}
                  onClick={() => setFocusOrderId(order.order_id)}
                >
                  <div className="cp-order-top">
                    <div>
                      <div className="cp-order-id">#{order.order_id}</div>
                      <div className="cp-order-name">{order.customer_name}</div>
                    </div>
                    <span className="cp-status-badge" style={{ background: cfg.bg, color: cfg.color }}>
                      {cfg.icon} {cfg.label}
                    </span>
                  </div>

                  <div className="cp-order-meta">
                    <span>⛽ <b>{order.qty_litres}L {order.product}</b></span>
                    <span>🕐 Placed: {order.placed_at}</span>
                    {order.assigned_truck && <span>🚛 Truck: {order.assigned_truck}</span>}
                    {order.estimated_eta && <span>📍 ETA: {order.estimated_eta}</span>}
                  </div>

                  {order.waybill_no && (
                    <div style={{ marginTop: "10px" }}>
                      <button
                        className="cp-wb-btn"
                        style={{ width: "100%", justifyContent: "center" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewWaybill?.(order);
                        }}
                      >
                        📄 View Official Waybill #{order.waybill_no}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: INTERACTIVE MAP & JOURNEY STEPPER */}
        <div className="cp-right">
          <div className="cp-card cp-map-card">
            <div className="cp-card-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span>🗺️</span>
                <span>Live Telematics &amp; Fleet Tracker</span>
              </div>
              {focusOrder && (
                <span
                  className="cp-status-badge"
                  style={{
                    background: STATUS_CONFIG[focusOrder.status].bg,
                    color: STATUS_CONFIG[focusOrder.status].color,
                  }}
                >
                  {STATUS_CONFIG[focusOrder.status].icon} {STATUS_CONFIG[focusOrder.status].label}
                </span>
              )}
            </div>

            {focusOrder && (
              <div className="cp-map-legend">
                <div className="cp-legend-item"><span>⛽</span> Kharj Central Bay 1</div>
                <div className="cp-legend-item"><span>🏢</span> {focusOrder.customer_name}</div>
                <div className="cp-legend-item"><span>🚛</span> {focusOrder.assigned_truck || "ALM-TRK-1041"}</div>
              </div>
            )}

            <div ref={miniMapRef} className="cp-mini-map" />

            {!focusOrder && (
              <div className="cp-map-placeholder">
                <div style={{ fontSize: "48px" }}>🗺️</div>
                <div style={{ marginTop: "12px", fontWeight: 600, color: "#475569" }}>
                  Place an order to see live tracking
                </div>
                <div style={{ fontSize: "12px", color: "#94A3B8", marginTop: "4px" }}>
                  Route from Kharj Depot to your hub will appear here
                </div>
              </div>
            )}

            {focusOrder && (
              <div className="cp-horizontal-tracker">
                <div className="cp-ds-title">📍 Shipment Progress &amp; Chain of Custody</div>
                <div className="cp-hstepper-wrap">
                  {[
                    {
                      num: 1,
                      icon: "🏢",
                      label: "1. Order Placed",
                      sub: `${focusOrder.qty_litres}L ${focusOrder.product}`,
                      done: true,
                    },
                    {
                      num: 2,
                      icon: "🚛",
                      label: "2. Driver Assigned",
                      sub: focusOrder.assigned_driver
                        ? focusOrder.assigned_driver.split(",")[1] || focusOrder.assigned_driver
                        : "Azhar Ud Din",
                      done: ["accepted", "refilling", "in_transit", "delivered"].includes(focusOrder.status),
                    },
                    {
                      num: 3,
                      icon: "⛽",
                      label: "3. Bay 1 Dispensed",
                      sub: "Kharj Depot (Bay 01)",
                      done: ["refilling", "in_transit", "delivered"].includes(focusOrder.status),
                    },
                    {
                      num: 4,
                      icon: "🚗",
                      label: "4. Highway 65 Transit",
                      sub: focusOrder.estimated_eta ? `ETA: ${focusOrder.estimated_eta}` : "En Route",
                      done: ["in_transit", "delivered"].includes(focusOrder.status),
                    },
                    {
                      num: 5,
                      icon: "✅",
                      label: "5. Delivered & SAP",
                      sub: focusOrder.delivered_at ? focusOrder.delivered_at : "Goods Issued",
                      done: focusOrder.status === "delivered",
                    },
                  ].map((step, i, arr) => (
                    <div key={i} className={"cp-hstep-item" + (step.done ? " done" : "")}>
                      <div className="cp-hstep-node-line">
                        <div className="cp-hstep-dot">{step.done ? "✓" : step.icon}</div>
                        {i < arr.length - 1 && (
                          <div className={"cp-hstep-connector" + (step.done && arr[i + 1].done ? " filled" : "")} />
                        )}
                      </div>
                      <div className="cp-hstep-content">
                        <div className="cp-hstep-title">{step.label}</div>
                        <div className="cp-hstep-sub">{step.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FULL WIDTH ENTERPRISE COMPLETED ORDER ARCHIVE */}
      {historyOrders.length > 0 && (
        <div className="cp-bottom-archive">
          <div className="cp-card">
            <div className="cp-card-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span>📑</span>
                <span>Completed Delivery Archive &amp; SAP Reconciliations</span>
              </div>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#16A34A" }}>
                ✓ {historyOrders.length} RECONCILED GOODS ISSUES
              </span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="cp-history-table">
                <thead>
                  <tr>
                    <th>ORDER ID</th>
                    <th>PRODUCT</th>
                    <th>VOLUME</th>
                    <th>DESTINATION HUB</th>
                    <th>DISPATCH TIME</th>
                    <th>WAYBILL #</th>
                    <th>SAP MATERIAL DOC #</th>
                    <th>STATUS</th>
                    <th style={{ textAlign: "right" }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {historyOrders.map((o) => (
                    <tr key={o.order_id}>
                      <td className="cp-mono" style={{ fontWeight: 800, color: "#2563EB" }}>
                        #{o.order_id}
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: "#1D4ED8" }}>
                          💧 AdBlue DEF
                        </span>
                      </td>
                      <td className="cp-mono" style={{ fontWeight: 700 }}>{o.qty_litres} L</td>
                      <td style={{ fontWeight: 600 }}>{o.customer_name}</td>
                      <td style={{ color: "#64748B" }}>{o.placed_at || "—"}</td>
                      <td className="cp-mono" style={{ fontWeight: 700 }}>
                        {o.waybill_no || "280820260001"}
                      </td>
                      <td className="cp-mono" style={{ color: "#059669", fontWeight: 700 }}>
                        {o.sap_doc_no || "4901824901"}
                      </td>
                      <td>
                        <span
                          className="cp-status-badge"
                          style={{
                            background: STATUS_CONFIG[o.status].bg,
                            color: STATUS_CONFIG[o.status].color,
                            fontSize: "11px",
                          }}
                        >
                          {STATUS_CONFIG[o.status].icon} {STATUS_CONFIG[o.status].label}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="cp-wb-btn"
                          style={{ fontSize: "11px", padding: "6px 12px" }}
                          onClick={() => onViewWaybill?.(o)}
                        >
                          📄 View Waybill
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerPortal;

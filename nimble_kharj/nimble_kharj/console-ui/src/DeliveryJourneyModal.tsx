import React, { useEffect, useState, useRef } from "react";
import L from "leaflet";
import { CustomerOrder, CustomerOrderStatus } from "./CustomerPortal";

interface Props {
  order: CustomerOrder;
  onClose: () => void;
  onViewWaybill: (order: CustomerOrder) => void;
  onUpdateStatus: (orderId: string, status: CustomerOrderStatus) => void;
}

const STAGES: { key: CustomerOrderStatus; title: string; icon: string; subtitle: string }[] = [
  { key: "pending", title: "Order Placed", icon: "🏢", subtitle: "Customer submitted AdBlue request" },
  { key: "accepted", title: "Waybill Issued", icon: "📋", subtitle: "Driver assigned & 3-Page Waybill generated" },
  { key: "refilling", title: "Depot Refill", icon: "💧", subtitle: "Refilling AdBlue DEF at Bay 1" },
  { key: "in_transit", title: "En-Route Transit", icon: "🚗", subtitle: "Truck on Highway 65 to customer" },
  { key: "delivered", title: "Delivered & SAP", icon: "✅", subtitle: "Delivery complete & SAP Doc posted" },
];

const DEPOT_COORDS: [number, number] = [24.1554, 47.3346];

export const DeliveryJourneyModal: React.FC<Props> = ({
  order,
  onClose,
  onViewWaybill,
  onUpdateStatus,
}) => {
  const [currentStageIdx, setCurrentStageIdx] = useState<number>(() => {
    const idx = STAGES.findIndex((s) => s.key === order.status);
    return idx >= 0 ? idx : 1;
  });
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [dispensedLitres, setDispensedLitres] = useState<number>(0);
  const [transitKm, setTransitKm] = useState<number>(38);
  const [transitSpeed, setTransitSpeed] = useState<number>(64);
  const autoPlayTimerRef = useRef<any>(null);
  const pumpTimerRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const modalMapRef = useRef<L.Map | null>(null);
  const truckMarkerRef = useRef<L.Marker | null>(null);

  const targetQty = order.qty_litres || 60;
  const currentStage = STAGES[currentStageIdx] || STAGES[0];
  const destCoords: [number, number] = [order.delivery_lat || 24.613, order.delivery_lng || 46.772];

  // Sync internal stage changes with global state
  useEffect(() => {
    if (order?.order_id && currentStage?.key) {
      onUpdateStatus(order.order_id, currentStage.key);
    }
  }, [currentStageIdx, order?.order_id]);

  // Stage 3 Pump simulation
  useEffect(() => {
    if (currentStage.key === "refilling") {
      setDispensedLitres(0);
      let val = 0;
      pumpTimerRef.current = setInterval(() => {
        val += 3.5;
        if (val >= targetQty) {
          val = targetQty;
          clearInterval(pumpTimerRef.current);
        }
        setDispensedLitres(parseFloat(val.toFixed(2)));
      }, 100);
    } else if (currentStageIdx > 2) {
      setDispensedLitres(targetQty);
    }
    return () => {
      if (pumpTimerRef.current) clearInterval(pumpTimerRef.current);
    };
  }, [currentStageIdx, targetQty]);

  // Stage 4 Leaflet Map Initialization & Animation
  useEffect(() => {
    if (currentStage.key !== "in_transit" || !mapContainerRef.current) {
      if (modalMapRef.current) {
        modalMapRef.current.remove();
        modalMapRef.current = null;
        truckMarkerRef.current = null;
      }
      return;
    }

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer("https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
      maxZoom: 19,
    }).addTo(map);

    // Depot Pin
    const depotIcon = L.divIcon({
      className: "journey-depot-divicon",
      html: `
        <div class="journey-pin-container">
          <div class="journey-avatar-circle depot-circle">
            <span class="journey-emoji">⛽</span>
          </div>
          <div class="journey-pin-pill dark">
            <span>Kharj Central Depot</span>
          </div>
        </div>
      `,
      iconSize: [140, 60],
      iconAnchor: [70, 30],
    });
    L.marker(DEPOT_COORDS, { icon: depotIcon }).addTo(map);

    // Customer Destination Pin
    const destIcon = L.divIcon({
      className: "journey-dest-divicon",
      html: `
        <div class="journey-pin-container">
          <div class="journey-avatar-circle dest-circle">
            <span class="journey-emoji">🏢</span>
          </div>
          <div class="journey-pin-pill emerald">
            <span>${order.customer_name.substring(0, 22)}</span>
          </div>
        </div>
      `,
      iconSize: [160, 60],
      iconAnchor: [80, 30],
    });
    L.marker(destCoords, { icon: destIcon }).addTo(map);

    // Route Polyline
    L.polyline([DEPOT_COORDS, destCoords], {
      color: "#2563EB",
      weight: 5,
      dashArray: "8, 6",
      opacity: 0.85,
    }).addTo(map);

    // Animated Truck Marker with live speed and wave animation
    const truckIcon = L.divIcon({
      className: "journey-truck-divicon",
      html: `
        <div class="journey-pin-container">
          <div class="journey-avatar-circle truck-circle pulse-wave">
            <span class="journey-emoji">🚛</span>
          </div>
          <div class="journey-pin-pill blue">
            <span class="truck-name-bold">ALM-TRK-1041</span>
            <span class="truck-speed-tag">${transitSpeed} km/h</span>
          </div>
        </div>
      `,
      iconSize: [130, 60],
      iconAnchor: [65, 30],
    });
    const truck = L.marker(DEPOT_COORDS, { icon: truckIcon }).addTo(map);
    truckMarkerRef.current = truck;

    // Fit bounds with comfortable padding
    const bounds = L.latLngBounds([DEPOT_COORDS, destCoords]);
    map.fitBounds(bounds, { padding: [50, 50] });

    modalMapRef.current = map;
    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      modalMapRef.current = null;
      truckMarkerRef.current = null;
    };
  }, [currentStage.key]);

  // Stage 4 Transit countdown simulation + truck movement along route
  useEffect(() => {
    let km = 38;
    let timer: any = null;
    if (currentStage.key === "in_transit") {
      setTransitKm(38);
      timer = setInterval(() => {
        km -= 2.5;
        if (km <= 2) km = 2;
        const newKm = parseFloat(km.toFixed(1));
        const newSpeed = Math.floor(58 + Math.random() * 12);
        setTransitKm(newKm);
        setTransitSpeed(newSpeed);

        // Interpolate truck position between Depot and Customer
        const progress = Math.max(0, Math.min(1, (38 - km) / 38));
        const curLat = DEPOT_COORDS[0] + (destCoords[0] - DEPOT_COORDS[0]) * progress;
        const curLng = DEPOT_COORDS[1] + (destCoords[1] - DEPOT_COORDS[1]) * progress;
        if (truckMarkerRef.current) {
          truckMarkerRef.current.setLatLng([curLat, curLng]);
          const updatedIcon = L.divIcon({
            className: "journey-truck-divicon",
            html: `
              <div class="journey-pin-container">
                <div class="journey-avatar-circle truck-circle pulse-wave">
                  <span class="journey-emoji">🚛</span>
                </div>
                <div class="journey-pin-pill blue">
                  <span class="truck-name-bold">ALM-TRK-1041</span>
                  <span class="truck-speed-tag">${newSpeed} km/h</span>
                </div>
              </div>
            `,
            iconSize: [130, 60],
            iconAnchor: [65, 30],
          });
          truckMarkerRef.current.setIcon(updatedIcon);
        }
      }, 300);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [currentStageIdx]);

  // Auto-play progression timer
  useEffect(() => {
    if (!isPlaying) {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
      return;
    }

    autoPlayTimerRef.current = setTimeout(() => {
      if (currentStageIdx < STAGES.length - 1) {
        setCurrentStageIdx((prev) => prev + 1);
      } else {
        setIsPlaying(false);
      }
    }, currentStageIdx === 3 ? 5000 : currentStageIdx === 2 ? 3800 : 3200); // Give transit stage 5 seconds

    return () => {
      if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current);
    };
  }, [isPlaying, currentStageIdx]);

  const handleNext = () => {
    setIsPlaying(false);
    if (currentStageIdx < STAGES.length - 1) {
      setCurrentStageIdx((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    setIsPlaying(false);
    if (currentStageIdx > 0) {
      setCurrentStageIdx((prev) => prev - 1);
    }
  };

  const handleRestart = () => {
    setCurrentStageIdx(0);
    setDispensedLitres(0);
    setTransitKm(38);
    setIsPlaying(true);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content glass-panel journey-modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "860px", padding: "0", overflow: "hidden" }}
      >
        {/* Header Bar */}
        <div className="journey-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div className="journey-pulse-icon">🚚</div>
            <div>
              <div style={{ fontSize: "16px", fontWeight: 800, color: "#0F172A", letterSpacing: "-0.02em" }}>
                ALMARAI END-TO-END DELIVERY JOURNEY
              </div>
              <div style={{ fontSize: "12px", color: "#64748B" }}>
                Order <b>#{order.order_id}</b> &nbsp;·&nbsp; {order.customer_name} &nbsp;·&nbsp; {order.qty_litres}L {order.product}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span className={`header-tag-pill ${currentStage?.key === "delivered" ? "emerald" : "cyan"}`}>
              {isPlaying ? "▶ AUTO-SIMULATING" : "⏸ PAUSED"}
            </span>
            <button className="modal-close-btn" style={{ position: "static" }} onClick={onClose}>
              &times;
            </button>
          </div>
        </div>

        {/* 5-Stage Stepper Ribbon */}
        <div className="journey-stepper-ribbon">
          {STAGES.map((s, idx) => {
            const isDone = currentStageIdx > idx;
            const isCurrent = currentStageIdx === idx;
            return (
              <div
                key={s.key}
                className={`journey-step-node ${isDone ? "done" : isCurrent ? "active" : ""}`}
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentStageIdx(idx);
                }}
              >
                <div className="step-circle">
                  {isDone ? "✓" : s.icon}
                </div>
                <div className="step-label-group">
                  <span className="step-num">STAGE {idx + 1}</span>
                  <span className="step-name">{s.title}</span>
                </div>
                {idx < STAGES.length - 1 && <div className="step-connector" />}
              </div>
            );
          })}
        </div>

        {/* Dynamic Center Stage Viewer */}
        <div className="journey-stage-body">
          {/* STAGE 1: Order Placed */}
          {currentStageIdx === 0 && (
            <div className="stage-card-view animate-fade-in">
              <div className="stage-badge-tag amber">STAGE 1: CUSTOMER ORDER PLACED</div>
              <div className="stage-hero-title">AdBlue Order Registered in Central ERP</div>
              <p className="stage-hero-desc">
                Customer <b>{order.customer_name}</b> placed a requisition for <b>{order.qty_litres} Litres</b> of <b>{order.product}</b> with scheduled dispatch slot.
              </p>

              <div className="stage-meta-grid">
                <div className="meta-box">
                  <span className="lbl">CUSTOMER HUB</span>
                  <span className="val">{order.customer_name}</span>
                </div>
                <div className="meta-box">
                  <span className="lbl">REQUESTED VOLUME</span>
                  <span className="val green">{order.qty_litres} Litres ({order.product})</span>
                </div>
                <div className="meta-box">
                  <span className="lbl">ORDER TIMESTAMP</span>
                  <span className="val">{order.placed_at}</span>
                </div>
                <div className="meta-box">
                  <span className="lbl">DISPATCH STATUS</span>
                  <span className="val amber">Pending Driver Assignment ⏳</span>
                </div>
              </div>
            </div>
          )}

          {/* STAGE 2: Waybill Generated */}
          {currentStageIdx === 1 && (
            <div className="stage-card-view animate-fade-in">
              <div className="stage-badge-tag blue">STAGE 2: DRIVER ACCEPTED &amp; WAYBILL ISSUED</div>
              <div className="stage-hero-title">Official Almarai 3-Page Waybill Generated</div>
              <p className="stage-hero-desc">
                Carrier driver <b>175076, AZHAR UD DIN</b> accepted the trip on Tractor <b>500609 (ALM-TRK-1041)</b>. The official government compliant waybill is active.
              </p>

              <div className="stage-meta-grid" style={{ marginBottom: "16px" }}>
                <div className="meta-box">
                  <span className="lbl">WAYBILL NUMBER</span>
                  <span className="val blue">FO #{order.waybill_no || "280820260001"}</span>
                </div>
                <div className="meta-box">
                  <span className="lbl">ASSIGNED TRUCK</span>
                  <span className="val">ALM-TRK-1041 (Trailer 26344)</span>
                </div>
                <div className="meta-box">
                  <span className="lbl">ASSIGNED DRIVER</span>
                  <span className="val">175076, AZHAR UD DIN</span>
                </div>
                <div className="meta-box">
                  <span className="lbl">ESTIMATED TRIP ETA</span>
                  <span className="val">{order.estimated_eta || "2h 30min"}</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  className="btn-action auto-demo"
                  style={{ flex: 1, justifyContent: "center", padding: "12px" }}
                  onClick={() => onViewWaybill(order)}
                >
                  📄 View &amp; Print Official Almarai Waybill (3 Pages)
                </button>
              </div>
            </div>
          )}

          {/* STAGE 3: Depot Refill */}
          {currentStageIdx === 2 && (
            <div className="stage-card-view animate-fade-in">
              <div className="stage-badge-tag orange">STAGE 3: FORECOURT REFILL AT KHARJ DEPOT</div>
              <div className="stage-hero-title">Electronic Solenoid Dispensing at Bay 1</div>
              <p className="stage-hero-desc">
                Truck arrived inside the 250m Kharj Geofence. 8-Point Audit Verification passed. Automated solenoid valve opened.
              </p>

              <div className="pump-simulation-box">
                <div className="pump-lcd-display">
                  <div className="lcd-label">REAL-TIME VOLUME DELIVERED</div>
                  <div className="lcd-digits">{dispensedLitres.toFixed(2)} <span style={{ fontSize: "16px" }}>L</span></div>
                  <div className="lcd-sub">PRESET TARGET: {targetQty}.00 L &nbsp;·&nbsp; FLOW RATE: 38.6 L/MIN</div>
                </div>

                <div className="pump-safety-strip">
                  <span className="safety-check">✓ Geofence: INSIDE</span>
                  <span className="safety-check">✓ Barcode: VERIFIED</span>
                  <span className="safety-check">✓ Solenoid: ARMED</span>
                  <span className="safety-check">✓ Temp: +22°C</span>
                </div>
              </div>
            </div>
          )}

          {/* STAGE 4: En-Route Transit */}
          {currentStageIdx === 3 && (
            <div className="stage-card-view animate-fade-in">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px", flexWrap: "wrap", gap: "6px" }}>
                <div>
                  <div className="stage-badge-tag green">STAGE 4: HIGHWAY 65 TRANSIT</div>
                  <div className="stage-hero-title" style={{ fontSize: "17px", margin: "2px 0" }}>Live GPS Telematics En Route to Customer</div>
                </div>
                <div style={{ background: "#F1F5F9", border: "1px solid #CBD5E1", borderRadius: "14px", padding: "4px 10px", fontSize: "11px", fontWeight: 700, color: "#334155" }}>
                  🛣️ Riyadh Highway 65 Corridor
                </div>
              </div>

              <div className="stage4-split-layout">
                {/* Left Telemetry Sidebar */}
                <div className="stage4-telemetry-col">
                  <div className="stage4-telemetry-pill">
                    <span className="pill-icon">⚡</span>
                    <div>
                      <div className="pill-val">{transitSpeed} km/h</div>
                      <div className="pill-lbl">CURRENT SPEED</div>
                    </div>
                  </div>
                  <div className="stage4-telemetry-pill">
                    <span className="pill-icon">📍</span>
                    <div>
                      <div className="pill-val">{transitKm} km</div>
                      <div className="pill-lbl">REMAINING DISTANCE</div>
                    </div>
                  </div>
                  <div className="stage4-telemetry-pill">
                    <span className="pill-icon">⏱️</span>
                    <div>
                      <div className="pill-val">18 mins</div>
                      <div className="pill-lbl">ESTIMATED ARRIVAL</div>
                    </div>
                  </div>
                  <div className="stage4-truck-info">
                    <div style={{ fontWeight: 800, fontSize: "12px", color: "#0F172A" }}>🚛 ALM-TRK-1041</div>
                    <div style={{ fontSize: "11px", color: "#64748B" }}>Driver: 175076, AZHAR UD DIN</div>
                    <div style={{ fontSize: "10px", color: "#16A34A", fontWeight: 700, marginTop: "2px" }}>● Telematics: ONLINE (100% OK)</div>
                  </div>
                </div>

                {/* Right Interactive Live Map */}
                <div className="journey-modal-map-wrap">
                  <div ref={mapContainerRef} className="journey-modal-map" />
                  <div className="journey-map-status-pill">
                    <span className="led-pulse" /> LIVE TELEMATICS
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STAGE 5: Delivered & SAP Reconciled */}
          {currentStageIdx === 4 && (
            <div className="stage-card-view animate-fade-in">
              <div className="stage-badge-tag emerald">STAGE 5: DELIVERY CONFIRMED &amp; SAP POSTED</div>
              <div className="stage-hero-title">Proof of Delivery Verified &amp; Goods Issue Complete</div>
              <p className="stage-hero-desc">
                Driver arrived at <b>{order.customer_name}</b>. Customer seal inspection confirmed. Electronic Goods Issue posted to SAP ERP.
              </p>

              <div className="pod-success-card">
                <div className="pod-header">
                  <span style={{ fontSize: "24px" }}>🎉</span>
                  <div>
                    <div style={{ fontWeight: 800, color: "#065F46", fontSize: "14px" }}>TRIP COMPLETED SUCCESSFULLY</div>
                    <div style={{ fontSize: "11px", color: "#047857" }}>Customer Sign-off Confirmed · Goods Received at Destination</div>
                  </div>
                </div>
                <div className="stage-meta-grid" style={{ marginTop: "12px" }}>
                  <div className="meta-box">
                    <span className="lbl">SAP MATERIAL DOC</span>
                    <span className="val purple">DOC #4901824901</span>
                  </div>
                  <div className="meta-box">
                    <span className="lbl">DELIVERED QUANTITY</span>
                    <span className="val green">{order.qty_litres} Litres</span>
                  </div>
                  <div className="meta-box">
                    <span className="lbl">DELIVERED AT</span>
                    <span className="val">{order.delivered_at || new Date().toLocaleTimeString("en-GB", { hour12: false })}</span>
                  </div>
                  <div className="meta-box">
                    <span className="lbl">RECONCILIATION</span>
                    <span className="val emerald">100% Reconciled ✓</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Playback Controls */}
        <div className="journey-modal-footer">
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className="btn-action"
              style={{ padding: "8px 14px", fontSize: "12px" }}
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? "⏸ Pause Demo" : "▶ Resume Auto-Play"}
            </button>
            <button
              className="btn-action"
              style={{ padding: "8px 14px", fontSize: "12px" }}
              onClick={handleRestart}
            >
              🔄 Replay Journey
            </button>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className="btn-action"
              style={{ padding: "8px 14px", fontSize: "12px" }}
              onClick={handlePrev}
              disabled={currentStageIdx === 0}
            >
              ← Prev Stage
            </button>
            {currentStageIdx < STAGES.length - 1 ? (
              <button
                className="btn-action auto-demo"
                style={{ padding: "8px 18px", fontSize: "12px" }}
                onClick={handleNext}
              >
                Next Stage →
              </button>
            ) : (
              <button
                className="btn-action"
                style={{ padding: "8px 20px", fontSize: "12px", background: "#16A34A", color: "#fff", border: "none" }}
                onClick={onClose}
              >
                ✓ Complete &amp; Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

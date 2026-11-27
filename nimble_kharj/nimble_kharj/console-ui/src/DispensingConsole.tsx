import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { api, subscribe, workerApi, WorkerStats } from "./api";
import { AlmaraiWaybillDoc } from "./AlmaraiWaybillDoc";
import { autoGenerateArabicDesc } from "./arabicTranslator";
import CustomerPortal, { CustomerOrder, CustomerOrderStatus } from "./CustomerPortal";
import { DeliveryJourneyModal } from "./DeliveryJourneyModal";
import { db, DBTodayRecord, DBIotDispenseLog, getTodayDateStr } from "./db";
import { AutomatedAdBlueReport } from "./AutomatedAdBlueReport";
import { AdBlueReportRecord, INITIAL_ADBLUE_REPORT_DATA } from "./adblueReportData";
import { AdBlueProcessWorkflow } from "./AdBlueProcessWorkflow";
import { Site3DTankTwin } from "./Site3DTankTwin";
import { TankHistoryPage } from "./TankHistoryPage";
import { ApprovedVehiclesPage, ApprovedVehicle } from "./ApprovedVehiclesPage";
import { IotDispenseFeed } from "./IotDispenseFeed";
import "./console.css";

/* ==========================================================================
   NIMBLE VISION — KHARJ ENTERPRISE OPERATIONS CONSOLE
   Stunning Dark Glassmorphism UI
   ========================================================================== */

const POLL_MS = 3000;
const TRAIL_MAX = 50;

type NavTab = "today_monitor" | "iot_feed" | "approved_vehicles" | "adblue_workflow" | "adblue_report" | "site_3d" | "tank_history" | "forecourt" | "fleet_gps" | "waybills" | "sap_ledger" | "analytics";
type MapLayerType = "light" | "satellite" | "terrain";

type Vehicle = {
  name: string;
  vehicle_no: string;
  driver_name: string;
  plate_no: string;
  sap_equipment_no: string;
  adblue_tank_capacity: number;
  last_latitude?: number;
  last_longitude?: number;
  last_speed_kmph?: number;
  last_heading?: number;
  last_ping_at?: string;
  geofence_state?: string;
  distance_m?: number;
  fix_age_s?: number;
  fix_stale?: boolean;
  route: string;
  adblue_level_pct: number;
};

type Station = {
  name: string;
  station_name: string;
  latitude: number;
  longitude: number;
  geofence_radius_m: number;
};

type Waybill = {
  name: string;
  waybill_no: string;
  vehicle: string;
  product: string;
  route: string;
  entitlement_qty: number;
  dispensed_qty: number;
  balance_qty: number;
  status: string;
  valid_to: string;
  valid_from: string;
  trip_start: string;
};

type Txn = {
  name: string;
  waybill: string;
  vehicle: string;
  status: string;
  dispensed_qty: number;
  sap_status: string;
  sap_document_no?: string;
  completed_at?: string;
  product: string;
};

type Unit = {
  name: string;
  status: string;
  product: string;
  totalizer_l: number;
  buffered_records: number;
  nozzle_count: number;
  firmware_version: string;
};

type Ev = {
  key: string;
  t: string;
  state: string;
  detail: string;
  source: "Dispenser" | "Cloud" | "SAP" | "GPS" | string;
};

type AuditCheck = {
  code: string;
  label: string;
  passed: boolean;
  detail: string;
};

// Initial Real-world Al Kharj Master Data
const INITIAL_STATION: Station = {
  name: "KHARJ-01",
  station_name: "Almarai Kharj Central AdBlue Depot",
  latitude: 24.1554,
  longitude: 47.3346,
  geofence_radius_m: 250,
};

const INITIAL_VEHICLES: Vehicle[] = [
  {
    name: "ALM-TRK-1041",
    vehicle_no: "ALM-TRK-1041",
    plate_no: "8412 KHA",
    driver_name: "R. Fernandes",
    sap_equipment_no: "EQ-1041",
    adblue_tank_capacity: 60,
    last_latitude: 24.1551,
    last_longitude: 47.3342,
    last_speed_kmph: 0,
    last_heading: 45,
    geofence_state: "Inside",
    distance_m: 48,
    fix_age_s: 2,
    fix_stale: false,
    route: "Kharj Depot -> Riyadh Highway 65",
    adblue_level_pct: 22,
  },
  {
    name: "ALM-TRK-1082",
    vehicle_no: "ALM-TRK-1082",
    plate_no: "3927 RSH",
    driver_name: "M. Haddad",
    sap_equipment_no: "EQ-1082",
    adblue_tank_capacity: 60,
    last_latitude: 24.182,
    last_longitude: 47.368,
    last_speed_kmph: 58,
    last_heading: 215,
    geofence_state: "Outside",
    distance_m: 4620,
    fix_age_s: 3,
    fix_stale: false,
    route: "Kharj Depot -> Dammam Route 522",
    adblue_level_pct: 18,
  },
  {
    name: "ALM-TRK-1119",
    vehicle_no: "ALM-TRK-1119",
    plate_no: "6650 JDH",
    driver_name: "S. Kurian",
    sap_equipment_no: "EQ-1119",
    adblue_tank_capacity: 75,
    last_latitude: 24.115,
    last_longitude: 47.298,
    last_speed_kmph: 64,
    last_heading: 30,
    geofence_state: "Outside",
    distance_m: 5890,
    fix_age_s: 4,
    fix_stale: false,
    route: "Kharj Depot -> Jeddah Express Line",
    adblue_level_pct: 14,
  },
];

const INITIAL_WAYBILLS: Waybill[] = [
  {
    name: "280820260001",
    waybill_no: "280820260001",
    vehicle: "ALM-TRK-1041",
    product: "AdBlue",
    route: "Kharj Depot -> Riyadh Highway 65",
    entitlement_qty: 60.0,
    dispensed_qty: 0.0,
    balance_qty: 60.0,
    status: "Open",
    valid_from: "2026-08-26 06:00:00",
    valid_to: "2026-08-28 23:59:00",
    trip_start: "2026-08-26 08:30:00",
  },
  {
    name: "280820260002",
    waybill_no: "280820260002",
    vehicle: "ALM-TRK-1082",
    product: "AdBlue",
    route: "Kharj Depot -> Dammam Route 522",
    entitlement_qty: 45.0,
    dispensed_qty: 0.0,
    balance_qty: 45.0,
    status: "Open",
    valid_from: "2026-08-26 06:00:00",
    valid_to: "2026-08-28 23:59:00",
    trip_start: "2026-08-26 09:15:00",
  },
  {
    name: "280820260003",
    waybill_no: "280820260003",
    vehicle: "ALM-TRK-1119",
    product: "AdBlue",
    route: "Kharj Depot -> Jeddah Express Line",
    entitlement_qty: 75.0,
    dispensed_qty: 0.0,
    balance_qty: 75.0,
    status: "Open",
    valid_from: "2026-08-26 06:00:00",
    valid_to: "2026-08-28 23:59:00",
    trip_start: "2026-08-26 07:00:00",
  },
];

const INITIAL_UNITS: Unit[] = [
  {
    name: "ADB-DU-01",
    status: "Online",
    product: "AdBlue",
    totalizer_l: 14820.5,
    buffered_records: 0,
    nozzle_count: 2,
    firmware_version: "nv-kharj-v2.4.0",
  },
];

const clock = (d = new Date()) => d.toLocaleTimeString("en-GB", { hour12: false });

export const getLocalFormattedDateTime = (d = new Date()) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const fmtDist = (m?: number) => {
  if (m == null) return "—";
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;
};

export default function DispensingConsole({
  currentUser = "admin",
  onLogout,
}: {
  currentUser?: string;
  onLogout?: () => void;
} = {}) {
  const [activeTab, setActiveTab] = useState<NavTab>("today_monitor");
  const [userRole, setUserRole] = useState<"supervisor" | "operator" | "driver" | "customer">("supervisor");
  const [mapLayer, setMapLayer] = useState<MapLayerType>("light");
  // Shared Customer Orders — persisted dynamically in DB
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>(() => db.getOrders());
  const [driverTab, setDriverTab] = useState<"mission" | "history" | "stats">("mission");
  const [driverActiveOrderId, setDriverActiveOrderId] = useState<string | null>(null);
  const [viewWaybillOrder, setViewWaybillOrder] = useState<CustomerOrder | null>(null);
  // Customer delivery pins on supervisor map (keyed by order_id)
  const custMarkersRef = useRef<Record<string, L.Marker>>({});
  const custRouteLinesRef = useRef<Record<string, L.Polyline>>({});
  const [station, setStation] = useState<Station>(INITIAL_STATION);
  const [mapReady, setMapReady] = useState(false);
  const [activeModal, setActiveModal] = useState<"none" | "verification" | "dispenser" | "sap" | "create_order" | "journey_flow">("none");
  
  // Order creation form state (Customer & Dispatch replenishment)
  const [orderForm, setOrderForm] = useState({
    customer: "CPP RIYADH SOUTH FOODS 01 (CUSTOMER)",
    arabic_desc: autoGenerateArabicDesc("CPP RIYADH SOUTH FOODS 01 (CUSTOMER)"),
    final_destination: "RIYADH SOUTH DEPOT",
    vehicle: "ALM-TRK-1041",
    tractor_no: "500609 (ALM-TRK-1041)",
    trailer_no: "26344",
    driver: "175076, AZHAR UD DIN",
    product: "AdBlue",
    entitlement_qty: 60,
    route: "Kharj Depot ➔ Riyadh Highway 65 ➔ Riyadh South Depot",
  });

  const [vehicles, setVehicles] = useState<Vehicle[]>([
    { name: "ALM-TRK-1041", vehicle_no: "ALM-TRK-1041", plate_no: "500609 KSA", status: "Active", route: "Kharj Depot ➔ Riyadh Highway 65 ➔ Riyadh South Depot", driver: "175076, AZHAR UD DIN", last_latitude: 24.1551, last_longitude: 47.3342, distance_m: 0, geofence_state: "Inside", last_speed_kmph: 0, adblue_level_pct: 42 },
    { name: "ALM-TRK-1082", vehicle_no: "ALM-TRK-1082", plate_no: "884192 KSA", status: "Active", route: "Kharj Depot ➔ Dammam Route 522 ➔ Dammam WH", driver: "189204, M. HADDAD", last_latitude: 24.182, last_longitude: 47.368, distance_m: 5400, geofence_state: "Outside", last_speed_kmph: 58, adblue_level_pct: 88 },
    { name: "ALM-TRK-1119", vehicle_no: "ALM-TRK-1119", plate_no: "772105 KSA", status: "Active", route: "Kharj Depot ➔ Jeddah Express Line ➔ Jeddah Central", driver: "194012, S. KURIAN", last_latitude: 24.115, last_longitude: 47.298, distance_m: 12400, geofence_state: "Outside", last_speed_kmph: 64, adblue_level_pct: 15 },
  ]);
  const [units, setUnits] = useState<Unit[]>(INITIAL_UNITS);
  const [waybills, setWaybills] = useState<Waybill[]>(INITIAL_WAYBILLS);
  const [txns, setTxns] = useState<Txn[]>(() => db.getTransactions() as Txn[]);

  const [selectedVehicle, setSelectedVehicle] = useState<string>("ALM-TRK-1041");
  const [selectedWaybillNo, setSelectedWaybillNo] = useState<string>("6101015888");
  const [dispenseLitres, setDispenseLitres] = useState<number>(0);
  const [flowRateLpm, setFlowRateLpm] = useState<number>(0);
  const [isDispensing, setIsDispensing] = useState<boolean>(false);
  const [isScanningLaser, setIsScanningLaser] = useState<boolean>(false);
  const [outboxCount, setOutboxCount] = useState<number>(0);
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);
  const [bufferedCount, setBufferedCount] = useState<number>(0);
  const [operatorName] = useState<string>("Tarun Kumar");

  // Official Automated AdBlue Report State & 11-Step Process Workflow State
  const [dynamicReportRecords, setDynamicReportRecords] = useState<AdBlueReportRecord[]>([]);
  const [workflowStepIndex, setWorkflowStepIndex] = useState<number>(1);

  // Dedicated Today's Operations & Monitoring state
  const [todayRecords, setTodayRecords] = useState<DBTodayRecord[]>(() => db.getTodayRecords());
  const [todayScannerInput, setTodayScannerInput] = useState<string>("");
  const [todaySelectedWb, setTodaySelectedWb] = useState<DBTodayRecord | null>(() => {
    const list = db.getTodayRecords();
    return list.find((r) => r.status === "Scanned") || list[0] || null;
  });
  const [isTodayDispensing, setIsTodayDispensing] = useState<boolean>(false);
  const [iotLogs, setIotLogs] = useState<DBIotDispenseLog[]>(() => db.getIotLogs());
  const [todayDispenseProgress, setTodayDispenseProgress] = useState<number>(0);
  const [todayFlowRate, setTodayFlowRate] = useState<number>(0);
  const [todaySearchQuery, setTodaySearchQuery] = useState<string>("");
  const [todayStatusFilter, setTodayStatusFilter] = useState<"all" | "Completed" | "Scanned">("all");
  const [workerStats, setWorkerStats] = useState<WorkerStats | null>(null);
  const [dispenseVehicleInput, setDispenseVehicleInput] = useState<string>("KL11BV2662");
  const [dispenseLitersInput, setDispenseLitersInput] = useState<number>(45.0);
  const [logDateFilter, setLogDateFilter] = useState<string>("");
  const [logSearchQuery, setLogSearchQuery] = useState<string>("");
  const [inspectedIotLog, setInspectedIotLog] = useState<DBIotDispenseLog | null>(null);

  // 8-Point Verification Engine state
  const [validationResults, setValidationResults] = useState<AuditCheck[]>([
    { code: "WB_FOUND", label: "Waybill Resolved from QR Barcode", passed: true, detail: "FO 6101015888 (Verified)" },
    { code: "WB_STATUS", label: "Waybill Status Active (Open)", passed: true, detail: "Status: OPEN" },
    { code: "WB_WINDOW", label: "Inside Validity Window", passed: true, detail: "Valid through Aug 28, 2026" },
    { code: "PROD_MATCH", label: "Product Matches Pump Nozzle", passed: true, detail: "AdBlue <=> ADB-DU-01" },
    { code: "VEH_MATCH", label: "Vehicle ID Matches Waybill", passed: true, detail: "ALM-TRK-1041 Matched" },
    { code: "STN_MATCH", label: "Station Authorised on Waybill", passed: true, detail: "KHARJ-01 Depot" },
    { code: "ENTITLEMENT", label: "Entitlement Balance Available", passed: true, detail: "60.00 L Entitlement" },
    { code: "GEOFENCE", label: "Vehicle Inside Station Geofence", passed: true, detail: "48m from station (Inside 250m Ring)" },
  ]);

  const [events, setEvents] = useState<Ev[]>([
    { key: "1", t: "13:20:00", state: "SYSTEM_ONLINE", detail: "Cloud Server connected to Station", source: "Cloud" },
    { key: "2", t: "13:21:10", state: "GPS_PING", detail: "Truck ALM-TRK-1041 inside Geofence", source: "GPS" },
    { key: "3", t: "13:22:45", state: "QR_RESOLVED", detail: "Scanned Waybill FO 6101015888 (Passed)", source: "Dispenser" },
  ]);

  const trails = useRef<Record<string, [number, number][]>>({
    "ALM-TRK-1041": [[24.156, 47.336], [24.1555, 47.335], [24.1551, 47.3342]],
    "ALM-TRK-1082": [[24.21, 47.4], [24.195, 47.38], [24.182, 47.368]],
    "ALM-TRK-1119": [[24.08, 47.26], [24.09, 47.27], [24.115, 47.298]],
  });

  const tapeEndRef = useRef<HTMLDivElement>(null);
  const flowTimerRef = useRef<any>(null);

  // Leaflet Map Refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const geofenceCircleRef = useRef<L.Circle | null>(null);
  const polylinesRef = useRef<Record<string, L.Polyline>>({});

  const pushEvent = useCallback((state: string, detail: string, source = "Cloud") => {
    setEvents((prev) => [
      ...prev.slice(-80),
      { key: `${Date.now()}-${Math.random()}`, t: clock(), state, detail, source },
    ]);
  }, []);

  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // Leaflet Map Lifecycle & Layer Management
  // ---------------------------------------------------------------------------
  const TILE_URLS: Record<MapLayerType, string> = {
    light: "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
    satellite: "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
    terrain: "https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}",
  };

  useEffect(() => {
    if (userRole !== "supervisor") {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        markersRef.current = {};
        polylinesRef.current = {};
        custMarkersRef.current = {};
        custRouteLinesRef.current = {};
        setMapReady(false);
      }
      return;
    }

    if (!mapContainerRef.current) return;
    if (leafletMapRef.current) return;

    mapContainerRef.current.style.height = "100%";
    mapContainerRef.current.style.width = "100%";

    const map = L.map(mapContainerRef.current, {
      center: [station.latitude, station.longitude],
      zoom: 13,
      zoomControl: true,
      attributionControl: false,
    });

    const tileLayer = L.tileLayer(TILE_URLS[mapLayer], {
      maxZoom: 19,
      subdomains: "abcd",
    }).addTo(map);

    // 250m Geofence Circle - Neon Cyan style
    const geofence = L.circle([station.latitude, station.longitude], {
      radius: station.geofence_radius_m,
      color: "#22d3ee",
      weight: 2,
      fillColor: "#22d3ee",
      fillOpacity: 0.1,
      dashArray: "4, 6",
    }).addTo(map);

    geofence.bindPopup(`
      <div style="font-family: 'Inter', sans-serif; font-size: 12px; color: #020617;">
        <b style="color: #0f62fe;">KHARJ DEPOT</b><br/>
        Radius: ${station.geofence_radius_m}m
      </div>
    `);

    leafletMapRef.current = map;
    tileLayerRef.current = tileLayer;
    geofenceCircleRef.current = geofence;
    setMapReady(true);

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    // Initial resize kicks to guarantee tiles appear immediately
    setTimeout(() => map.invalidateSize(), 50);
    setTimeout(() => map.invalidateSize(), 200);
    setTimeout(() => map.invalidateSize(), 500);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      leafletMapRef.current = null;
      markersRef.current = {};
      polylinesRef.current = {};
      custMarkersRef.current = {};
      custRouteLinesRef.current = {};
      setMapReady(false);
    };
  }, [userRole, station.latitude, station.longitude, station.geofence_radius_m]);

  // Invalidate map size when tab switches to Forecourt
  useEffect(() => {
    if (userRole === "supervisor" && activeTab === "forecourt" && leafletMapRef.current) {
      const map = leafletMapRef.current;
      setTimeout(() => map.invalidateSize(), 50);
      setTimeout(() => map.invalidateSize(), 150);
      setTimeout(() => map.invalidateSize(), 400);
    }
  }, [activeTab, userRole]);

  // Update Tile Layer on switch
  useEffect(() => {
    if (!leafletMapRef.current || !tileLayerRef.current) return;
    tileLayerRef.current.setUrl(TILE_URLS[mapLayer]);
  }, [mapLayer]);

  // Update Vehicle Markers & Polylines on Leaflet Map
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    vehicles.forEach((v) => {
      if (v.last_latitude == null || v.last_longitude == null) return;
      const isInside = v.geofence_state === "Inside";

      const markerHtml = `
        <div class="custom-truck-pin">
          <div class="truck-marker-circle ${isInside ? "inside-station" : ""}">🚛</div>
          <div class="truck-marker-label">${v.vehicle_no}</div>
        </div>
      `;

      const icon = L.divIcon({
        className: "leaflet-truck-divicon",
        html: markerHtml,
        iconSize: [80, 50],
        iconAnchor: [40, 25],
      });

      if (markersRef.current[v.name]) {
        markersRef.current[v.name].setLatLng([v.last_latitude, v.last_longitude]);
        markersRef.current[v.name].setIcon(icon);
      } else {
        const marker = L.marker([v.last_latitude, v.last_longitude], { icon })
          .addTo(map)
          .on("click", () => {
            setSelectedVehicle(v.name);
          });
        markersRef.current[v.name] = marker;
      }

      // Breadcrumb Polylines
      const t = trails.current[v.name] ?? [];
      if (t.length >= 2) {
        if (polylinesRef.current[v.name]) {
          polylinesRef.current[v.name].setLatLngs(t as [number, number][]);
        } else {
          const polyline = L.polyline(t as [number, number][], {
            color: "#22d3ee",
            weight: 3,
            dashArray: "4, 4",
            opacity: 0.6,
          }).addTo(map);
          polylinesRef.current[v.name] = polyline;
        }
      }
    });

    // Draw customer delivery pins & route lines on supervisor map
    customerOrders.forEach((order) => {
      const key = order.order_id;
      if (order.status === "delivered") {
        // Clean up delivered order pins
        if (custMarkersRef.current[key]) { custMarkersRef.current[key].remove(); delete custMarkersRef.current[key]; }
        if (custRouteLinesRef.current[key]) { custRouteLinesRef.current[key].remove(); delete custRouteLinesRef.current[key]; }
        return;
      }
      const statusColors: Record<CustomerOrderStatus, string> = {
        pending: "#D97706", accepted: "#2563EB", refilling: "#EA580C", in_transit: "#16A34A", delivered: "#059669",
      };
      const color = statusColors[order.status];
      const statusIcons: Record<CustomerOrderStatus, string> = {
        pending: "⏳", accepted: "🚛", refilling: "⛽", in_transit: "🚗", delivered: "✅",
      };
      const custIcon = L.divIcon({
        className: "",
        html: `<div style="background:${color};color:#fff;font-size:9px;font-weight:700;padding:3px 7px;border-radius:20px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${statusIcons[order.status]} ${order.customer_name.substring(0, 18)}</div>`,
        iconAnchor: [60, 12],
      });
      if (custMarkersRef.current[key]) {
        custMarkersRef.current[key].setLatLng([order.delivery_lat, order.delivery_lng]).setIcon(custIcon);
      } else {
        custMarkersRef.current[key] = L.marker([order.delivery_lat, order.delivery_lng], { icon: custIcon }).addTo(map);
      }
      // Dashed route line: Depot → Customer
      const routeCoords: [number, number][] = [[station.latitude, station.longitude], [order.delivery_lat, order.delivery_lng]];
      if (custRouteLinesRef.current[key]) {
        custRouteLinesRef.current[key].setLatLngs(routeCoords);
      } else {
        custRouteLinesRef.current[key] = L.polyline(routeCoords, {
          color, weight: 2, dashArray: "10, 8", opacity: 0.6,
        }).addTo(map);
      }
    });
  }, [vehicles, customerOrders, mapReady]);

  const handleCenterStation = () => {
    leafletMapRef.current?.flyTo([station.latitude, station.longitude], 13, { duration: 1 });
  };

  const handleFocusTruck = (v: Vehicle) => {
    if (v.last_latitude && v.last_longitude) {
      leafletMapRef.current?.flyTo([v.last_latitude, v.last_longitude], 14, { duration: 0.8 });
    }
  };

  // Sync with Frappe Backend & AdBlue Worker REST API
  const syncWithBackend = useCallback(async () => {
    try {
      // Sync with AdBlue Worker REST API (port 8001 / SQLite DB)
      try {
        const workerData = await workerApi.getLogs(1, 100);
        if (workerData && Array.isArray(workerData.logs)) {
          const formatted: DBIotDispenseLog[] = workerData.logs.map((l, i) => ({
            id: l.id,
            name: `IOT-${l.id ?? i + 1}`,
            txn_id: l.txn_id,
            dispenser_id: l.dispenser_id,
            vehicle_id: l.vehicle_id,
            waybill_no: l.waybill_no,
            trailer_no: l.trailer_no,
            dispensed_liters: Number(l.dispensed_liters),
            date_time: l.date_time,
            totaliser_start: l.totaliser_start,
            totaliser_end: l.totaliser_end,
            operator: l.operator,
            entry_mode: l.entry_mode,
            stop_reason: l.stop_reason,
            error_code: l.error_code,
          }));
          setIotLogs(formatted);
          db.saveIotLogs(formatted);
        }
        const stats = await workerApi.getStats();
        if (stats) setWorkerStats(stats);
      } catch (err) {
        // Fallback to local db if worker offline
      }

      const [dash, gpsData] = await Promise.all([
        api.dashboard().catch(() => null) as any,
        api.vehiclesAtStation().catch(() => null) as any,
      ]);

      if (dash) {
        if (dash.units?.length) setUnits(dash.units);
        if (dash.open_waybills?.length) setWaybills(dash.open_waybills);
        if (dash.recent_txns?.length) setTxns(dash.recent_txns);
        if ((dash as any).iot_dispenses?.length) {
          setIotLogs((dash as any).iot_dispenses);
          db.saveIotLogs((dash as any).iot_dispenses);
        }
        setOutboxCount(dash.sap_outbox ?? 0);
      }
      if (gpsData) {
        if (gpsData.station) setStation(gpsData.station);
        if (gpsData.vehicles?.length) {
          setVehicles((prev) =>
            gpsData.vehicles.map((gv: any) => {
              const match = prev.find((p) => p.name === gv.name);
              return {
                ...match,
                ...gv,
                adblue_tank_capacity: match?.adblue_tank_capacity || 60,
                plate_no: match?.plate_no || "KHA",
                sap_equipment_no: match?.sap_equipment_no || "EQ",
                route: match?.route || "Kharj Depot Line",
                adblue_level_pct: match?.adblue_level_pct || 20,
              };
            })
          );
        }
      }
    } catch {
      // Graceful fallback
    }
  }, []);

  useEffect(() => {
    syncWithBackend();
    const interval = setInterval(syncWithBackend, POLL_MS);
    return () => clearInterval(interval);
  }, [syncWithBackend]);

  useEffect(() => {
    if (tapeEndRef.current && tapeEndRef.current.parentElement) {
      const parent = tapeEndRef.current.parentElement;
      parent.scrollTo({ top: parent.scrollHeight, behavior: "smooth" });
    }
  }, [events]);

  // Realtime Socket subscription
  useEffect(() => {
    return subscribe({
      kharj_gps: (d: any) => {
        setVehicles((vs) =>
          vs.map((v) =>
            v.name === d.vehicle
              ? {
                  ...v,
                  last_latitude: d.latitude,
                  last_longitude: d.longitude,
                  last_speed_kmph: d.speed_kmph,
                  geofence_state: d.geofence,
                  distance_m: d.distance_m,
                }
              : v
          )
        );
      },
      kharj_iot_dispense: (d: any) => {
        const item: DBIotDispenseLog = {
          name: d.name || `IOT-${Date.now()}`,
          vehicle_id: d.vehicle_id,
          dispensed_liters: Number(d.dispensed_liters),
          date_time: d.date_time,
        };
        setIotLogs((prev) => [item, ...prev]);
        db.addIotLog(item);
        pushEvent("IOT_DISPENSE", `MQTT Telemetry: ${d.vehicle_id} dispensed ${d.dispensed_liters}L`, "IoT");
      },
      kharj_flow: (d: any) => {
        setDispenseLitres(d.dispensed_qty);
        setFlowRateLpm(d.flow_rate_lpm);
      },
    });
  }, []);

  const focusVehicle = useMemo(() => {
    return vehicles.find((v) => v.name === selectedVehicle) || vehicles[0];
  }, [vehicles, selectedVehicle]);

  const activeWaybill = useMemo(() => {
    return waybills.find((w) => w.waybill_no === selectedWaybillNo) ||
           waybills.find((w) => w.vehicle === focusVehicle?.name) ||
           waybills[0];
  }, [waybills, selectedWaybillNo, focusVehicle]);

  const activeUnit = units.find((u) => u.product === "AdBlue") || units[0];

  // ---------------------------------------------------------------------------
  // Interactive Workflows
  // ---------------------------------------------------------------------------
  const handleDriveTruck = (vehName: string) => {
    pushEvent("GPS_DISPATCH", `Routing vehicle ${vehName} to Kharj Station forecourt`, "GPS");
    let step = 0;
    const steps = 24;
    const targetVeh = vehicles.find((v) => v.name === vehName);
    if (!targetVeh) return;

    const startLat = targetVeh.last_latitude ?? 24.182;
    const startLng = targetVeh.last_longitude ?? 47.368;

    const timer = setInterval(() => {
      step++;
      const fraction = step / steps;
      const lat = startLat + (station.latitude - startLat) * fraction;
      const lng = startLng + (station.longitude - startLng) * fraction;
      const dist = Math.round((1 - fraction) * (targetVeh.distance_m || 5000) + 35);
      const isInside = fraction >= 0.85;

      setVehicles((vs) =>
        vs.map((v) =>
          v.name === vehName
            ? {
                ...v,
                last_latitude: lat,
                last_longitude: lng,
                last_speed_kmph: fraction === 1 ? 0 : Math.round(62 * (1 - fraction) + 8),
                geofence_state: isInside ? "Inside" : "Outside",
                distance_m: dist,
                fix_age_s: 0,
              }
            : v
        )
      );

      const t = (trails.current[vehName] ??= []);
      t.push([lat, lng]);
      if (t.length > TRAIL_MAX) t.shift();

      if (fraction >= 0.85 && step === Math.floor(steps * 0.85)) {
        pushEvent("GEOFENCE_ENTRY", `${vehName} entered 250m Station Geofence bay`, "GPS");
      }

      if (step >= steps) {
        clearInterval(timer);
        pushEvent("VEHICLE_PARKED", `${vehName} parked at Nozzle 1`, "GPS");
      }
    }, 120);
  };

  const handleScanQR = () => {
    if (!activeWaybill || !focusVehicle) return;
    setActiveModal("verification");
    setIsScanningLaser(true);
    pushEvent("SCAN_START", `Scanning QR on FO ${activeWaybill.waybill_no}`, "Dispenser");

    setTimeout(() => {
      setIsScanningLaser(false);
      const isInside = focusVehicle.geofence_state === "Inside" || (focusVehicle.distance_m || 0) < 300;
      const balance = activeWaybill.balance_qty;

      const checks: AuditCheck[] = [
        { code: "WB_FOUND", label: "Waybill Resolved from QR", passed: true, detail: `FO ${activeWaybill.waybill_no}` },
        { code: "WB_STATUS", label: "Waybill Status Active", passed: activeWaybill.status === "Open", detail: `Status: ${activeWaybill.status}` },
        { code: "WB_WINDOW", label: "Validity Window", passed: true, detail: "Valid through Aug 28" },
        { code: "PROD_MATCH", label: "Product Matches Nozzle", passed: true, detail: `${activeWaybill.product} <=> ${activeUnit.name}` },
        { code: "VEH_MATCH", label: "Vehicle ID Verified", passed: true, detail: `${focusVehicle.vehicle_no}` },
        { code: "STN_MATCH", label: "Station Authorised", passed: true, detail: `${station.name}` },
        { code: "ENTITLEMENT", label: "Balance Available", passed: balance > 0, detail: `${balance.toFixed(1)} L` },
        { code: "GEOFENCE", label: "Inside Geofence", passed: isInside, detail: isInside ? "PASSED" : "REJECTED" },
      ];

      setValidationResults(checks);
      const passed = checks.every((c) => c.passed);

      if (passed) {
        pushEvent("VALIDATION_APPROVED", `8/8 checks passed. Solenoid ARMED.`, "Cloud");
      } else {
        pushEvent("VALIDATION_REJECTED", "Security check failed.", "Cloud");
      }
    }, 1200);
  };

  const handleStartDispense = () => {
    if (isDispensing || !activeWaybill) return;
    setActiveModal("dispenser");
    const preset = Math.min(activeWaybill.balance_qty, 45.0);

    setIsDispensing(true);
    setDispenseLitres(0);
    setFlowRateLpm(38.6);

    pushEvent("NOZZLE_LIFTED", `Nozzle lifted. Preset: ${preset.toFixed(1)} L`, "Dispenser");

    let curr = 0;
    flowTimerRef.current = setInterval(() => {
      curr += 2.2;
      if (curr >= preset) {
        curr = preset;
        clearInterval(flowTimerRef.current);
        setIsDispensing(false);
        setFlowRateLpm(0);
        setDispenseLitres(curr);

        setWaybills((wbList) =>
          wbList.map((w) =>
            w.waybill_no === activeWaybill.waybill_no
              ? {
                  ...w,
                  dispensed_qty: w.dispensed_qty + curr,
                  balance_qty: Math.max(0, w.balance_qty - curr),
                  status: w.balance_qty - curr <= 0.1 ? "Completed" : "Open",
                }
              : w
          )
        );

        setUnits((uList) =>
          uList.map((u) =>
            u.name === activeUnit.name
              ? { ...u, totalizer_l: u.totalizer_l + curr }
              : u
          )
        );

        pushEvent("NOZZLE_STOWED", `Delivered ${curr.toFixed(2)} L. Nozzle stowed.`, "Dispenser");

        if (isOfflineMode) {
          setBufferedCount((c) => c + 1);
          setOutboxCount((c) => c + 1);
          pushEvent("OFFLINE_BUFFER_SAVED", `Offline transaction buffered in Kiosk Flash memory (FO #${activeWaybill.waybill_no})`, "Dispenser");
        } else {
          setTimeout(() => {
            const docNo = "49" + Math.floor(10000000 + Math.random() * 90000000);
            const txn: Txn = {
              name: `TXN-${Date.now().toString().slice(-6)}`,
              waybill: activeWaybill.waybill_no,
              vehicle: focusVehicle.vehicle_no,
              product: activeWaybill.product,
              status: "Reconciled",
              dispensed_qty: curr,
              sap_status: "Posted",
              sap_document_no: docNo,
              completed_at: clock(),
            };
            db.addTransaction(txn as any);
            setTxns(db.getTransactions() as Txn[]);
            pushEvent("SAP_POSTED", `SAP Material Doc #${docNo} saved to DB and posted`, "SAP");
          }, 1000);
        }
      } else {
        setDispenseLitres(parseFloat(curr.toFixed(2)));
      }
    }, 150);
  };

  const handleAbort = () => {
    if (flowTimerRef.current) clearInterval(flowTimerRef.current);
    setIsDispensing(false);
    setFlowRateLpm(0);
    pushEvent("E_STOP", "Operator triggered E-STOP.", "Dispenser");
  };

  const handleRunFullDemo = () => {
    pushEvent("DEMO_START", "Running Automated AdBlue Refilling Sequence", "Cloud");
    setWorkflowStepIndex(2);
    setSelectedVehicle("ALM-TRK-1082");
    handleDriveTruck("ALM-TRK-1082");
    setTimeout(() => {
      handleScanQR();
      setWorkflowStepIndex(4);
      setTimeout(() => {
        handleStartDispense();
        setWorkflowStepIndex(7);
      }, 2000);
    }, 3200);
  };

  const handleSimulateIotPacket = useCallback(async () => {
    const sampleVehicles = ["KL11BV2662", "566808", "344678", "8906010913335", "ALM-TRK-1041", "ALM-TRK-1082"];
    const randomVehicle = sampleVehicles[Math.floor(Math.random() * sampleVehicles.length)];
    const randomLiters = Number((2 + Math.random() * 45).toFixed(2));
    const nowStr = getLocalFormattedDateTime();

    const res = await workerApi.recordDispense(randomVehicle, randomLiters, nowStr);
    const simulatedRecord: DBIotDispenseLog = {
      id: res?.id || Date.now(),
      name: `IOT-${res?.id || Date.now().toString().slice(-5)}`,
      txn_id: res?.txn_id,
      dispenser_id: res?.dispenser_id || "ADB-DU-01",
      vehicle_id: randomVehicle,
      waybill_no: res?.waybill_no || "—",
      trailer_no: res?.trailer_no || "—",
      dispensed_liters: randomLiters,
      date_time: res?.date_time || nowStr,
      totaliser_start: res?.totaliser_start ?? 14820.5,
      totaliser_end: res?.totaliser_end ?? (14820.5 + randomLiters),
      operator: res?.operator || "Tarun Kumar",
      entry_mode: res?.entry_mode || "AUTO_MQTT",
      stop_reason: res?.stop_reason || "NOZZLE_STOWED",
      error_code: res?.error_code || "NONE",
    };

    setIotLogs((prev) => [simulatedRecord, ...prev]);
    db.addIotLog(simulatedRecord);
    pushEvent("IOT_DISPENSE", `MQTT Telemetry: ${randomVehicle} dispensed ${randomLiters}L (Saved to DB)`, "IoT");

    const freshStats = await workerApi.getStats();
    if (freshStats) setWorkerStats(freshStats);
  }, [pushEvent]);

  const handleRefreshIotLogs = useCallback(async () => {
    try {
      const res = await workerApi.getLogs(1, 100);
      if (res && res.logs?.length > 0) {
        const formatted: DBIotDispenseLog[] = res.logs.map((l, i) => ({
          id: l.id,
          name: `IOT-${l.id ?? i + 1}`,
          txn_id: l.txn_id,
          dispenser_id: l.dispenser_id,
          vehicle_id: l.vehicle_id,
          waybill_no: l.waybill_no,
          trailer_no: l.trailer_no,
          dispensed_liters: Number(l.dispensed_liters),
          date_time: l.date_time,
          totaliser_start: l.totaliser_start,
          totaliser_end: l.totaliser_end,
          operator: l.operator,
          entry_mode: l.entry_mode,
          stop_reason: l.stop_reason,
          error_code: l.error_code,
        }));
        setIotLogs(formatted);
        db.saveIotLogs(formatted);
        pushEvent("IOT_REFRESH", `Fetched ${res.logs.length} IoT records from SQLite DB`, "IoT");
      }
      const stats = await workerApi.getStats();
      if (stats) setWorkerStats(stats);
    } catch {
      setIotLogs(db.getIotLogs());
    }
  }, [pushEvent]);

  const handleCreateOrder = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const newFoNo = db.generateNextWaybillNo();
    const newWb: Waybill = {
      name: newFoNo,
      waybill_no: newFoNo,
      vehicle: orderForm.vehicle,
      product: orderForm.product,
      route: orderForm.route,
      entitlement_qty: Number(orderForm.entitlement_qty),
      dispensed_qty: 0,
      balance_qty: Number(orderForm.entitlement_qty),
      status: "Open",
      valid_from: "2026-08-26 06:00:00",
      valid_to: "2026-08-29 23:59:00",
      trip_start: clock(),
    };

    setWaybills((prev) => [newWb, ...prev]);
    setSelectedVehicle(orderForm.vehicle);
    setSelectedWaybillNo(newFoNo);
    pushEvent("ORDER_CREATED", `New AdBlue Order FO #${newFoNo} issued for ${orderForm.vehicle} (${orderForm.entitlement_qty}L ${orderForm.product})`, "Cloud");
    setActiveModal("verification");
    setActiveTab("waybills");
  };

  // Handle customer placing an order (from CustomerPortal)
  const handleCustomerPlaceOrder = (order: CustomerOrder) => {
    db.addOrder(order);
    setCustomerOrders(db.getOrders());
    pushEvent("CUSTOMER_ORDER", `Customer order #${order.order_id} saved to DB: ${order.qty_litres}L ${order.product} → ${order.customer_name}`, "Cloud");
  };

  // Driver accepts a customer order -> Immediately opens Journey Flow Modal
  const handleDriverAcceptOrder = (orderId: string) => {
    db.updateOrderStatus(orderId, "accepted", {
      assigned_truck: focusVehicle.vehicle_no,
      assigned_driver: focusVehicle.driver,
    });
    setCustomerOrders(db.getOrders());
    setDriverActiveOrderId(orderId);
    pushEvent("DRIVER_ACCEPTED", `Driver ${focusVehicle.driver} accepted order #${orderId}. Saved to DB.`, "Cloud");
    setActiveModal("journey_flow");
  };

  // Driver arrives at depot → status: refilling
  const handleDriverAtDepot = (orderId: string) => {
    db.updateOrderStatus(orderId, "refilling");
    setCustomerOrders(db.getOrders());
    pushEvent("REFILLING", `Truck ${focusVehicle.vehicle_no} at Kharj Bay 1. Refilling in progress.`, "Dispenser");
  };

  // Driver marks as delivered
  const handleDriverDeliverOrder = (orderId: string) => {
    const deliveredAt = clock();
    const sapDoc = "49" + Math.floor(10000000 + Math.random() * 90000000);
    db.updateOrderStatus(orderId, "delivered", {
      delivered_at: deliveredAt,
      sap_doc_no: sapDoc,
    });
    setCustomerOrders(db.getOrders());
    pushEvent("DELIVERED", `Order #${orderId} delivered and posted to SAP (${sapDoc}). Stored in DB.`, "Cloud");
  };

  // Simulate full delivery journey for demo
  const handleSimulateDelivery = (orderId: string) => {
    setDriverActiveOrderId(orderId);
    setActiveModal("journey_flow");
  };

  const handleDrainSAP = () => {
    setActiveModal("sap");
    if (outboxCount > 0) {
      pushEvent("SAP_DRAIN", "Reconciling transactions with SAP...", "SAP");
      setTimeout(() => {
      setTxns((tList) =>
        tList.map((t) => ({ ...t, sap_status: "Posted", sap_document_no: t.sap_document_no || "49" + Math.floor(10000000 + Math.random() * 90000000) }))
      );
      setOutboxCount(0);
      pushEvent("SAP_RECONCILED", "SAP Outbox 100% synchronized", "SAP");
    }, 800);
    }
  };

  // Sync today records with db event bus
  useEffect(() => {
    const handleDbUpdate = (e: any) => {
      if (e?.detail?.type === "today_scans" || !e?.detail) {
        setTodayRecords(db.getTodayRecords());
      }
    };
    window.addEventListener("kharj_db_updated", handleDbUpdate);
    return () => window.removeEventListener("kharj_db_updated", handleDbUpdate);
  }, []);

  const todayScannedCount = useMemo(() => todayRecords.length, [todayRecords]);
  const todayAdBlueDispensed = useMemo(() => {
    return todayRecords.reduce((sum, r) => sum + (r.product.toLowerCase().includes("adblue") ? r.dispensed_qty : 0), 0);
  }, [todayRecords]);
  const todayCompletedCount = useMemo(() => todayRecords.filter((r) => r.status === "Completed").length, [todayRecords]);
  const avgDispensedPerTruck = useMemo(() => {
    return todayCompletedCount > 0 ? (todayAdBlueDispensed / todayCompletedCount).toFixed(1) : "0.0";
  }, [todayCompletedCount, todayAdBlueDispensed]);

  // Derived metrics from real IoT Dispense Logs & Worker API
  const totalDispensedLiters = useMemo(() => {
    if (workerStats?.total_liters != null) return workerStats.total_liters;
    return iotLogs.reduce((sum, item) => sum + (Number(item.dispensed_liters) || 0), 0);
  }, [workerStats, iotLogs]);

  const realTodayDispensedLiters = useMemo(() => {
    if (workerStats?.today_liters != null && workerStats.today_liters > 0) return workerStats.today_liters;
    const todayStr = getLocalFormattedDateTime().slice(0, 10);
    const sumToday = iotLogs
      .filter((l) => (l.date_time || "").startsWith(todayStr))
      .reduce((sum, item) => sum + (Number(item.dispensed_liters) || 0), 0);
    return sumToday > 0 ? sumToday : todayAdBlueDispensed;
  }, [workerStats, iotLogs, todayAdBlueDispensed]);

  const todayDispenseCount = useMemo(() => {
    if (workerStats?.today_txns != null && workerStats.today_txns > 0) return workerStats.today_txns;
    const todayStr = getLocalFormattedDateTime().slice(0, 10);
    const countToday = iotLogs.filter((l) => (l.date_time || "").startsWith(todayStr)).length;
    return countToday > 0 ? countToday : todayCompletedCount;
  }, [workerStats, iotLogs, todayCompletedCount]);

  const totalTxnCount = useMemo(() => {
    if (workerStats?.total_txns != null && workerStats.total_txns > 0) return workerStats.total_txns;
    return iotLogs.length;
  }, [workerStats, iotLogs]);

  const uniqueVehiclesCount = useMemo(() => {
    if (workerStats?.vehicle_count != null && workerStats.vehicle_count > 0) return workerStats.vehicle_count;
    return new Set(iotLogs.map((l) => l.vehicle_id)).size;
  }, [workerStats, iotLogs]);

  const filteredIotLogs = useMemo(() => {
    return iotLogs.filter((log) => {
      const q = logSearchQuery.toLowerCase().trim();
      const matchVehicle = !q ||
        (log.vehicle_id && log.vehicle_id.toLowerCase().includes(q)) ||
        (log.txn_id && log.txn_id.toLowerCase().includes(q)) ||
        (log.waybill_no && log.waybill_no.toLowerCase().includes(q)) ||
        (log.trailer_no && log.trailer_no.toLowerCase().includes(q));
      const matchDate = !logDateFilter.trim() ||
        (log.date_time && log.date_time.startsWith(logDateFilter.trim()));
      return matchVehicle && matchDate;
    });
  }, [iotLogs, logSearchQuery, logDateFilter]);

  const handleDirectDispense = async (vehicleId?: string, liters?: number) => {
    const vId = (vehicleId || dispenseVehicleInput || "").trim();
    const ltrs = liters != null ? liters : Number(dispenseLitersInput);
    if (!vId || isNaN(ltrs) || ltrs <= 0) return;

    setIsTodayDispensing(true);
    setTodayDispenseProgress(0);
    setTodayFlowRate(38.6);
    pushEvent("NOZZLE_LIFTED", `Bay 1 Nozzle lifted. Dispensing ${ltrs}L AdBlue to ${vId}`, "Dispenser");

    let currentL = 0;
    if (flowTimerRef.current) clearInterval(flowTimerRef.current);
    flowTimerRef.current = setInterval(async () => {
      currentL += Math.min(3.5, ltrs - currentL);
      if (currentL >= ltrs) {
        clearInterval(flowTimerRef.current);
        setIsTodayDispensing(false);
        setTodayFlowRate(0);
        setTodayDispenseProgress(ltrs);

        const nowIst = getLocalFormattedDateTime();
        const res = await workerApi.recordDispense(vId, ltrs, nowIst);

        const newLog: DBIotDispenseLog = {
          id: res?.id || Date.now(),
          name: `IOT-${res?.id || Date.now()}`,
          txn_id: res?.txn_id || `TXN-${nowIst.slice(0, 10).replace(/-/g, "")}-${String(Date.now()).slice(-4)}`,
          dispenser_id: res?.dispenser_id || "ADB-DU-01",
          vehicle_id: vId,
          waybill_no: res?.waybill_no || "—",
          trailer_no: res?.trailer_no || "—",
          dispensed_liters: ltrs,
          date_time: res?.date_time || nowIst,
          totaliser_start: res?.totaliser_start ?? 14820.5,
          totaliser_end: res?.totaliser_end ?? (14820.5 + ltrs),
          operator: res?.operator || "Tarun Kumar",
          entry_mode: res?.entry_mode || "RFID_MANUAL",
          stop_reason: res?.stop_reason || "NOZZLE_STOWED",
          error_code: res?.error_code || "NONE",
        };
        setIotLogs((prev) => [newLog, ...prev]);
        db.addIotLog(newLog);

        const freshStats = await workerApi.getStats();
        if (freshStats) setWorkerStats(freshStats);

        setUnits((prev) => prev.map((u) => ({ ...u, totalizer_l: u.totalizer_l + ltrs })));
        pushEvent("DISPENSE_COMPLETED", `Delivered ${ltrs.toFixed(2)} L AdBlue to ${vId}. Saved to DB.`, "Dispenser");
      } else {
        setTodayDispenseProgress(currentL);
      }
    }, 120);
  };

  const handleDeleteLog = async (logId?: number) => {
    if (!logId) return;
    if (!window.confirm(`Are you sure you want to remove dispense record #${logId}?`)) return;
    await workerApi.deleteLog(logId);
    setIotLogs((prev) => prev.filter((l) => l.id !== logId));
    const freshStats = await workerApi.getStats();
    if (freshStats) setWorkerStats(freshStats);
  };

  const handleClearAllLogs = async () => {
    if (!window.confirm("Are you sure you want to clear ALL dispense logs from the database?")) return;
    await workerApi.clearLogs();
    setIotLogs([]);
    db.saveIotLogs([]);
    const freshStats = await workerApi.getStats();
    if (freshStats) setWorkerStats(freshStats);
  };

  const handleManualRefresh = async () => {
    try {
      const workerData = await workerApi.getLogs(1, 100);
      if (workerData && Array.isArray(workerData.logs)) {
        const formatted: DBIotDispenseLog[] = workerData.logs.map((l, i) => ({
          id: l.id,
          name: `IOT-${l.id ?? i + 1}`,
          txn_id: l.txn_id,
          dispenser_id: l.dispenser_id,
          vehicle_id: l.vehicle_id,
          waybill_no: l.waybill_no,
          trailer_no: l.trailer_no,
          dispensed_liters: Number(l.dispensed_liters),
          date_time: l.date_time,
          totaliser_start: l.totaliser_start,
          totaliser_end: l.totaliser_end,
          operator: l.operator,
          entry_mode: l.entry_mode,
          stop_reason: l.stop_reason,
          error_code: l.error_code,
        }));
        setIotLogs(formatted);
        db.saveIotLogs(formatted);
      }
      const stats = await workerApi.getStats();
      if (stats) setWorkerStats(stats);
    } catch {
      setIotLogs(db.getIotLogs());
    }
  };

  const filteredTodayRecords = useMemo(() => {
    return todayRecords.filter((r) => {
      const matchSearch =
        !todaySearchQuery ||
        r.waybill_no.toLowerCase().includes(todaySearchQuery.toLowerCase()) ||
        r.vehicle_no.toLowerCase().includes(todaySearchQuery.toLowerCase()) ||
        r.driver_name.toLowerCase().includes(todaySearchQuery.toLowerCase());
      const matchStatus =
        todayStatusFilter === "all" ||
        (todayStatusFilter === "Completed" && r.status === "Completed") ||
        (todayStatusFilter === "Scanned" && r.status !== "Completed");
      return matchSearch && matchStatus;
    });
  }, [todayRecords, todaySearchQuery, todayStatusFilter]);

  const handleResetAllTestWaybills = () => {
    const updated = db.resetDemoSamples();
    setTodayRecords(updated);
    const firstDemo = updated.find((r) => r.waybill_no === "280820260005") || updated[0] || null;
    setTodaySelectedWb(firstDemo);
    setIsTodayDispensing(false);
    setTodayDispenseProgress(0);
    setTodayFlowRate(0);
    setTodayScannerInput("");
    pushEvent(
      "WAYBILL_RESET",
      "Reset all 3 test waybills (280820260005, 280820260006, 280820260007) back to 0L ready for dispensing.",
      "Dispenser"
    );
  };

  const handleScanTodayWaybill = (rawCode?: string) => {
    const code = (rawCode || todayScannerInput).trim();

    // If input is empty and "Scan & Authorize" is clicked, reset all 3 test waybills back to 0L and Scanned!
    if (!code) {
      handleResetAllTestWaybills();
      return;
    }

    const existing = todayRecords.find((r) => r.waybill_no.toLowerCase() === code.toLowerCase());
    if (existing) {
      // Re-scan / Re-authorize: Reset back to 0L dispensed and Scanned status so nozzle can be released again
      const resetWb = db.resetWaybillToScanned(existing.waybill_no) || {
        ...existing,
        status: "Scanned" as const,
        dispensed_qty: 0,
        completed_at: undefined,
        scanned_at: new Date().toLocaleTimeString("en-GB", { hour12: false }),
      };
      const freshList = db.getTodayRecords();
      setTodayRecords(freshList);
      setTodaySelectedWb(resetWb);
      setTodayScannerInput("");
      setIsTodayDispensing(false);
      setTodayDispenseProgress(0);
      setTodayFlowRate(0);
      pushEvent("WAYBILL_RESET", `Waybill #${resetWb.waybill_no} re-authorized & reset to 0L for fresh dispense.`, "Dispenser");
      return;
    }

    const foundMaster = waybills.find((w) => w.waybill_no.toLowerCase() === code.toLowerCase());
    const vehicleObj = vehicles.find((v) => v.vehicle_no === (foundMaster?.vehicle || focusVehicle.vehicle_no)) || focusVehicle;

    const newRecord = db.addTodayScan({
      waybill_no: code,
      vehicle_no: foundMaster?.vehicle || vehicleObj.vehicle_no,
      driver_name: vehicleObj.driver || "175076, AZHAR UD DIN",
      product: foundMaster?.product || "AdBlue",
      entitlement_qty: foundMaster?.entitlement_qty || 60.0,
      dispensed_qty: 0,
      status: "Scanned",
    });

    const updated = db.getTodayRecords();
    setTodayRecords(updated);
    setTodaySelectedWb(newRecord);
    setTodayScannerInput("");
    setIsTodayDispensing(false);
    setTodayDispenseProgress(0);
    setTodayFlowRate(0);
    pushEvent("WAYBILL_SCANNED", `Scanned & Registered Waybill #${newRecord.waybill_no} for ${newRecord.vehicle_no} (${newRecord.entitlement_qty}L)`, "Dispenser");
  };

  const handleStartTodayDispense = () => {
    if (!todaySelectedWb || isTodayDispensing) return;
    if (todaySelectedWb.status === "Completed") {
      // Auto reset and prepare for fresh dispense
      handleScanTodayWaybill(todaySelectedWb.waybill_no);
      return;
    }

    setIsTodayDispensing(true);
    setTodayDispenseProgress(todaySelectedWb.dispensed_qty);
    setTodayFlowRate(38.6);
    setWorkflowStepIndex(7);
    pushEvent("NOZZLE_LIFTED", `Bay 1 Nozzle lifted. Dispensing AdBlue for FO #${todaySelectedWb.waybill_no}`, "Dispenser");

    const targetQty = todaySelectedWb.entitlement_qty;
    let currentL = todaySelectedWb.dispensed_qty;

    if (flowTimerRef.current) clearInterval(flowTimerRef.current);
    flowTimerRef.current = setInterval(() => {
      currentL += 3.5;
      if (currentL >= targetQty) {
        currentL = targetQty;
        clearInterval(flowTimerRef.current);
        setIsTodayDispensing(false);
        setTodayFlowRate(0);
        setTodayDispenseProgress(currentL);
        setWorkflowStepIndex(11);

        db.updateTodayDispensed(todaySelectedWb.waybill_no, currentL);
        const fresh = db.getTodayRecords();
        setTodayRecords(fresh);
        const updatedSelected = fresh.find((r) => r.waybill_no === todaySelectedWb.waybill_no);
        if (updatedSelected) setTodaySelectedWb(updatedSelected);

        setUnits((prev) => prev.map((u) => ({ ...u, totalizer_l: u.totalizer_l + currentL })));
        pushEvent("DISPENSE_COMPLETED", `Delivered ${currentL.toFixed(1)} L AdBlue to ${todaySelectedWb.vehicle_no}. Nozzle stowed.`, "Dispenser");

        // Dynamically add to the official Automated AdBlue Report
        const newReportRecord: AdBlueReportRecord = {
          id: `REP-${Date.now().toString().slice(-4)}`,
          transactionDate: new Date().toLocaleDateString("en-GB"),
          transactionHour: clock(),
          vehicle: todaySelectedWb.vehicle_no.replace(/[^0-9]/g, "") || "500497",
          dispenserNumber: 1,
          quantity: currentL,
          quantityUnits: "L",
          adblueProductCode: "1",
          site: "ALMARAI KHARJ",
          vehiclesCategory: "TRACTOR",
          vehicleIdentifier: "2023" + Math.floor(100 + Math.random() * 900),
          waybillNo: todaySelectedWb.waybill_no,
          driverName: todaySelectedWb.driver_name,
        };
        setDynamicReportRecords((prev) => [newReportRecord, ...prev]);
      } else {
        setTodayDispenseProgress(currentL);
      }
    }, 150);
  };

  const handleResetTodayData = () => {
    if (window.confirm("Reset today's scanned waybills and AdBlue records to standard initial shift data?")) {
      db.resetTodayRecords();
      const resetList = db.getTodayRecords();
      setTodayRecords(resetList);
      setTodaySelectedWb(resetList[0] || null);
      pushEvent("SHIFT_RESET", "Reset today's operational waybill & dispensing counters.", "Cloud");
    }
  };


  const demoSamples = [
    { no: "280820260005", vehicle: "ALM-TRK-1041", driver: "175076, AZHAR UD DIN", qty: 60 },
    { no: "280820260006", vehicle: "ALM-TRK-1082", driver: "189204, M. HADDAD", qty: 50 },
    { no: "280820260007", vehicle: "ALM-TRK-1119", driver: "194012, S. KURIAN", qty: 80 },
  ];

  return (
    <div className="super-wrap">
      {/* --------------------------------------------------------------------
          SUPER-HEADER WITH ROLE-BASED AUTHENTICATION SWITCHER
          -------------------------------------------------------------------- */}
      <header className="glass-panel super-header no-print">
        <div className="brand-badge-container">
          <div className="brand-icon-hex">NV</div>
          <div className="brand-titles">
            <h1>AdBlue Fleet Management System</h1>
            <div className="brand-subtag">
              <span className="led-pulse" />
              KHARJ-01 &nbsp;·&nbsp; INTELLIGENT FORECOURT
            </div>
          </div>
        </div>

        {/* Operations Console Badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(37,99,235,0.08)", border: "1.5px solid rgba(37,99,235,0.25)", padding: "6px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 800, color: "#1d4ed8" }}>
            <span>👔</span>
            <span>Operations Supervisor Console</span>
          </div>

          <div className="top-telemetry-row">
            <div
              className={`offline-toggle-container ${isOfflineMode ? "offline" : "online"}`}
              onClick={() => {
                if (isOfflineMode) {
                  setIsOfflineMode(false);
                  if (bufferedCount > 0) {
                    pushEvent("BUFFER_FLUSH", `Flushing ${bufferedCount} buffered record(s) from Kiosk Flash to SAP ERP`, "Cloud");
                    handleDrainSAP();
                    setBufferedCount(0);
                  }
                } else {
                  setIsOfflineMode(true);
                  pushEvent("NETWORK_OFFLINE", "Forecourt Internet dropped. Kiosk Local Flash Cache & Buffer ARMED.", "Dispenser");
                }
              }}
              title="Click to simulate Forecourt Online / Offline buffer network modes"
            >
              <span>{isOfflineMode ? "📡 KIOSK OFFLINE (BUFFERING)" : "🟢 CLOUD ONLINE"}</span>
              {bufferedCount > 0 && <span style={{ background: "var(--red)", color: "#fff", padding: "1px 6px", borderRadius: "10px", fontSize: "10px", marginLeft: "4px" }}>{bufferedCount} BUF</span>}
            </div>


            {userRole !== "customer" && (
              <div className="telemetry-badge">
                TOTALIZER: <b>{activeUnit.totalizer_l.toLocaleString()} L</b>
              </div>
            )}
            <div className="telemetry-badge" style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
              <span>USER: <b style={{ textTransform: "capitalize", color: "#38bdf8" }}>{currentUser || "admin"}</b></span>
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    background: "rgba(239, 68, 68, 0.15)",
                    color: "#f87171",
                    border: "1px solid rgba(239, 68, 68, 0.4)",
                    borderRadius: "6px",
                    padding: "3px 8px",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = "#ef4444";
                    e.currentTarget.style.color = "#ffffff";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)";
                    e.currentTarget.style.color = "#f87171";
                  }}
                  title="Sign out of AdBlue Management Console"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Sign Out
                </button>
              )}
            </div>
          </div>
        </div>
      </header>
       {/* --------------------------------------------------------------------
          ROLE VIEW 1: FLEET DRIVER MOBILE VIEW
          -------------------------------------------------------------------- */}
      {/* --------------------------------------------------------------------
          ROLE VIEW 0: CUSTOMER PORTAL
          -------------------------------------------------------------------- */}
      {userRole === "customer" && (
        <CustomerPortal
          orders={customerOrders}
          onPlaceOrder={handleCustomerPlaceOrder}
          onViewWaybill={(order) => {
            setViewWaybillOrder(order);
            setActiveModal("verification");
          }}
          onOpenJourney={(order) => {
            setDriverActiveOrderId(order.order_id);
            setActiveModal("journey_flow");
          }}
        />
      )}

      {userRole === "driver" && (
        <div className="driver-cockpit-container animate-fade-in">
          <div className="driver-cockpit-grid">
            {/* LEFT COLUMN: DIGITAL ATOMS PASS & DISPATCH TERMINAL */}
            <div className="driver-phone-shell">
              {/* Phone Header */}
              <div className="driver-phone-header">
                <div className="driver-status-bar">
                  <span>📶 5G ULTRA</span>
                  <span>14:32</span>
                  <span>⚡ 100%</span>
                </div>

                <div className="driver-profile-row">
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div className="driver-avatar-circle">RF</div>
                    <div>
                      <div style={{ fontSize: "16px", fontWeight: 800, color: "#FFFFFF" }}>R. Fernandes</div>
                      <div style={{ fontSize: "11px", color: "#93C5FD", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                        TRUCK: {focusVehicle.vehicle_no} ({focusVehicle.plate_no})
                      </div>
                    </div>
                  </div>
                  <span
                    className={`header-tag-pill ${focusVehicle.geofence_state === "Inside" ? "emerald" : "cyan"}`}
                    style={{ color: "#FFFFFF", borderColor: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.2)", fontSize: "10px", fontWeight: 800 }}
                  >
                    {focusVehicle.geofence_state === "Inside" ? "● AT DEPOT (BAY 1)" : "🟢 ON ROUTE (HWY 65)"}
                  </span>
                </div>

                <div className="driver-route-pill">
                  <span>📍</span>
                  <span style={{ fontWeight: 600 }}>{focusVehicle.route}</span>
                </div>

                {/* Driver In-App Tab Switcher */}
                <div className="driver-tab-switcher">
                  <button
                    className={`driver-tab-btn ${driverTab === "mission" ? "active" : ""}`}
                    onClick={() => setDriverTab("mission")}
                  >
                    📱 Active Mission
                  </button>
                  <button
                    className={`driver-tab-btn ${driverTab === "history" ? "active" : ""}`}
                    onClick={() => setDriverTab("history")}
                  >
                    📜 Past Trips ({3 + customerOrders.filter((o) => o.status === "delivered").length})
                  </button>
                  <button
                    className={`driver-tab-btn ${driverTab === "stats" ? "active" : ""}`}
                    onClick={() => setDriverTab("stats")}
                  >
                    📊 Shift Stats
                  </button>
                </div>
              </div>

              {/* Phone Body */}
              <div className="driver-phone-body">
                {/* TAB 1: ACTIVE MISSION */}
                {driverTab === "mission" && (
                  <>
                    {/* Dynamic QR Pass */}
                    <div className="qr-pass-container">
                      <div className="scan-beam" />
                      <div style={{ fontSize: "11px", fontWeight: 800, color: "#1D4ED8", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: "8px", fontFamily: "var(--font-mono)" }}>
                        OFFICIAL aTOMS ADBLUE PASS · FO #{activeWaybill?.waybill_no || "280820260001"}
                      </div>
                      <div style={{ display: "flex", justifyContent: "center", margin: "12px 0" }}>
                        <svg width="150" height="150" viewBox="0 0 24 24" fill="#0F172A">
                          <path d="M2 2h8v8H2V2zm2 2v4h4V4H4zm10-2h8v8h-8V2zm2 2v4h4V4h-4zM2 14h8v8H2v-8zm2 2v4h4v-4H4zm10 0h2v2h-2v-2zm4 0h4v2h-4v-2zm-4 4h2v2h-2v-2zm4 2h4v2h-4v-2zm-2-4h2v2h-2v-2zm4-4h2v2h-2v-2zM6 6h2v2H6V6zm12 0h2v2h-2V6zM6 18h2v2H6v-2z" />
                        </svg>
                      </div>
                      <div style={{ fontSize: "11px", color: "#64748B", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                        <span>🔴</span> Present to Forecourt Laser Scanner at Bay 1
                      </div>
                    </div>

                    {/* Quota & AdBlue DEF Meter */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <div style={{ background: "#F0FDF4", border: "1.5px solid #BBF7D0", borderLeft: "4px solid #16A34A", padding: "12px", borderRadius: "12px" }}>
                        <div style={{ fontSize: "10px", fontWeight: 800, color: "#166534", textTransform: "uppercase", fontFamily: "var(--font-mono)", marginBottom: "4px" }}>
                          AdBlue Quota
                        </div>
                        <div style={{ fontSize: "22px", fontWeight: 800, color: "#15803D", fontFamily: "var(--font-mono)" }}>
                          {activeWaybill?.entitlement_qty || 60.0} L
                        </div>
                        <div style={{ fontSize: "10px", color: "#475569", marginTop: "2px", fontWeight: 600 }}>Authorized for Trip</div>
                      </div>
                      <div style={{ background: "#EFF6FF", border: "1.5px solid #BFDBFE", borderLeft: "4px solid #2563EB", padding: "12px", borderRadius: "12px" }}>
                        <div style={{ fontSize: "10px", fontWeight: 800, color: "#1E40AF", textTransform: "uppercase", fontFamily: "var(--font-mono)", marginBottom: "4px" }}>
                          AdBlue Tank Level
                        </div>
                        <div style={{ fontSize: "22px", fontWeight: 800, color: "#1D4ED8", fontFamily: "var(--font-mono)" }}>
                          {focusVehicle.adblue_level_pct}%
                        </div>
                        <div style={{ fontSize: "10px", color: "#475569", marginTop: "2px", fontWeight: 600 }}>AdBlue DEF Tank</div>
                      </div>
                    </div>

                    {/* Customer Order Notification — pending orders from Customer Portal */}
                    {customerOrders.filter((o) => o.status === "pending").length > 0 && (
                      <div style={{ background: "linear-gradient(135deg,#FEF3C7,#FDE68A)", border: "2px solid #D97706", borderRadius: "14px", padding: "14px", animation: "pulse 2s infinite" }}>
                        <div style={{ fontWeight: 800, color: "#92400E", fontSize: "11px", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: "6px" }}>
                          📲 New Requisition Broadcast!
                        </div>
                        {customerOrders
                          .filter((o) => o.status === "pending")
                          .slice(0, 1)
                          .map((order) => (
                            <div key={order.order_id}>
                              <div style={{ fontWeight: 800, fontSize: "14px", color: "#1E293B", marginBottom: "4px" }}>
                                {order.customer_name}
                              </div>
                              <div style={{ fontSize: "11px", color: "#78350F", fontWeight: 600 }}>
                                ⛽ {order.qty_litres}L {order.product} — ETA {order.estimated_eta}
                              </div>
                              <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                                <button
                                  onClick={() => handleDriverAcceptOrder(order.order_id)}
                                  style={{
                                    flex: 1,
                                    padding: "10px",
                                    background: "#16A34A",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: "10px",
                                    fontWeight: 800,
                                    fontSize: "12px",
                                    cursor: "pointer",
                                    boxShadow: "0 2px 8px rgba(22,163,74,0.3)",
                                  }}
                                >
                                  ✅ Accept Trip
                                </button>
                                <button
                                  onClick={() => handleSimulateDelivery(order.order_id)}
                                  style={{
                                    flex: 1,
                                    padding: "10px",
                                    background: "#2563EB",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: "10px",
                                    fontWeight: 800,
                                    fontSize: "12px",
                                    cursor: "pointer",
                                    boxShadow: "0 2px 8px rgba(37,99,235,0.3)",
                                  }}
                                >
                                  ▶ Auto Demo
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}

                    {/* Active accepted order — journey stepper */}
                    {driverActiveOrderId &&
                      (() => {
                        const ao = customerOrders.find((o) => o.order_id === driverActiveOrderId);
                        if (!ao) return null;
                        const steps = ["pending", "accepted", "refilling", "in_transit", "delivered"] as CustomerOrderStatus[];
                        const stepIdx = steps.indexOf(ao.status);
                        return (
                          <div style={{ background: "#EFF6FF", border: "2px solid #2563EB", borderRadius: "14px", padding: "14px" }}>
                            <div style={{ fontWeight: 800, color: "#1E40AF", fontSize: "11px", textTransform: "uppercase", marginBottom: "6px" }}>
                              📦 Active Trip Mission: #{ao.order_id}
                            </div>
                            <div style={{ fontWeight: 800, fontSize: "13px", color: "#0F172A", marginBottom: "6px" }}>
                              {ao.customer_name}
                            </div>
                            <div style={{ display: "flex", gap: "4px", alignItems: "center", margin: "10px 0" }}>
                              {["⏳", "🚛", "⛽", "🚗", "✅"].map((icon, i) => (
                                <React.Fragment key={i}>
                                  <div
                                    style={{
                                      width: "30px",
                                      height: "30px",
                                      borderRadius: "50%",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontSize: "13px",
                                      background: i < stepIdx ? "#16A34A" : i === stepIdx ? "#2563EB" : "#E2E8F0",
                                      color: i <= stepIdx ? "#fff" : "#64748B",
                                      fontWeight: 800,
                                    }}
                                  >
                                    {i < stepIdx ? "✓" : icon}
                                  </div>
                                  {i < 4 && (
                                    <div
                                      style={{
                                        flex: 1,
                                        height: "3px",
                                        background: i < stepIdx ? "#16A34A" : "#E2E8F0",
                                      }}
                                    />
                                  )}
                                </React.Fragment>
                              ))}
                            </div>
                            <div style={{ display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap" }}>
                              {ao.status === "accepted" && (
                                <button
                                  onClick={() => handleDriverAtDepot(driverActiveOrderId)}
                                  style={{
                                    flex: 1,
                                    padding: "9px",
                                    background: "#EA580C",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: "8px",
                                    fontWeight: 800,
                                    fontSize: "12px",
                                    cursor: "pointer",
                                  }}
                                >
                                  ⛽ Arrived at Bay 1
                                </button>
                              )}
                              {ao.status === "refilling" && (
                                <button
                                  onClick={() => {
                                    setCustomerOrders((prev) =>
                                      prev.map((o) =>
                                        o.order_id === driverActiveOrderId
                                          ? { ...o, status: "in_transit" as CustomerOrderStatus }
                                          : o
                                      )
                                    );
                                    handleDriveTruck(focusVehicle.name);
                                  }}
                                  style={{
                                    flex: 1,
                                    padding: "9px",
                                    background: "#16A34A",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: "8px",
                                    fontWeight: 800,
                                    fontSize: "12px",
                                    cursor: "pointer",
                                  }}
                                >
                                  🚗 Refill Done — Depart
                                </button>
                              )}
                              {ao.status === "in_transit" && (
                                <button
                                  onClick={() => handleDriverDeliverOrder(driverActiveOrderId)}
                                  style={{
                                    flex: 1,
                                    padding: "9px",
                                    background: "#059669",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: "8px",
                                    fontWeight: 800,
                                    fontSize: "12px",
                                    cursor: "pointer",
                                  }}
                                >
                                  ✅ Mark as Delivered
                                </button>
                              )}
                              <button
                                onClick={() => setActiveModal("verification")}
                                style={{
                                  padding: "9px 14px",
                                  background: "#0F172A",
                                  color: "#fff",
                                  border: "none",
                                  borderRadius: "8px",
                                  fontWeight: 800,
                                  fontSize: "12px",
                                  cursor: "pointer",
                                }}
                              >
                                📄 Waybill
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                    {/* Customer Delivery Order Card */}
                    {!driverActiveOrderId && (
                      <div style={{ background: "#F8FAFC", border: "1.5px solid #E2E8F0", borderRadius: "12px", padding: "14px", fontSize: "11px" }}>
                        <div style={{ fontWeight: 800, color: "#2563EB", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: "4px" }}>
                          📦 Scheduled Trip Route
                        </div>
                        <div style={{ fontWeight: 800, fontSize: "13px", color: "#0F172A" }}>
                          {activeWaybill?.trip_customer || "CPP RIYADH SOUTH FOODS 01 (CUSTOMER)"}
                        </div>
                        <div style={{ color: "#64748B", marginTop: "3px", fontWeight: 600 }}>
                          Destination: <b>{activeWaybill?.final_destination || "RIYADH SOUTH DEPOT"}</b>
                        </div>
                      </div>
                    )}

                    {/* View Official Almarai Waybill Button */}
                    <button
                      className="btn-action"
                      style={{ width: "100%", justifyContent: "center", padding: "12px", background: "#0F172A", color: "#FFFFFF", border: "none", fontWeight: 800, borderRadius: "12px", fontSize: "13px" }}
                      onClick={() => setActiveModal("verification")}
                    >
                      📄 View 3-Page Official Almarai Waybill
                    </button>

                    {/* Simulate Arrival Button */}
                    <button
                      className="btn-action auto-demo"
                      style={{ width: "100%", justifyContent: "center", padding: "13px", fontSize: "13px", borderRadius: "12px", fontWeight: 800 }}
                      onClick={() => {
                        handleDriveTruck(focusVehicle.name);
                        setUserRole("operator");
                      }}
                    >
                      🚚 Open Forecourt Operator Scanner
                    </button>
                  </>
                )}

                {/* TAB 2: PAST DELIVERIES / TRIP HISTORY */}
                {driverTab === "history" && (
                  <div className="driver-history-view animate-fade-in">
                    <div className="driver-history-summary">
                      <div style={{ fontWeight: 800, fontSize: "14px", color: "#065F46" }}>
                        ✅ {3 + customerOrders.filter((o) => o.status === "delivered").length} Completed Trips Today
                      </div>
                      <div style={{ fontSize: "11px", color: "#047857", marginTop: "2px" }}>
                        Total Delivered: <b>{240 + customerOrders.filter((o) => o.status === "delivered").reduce((sum, o) => sum + o.qty_litres, 0)} Litres</b> · All SAP Reconciled
                      </div>
                    </div>

                    {/* Render delivered customer orders */}
                    {customerOrders
                      .filter((o) => o.status === "delivered")
                      .map((order) => (
                        <div key={order.order_id} className="driver-history-card">
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                            <div>
                              <span className="driver-hist-id">#{order.order_id}</span>
                              <div style={{ fontWeight: 800, fontSize: "13px", color: "#0F172A" }}>{order.customer_name}</div>
                            </div>
                            <span className="header-tag-pill emerald" style={{ fontSize: "10px", fontWeight: 800 }}>
                              DELIVERED
                            </span>
                          </div>
                          <div style={{ fontSize: "11px", color: "#475569", margin: "6px 0", fontWeight: 600 }}>
                            ⛽ <b>{order.qty_litres}L {order.product}</b> &nbsp;·&nbsp; Delivered at {order.delivered_at || "12:30:00"}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px", paddingTop: "8px", borderTop: "1px dashed #E2E8F0" }}>
                            <span style={{ fontSize: "11px", color: "#7C3AED", fontFamily: "var(--font-mono)", fontWeight: 800 }}>
                              SAP DOC #{order.sap_doc_no || "4901824901"}
                            </span>
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button
                                onClick={() => {
                                  setViewWaybillOrder(order);
                                  setActiveModal("verification");
                                }}
                                style={{ padding: "5px 10px", background: "#0F172A", color: "#fff", border: "none", borderRadius: "6px", fontSize: "10px", fontWeight: 800, cursor: "pointer" }}
                              >
                                📄 Waybill
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}

                    {/* Seed past deliveries */}
                    {[
                      { id: "ORD-101562", customer: "ALMARAI CENTRAL DISTRIBUTION RIYADH", qty: "100L AdBlue", time: "10:45 AM", sap: "SAP DOC #4901824102", waybill: "6101015842" },
                      { id: "ORD-101558", customer: "NUPCO CUSTOMER - RIYADH EAST DEPOT", qty: "80L AdBlue", time: "08:12 AM", sap: "SAP DOC #4901823901", waybill: "6101015799" },
                      { id: "ORD-101549", customer: "CPP RIYADH SOUTH FOODS 01 (CUSTOMER)", qty: "60L AdBlue", time: "Yesterday 18:55", sap: "SAP DOC #4901823720", waybill: "6101015720" },
                    ].map((item) => (
                      <div key={item.id} className="driver-history-card">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                          <div>
                            <span className="driver-hist-id">#{item.id}</span>
                            <div style={{ fontWeight: 800, fontSize: "13px", color: "#0F172A" }}>{item.customer}</div>
                          </div>
                          <span className="header-tag-pill emerald" style={{ fontSize: "10px", fontWeight: 800 }}>
                            DELIVERED
                          </span>
                        </div>
                        <div style={{ fontSize: "11px", color: "#475569", margin: "6px 0", fontWeight: 600 }}>
                          💧 <b>{item.qty}</b> &nbsp;·&nbsp; Delivered at {item.time}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px", paddingTop: "8px", borderTop: "1px dashed #E2E8F0" }}>
                          <span style={{ fontSize: "11px", color: "#7C3AED", fontFamily: "var(--font-mono)", fontWeight: 800 }}>
                            {item.sap}
                          </span>
                          <button
                            onClick={() => setActiveModal("verification")}
                            style={{ padding: "5px 10px", background: "#0F172A", color: "#fff", border: "none", borderRadius: "6px", fontSize: "10px", fontWeight: 800, cursor: "pointer" }}
                          >
                            📄 Waybill #{item.waybill}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* TAB 3: SHIFT STATS */}
                {driverTab === "stats" && (
                  <div className="driver-stats-view animate-fade-in">
                    <div className="driver-stat-card-grid">
                      <div className="d-stat-box">
                        <span className="d-stat-icon">📦</span>
                        <div className="d-stat-num">{3 + customerOrders.filter((o) => o.status === "delivered").length}</div>
                        <div className="d-stat-lbl">TRIPS TODAY</div>
                      </div>
                      <div className="d-stat-box">
                        <span className="d-stat-icon">⛽</span>
                        <div className="d-stat-num">{240 + customerOrders.filter((o) => o.status === "delivered").reduce((sum, o) => sum + o.qty_litres, 0)} L</div>
                        <div className="d-stat-lbl">VOLUME DELIVERED</div>
                      </div>
                      <div className="d-stat-box">
                        <span className="d-stat-icon">⏱️</span>
                        <div className="d-stat-num">100%</div>
                        <div className="d-stat-lbl">ON-TIME RATE</div>
                      </div>
                      <div className="d-stat-box">
                        <span className="d-stat-icon">🛡️</span>
                        <div className="d-stat-num">98 / 100</div>
                        <div className="d-stat-lbl">SAFETY SCORE</div>
                      </div>
                    </div>

                    {/* Pre-Trip Inspection Card */}
                    <div style={{ background: "#F8FAFC", border: "1.5px solid #E2E8F0", borderRadius: "12px", padding: "14px", marginTop: "14px" }}>
                      <div style={{ fontWeight: 800, fontSize: "11px", color: "#0F172A", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: "10px" }}>
                        🔍 PRE-TRIP VEHICLE AUDIT
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "11px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "#64748B" }}>Tractor &amp; Trailer Safety:</span>
                          <span style={{ fontWeight: 700, color: "#16A34A" }}>PASSED ✓</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "#64748B" }}>Odometer Reading:</span>
                          <span style={{ fontWeight: 700, color: "#0F172A", fontFamily: "var(--font-mono)" }}>142,850 KM</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "#64748B" }}>Tire Pressure / Brakes:</span>
                          <span style={{ fontWeight: 700, color: "#16A34A" }}>110 PSI (OPTIMAL)</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "#64748B" }}>GPS Telematics Ping:</span>
                          <span style={{ fontWeight: 700, color: "#2563EB" }}>ACTIVE (100% OK)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: HIGHWAY 65 TELEMATICS & ROUTE MANIFEST */}
            <div className="driver-telematics-panel">
              {/* Telematics Hero Metrics */}
              <div className="driver-telematics-header">
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "24px" }}>🛣️</span>
                  <div>
                    <div style={{ fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>
                      Highway 65 Fleet Telematics
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748B" }}>
                      Real-time In-Cab Diagnostics &amp; Corridor Navigation
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => setActiveModal("verification")}
                    style={{
                      padding: "8px 14px",
                      background: "#0F172A",
                      color: "#FFFFFF",
                      border: "none",
                      borderRadius: "10px",
                      fontSize: "12px",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    📄 Government Waybill
                  </button>
                  <button
                    onClick={() => setActiveModal("journey_flow")}
                    style={{
                      padding: "8px 14px",
                      background: "linear-gradient(135deg, #16A34A, #15803D)",
                      color: "#FFFFFF",
                      border: "none",
                      borderRadius: "10px",
                      fontSize: "12px",
                      fontWeight: 800,
                      cursor: "pointer",
                      boxShadow: "0 2px 8px rgba(22,163,74,0.3)",
                    }}
                  >
                    🚚 3D Journey Simulator
                  </button>
                </div>
              </div>

              {/* Gauges Grid */}
              <div className="driver-gauge-grid">
                <div className="d-gauge-card speed">
                  <div className="d-gauge-lbl">VEHICLE SPEED</div>
                  <div className="d-gauge-val">
                    <b>64</b> <span style={{ fontSize: "14px", fontWeight: 600 }}>km/h</span>
                  </div>
                  <div className="d-gauge-sub">Limit: 80 km/h · Safe</div>
                </div>
                <div className="d-gauge-card distance">
                  <div className="d-gauge-lbl">REMAINING DISTANCE</div>
                  <div className="d-gauge-val">
                    <b>38.2</b> <span style={{ fontSize: "14px", fontWeight: 600 }}>km</span>
                  </div>
                  <div className="d-gauge-sub">Corridor: Highway 65</div>
                </div>
                <div className="d-gauge-card eta">
                  <div className="d-gauge-lbl">ESTIMATED ETA</div>
                  <div className="d-gauge-val">
                    <b>18</b> <span style={{ fontSize: "14px", fontWeight: 600 }}>mins</span>
                  </div>
                  <div className="d-gauge-sub">Traffic: Optimal (Green)</div>
                </div>
                <div className="d-gauge-card temp">
                  <div className="d-gauge-lbl">DEF PRODUCT TEMP</div>
                  <div className="d-gauge-val">
                    <b>21.4</b> <span style={{ fontSize: "14px", fontWeight: 600 }}>°C</span>
                  </div>
                  <div className="d-gauge-sub">Target: &lt; 25°C · Compliant</div>
                </div>
              </div>

              {/* Turn-by-Turn Waypoints */}
              <div className="driver-waypoints-card">
                <div style={{ fontSize: "12px", fontWeight: 800, color: "#0F172A", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: "14px" }}>
                  📍 Route Manifest &amp; Waypoint Log
                </div>
                <div className="d-waypoint-item done">
                  <div className="d-wp-dot">✓</div>
                  <div className="d-wp-info">
                    <div className="d-wp-title">Kharj Central Depot (Bay 1)</div>
                    <div className="d-wp-meta">Dispensed 60.0 Litres AdBlue DEF · 8-Point Pre-Trip Verification Passed</div>
                  </div>
                  <div className="d-wp-time">08:00 AM</div>
                </div>

                <div className="d-waypoint-item active">
                  <div className="d-wp-dot">🚛</div>
                  <div className="d-wp-info">
                    <div className="d-wp-title">Highway 65 Al-Kharj Express Corridor (KM 42)</div>
                    <div className="d-wp-meta">In-Transit Telematics Ping Active · Geofence: Outside Depot</div>
                  </div>
                  <div className="d-wp-time">NOW (64 km/h)</div>
                </div>

                <div className="d-waypoint-item">
                  <div className="d-wp-dot">🏢</div>
                  <div className="d-wp-info">
                    <div className="d-wp-title">CPP Riyadh South Foods 01 Receiving Bay</div>
                    <div className="d-wp-meta">Customer Destination Dock · Sign-off &amp; SAP Material Doc Generation</div>
                  </div>
                  <div className="d-wp-time">ETA 08:45 AM</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------
          ROLE VIEW 2: FORECOURT PUMP OPERATOR (HANDHELD POS)
          -------------------------------------------------------------------- */}
      {userRole === "operator" && (
        <div className="operator-pos-grid">
          {/* Scanner Viewfinder Card */}
          <div className="pos-viewfinder-card">
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: ".12em", color: "#60A5FA", textTransform: "uppercase", fontFamily: "var(--font-mono)" }}>
              BAY 1 · HANDHELD POS SCANNER
            </div>
            <div style={{ fontSize: "18px", fontWeight: 800, color: "#FFFFFF", marginTop: "4px" }}>
              AdBlue Dispensing Unit (ADB-DU-01)
            </div>

            <div className="pos-viewfinder-target">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="rgba(16,185,129,0.8)">
                <path d="M2 2h8v8H2V2zm2 2v4h4V4H4zm10-2h8v8h-8V2zm2 2v4h4V4h-4zM2 14h8v8H2v-8zm2 2v4h4v-4H4zm10 0h2v2h-2v-2zm4 0h4v2h-4v-2zm-4 4h2v2h-2v-2zm4 2h4v2h-4v-2zm-2-4h2v2h-2v-2zm4-4h2v2h-2v-2zM6 6h2v2H6V6zm12 0h2v2h-2V6zM6 18h2v2H6v-2z" />
              </svg>
            </div>

            <div style={{ display: "flex", gap: "10px", width: "100%", maxWidth: "360px" }}>
              <button
                className="btn-action"
                style={{ flex: 1, justifyContent: "center", background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "#FFFFFF", padding: "10px" }}
                onClick={handleScanQR}
              >
                📸 Scan Driver QR
              </button>
              <button
                className="btn-action auto-demo"
                style={{ flex: 1, justifyContent: "center", padding: "10px" }}
                onClick={handleStartDispense}
                disabled={isDispensing}
              >
                {isDispensing ? "Flowing..." : "⚡ Release Nozzle"}
              </button>
            </div>
          </div>

          {/* Real-time Checklist & Pump Status */}
          <div className="glass-panel">
            <div className="panel-header">
              <h2>8-POINT AUDIT VERIFICATION</h2>
              <span className="header-tag-pill emerald">
                {validationResults.filter(c => c.passed).length}/8 CHECKS OK
              </span>
            </div>
            <div className="panel-body">
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                {validationResults.slice(0, 5).map((c) => (
                  <div key={c.code} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "var(--surface-2)", borderRadius: "8px", fontSize: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ color: c.passed ? "var(--green)" : "var(--red)", fontWeight: 800 }}>{c.passed ? "✓" : "✕"}</span>
                      <span style={{ fontWeight: 600 }}>{c.label}</span>
                    </div>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-3)" }}>{c.detail}</span>
                  </div>
                ))}
              </div>

              {/* Flow status */}
              <div style={{ background: "var(--green-bg)", border: "1px solid var(--green-bd)", borderRadius: "10px", padding: "14px", textAlign: "center" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--green-txt)", textTransform: "uppercase", fontFamily: "var(--font-mono)" }}>
                  {isDispensing ? "▶ ACTIVE DELIVERY IN PROGRESS" : "■ READY FOR DISPENSE"}
                </div>
                <div style={{ fontSize: "32px", fontWeight: 800, color: "var(--green)", fontFamily: "var(--font-mono)", margin: "4px 0" }}>
                  {dispenseLitres.toFixed(2)} <span style={{ fontSize: "14px" }}>L</span>
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-2)" }}>
                  Flow Rate: <b>{flowRateLpm.toFixed(1)} L/M</b> · Preset Max: <b>{activeWaybill?.entitlement_qty || 60.0} L</b>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------
          ROLE VIEW 3: SUPERVISOR CENTRAL CONSOLE
          -------------------------------------------------------------------- */}
      {userRole === "supervisor" && (
        <>
          {/* Streamlined Quick Action Bar */}
          <div className="glass-panel navigation-toolbar no-print" style={{ justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--blue)", letterSpacing: ".04em", display: "flex", alignItems: "center", gap: "6px" }}>
                {activeTab === "today_monitor" && "⚡ REAL-TIME ADBLUE DISPENSED DETAILS & TELEMETRY LEDGER"}
                {activeTab === "iot_feed" && "📡 IOT TELEMETRY LIVE FEED (MQTT BROKER / DISPENSED LITERS)"}
                {activeTab === "adblue_workflow" && "🔄 11-STAGE AUTOMATED ADBLUE REFILLING PROCESS"}
                {activeTab === "adblue_report" && "📄 OFFICIAL AUTOMATED ADBLUE REPORT"}
                {activeTab === "site_3d" && "🏭 3D SITE & BULK TANK OVERVIEW (2x 30kL & 10 DISPENSERS)"}
                {activeTab === "tank_history" && "📜 BULK STORAGE TANKS 1 & 2 INVENTORY & HISTORICAL LEDGER"}
              </span>
            </div>

            <div className="quick-action-group">
              <button
                className={`btn-action ${activeTab === "today_monitor" ? "auto-demo" : ""}`}
                onClick={() => setActiveTab("today_monitor")}
                style={{ background: activeTab === "today_monitor" ? "#2563eb" : "rgba(37,99,235,0.12)", color: activeTab === "today_monitor" ? "#fff" : "#2563eb", borderColor: "#2563eb", fontWeight: 700 }}
                title="View Real-Time Dispensed Liters & Telemetry Logs"
              >
                ⚡ Dispense Console
              </button>
              <button
                className={`btn-action ${activeTab === "iot_feed" ? "auto-demo" : ""}`}
                onClick={() => setActiveTab("iot_feed")}
                style={{ background: activeTab === "iot_feed" ? "#8b5cf6" : "rgba(139,92,246,0.15)", color: activeTab === "iot_feed" ? "#fff" : "#a78bfa", borderColor: "#8b5cf6", fontWeight: 700 }}
                title="View Real-Time IoT Telemetry Stream (Vehicle ID, Dispensed Liters, Date Time)"
              >
                📡 IoT Live Feed
              </button>
              <button
                className={`btn-action ${activeTab === "adblue_workflow" ? "auto-demo" : ""}`}
                onClick={() => setActiveTab("adblue_workflow")}
                style={{ background: activeTab === "adblue_workflow" ? "#0284c7" : "rgba(2,132,199,0.15)", color: activeTab === "adblue_workflow" ? "#fff" : "#38bdf8", borderColor: "#0284c7", fontWeight: 700 }}
                title="View 11-Stage Automated AdBlue Refilling Process"
              >
                🔄 11-Step Process
              </button>
              <button
                className={`btn-action ${activeTab === "adblue_report" ? "auto-demo" : ""}`}
                onClick={() => setActiveTab("adblue_report")}
                style={{ background: activeTab === "adblue_report" ? "#059669" : "rgba(16,185,129,0.15)", color: activeTab === "adblue_report" ? "#fff" : "#34d399", borderColor: "#059669", fontWeight: 700 }}
                title="View Official Automated AdBlue Report"
              >
                📄 Official Report
              </button>
              <button
                className={`btn-action ${activeTab === "site_3d" ? "auto-demo" : ""}`}
                onClick={() => setActiveTab("site_3d")}
                style={{ background: activeTab === "site_3d" ? "#7c3aed" : "rgba(124,58,237,0.15)", color: activeTab === "site_3d" ? "#fff" : "#c084fc", borderColor: "#7c3aed", fontWeight: 700 }}
                title="View Interactive 3D Digital Twin of 2x 30kL Tanks & 10 Forecourt Dispensers"
              >
                🏭 3D Site Overview
              </button>
              <button
                className={`btn-action ${activeTab === "tank_history" ? "auto-demo" : ""}`}
                onClick={() => setActiveTab("tank_history")}
                style={{ background: activeTab === "tank_history" ? "#ea580c" : "rgba(234,88,12,0.15)", color: activeTab === "tank_history" ? "#fff" : "#fb923c", borderColor: "#ea580c", fontWeight: 700 }}
                title="View Dedicated Bulk Storage Tanks 1 & 2 History, Refills, Dispenses & Quality Logs"
              >
                📜 Tank History
              </button>

              {activeTab === "today_monitor" && (
                <>
                  <button
                    className="btn-action auto-demo"
                    onClick={() => handleDirectDispense("KL11BV2662", 50.0)}
                    title="Quick dispense 50 Liters to sample truck"
                    style={{ background: "linear-gradient(135deg, #059669, #047857)", color: "#fff", borderColor: "#059669" }}
                  >
                    + Quick 50L Dispense
                  </button>
                  <button
                    className="btn-action"
                    onClick={handleManualRefresh}
                    title="Refresh live logs from server"
                  >
                    ↺ Refresh Logs
                  </button>
                  <button
                    className="btn-action"
                    onClick={handleClearAllLogs}
                    title="Clear all logs from database"
                    style={{ color: "#ef4444", borderColor: "rgba(239,68,68,0.3)" }}
                  >
                    🗑️ Clear Logs
                  </button>
                </>
              )}
            </div>
          </div>

          {/* TAB 0: TODAY'S ADBLUE OPERATIONS & REAL-TIME MONITOR */}
          <div style={{ display: activeTab === "today_monitor" ? "block" : "none" }}>
            {/* Top KPI Cards Banner */}
            <div className="today-kpi-grid">
              {/* KPI 1: Today AdBlue Dispensed */}
              <div className="today-kpi-card glass-panel primary-emerald">
                <div className="today-kpi-header">
                  <div className="today-kpi-label">TOTAL ADBLUE DISPENSED TODAY</div>
                  <span className="today-kpi-icon-pill">💧</span>
                </div>
                <div className="today-kpi-value-row">
                  <span className="today-kpi-number emerald">{realTodayDispensedLiters.toFixed(2)}</span>
                  <span className="today-kpi-unit">LITRES</span>
                </div>
                <div className="today-kpi-footer">
                  <span className="kpi-pill success">✓ {todayDispenseCount} Dispenses Today</span>
                  <span className="kpi-pill cyan">AVG {(todayDispenseCount > 0 ? (realTodayDispensedLiters / todayDispenseCount).toFixed(1) : "0.0")} L / TRUCK</span>
                  <span className="kpi-date-badge">📅 {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
              </div>

              {/* KPI 2: Total Dispenses Logged */}
              <div className="today-kpi-card glass-panel primary-blue">
                <div className="today-kpi-header">
                  <div className="today-kpi-label">TOTAL DISPENSES LOGGED</div>
                  <span className="today-kpi-icon-pill">📋</span>
                </div>
                <div className="today-kpi-value-row">
                  <span className="today-kpi-number">{totalTxnCount}</span>
                  <span className="today-kpi-unit">TRANSACTIONS</span>
                </div>
                <div className="today-kpi-footer">
                  <span className="kpi-pill cyan">🚚 {uniqueVehiclesCount} Distinct Vehicles</span>
                  <span className="kpi-pill success">📡 MQTT Ready (1883)</span>
                </div>
              </div>

              {/* KPI 3: Lifetime Volume */}
              <div className="today-kpi-card glass-panel primary-cyan">
                <div className="today-kpi-header">
                  <div className="today-kpi-label">TOTAL LIFETIME VOLUME</div>
                  <span className="today-kpi-icon-pill">⚡</span>
                </div>
                <div className="today-kpi-value-row">
                  <span className="today-kpi-number cyan">{totalDispensedLiters.toFixed(2)}</span>
                  <span className="today-kpi-unit">LITRES</span>
                </div>
                <div className="today-kpi-footer">
                  <span className="kpi-pill spec">ISO 22241 / AUS 32</span>
                  <span className="kpi-pill success">🟢 SQLite Port 8001</span>
                </div>
              </div>

              {/* KPI 4: Forecourt Dispenser Status */}
              <div className="today-kpi-card glass-panel primary-cyan">
                <div className="today-kpi-header">
                  <div className="today-kpi-label">KHARJ BAY 1 DISPENSER STATUS</div>
                  <span className="today-kpi-icon-pill">⛽</span>
                </div>
                <div className="today-kpi-value-row">
                  <span className="today-kpi-number cyan">ADB-DU-01</span>
                </div>
                <div className="today-kpi-footer">
                  <span className="kpi-pill success">🟢 SOLENOID ARMED</span>
                  <span className="kpi-pill spec">TOTALIZER: {(units[0]?.totalizer_l + totalDispensedLiters).toLocaleString()} L</span>
                </div>
              </div>
            </div>

            {/* Telemetry Station & Dispenser Flow Control */}
            <div className="today-console-grid">
              {/* Left Column: Direct Dispense & IoT Ingestion */}
              <div className="glass-panel today-scanner-panel">
                <div className="panel-header">
                  <h2>⛽ ADBLUE DISPENSER &amp; TELEMETRY STATION</h2>
                  <span className="header-tag-pill cyan">MQTT READY (PORT 8001)</span>
                </div>
                <div className="panel-body">
                  <p className="scanner-desc">
                    Enter vehicle number and volume to dispense AdBlue directly, or send hardware telemetry via MQTT topic <code>adblue/iot/dispense</code>. No vehicle registration required.
                  </p>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleDirectDispense();
                    }}
                    className="today-scan-form"
                  >
                    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr auto", gap: "10px", width: "100%", alignItems: "center" }}>
                      <div className="today-scan-input-wrapper" style={{ margin: 0 }}>
                        <span className="scan-input-icon">🚚</span>
                        <input
                          type="text"
                          className="today-scan-input"
                          placeholder="Vehicle ID (e.g. KL11BV2662, 566808)..."
                          value={dispenseVehicleInput}
                          onChange={(e) => setDispenseVehicleInput(e.target.value)}
                        />
                      </div>
                      <div className="today-scan-input-wrapper" style={{ margin: 0 }}>
                        <span className="scan-input-icon">💧</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          className="today-scan-input"
                          placeholder="Liters (e.g. 50.0)"
                          value={dispenseLitersInput}
                          onChange={(e) => setDispenseLitersInput(Number(e.target.value))}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isTodayDispensing || !dispenseVehicleInput.trim()}
                        className="btn-action btn-scan-submit"
                        style={{ background: "linear-gradient(135deg, #059669, #047857)", color: "#fff", fontWeight: 700, padding: "12px 18px", height: "100%" }}
                      >
                        {isTodayDispensing ? "▶ Flowing..." : "▶ Dispense"}
                      </button>
                    </div>
                  </form>

                  <div className="quick-scan-samples" style={{ marginTop: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
                      <span className="quick-scan-label" style={{ marginBottom: 0 }}>QUICK 1-CLICK DISPENSE SAMPLES:</span>
                      <span style={{ fontSize: "11px", color: "var(--text-3)" }}>Click to simulate instant hardware delivery</span>
                    </div>
                    <div className="quick-scan-chips">
                      {[
                        { vid: "KL11BV2662", ltrs: 50.0 },
                        { vid: "566808", ltrs: 2.22 },
                        { vid: "344678", ltrs: 2.22 },
                        { vid: "8906010913335", ltrs: 12.76 },
                        { vid: "ALM-TRK-1041", ltrs: 60.0 },
                      ].map((item) => (
                        <button
                          key={item.vid}
                          type="button"
                          className="quick-scan-chip"
                          onClick={() => {
                            setDispenseVehicleInput(item.vid);
                            setDispenseLitersInput(item.ltrs);
                            handleDirectDispense(item.vid, item.ltrs);
                          }}
                          disabled={isTodayDispensing}
                          title={`Click to dispense ${item.ltrs}L to ${item.vid}`}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span>🚚 {item.vid}</span>
                          </div>
                          <span className="chip-meta" style={{ color: "#059669", fontWeight: 700 }}>({item.ltrs} L)</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Dispenser Flow Control & Gauge */}
              <div className="glass-panel today-dispense-panel">
                <div className="panel-header">
                  <h2>⚡ DISPENSER FLOW CONTROL &amp; LIVE GAUGE</h2>
                  <span className={`header-tag-pill ${isTodayDispensing ? "emerald" : "cyan"}`}>
                    {isTodayDispensing ? "▶ SOLENOID ACTIVE · FLOWING" : "● READY TO DISPENSE"}
                  </span>
                </div>

                <div className="panel-body">
                  <div className="active-wb-card">
                    <div className="active-wb-header">
                      <div>
                        <div className="active-wb-title">
                          VEHICLE: {dispenseVehicleInput || "KL11BV2662"}
                        </div>
                        <div className="active-wb-sub">
                          Dispenser Bay 1 · Solenoid Armed · 1883 Telemetry Ready
                        </div>
                      </div>
                      <div className="active-wb-entitlement">
                        <span className="entitlement-label">TARGET VOLUME</span>
                        <span className="entitlement-value">{(dispenseLitersInput || 50.0).toFixed(1)} L</span>
                      </div>
                    </div>

                    {/* Dispensing Progress & Flow Gauge */}
                    <div className="dispense-gauge-box">
                      <div className="gauge-metric-row">
                        <div>
                          <span className="gauge-label">DISPENSED NOW</span>
                          <div className="gauge-big-num">
                            {isTodayDispensing ? todayDispenseProgress.toFixed(2) : Number(dispenseLitersInput || 50.0).toFixed(2)} <span className="unit">L</span>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span className="gauge-label">FLOW RATE</span>
                          <div className="gauge-rate-num">
                            {todayFlowRate.toFixed(1)} <span className="unit">L/M</span>
                          </div>
                        </div>
                      </div>

                      <div className="dispense-progress-bar-track">
                        <div
                          className={`dispense-progress-bar-fill ${isTodayDispensing ? "flowing" : ""}`}
                          style={{
                            width: `${Math.min(
                              100,
                              (((isTodayDispensing ? todayDispenseProgress : Number(dispenseLitersInput || 50.0)) /
                                Math.max(1, Number(dispenseLitersInput || 50.0))) *
                                100)
                            )}%`,
                          }}
                        />
                      </div>

                      <div className="gauge-bottom-meta">
                        <span>Product: <b>AdBlue (AUS 32 / ISO 22241)</b></span>
                        <span>Status: <b>{isTodayDispensing ? "Dispensing in progress..." : "Nozzle stowed / Ready"}</b></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Section: Real-Time Dispensed Liters Ledger (Matching Image 3) */}
            <section className="glass-panel today-log-section" style={{ marginTop: "24px" }}>
              <div className="panel-header" style={{ flexWrap: "wrap", gap: "12px", justifyContent: "space-between" }}>
                <div>
                  <h2>📋 DISPENSE TRANSACTION LOGS ({filteredIotLogs.length})</h2>
                  <div style={{ fontSize: "12px", color: "var(--text-3)", marginTop: "2px" }}>
                    Real-time dispensing records synchronized via MQTT topic <code>adblue/iot/dispense</code> &amp; SQLite database
                  </div>
                </div>

                {/* Filters, Search & Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "12px", color: "var(--text-3)", fontWeight: 600 }}>Filter Date:</span>
                    <input
                      type="date"
                      value={logDateFilter}
                      onChange={(e) => setLogDateFilter(e.target.value)}
                      style={{
                        padding: "6px 10px",
                        fontSize: "12px",
                        borderRadius: "6px",
                        border: "1px solid rgba(0,0,0,0.15)",
                        background: "rgba(0,0,0,0.03)",
                        color: "var(--text-1)",
                      }}
                    />
                    {logDateFilter && (
                      <button
                        type="button"
                        className="btn-action"
                        onClick={() => setLogDateFilter("")}
                        style={{ fontSize: "11px", padding: "4px 8px" }}
                      >
                        All Dates
                      </button>
                    )}
                  </div>

                  <div className="table-search-box">
                    <span>🔍</span>
                    <input
                      type="text"
                      placeholder="Search Vehicle ID..."
                      value={logSearchQuery}
                      onChange={(e) => setLogSearchQuery(e.target.value)}
                    />
                  </div>

                  <button
                    type="button"
                    className="btn-action"
                    onClick={handleManualRefresh}
                    style={{ fontSize: "12px", padding: "6px 12px" }}
                    title="Refresh logs from server"
                  >
                    ↺ Refresh
                  </button>

                  <button
                    type="button"
                    className="btn-action"
                    onClick={handleClearAllLogs}
                    style={{ fontSize: "12px", padding: "6px 12px", color: "#ef4444", borderColor: "rgba(239,68,68,0.3)" }}
                    title="Clear all logs from database"
                  >
                    🗑️ Clear All Logs
                  </button>
                </div>
              </div>

              <div className="panel-body" style={{ padding: 0 }}>
                <div className="today-table-wrapper">
                  <table className="today-activity-table">
                    <thead>
                      <tr>
                        <th style={{ width: "45px" }}>#</th>
                        <th>TXN ID</th>
                        <th>DISPENSER</th>
                        <th>VEHICLE &amp; TRAILER</th>
                        <th>WAYBILL</th>
                        <th>DISPENSED VOLUME</th>
                        <th>TOTALISER (START ➔ END)</th>
                        <th>OPERATOR &amp; MODE</th>
                        <th>STATUS / STOP</th>
                        <th>DATE &amp; TIME (IST)</th>
                        <th style={{ textAlign: "right" }}>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredIotLogs.length === 0 ? (
                        <tr>
                          <td colSpan={11} style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-3)" }}>
                            <div style={{ fontSize: "28px", marginBottom: "8px" }}>📡</div>
                            <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text-1)" }}>No dispense records found</div>
                            <div style={{ fontSize: "12px", marginTop: "4px" }}>
                              Publish an MQTT message to <code>adblue/iot/dispense</code> or click "Dispense" above.
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredIotLogs.map((log, idx) => (
                          <tr key={log.id || log.name || idx} className="today-table-row">
                            <td style={{ fontFamily: "var(--font-mono)", color: "var(--text-3)", fontWeight: 600, fontSize: "11px" }}>
                              {log.id != null ? log.id : idx + 1}
                            </td>
                            <td>
                              <span
                                style={{
                                  display: "inline-block",
                                  fontFamily: "var(--font-mono)",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  color: "#6d28d9",
                                  background: "rgba(109,40,217,0.08)",
                                  padding: "3px 7px",
                                  borderRadius: "4px",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {log.txn_id || `TXN-${log.id || idx + 1}`}
                              </span>
                            </td>
                            <td>
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  background: "rgba(0,0,0,0.05)",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  color: "var(--text-2)",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {log.dispenser_id || "ADB-DU-01"}
                              </span>
                            </td>
                            <td>
                              <div>
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "5px",
                                    background: "rgba(37, 99, 235, 0.1)",
                                    color: "#1d4ed8",
                                    border: "1px solid rgba(37, 99, 235, 0.25)",
                                    padding: "3px 8px",
                                    borderRadius: "5px",
                                    fontWeight: 700,
                                    fontSize: "12px",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  🚚 {log.vehicle_id}
                                </span>
                                {log.trailer_no && log.trailer_no !== "—" && (
                                  <div style={{ fontSize: "11px", color: "var(--text-3)", marginTop: "2px" }}>
                                    Trailer: <b>{log.trailer_no}</b>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td>
                              {log.waybill_no && log.waybill_no !== "—" ? (
                                <span
                                  style={{
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    background: "rgba(245,158,11,0.1)",
                                    color: "#b45309",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    border: "1px solid rgba(245,158,11,0.25)",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {log.waybill_no}
                                </span>
                              ) : (
                                <span style={{ color: "var(--text-3)" }}>—</span>
                              )}
                            </td>
                            <td>
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  background: "rgba(16, 185, 129, 0.12)",
                                  color: "#047857",
                                  border: "1px solid rgba(16, 185, 129, 0.25)",
                                  padding: "3px 8px",
                                  borderRadius: "5px",
                                  fontWeight: 800,
                                  fontSize: "12px",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                💧 {Number(log.dispensed_liters).toFixed(2)} L
                              </span>
                            </td>
                            <td>
                              <span
                                style={{
                                  fontFamily: "var(--font-mono)",
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  color: "#0f766e",
                                  background: "#f0fdfa",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  border: "1px solid #ccfbf1",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {Number(log.totaliser_start || 0).toFixed(1)} ➔ {Number(log.totaliser_end || 0).toFixed(1)} L
                              </span>
                            </td>
                            <td>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: "11px", color: "var(--text-1)" }}>
                                  {log.operator || "Operator"}
                                </div>
                                <span
                                  style={{
                                    fontSize: "10px",
                                    fontWeight: 700,
                                    background: "rgba(0,0,0,0.04)",
                                    padding: "1px 5px",
                                    borderRadius: "3px",
                                    color: "var(--text-3)",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {log.entry_mode || "AUTO_MQTT"}
                                </span>
                              </div>
                            </td>
                            <td>
                              <span
                                style={{
                                  display: "inline-block",
                                  background: "rgba(16, 185, 129, 0.1)",
                                  color: "#059669",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {log.stop_reason || "NOZZLE_STOWED"}
                              </span>
                              {log.error_code && log.error_code !== "NONE" && (
                                <div style={{ color: "#ef4444", fontSize: "10px", fontWeight: 700 }}>
                                  Err: {log.error_code}
                                </div>
                              )}
                            </td>
                            <td style={{ fontFamily: "var(--font-mono)", color: "var(--text-1)", fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap" }}>
                              {log.date_time}
                            </td>
                            <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                              <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                                <button
                                  type="button"
                                  className="table-mini-btn"
                                  style={{ color: "#2563eb", borderColor: "#bfdbfe", background: "#eff6ff", fontWeight: 700 }}
                                  onClick={() => setInspectedIotLog(log)}
                                  title="Inspect all 13 fields"
                                >
                                  🔍 Audit Slip
                                </button>
                                <button
                                  type="button"
                                  className="table-mini-btn"
                                  style={{ color: "#ef4444", borderColor: "#fecaca", background: "#fef2f2", fontWeight: 700 }}
                                  onClick={() => handleDeleteLog(log.id)}
                                  title="Remove this dispense record"
                                >
                                  Remove
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Table Footer Summary */}
                <div className="today-table-summary-bar">
                  <div className="summary-stat">
                    <span>Total Recorded Dispenses:</span>
                    <b>{filteredIotLogs.length}</b>
                  </div>
                  <div className="summary-stat">
                    <span>Total Volume Displayed:</span>
                    <b style={{ color: "var(--green)" }}>
                      {filteredIotLogs.reduce((sum, item) => sum + (Number(item.dispensed_liters) || 0), 0).toFixed(2)} Litres
                    </b>
                  </div>
                  <div className="summary-stat">
                    <span>Unique Vehicles:</span>
                    <b>{new Set(filteredIotLogs.map((l) => l.vehicle_id)).size}</b>
                  </div>
                </div>
              </div>

                {/* Audit Slip Modal Inspecting All 13 Fields */}
                {inspectedIotLog && (
                  <div
                    style={{
                      position: "fixed",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: "rgba(15, 23, 42, 0.65)",
                      backdropFilter: "blur(4px)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      zIndex: 9999,
                      padding: "20px",
                    }}
                    onClick={() => setInspectedIotLog(null)}
                  >
                    <div
                      style={{
                        background: "#ffffff",
                        borderRadius: "16px",
                        width: "100%",
                        maxWidth: "680px",
                        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
                        overflow: "hidden",
                        border: "1px solid rgba(0,0,0,0.1)",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div
                        style={{
                          background: "linear-gradient(135deg, #0f2b5c 0%, #1e40af 100%)",
                          color: "#ffffff",
                          padding: "18px 24px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 800, fontSize: "16px" }}>
                          <span>🔍</span> Transaction Audit Slip &amp; IoT Telemetry
                        </div>
                        <button
                          type="button"
                          onClick={() => setInspectedIotLog(null)}
                          style={{
                            background: "rgba(255,255,255,0.2)",
                            border: "none",
                            color: "#ffffff",
                            width: "30px",
                            height: "30px",
                            borderRadius: "50%",
                            cursor: "pointer",
                            fontWeight: 800,
                          }}
                        >
                          ✕
                        </button>
                      </div>

                      <div style={{ padding: "20px 24px", maxHeight: "75vh", overflowY: "auto" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                          <div style={{ background: "rgba(109,40,217,0.06)", border: "1px solid rgba(109,40,217,0.2)", borderRadius: "8px", padding: "10px 14px" }}>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "#6d28d9", textTransform: "uppercase" }}>1. Transaction ID (TXN_ID)</div>
                            <div style={{ fontSize: "14px", fontWeight: 800, fontFamily: "var(--font-mono)", color: "var(--text-1)", marginTop: "2px" }}>
                              {inspectedIotLog.txn_id || `TXN-${inspectedIotLog.id}`}
                            </div>
                          </div>

                          <div style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "8px", padding: "10px 14px" }}>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>2. Dispenser ID</div>
                            <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--text-1)", marginTop: "2px" }}>
                              {inspectedIotLog.dispenser_id || "ADB-DU-01"}
                            </div>
                          </div>

                          <div style={{ background: "rgba(37,99,235,0.06)", border: "1px solid rgba(37,99,235,0.2)", borderRadius: "8px", padding: "10px 14px" }}>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase" }}>3. Vehicle ID</div>
                            <div style={{ fontSize: "15px", fontWeight: 800, color: "#1d4ed8", marginTop: "2px" }}>
                              🚚 {inspectedIotLog.vehicle_id}
                            </div>
                          </div>

                          <div style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "8px", padding: "10px 14px" }}>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>4. Trailer Number</div>
                            <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-1)", marginTop: "2px" }}>
                              {inspectedIotLog.trailer_no || "—"}
                            </div>
                          </div>

                          <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "8px", padding: "10px 14px" }}>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "#b45309", textTransform: "uppercase" }}>5. Waybill Number</div>
                            <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-1)", marginTop: "2px" }}>
                              {inspectedIotLog.waybill_no || "—"}
                            </div>
                          </div>

                          <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: "8px", padding: "10px 14px" }}>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "#047857", textTransform: "uppercase" }}>6. Dispensed Volume</div>
                            <div style={{ fontSize: "18px", fontWeight: 800, color: "#047857", marginTop: "2px" }}>
                              💧 {Number(inspectedIotLog.dispensed_liters).toFixed(2)} L
                            </div>
                          </div>

                          <div style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "8px", padding: "10px 14px" }}>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>7. Date &amp; Time (IST)</div>
                            <div style={{ fontSize: "13px", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text-1)", marginTop: "2px" }}>
                              {inspectedIotLog.date_time}
                            </div>
                          </div>

                          <div style={{ background: "rgba(15,118,110,0.06)", border: "1px solid rgba(15,118,110,0.2)", borderRadius: "8px", padding: "10px 14px" }}>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "#0f766e", textTransform: "uppercase" }}>8 &amp; 9. Totaliser (Start ➔ End)</div>
                            <div style={{ fontSize: "13px", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text-1)", marginTop: "2px" }}>
                              {Number(inspectedIotLog.totaliser_start || 0).toFixed(2)} ➔ {Number(inspectedIotLog.totaliser_end || 0).toFixed(2)} L
                            </div>
                          </div>

                          <div style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "8px", padding: "10px 14px" }}>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>10. Operator</div>
                            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-1)", marginTop: "2px" }}>
                              👤 {inspectedIotLog.operator || "Operator"}
                            </div>
                          </div>

                          <div style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "8px", padding: "10px 14px" }}>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>11. Entry Mode</div>
                            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-1)", marginTop: "2px" }}>
                              🏷️ {inspectedIotLog.entry_mode || "AUTO_MQTT"}
                            </div>
                          </div>

                          <div style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "8px", padding: "10px 14px" }}>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>12. Stop Reason</div>
                            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-1)", marginTop: "2px" }}>
                              🛑 {inspectedIotLog.stop_reason || "NOZZLE_STOWED"}
                            </div>
                          </div>

                          <div style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "8px", padding: "10px 14px" }}>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>13. Error Code</div>
                            <div style={{ fontSize: "13px", fontWeight: 700, color: inspectedIotLog.error_code && inspectedIotLog.error_code !== "NONE" ? "#ef4444" : "#10b981", marginTop: "2px" }}>
                              {inspectedIotLog.error_code || "NONE"}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div style={{ padding: "14px 24px", background: "rgba(0,0,0,0.02)", borderTop: "1px solid rgba(0,0,0,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "12px", color: "var(--text-3)" }}>Synchronized via MQTT <code>adblue/iot/dispense</code></span>
                        <button type="button" className="btn-action" onClick={() => setInspectedIotLog(null)}>
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                )}
            </section>
          </div>

          {/* TAB: REAL-TIME IOT TELEMETRY (MQTT) */}
          {activeTab === "iot_feed" && (
            <IotDispenseFeed
              logs={iotLogs}
              workerStats={workerStats}
              onSimulatePacket={handleSimulateIotPacket}
              onRefresh={handleRefreshIotLogs}
              onDeleteLog={handleDeleteLog}
              onClearAllLogs={handleClearAllLogs}
            />
          )}

          {/* TAB: PRE-APPROVED FLEET DIRECTORY */}
          {activeTab === "approved_vehicles" && (
            <div className="animate-fade-in" style={{ marginBottom: "30px" }}>
              <ApprovedVehiclesPage />
            </div>
          )}

          {/* TAB: 11-STAGE AUTOMATED ADBLUE REFILLING PROCESS (IMAGE 1) */}
          {activeTab === "adblue_workflow" && (
            <div className="animate-fade-in" style={{ marginBottom: "30px" }}>
              <AdBlueProcessWorkflow
                currentStepIndex={workflowStepIndex}
                activeVehicleNo={todaySelectedWb?.vehicle_no || selectedVehicle}
                activeWaybillNo={todaySelectedWb?.waybill_no || selectedWaybillNo}
                activeDispensedQty={isTodayDispensing ? todayDispenseProgress : (todaySelectedWb?.dispensed_qty || 32.0)}
                activePresetQty={todaySelectedWb?.entitlement_qty || 60.0}
                onNavigateToReport={() => setActiveTab("adblue_report")}
              />
            </div>
          )}

          {/* TAB: OFFICIAL AUTOMATED ADBLUE REPORT (IMAGE 2) */}
          {activeTab === "adblue_report" && (
            <div className="animate-fade-in" style={{ marginBottom: "30px" }}>
              <AutomatedAdBlueReport
                additionalRecords={dynamicReportRecords}
              />
            </div>
          )}

          {/* TAB: 3D SITE & TANK OVERVIEW (2x 30kL & 10 DISPENSERS) */}
          {activeTab === "site_3d" && (
            <div className="animate-fade-in" style={{ marginBottom: "30px" }}>
              <Site3DTankTwin
                todayDispensedTotal={todayAdBlueDispensed}
                activeDispenserBay={todaySelectedWb ? 1 : 1}
                isDispensing={isTodayDispensing}
              />
            </div>
          )}

          {/* TAB: BULK STORAGE TANKS 1 & 2 DEDICATED HISTORY PAGE */}
          {activeTab === "tank_history" && (
            <div className="animate-fade-in" style={{ marginBottom: "30px" }}>
              <TankHistoryPage
                todayDispensedTotal={todayAdBlueDispensed}
                currentTank1Volume={24730.0}
                currentTank2Volume={26300.0}
              />
            </div>
          )}

          {/* TAB 1: COMMAND CENTER */}
          <div style={{ display: activeTab === "forecourt" ? "block" : "none" }}>
            <section className="glass-panel" style={{ marginBottom: "24px" }}>
              <div className="panel-header">
                <h2>FLEET TELEMATICS & GEOFENCE</h2>
                <span className="header-tag-pill cyan">
                  {vehicles.filter((v) => v.geofence_state === "Inside").length} UNITS AT BAY
                </span>
              </div>

              <div className="tactical-radar-grid">
                <div className="leaflet-map-wrapper">
                  <div id="leaflet-fleet-map" ref={mapContainerRef} className={mapLayer === "dark" ? "dark-map-tiles" : ""} />
                  <div className="map-floating-toolbar">
                    <button className={`map-layer-btn ${mapLayer === "light" ? "active" : ""}`} onClick={() => setMapLayer("light")}>
                      Road Map
                    </button>
                    <button className={`map-layer-btn ${mapLayer === "satellite" ? "active" : ""}`} onClick={() => setMapLayer("satellite")}>
                      Satellite
                    </button>
                    <button className={`map-layer-btn ${mapLayer === "terrain" ? "active" : ""}`} onClick={() => setMapLayer("terrain")}>
                      Terrain
                    </button>
                    <button className="map-layer-btn" onClick={handleCenterStation}>
                      Recenter
                    </button>
                  </div>
                </div>

                <div className="fleet-vehicle-deck">
                  <div className="fleet-deck-header">
                    <span>ACTIVE FLEET SECTOR</span>
                    <span>{vehicles.length} VEHICLES</span>
                  </div>

                  <div className="fleet-list-container">
                    {vehicles.map((v) => {
                      const isSel = v.name === selectedVehicle;
                      return (
                        <div
                          key={v.name}
                          className={`fleet-item-card ${isSel ? "selected" : ""}`}
                          onClick={() => {
                            setSelectedVehicle(v.name);
                            handleFocusTruck(v);
                          }}
                        >
                          <div className="fleet-item-title">
                            <span>{v.vehicle_no}</span>
                            <span className={v.geofence_state === "Inside" ? "status-blink" : ""} style={{ color: v.geofence_state === "Inside" ? "var(--green)" : "var(--text-3)", fontSize: "12px", letterSpacing: "0.05em", fontWeight: 700 }}>
                              {v.geofence_state?.toUpperCase()}
                            </span>
                          </div>
                          <div className="fleet-item-meta">
                            <span>{v.driver}</span>
                            <span style={{ fontFamily: "var(--font-mono)", color: "var(--blue)", fontWeight: "bold" }}>{v.last_speed_kmph} km/h</span>
                          </div>
                          <div className="fleet-item-route">{v.route}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* TAB 2: FLEET TELEMATICS */}
          {activeTab === "fleet_gps" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "14px" }}>
              {vehicles.map((v) => (
                <div key={v.name} className="glass-panel">
                  <div className="panel-header">
                    <h2 style={{ fontFamily: "var(--font-mono)", fontSize: "13px" }}>{v.vehicle_no}</h2>
                    <span className={`header-tag-pill ${v.geofence_state === "Inside" ? "emerald" : "cyan"}`}>
                      {v.geofence_state}
                    </span>
                  </div>
                  <div className="panel-body">
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "10px" }}>
                      <div style={{ background: "var(--blue-bg)", border: "1px solid var(--blue-bd)", borderLeft: "4px solid var(--blue)", padding: "12px", borderRadius: "var(--radius-sm)" }}>
                        <div style={{ fontSize: "9px", fontWeight: 700, color: "var(--blue-txt)", letterSpacing: ".12em", textTransform: "uppercase", marginBottom: "6px", fontFamily: "var(--font-mono)" }}>Speed</div>
                        <div style={{ fontFamily: "var(--font-mono)", fontWeight: 800, color: "var(--blue)", fontSize: "24px", lineHeight: 1 }}>{v.last_speed_kmph}<span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-3)", marginLeft: "4px" }}>km/h</span></div>
                      </div>
                      <div style={{ background: "var(--green-bg)", border: "1px solid var(--green-bd)", borderLeft: "4px solid var(--green)", padding: "12px", borderRadius: "var(--radius-sm)" }}>
                        <div style={{ fontSize: "9px", fontWeight: 700, color: "var(--green-txt)", letterSpacing: ".12em", textTransform: "uppercase", marginBottom: "6px", fontFamily: "var(--font-mono)" }}>Dist to Depot</div>
                        <div style={{ fontFamily: "var(--font-mono)", fontWeight: 800, color: "var(--green)", fontSize: "24px", lineHeight: 1 }}>{fmtDist(v.distance_m)}</div>
                      </div>
                      <div style={{ background: v.adblue_level_pct < 20 ? "var(--red-bg)" : "var(--amber-bg)", border: `1px solid ${v.adblue_level_pct < 20 ? "var(--red-bd)" : "var(--amber-bd)"}`, borderLeft: `4px solid ${v.adblue_level_pct < 20 ? "var(--red)" : "var(--amber)"}`, padding: "12px", borderRadius: "var(--radius-sm)" }}>
                        <div style={{ fontSize: "9px", fontWeight: 700, color: v.adblue_level_pct < 20 ? "var(--red-txt)" : "var(--amber-txt)", letterSpacing: ".12em", textTransform: "uppercase", marginBottom: "6px", fontFamily: "var(--font-mono)" }}>AdBlue DEF Level</div>
                        <div style={{ fontFamily: "var(--font-mono)", fontWeight: 800, color: v.adblue_level_pct < 20 ? "var(--red)" : "var(--amber)", fontSize: "24px", lineHeight: 1 }}>{v.adblue_level_pct}%</div>
                      </div>
                      <div style={{ background: "var(--sky-bg)", border: "1px solid var(--sky-bd)", borderLeft: "4px solid var(--sky)", padding: "12px", borderRadius: "var(--radius-sm)" }}>
                        <div style={{ fontSize: "9px", fontWeight: 700, color: "var(--sky-txt)", letterSpacing: ".12em", textTransform: "uppercase", marginBottom: "6px", fontFamily: "var(--font-mono)" }}>GPS Fix</div>
                        <div style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--sky)", fontSize: "12px", lineHeight: 1.7 }}>{v.last_latitude?.toFixed(4)},<br/>{v.last_longitude?.toFixed(4)}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
                      <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--blue)", flexShrink: 0 }}></div>
                      <div>
                        <div style={{ fontSize: "9px", fontWeight: 700, color: "var(--text-3)", letterSpacing: ".1em", textTransform: "uppercase", fontFamily: "var(--font-mono)", marginBottom: "1px" }}>Active Route</div>
                        <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-1)", fontFamily: "var(--font-mono)" }}>{v.route}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: ACTIVE WAYBILLS */}
          {activeTab === "waybills" && (
            <div className="glass-panel">
              <div className="panel-header">
                <h2>ACTIVE ADBLUE ORDERS</h2>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <button
                    className="btn-action"
                    onClick={() => setActiveModal("create_order")}
                    style={{ background: "var(--blue)", color: "#FFFFFF", border: "none", fontSize: "11px", padding: "4px 10px" }}
                  >
                    + Issue New Waybill
                  </button>
                  <span className="header-tag-pill cyan">{waybills.length} ORDERS</span>
                </div>
              </div>
              <div className="panel-body" style={{ padding: 0 }}>
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>WAYBILL NO</th>
                        <th>VEHICLE</th>
                        <th>PRODUCT</th>
                        <th>ENTITLEMENT</th>
                        <th>BALANCE</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {waybills.map((w) => (
                        <tr
                          key={w.name}
                          style={{ cursor: "pointer" }}
                          onClick={() => {
                            setSelectedVehicle(w.vehicle);
                            setSelectedWaybillNo(w.waybill_no);
                            setActiveModal("verification");
                          }}
                          title="Click to view official Waybill Document"
                        >
                          <td style={{ fontWeight: 700, color: "var(--blue)", fontVariantNumeric: "tabular-nums" }}>{w.waybill_no}</td>
                          <td style={{ fontWeight: 600 }}>{w.vehicle}</td>
                          <td><span className="header-tag-pill cyan">{w.product}</span></td>
                          <td style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{w.entitlement_qty.toFixed(1)} L</td>
                          <td style={{ fontWeight: 700, color: "var(--green)", fontVariantNumeric: "tabular-nums" }}>{w.balance_qty.toFixed(1)} L</td>
                          <td>
                            <span className={`header-tag-pill ${w.status === "Open" ? "emerald" : "purple"}`}>
                              {w.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SAP LEDGERS */}
          {activeTab === "sap_ledger" && (
            <div className="glass-panel">
              <div className="panel-header">
                <h2>SAP RECONCILIATION LEDGER</h2>
                <span className="header-tag-pill purple">{txns.length} POSTINGS</span>
              </div>
              <div className="panel-body" style={{ padding: 0 }}>
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>TXN ID</th>
                        <th>SAP DOC</th>
                        <th>WAYBILL</th>
                        <th>VEHICLE</th>
                        <th>QTY</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {txns.map((t) => (
                        <tr
                          key={t.name}
                          style={{ cursor: "pointer" }}
                          onClick={() => setActiveModal("sap")}
                          title="Click to view SAP ERP Outbox & System Log"
                        >
                          <td style={{ fontFamily: "var(--font-mono)", color: "var(--text-2)", fontSize: "12px" }}>{t.name}</td>
                          <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--purple)" }}>{t.sap_document_no || "PENDING"}</td>
                          <td style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{t.waybill}</td>
                          <td style={{ fontWeight: 600 }}>{t.vehicle}</td>
                          <td style={{ fontFamily: "var(--font-mono)", color: "var(--green)", fontWeight: 700 }}>{t.dispensed_qty.toFixed(1)} L</td>
                          <td>
                            <span className="header-tag-pill purple">
                              {t.sap_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          {/* TAB 5: FORECOURT INSIGHTS & ANALYTICS */}
          {activeTab === "analytics" && (
            <div>
              {/* Metric Cards Row */}
              <div className="analytics-grid">
                <div className="analytics-metric-card" style={{ borderLeft: "4px solid var(--blue)" }}>
                  <div className="analytics-metric-title">Total Litres Dispensed Today</div>
                  <div className="analytics-metric-number" style={{ color: "var(--blue)" }}>
                    1,284.5 <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-3)" }}>L</span>
                  </div>
                  <div className="analytics-metric-trend up">
                    <span>▲ +14.2%</span> <span style={{ color: "var(--text-3)", fontWeight: 500 }}>vs yesterday</span>
                  </div>
                </div>

                <div className="analytics-metric-card" style={{ borderLeft: "4px solid var(--green)" }}>
                  <div className="analytics-metric-title">Avg Bay Turnaround Time</div>
                  <div className="analytics-metric-number" style={{ color: "var(--green)" }}>
                    3.8 <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-3)" }}>min</span>
                  </div>
                  <div className="analytics-metric-trend up">
                    <span>▼ -42s</span> <span style={{ color: "var(--text-3)", fontWeight: 500 }}>target: &lt; 5.0 min</span>
                  </div>
                </div>

                <div className="analytics-metric-card" style={{ borderLeft: "4px solid var(--purple)" }}>
                  <div className="analytics-metric-title">SAP Sync Success Rate</div>
                  <div className="analytics-metric-number" style={{ color: "var(--purple)" }}>
                    100 <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-3)" }}>%</span>
                  </div>
                  <div className="analytics-metric-trend up">
                    <span>● {txns.length} Document(s)</span> <span style={{ color: "var(--text-3)", fontWeight: 500 }}>0 failed</span>
                  </div>
                </div>

                <div className="analytics-metric-card" style={{ borderLeft: "4px solid var(--amber)" }}>
                  <div className="analytics-metric-title">Fleet Quota Compliance</div>
                  <div className="analytics-metric-number" style={{ color: "var(--amber)" }}>
                    98.6 <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-3)" }}>%</span>
                  </div>
                  <div className="analytics-metric-trend neutral">
                    <span>● 3 Active Trucks</span> <span style={{ color: "var(--text-3)", fontWeight: 500 }}>on authorized routes</span>
                  </div>
                </div>
              </div>

              {/* Detailed Breakdown Panels */}
              <div className="analytics-breakdown-panel">
                {/* Route Consumption */}
                <div className="glass-panel">
                  <div className="panel-header">
                    <h2>FLEET ROUTE ADBlue CONSUMPTION</h2>
                    <span className="header-tag-pill cyan">ACTIVE SECTORS</span>
                  </div>
                  <div className="panel-body">
                    <div className="route-progress-row">
                      <div className="route-progress-labels">
                        <span>Kharj DC ➔ Riyadh Highway 65</span>
                        <span style={{ color: "var(--blue)" }}>616.5 L (48%)</span>
                      </div>
                      <div className="route-progress-track">
                        <div className="route-progress-fill" style={{ width: "48%", background: "var(--blue)" }} />
                      </div>
                    </div>

                    <div className="route-progress-row">
                      <div className="route-progress-labels">
                        <span>Kharj Depot ➔ Dammam Route 522</span>
                        <span style={{ color: "var(--green)" }}>411.0 L (32%)</span>
                      </div>
                      <div className="route-progress-track">
                        <div className="route-progress-fill" style={{ width: "32%", background: "var(--green)" }} />
                      </div>
                    </div>

                    <div className="route-progress-row">
                      <div className="route-progress-labels">
                        <span>Kharj Depot ➔ Jeddah Express Line</span>
                        <span style={{ color: "var(--purple)" }}>257.0 L (20%)</span>
                      </div>
                      <div className="route-progress-track">
                        <div className="route-progress-fill" style={{ width: "20%", background: "var(--purple)" }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Forecourt Hardware Health & Buffer State */}
                <div className="glass-panel">
                  <div className="panel-header">
                    <h2>KIOSK & CLOUD RECONCILIATION HEALTH</h2>
                    <span className={`header-tag-pill ${isOfflineMode ? "amber" : "emerald"}`}>
                      {isOfflineMode ? "BUFFER ACTIVE" : "REALTIME LINK"}
                    </span>
                  </div>
                  <div className="panel-body">
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "var(--surface-2)", borderRadius: "8px", fontSize: "12px" }}>
                        <span style={{ fontWeight: 600 }}>Network Connection</span>
                        <span style={{ fontWeight: 700, color: isOfflineMode ? "var(--amber)" : "var(--green)" }}>
                          {isOfflineMode ? "Offline (Local Flash Active)" : "Online (Connected)"}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "var(--surface-2)", borderRadius: "8px", fontSize: "12px" }}>
                        <span style={{ fontWeight: 600 }}>Hardware Offline Buffer Queue</span>
                        <span style={{ fontWeight: 700, color: bufferedCount > 0 ? "var(--amber)" : "var(--text-1)" }}>
                          {bufferedCount} Record(s) Pending
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "var(--surface-2)", borderRadius: "8px", fontSize: "12px" }}>
                        <span style={{ fontWeight: 600 }}>Dispenser Solenoid Response</span>
                        <span style={{ fontWeight: 700, color: "var(--blue)" }}>&lt; 180 ms</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "var(--surface-2)", borderRadius: "8px", fontSize: "12px" }}>
                        <span style={{ fontWeight: 600 }}>SAP Goods Issue Outbox</span>
                        <span style={{ fontWeight: 700, color: "var(--purple)" }}>{txns.length} Synced</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------------
              FLOATING MACOS BOTTOM DOCK (Clean, Focused, Modern Tab Switcher)
              -------------------------------------------------------------------- */}
          <div className="floating-macos-dock-wrapper no-print">
            <nav className="floating-macos-dock">
              <button
                className={`dock-item-btn ${activeTab === "today_monitor" ? "active" : ""}`}
                onClick={() => setActiveTab("today_monitor")}
                style={activeTab === "today_monitor" ? { background: "linear-gradient(135deg, rgba(37,99,235,0.4), rgba(16,185,129,0.3))", borderColor: "#38bdf8" } : {}}
              >
                <span className="dock-item-icon">⚡</span>
                <span>Dispense Console</span>
                <span className="dock-badge-pill" style={{ background: "#2563eb", color: "#fff" }}>{filteredIotLogs.length}</span>
              </button>

              <button
                className={`dock-item-btn ${activeTab === "iot_feed" ? "active" : ""}`}
                onClick={() => setActiveTab("iot_feed")}
                style={activeTab === "iot_feed" ? { background: "linear-gradient(135deg, rgba(139,92,246,0.4), rgba(167,139,250,0.3))", borderColor: "#a78bfa" } : {}}
              >
                <span className="dock-item-icon">📡</span>
                <span>IoT Live Feed</span>
                <span className="dock-badge-pill" style={{ background: "#8b5cf6", color: "#fff" }}>{iotLogs.length}</span>
              </button>

              <button
                className={`dock-item-btn ${activeTab === "adblue_workflow" ? "active" : ""}`}
                onClick={() => setActiveTab("adblue_workflow")}
                style={activeTab === "adblue_workflow" ? { background: "linear-gradient(135deg, rgba(2,132,199,0.4), rgba(56,189,248,0.3))", borderColor: "#38bdf8" } : {}}
              >
                <span className="dock-item-icon">🔄</span>
                <span>11-Step Process</span>
              </button>

              <button
                className={`dock-item-btn ${activeTab === "adblue_report" ? "active" : ""}`}
                onClick={() => setActiveTab("adblue_report")}
                style={activeTab === "adblue_report" ? { background: "linear-gradient(135deg, rgba(16,185,129,0.4), rgba(5,150,105,0.3))", borderColor: "#34d399" } : {}}
              >
                <span className="dock-item-icon">📄</span>
                <span>Official Report</span>
                <span className="dock-badge-pill" style={{ background: "#059669", color: "#fff" }}>
                  {INITIAL_ADBLUE_REPORT_DATA.length + dynamicReportRecords.length}
                </span>
              </button>

              <button
                className={`dock-item-btn ${activeTab === "site_3d" ? "active" : ""}`}
                onClick={() => setActiveTab("site_3d")}
                style={activeTab === "site_3d" ? { background: "linear-gradient(135deg, rgba(124,58,237,0.4), rgba(168,85,247,0.3))", borderColor: "#c084fc" } : {}}
              >
                <span className="dock-item-icon">🏭</span>
                <span>3D Site &amp; Tanks</span>
                <span className="dock-badge-pill" style={{ background: "#7c3aed", color: "#fff" }}>
                  60kL
                </span>
              </button>

              <button
                className={`dock-item-btn ${activeTab === "tank_history" ? "active" : ""}`}
                onClick={() => setActiveTab("tank_history")}
                style={activeTab === "tank_history" ? { background: "linear-gradient(135deg, rgba(234,88,12,0.4), rgba(249,115,22,0.3))", borderColor: "#fb923c" } : {}}
              >
                <span className="dock-item-icon">📜</span>
                <span>Tank History</span>
                <span className="dock-badge-pill" style={{ background: "#ea580c", color: "#fff" }}>
                  T1 &bull; T2
                </span>
              </button>
            </nav>
          </div>
        </>
      )}

      {/* --------------------------------------------------------------------
          MODALS
          -------------------------------------------------------------------- */}
      {/* Modal 1: Customer Order & Dispatch Placement */}
      {activeModal === "create_order" && (
        <div className="modal-backdrop" onClick={() => setActiveModal("none")}>
          <div className="modal-content glass-panel" style={{ maxWidth: "680px" }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setActiveModal("none")}>&times;</button>
            <div className="panel-header">
              <h2>CUSTOMER ORDER &amp; DISPATCH REPLENISHMENT</h2>
              <span className="header-tag-pill cyan">ALMARAI FREIGHT ORDER</span>
            </div>
            <div className="panel-body">
              <form className="order-form-grid" onSubmit={handleCreateOrder}>
                <div className="form-group">
                  <label className="form-label">Customer / Destination Account</label>
                  <select
                    className="form-select"
                    value={orderForm.customer}
                    onChange={(e) => {
                      const cust = e.target.value;
                      let dest = "RIYADH SOUTH DEPOT";
                      if (cust.includes("NUPCO")) {
                        dest = "RIYADH EAST DEPOT (NUPCO)";
                      } else if (cust.includes("CENTRAL")) {
                        dest = "ALMARAI CENTRAL DISTRIBUTION";
                      }
                      setOrderForm(prev => ({
                        ...prev,
                        customer: cust,
                        arabic_desc: autoGenerateArabicDesc(cust),
                        final_destination: dest,
                      }));
                    }}
                  >
                    <option value="CPP RIYADH SOUTH FOODS 01 (CUSTOMER)">CPP RIYADH SOUTH FOODS 01 (CUSTOMER)</option>
                    <option value="NUPCO CUSTOMER - RIYADH EAST DEPOT">NUPCO CUSTOMER - RIYADH EAST DEPOT</option>
                    <option value="ALMARAI CENTRAL DISTRIBUTION RIYADH">ALMARAI CENTRAL DISTRIBUTION RIYADH</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Final Destination Hub</label>
                  <input
                    type="text"
                    className="form-input"
                    value={orderForm.final_destination}
                    onChange={(e) => setOrderForm(prev => ({ ...prev, final_destination: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Assign Fleet Vehicle &amp; Tractor</label>
                  <select
                    className="form-select"
                    value={orderForm.vehicle}
                    onChange={(e) => {
                      const vObj = vehicles.find(v => v.vehicle_no === e.target.value);
                      setOrderForm(prev => ({
                        ...prev,
                        vehicle: e.target.value,
                        driver: vObj ? vObj.driver : prev.driver,
                        route: vObj ? vObj.route : prev.route,
                        tractor_no: vObj ? `${vObj.vehicle_no} (${vObj.plate_no})` : prev.tractor_no,
                      }));
                    }}
                  >
                    {vehicles.map(v => (
                      <option key={v.name} value={v.vehicle_no}>
                        {v.vehicle_no} — {v.driver} ({v.plate_no})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Product Type to Refill at Kharj Depot</label>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      type="button"
                      className="btn-action auto-demo"
                      style={{ flex: 1, justifyContent: "center" }}
                      onClick={() => setOrderForm(prev => ({ ...prev, product: "AdBlue" }))}
                    >
                      💧 AdBlue (DEF) ISO 22241 / AUS 32
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Refill Quota Quantity (Litres)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="500"
                    className="form-input"
                    value={orderForm.entitlement_qty}
                    onChange={(e) => setOrderForm(prev => ({ ...prev, entitlement_qty: Number(e.target.value) }))}
                    required
                  />
                  <div className="preset-chips-row">
                    {[20, 45, 60, 75, 100].map(qty => (
                      <button
                        key={qty}
                        type="button"
                        className={`preset-chip ${orderForm.entitlement_qty === qty ? "selected" : ""}`}
                        onClick={() => setOrderForm(prev => ({ ...prev, entitlement_qty: qty }))}
                      >
                        {qty} L
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Scheduled Transportation Route</label>
                  <input
                    type="text"
                    className="form-input"
                    value={orderForm.route}
                    onChange={(e) => setOrderForm(prev => ({ ...prev, route: e.target.value }))}
                    required
                  />
                </div>

                <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                  <button
                    type="button"
                    className="btn-action"
                    style={{ flex: 1, justifyContent: "center" }}
                    onClick={() => setActiveModal("none")}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-action auto-demo"
                    style={{ flex: 2, justifyContent: "center", padding: "10px" }}
                  >
                    ✓ Issue Official Almarai Waybill
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Authentic 3-Page Almarai Waybill Document */}
      {activeModal === "verification" && (
        <div className="modal-backdrop" onClick={() => { setActiveModal("none"); setViewWaybillOrder(null); }}>
          <div className="modal-content glass-panel" style={{ maxWidth: "880px", padding: "16px" }} onClick={(e) => e.stopPropagation()}>
            <AlmaraiWaybillDoc
              data={viewWaybillOrder ? {
                waybill_no: viewWaybillOrder.waybill_no || "280820260001",
                prepared_date: "2026-08-13 13:41:22",
                schedule_date: "13.08.2026 00:00:00",
                prepared_by: "111037 - Gopikrishnan",
                final_destination: viewWaybillOrder.delivery_address,
                trip_customer: viewWaybillOrder.customer_name,
                arabic_desc: autoGenerateArabicDesc("CPP RIYADH SOUTH FOODS 01 (CUSTOMER)"),
                driver_name: viewWaybillOrder.assigned_driver || focusVehicle.driver || "175076, AZHAR UD DIN",
                tractor_no: (viewWaybillOrder.assigned_truck || focusVehicle.vehicle_no) + " (" + focusVehicle.plate_no + ")",
                trailer_no: "26344",
                product: viewWaybillOrder.product,
                entitlement_qty: viewWaybillOrder.qty_litres,
                dispensed_qty: 0,
                balance_qty: viewWaybillOrder.qty_litres,
                bay_no: "01 (ADB-DU-01)",
                temp_c: "+22C",
              } : {
                waybill_no: activeWaybill?.waybill_no || "280820260001",
                prepared_date: "2026-08-13 13:41:22",
                schedule_date: "13.08.2026 00:00:00",
                prepared_by: "111037 - Gopikrishnan",
                final_destination: orderForm.final_destination,
                trip_customer: orderForm.customer,
                arabic_desc: orderForm.arabic_desc,
                driver_name: focusVehicle.driver || "175076, AZHAR UD DIN",
                tractor_no: `${focusVehicle.vehicle_no} (${focusVehicle.plate_no})`,
                trailer_no: "26344",
                product: activeWaybill?.product || "AdBlue",
                entitlement_qty: activeWaybill?.entitlement_qty || 60,
                dispensed_qty: activeWaybill?.dispensed_qty || 0,
                balance_qty: activeWaybill?.balance_qty || 60,
                bay_no: "01 (ADB-DU-01)",
                temp_c: "+22C",
              }}
              onClose={() => { setActiveModal("none"); setViewWaybillOrder(null); }}
              onAuthorizePump={() => {
                setActiveModal("dispenser");
                handleStartDispense();
              }}
              showPumpAction={!viewWaybillOrder}
            />
          </div>
        </div>
      )}

      {/* Modal 3: Dispenser Flow Terminal */}
      {activeModal === "dispenser" && (
        <div className="modal-backdrop" onClick={() => setActiveModal("none")}>
          <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setActiveModal("none")}>&times;</button>
            <div className="panel-header">
              <h2>{activeUnit.name} TERMINAL</h2>
              <span className="header-tag-pill emerald">{activeUnit.product}</span>
            </div>
            <div className="panel-body">
              <div className="dispenser-hardware-terminal">
                <div className="terminal-marquee-bar">
                  <span>SYSTEM STATE:</span>
                  <span style={{ color: isDispensing ? "var(--green)" : "var(--blue)", fontWeight: 700 }}>
                    {isDispensing ? "▶ FLUID FLOWING" : "■ SYSTEM STANDBY"}
                  </span>
                </div>

                <div className="lcd-meter-screen">
                  <div>
                    <div className="lcd-number-huge">{dispenseLitres.toFixed(2)}</div>
                    <div className="lcd-subtitle">LITRES DELIVERED</div>
                  </div>
                  <div className="hydro-fluid-cylinder">
                    <div
                      className="hydro-fluid-level"
                      style={{ height: `${Math.min(100, (dispenseLitres / (activeWaybill?.entitlement_qty || 60)) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="hardware-stats-grid">
                  <div className="hardware-stat-box">
                    <div className="label">FLOW RATE</div>
                    <div className="value" style={{color: "var(--blue)"}}>{flowRateLpm.toFixed(1)} L/M</div>
                  </div>
                  <div className="hardware-stat-box">
                    <div className="label">PRESET MAX</div>
                    <div className="value">{activeWaybill?.entitlement_qty.toFixed(1)} L</div>
                  </div>
                  <div className="hardware-stat-box">
                    <div className="label">NOZZLE</div>
                    <div className="value">{isDispensing ? "Lifted" : "Stowed"}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: SAP Reconcile Outbox */}
      {activeModal === "sap" && (
        <div className="modal-backdrop" onClick={() => setActiveModal("none")}>
          <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setActiveModal("none")}>&times;</button>
            <div className="panel-header">
              <h2>SAP ERP OUTBOX & SYSTEM LOG</h2>
              <span className="header-tag-pill purple">{txns.length} POSTINGS</span>
            </div>
            <div className="panel-body">
              <div style={{ marginBottom: "24px" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-3)", marginBottom: "12px", letterSpacing: "0.1em" }}>
                  RECENT POSTINGS
                </div>
                {txns.slice(0, 3).map((t) => (
                  <div key={t.name} className="sap-posting-box">
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <b style={{color: "var(--text-1)"}}>{t.vehicle}</b>
                      <span style={{ color: "var(--purple)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>DOC: {t.sap_document_no}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-2)" }}>
                      <span>FO {t.waybill}</span>
                      <span style={{ color: "var(--green)", fontWeight: 700 }}>+{t.dispensed_qty.toFixed(1)} L</span>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-3)", marginBottom: "12px", letterSpacing: "0.1em" }}>
                  EVENT STREAM
                </div>
                <div className="event-terminal-log">
                  {events.map((e) => (
                    <div key={e.key} className="log-entry">
                      <span className="time">{e.t}</span>
                      <span className="src">[{e.source}]</span>
                      <span className="msg">{e.detail}</span>
                    </div>
                  ))}
                  <div ref={tapeEndRef} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Interactive 5-Stage Delivery Journey Flow Simulator */}
      {activeModal === "journey_flow" && (() => {
        const targetOrder = customerOrders.find((o) => o.order_id === driverActiveOrderId) || customerOrders[0] || {
          order_id: "ORD-2026-0849",
          customer_name: "CPP RIYADH SOUTH FOODS 01 (CUSTOMER)",
          customer_code: "CPP-RSDP-01",
          product: "AdBlue",
          qty_litres: 60,
          delivery_address: "RIYADH SOUTH DEPOT",
          delivery_lat: 24.613,
          delivery_lng: 46.772,
          status: "accepted",
          placed_at: "13:20:00",
          estimated_eta: "2h 30min",
          waybill_no: "280820260001",
          assigned_truck: "ALM-TRK-1041",
          assigned_driver: "175076, AZHAR UD DIN",
        };
        return (
          <DeliveryJourneyModal
            order={targetOrder}
            onClose={() => setActiveModal("none")}
            onViewWaybill={(ord) => {
              setViewWaybillOrder(ord);
              setActiveModal("verification");
            }}
            onUpdateStatus={(orderId, newStatus) => {
              db.updateOrderStatus(orderId, newStatus, {
                ...(newStatus === "delivered" ? { sap_doc_no: "49" + Math.floor(10000000 + Math.random() * 90000000) } : {})
              });
              setCustomerOrders(db.getOrders());
              if (newStatus === "in_transit") {
                handleDriveTruck(focusVehicle.name);
              }
            }}
          />
        );
      })()}

      {/* FOOTER */}
      <footer className="no-print" style={{ marginTop: "32px", textAlign: "center", fontSize: "13px", color: "var(--text-tertiary)", letterSpacing: "0.05em" }}>
        NIMBLE VISION TECHNOLOGIES PVT. LTD. © 2026
      </footer>
    </div>
  );
}

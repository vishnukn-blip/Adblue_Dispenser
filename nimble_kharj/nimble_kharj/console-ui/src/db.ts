// Kharj Unified Persistent Database Storage Engine
// Syncs with Frappe Backend MariaDB when available, and persists locally in IndexedDB/LocalStorage.
import { CustomerOrder, CustomerOrderStatus } from "./CustomerPortal";

export interface DBTransaction {
  name: string;
  waybill: string;
  vehicle: string;
  product: string;
  status: "Reconciled" | "Pending" | "Failed";
  dispensed_qty: number;
  sap_status: "Posted" | "Pending" | "Error";
  sap_document_no: string;
  completed_at: string;
}

export interface DBWaybill {
  waybill_no: string;
  vehicle: string;
  trip_customer: string;
  final_destination: string;
  entitlement_qty: number;
  dispensed_qty: number;
  product: string;
  status: "Open" | "Dispensed" | "Partially Dispensed" | "Delivered";
  tractor_no?: string;
  trailer_no?: string;
  carrier_driver?: string;
  created_at?: string;
}

export interface DBTodayRecord {
  id: string;
  waybill_no: string;
  vehicle_no: string;
  driver_name: string;
  product: string;
  entitlement_qty: number;
  dispensed_qty: number;
  status: "Scanned" | "Dispensing" | "Completed";
  scanned_at: string;
  completed_at?: string;
  date_str: string;
}

const STORAGE_KEYS = {
  ORDERS: "kharj_db_orders_v3",
  WAYBILLS: "kharj_db_waybills_v3",
  TRANSACTIONS: "kharj_db_transactions_v3",
  TODAY_SCANS: "kharj_db_today_scans_v1",
  IOT_LOGS: "kharj_db_iot_logs_v1",
};

export interface DBIotDispenseLog {
  id?: number;
  name?: string;
  txn_id?: string;
  dispenser_id?: string;
  vehicle_id: string;
  waybill_no?: string;
  trailer_no?: string;
  dispensed_liters: number;
  date_time: string;
  totaliser_start?: number;
  totaliser_end?: number;
  operator?: string;
  entry_mode?: string;
  stop_reason?: string;
  error_code?: string;
}

const INITIAL_IOT_LOGS: DBIotDispenseLog[] = [];

export const getTodayDateStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const INITIAL_TODAY_RECORDS: DBTodayRecord[] = [
  {
    id: "TODAY-01",
    waybill_no: "280820260001",
    vehicle_no: "ALM-TRK-1041",
    driver_name: "175076, AZHAR UD DIN",
    product: "AdBlue",
    entitlement_qty: 60.0,
    dispensed_qty: 60.0,
    status: "Completed",
    scanned_at: "09:12:15",
    completed_at: "09:18:40",
    date_str: getTodayDateStr(),
  },
  {
    id: "TODAY-02",
    waybill_no: "280820260002",
    vehicle_no: "ALM-TRK-1082",
    driver_name: "189204, M. HADDAD",
    product: "AdBlue",
    entitlement_qty: 45.0,
    dispensed_qty: 45.0,
    status: "Completed",
    scanned_at: "10:35:00",
    completed_at: "10:41:22",
    date_str: getTodayDateStr(),
  },
  {
    id: "TODAY-03",
    waybill_no: "280820260003",
    vehicle_no: "ALM-TRK-1119",
    driver_name: "194012, S. KURIAN",
    product: "AdBlue",
    entitlement_qty: 75.0,
    dispensed_qty: 75.0,
    status: "Completed",
    scanned_at: "11:50:30",
    completed_at: "11:58:10",
    date_str: getTodayDateStr(),
  },
  {
    id: "TODAY-04",
    waybill_no: "280820260004",
    vehicle_no: "ALM-TRK-1041",
    driver_name: "175076, AZHAR UD DIN",
    product: "AdBlue",
    entitlement_qty: 60.0,
    dispensed_qty: 60.0,
    status: "Completed",
    scanned_at: "13:05:10",
    completed_at: "13:12:05",
    date_str: getTodayDateStr(),
  },
];

// Seed initial persistent records with standard DDMMYYYY#### sequential waybill numbers
const INITIAL_SEED_ORDERS: CustomerOrder[] = [
  {
    order_id: "ORD-590252",
    customer_name: "CPP RIYADH SOUTH FOODS 01",
    customer_code: "CPP-RSDP-01",
    product: "AdBlue",
    qty_litres: 100,
    delivery_address: "RIYADH SOUTH DEPOT (CPP FOODS)",
    delivery_lat: 24.713,
    delivery_lng: 46.674,
    status: "in_transit",
    waybill_no: "280820260001",
    assigned_truck: "ALM-TRK-1041",
    assigned_driver: "175076, AZHAR UD DIN",
    placed_at: "09:15:00",
    estimated_eta: "18 mins",
  },
  {
    order_id: "ORD-101562",
    customer_name: "ALMARAI CENTRAL DISTRIBUTION RIYADH",
    customer_code: "ALM-CENT-01",
    product: "AdBlue",
    qty_litres: 100,
    delivery_address: "ALMARAI CENTRAL DISTRIBUTION",
    delivery_lat: 24.7136,
    delivery_lng: 46.6753,
    status: "delivered",
    waybill_no: "280820260002",
    assigned_truck: "ALM-TRK-1041",
    assigned_driver: "175076, AZHAR UD DIN",
    placed_at: "08:15:00",
    delivered_at: "10:45:22",
    sap_doc_no: "4901824102",
  },
  {
    order_id: "ORD-101558",
    customer_name: "NUPCO CUSTOMER - RIYADH EAST DEPOT",
    customer_code: "NUPCO-REDP-01",
    product: "AdBlue",
    qty_litres: 80,
    delivery_address: "RIYADH EAST DEPOT (NUPCO)",
    delivery_lat: 24.780,
    delivery_lng: 46.820,
    status: "delivered",
    waybill_no: "280820260003",
    assigned_truck: "ALM-TRK-1041",
    assigned_driver: "175076, AZHAR UD DIN",
    placed_at: "06:30:00",
    delivered_at: "08:12:10",
    sap_doc_no: "4901823901",
  },
];

const INITIAL_SEED_WAYBILLS: DBWaybill[] = [
  {
    waybill_no: "280820260001",
    vehicle: "ALM-TRK-1041",
    trip_customer: "CPP RIYADH SOUTH FOODS 01 (CUSTOMER)",
    final_destination: "RIYADH SOUTH DEPOT",
    entitlement_qty: 60.0,
    dispensed_qty: 60.0,
    product: "AdBlue",
    status: "Open",
    tractor_no: "500609 (ALM-TRK-1041)",
    trailer_no: "26344",
    carrier_driver: "175076, AZHAR UD DIN",
    created_at: "2026-08-28 09:00:00",
  },
  {
    waybill_no: "280820260002",
    vehicle: "ALM-TRK-1041",
    trip_customer: "ALMARAI CENTRAL DISTRIBUTION RIYADH",
    final_destination: "CENTRAL DISTRIBUTION HUB",
    entitlement_qty: 100.0,
    dispensed_qty: 100.0,
    product: "AdBlue",
    status: "Delivered",
    tractor_no: "500609 (ALM-TRK-1041)",
    trailer_no: "26344",
    carrier_driver: "175076, AZHAR UD DIN",
    created_at: "2026-08-28 08:00:00",
  },
];

const INITIAL_SEED_TRANSACTIONS: DBTransaction[] = [
  {
    name: "TXN-ADB-20260828-01",
    waybill: "280820260001",
    vehicle: "ALM-TRK-1041",
    product: "AdBlue",
    status: "Reconciled",
    dispensed_qty: 60.0,
    sap_status: "Posted",
    sap_document_no: "4901824901",
    completed_at: "09:45 AM",
  },
  {
    name: "TXN-ADB-20260828-02",
    waybill: "280820260002",
    vehicle: "ALM-TRK-1041",
    product: "AdBlue",
    status: "Reconciled",
    dispensed_qty: 100.0,
    sap_status: "Posted",
    sap_document_no: "4901824102",
    completed_at: "10:14 AM",
  },
];

class KharjDatabase {
  // Generate date-based sequential waybill number: DDMMYYYY + 4-digit counter (e.g. 280820260001, 280820260002)
  generateNextWaybillNo(date: Date = new Date()): string {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = String(date.getFullYear());
    const datePrefix = `${day}${month}${year}`;

    // Collect all existing waybill numbers from waybills and orders
    const allWbs = [
      ...this.getWaybills().map((w) => w.waybill_no),
      ...this.getOrders().map((o) => o.waybill_no).filter(Boolean) as string[],
    ];

    let maxSeq = 0;
    for (const wb of allWbs) {
      if (wb && wb.startsWith(datePrefix)) {
        const seqPart = wb.substring(datePrefix.length);
        const parsed = parseInt(seqPart, 10);
        if (!isNaN(parsed) && parsed > maxSeq) {
          maxSeq = parsed;
        }
      }
    }

    const nextSeq = maxSeq + 1;
    const formattedSeq = String(nextSeq).padStart(4, "0");
    return `${datePrefix}${formattedSeq}`;
  }

  // Orders
  getOrders(): CustomerOrder[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ORDERS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn("DB read error:", e);
    }
    this.saveOrders(INITIAL_SEED_ORDERS);
    return INITIAL_SEED_ORDERS;
  }

  saveOrders(orders: CustomerOrder[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
      window.dispatchEvent(new CustomEvent("kharj_db_updated", { detail: { type: "orders" } }));
    } catch (e) {
      console.error("DB save error:", e);
    }
  }

  addOrder(order: CustomerOrder) {
    const orders = this.getOrders();
    const updated = [order, ...orders];
    this.saveOrders(updated);
    return order;
  }

  updateOrderStatus(orderId: string, status: CustomerOrderStatus, extra: Partial<CustomerOrder> = {}) {
    const orders = this.getOrders();
    const updated = orders.map((o) => {
      if (o.order_id === orderId) {
        return {
          ...o,
          status,
          ...extra,
          ...(status === "delivered" && !o.delivered_at
            ? { delivered_at: new Date().toLocaleTimeString("en-GB", { hour12: false }) }
            : {}),
        };
      }
      return o;
    });
    this.saveOrders(updated);
    return updated.find((o) => o.order_id === orderId);
  }

  // Waybills
  getWaybills(): DBWaybill[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.WAYBILLS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn("DB read error:", e);
    }
    this.saveWaybills(INITIAL_SEED_WAYBILLS);
    return INITIAL_SEED_WAYBILLS;
  }

  saveWaybills(waybills: DBWaybill[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.WAYBILLS, JSON.stringify(waybills));
      window.dispatchEvent(new CustomEvent("kharj_db_updated", { detail: { type: "waybills" } }));
    } catch (e) {
      console.error("DB save error:", e);
    }
  }

  addWaybill(wb: DBWaybill) {
    const waybills = this.getWaybills();
    const exists = waybills.find((w) => w.waybill_no === wb.waybill_no);
    const updated = exists ? waybills.map((w) => (w.waybill_no === wb.waybill_no ? wb : w)) : [wb, ...waybills];
    this.saveWaybills(updated);
    return wb;
  }

  // Transactions
  getTransactions(): DBTransaction[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn("DB read error:", e);
    }
    this.saveTransactions(INITIAL_SEED_TRANSACTIONS);
    return INITIAL_SEED_TRANSACTIONS;
  }

  saveTransactions(txns: DBTransaction[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(txns));
      window.dispatchEvent(new CustomEvent("kharj_db_updated", { detail: { type: "transactions" } }));
    } catch (e) {
      console.error("DB save error:", e);
    }
  }

  addTransaction(txn: DBTransaction) {
    const txns = this.getTransactions();
    const updated = [txn, ...txns];
    this.saveTransactions(updated);
    return txn;
  }

  // Today's Scanned Waybills & Dispensed AdBlue Monitoring
  getTodayRecords(): DBTodayRecord[] {
    try {
      const todayStr = getTodayDateStr();
      const raw = localStorage.getItem(STORAGE_KEYS.TODAY_SCANS);
      if (raw) {
        const parsed: DBTodayRecord[] = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // If stored records are for today, return them
          const todayItems = parsed.filter(r => r.date_str === todayStr);
          if (todayItems.length > 0) return todayItems;
        }
      }
    } catch (e) {
      console.warn("DB today read error:", e);
    }
    this.saveTodayRecords(INITIAL_TODAY_RECORDS);
    return INITIAL_TODAY_RECORDS;
  }

  saveTodayRecords(records: DBTodayRecord[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.TODAY_SCANS, JSON.stringify(records));
      window.dispatchEvent(new CustomEvent("kharj_db_updated", { detail: { type: "today_scans" } }));
    } catch (e) {
      console.error("DB today save error:", e);
    }
  }

  addTodayScan(record: {
    waybill_no: string;
    vehicle_no: string;
    driver_name: string;
    product?: string;
    entitlement_qty: number;
    dispensed_qty?: number;
    status?: "Scanned" | "Dispensing" | "Completed";
  }): DBTodayRecord {
    const todayRecords = this.getTodayRecords();
    const existing = todayRecords.find((r) => r.waybill_no === record.waybill_no);
    if (existing) return existing;

    const newRecord: DBTodayRecord = {
      id: `TODAY-${Date.now().toString().slice(-4)}`,
      waybill_no: record.waybill_no,
      vehicle_no: record.vehicle_no,
      driver_name: record.driver_name,
      product: record.product || "AdBlue",
      entitlement_qty: record.entitlement_qty,
      dispensed_qty: record.dispensed_qty || 0,
      status: record.status || "Scanned",
      scanned_at: new Date().toLocaleTimeString("en-GB", { hour12: false }),
      date_str: getTodayDateStr(),
    };
    const updated = [newRecord, ...todayRecords];
    this.saveTodayRecords(updated);
    return newRecord;
  }

  updateTodayDispensed(waybillNo: string, dispensedQty: number): DBTodayRecord | undefined {
    const todayRecords = this.getTodayRecords();
    const nowTime = new Date().toLocaleTimeString("en-GB", { hour12: false });
    const updated = todayRecords.map((r) => {
      if (r.waybill_no === waybillNo) {
        const isDone = dispensedQty >= r.entitlement_qty;
        return {
          ...r,
          dispensed_qty: dispensedQty,
          status: (isDone ? "Completed" : "Dispensing") as "Completed" | "Dispensing",
          completed_at: isDone ? nowTime : r.completed_at,
        };
      }
      return r;
    });
    this.saveTodayRecords(updated);
    return updated.find((r) => r.waybill_no === waybillNo);
  }

  resetWaybillToScanned(waybillNo: string): DBTodayRecord | undefined {
    const todayRecords = this.getTodayRecords();
    const nowTime = new Date().toLocaleTimeString("en-GB", { hour12: false });
    const updated = todayRecords.map((r) => {
      if (r.waybill_no === waybillNo) {
        return {
          ...r,
          status: "Scanned" as const,
          dispensed_qty: 0,
          completed_at: undefined,
          scanned_at: nowTime,
        };
      }
      return r;
    });
    this.saveTodayRecords(updated);
    return updated.find((r) => r.waybill_no === waybillNo);
  }

  resetMultipleWaybillsToScanned(waybillNos: string[]): DBTodayRecord[] {
    const todayRecords = this.getTodayRecords();
    const nowTime = new Date().toLocaleTimeString("en-GB", { hour12: false });
    const nosSet = new Set(waybillNos.map((n) => n.toLowerCase()));
    const updated = todayRecords.map((r) => {
      if (nosSet.has(r.waybill_no.toLowerCase())) {
        return {
          ...r,
          status: "Scanned" as const,
          dispensed_qty: 0,
          completed_at: undefined,
          scanned_at: nowTime,
        };
      }
      return r;
    });
    this.saveTodayRecords(updated);
    return updated;
  }

  resetDemoSamples(): DBTodayRecord[] {
    let todayRecords = this.getTodayRecords();
    const demoSamples = [
      { no: "280820260005", vehicle: "ALM-TRK-1041", driver: "175076, AZHAR UD DIN", qty: 60 },
      { no: "280820260006", vehicle: "ALM-TRK-1082", driver: "189204, M. HADDAD", qty: 50 },
      { no: "280820260007", vehicle: "ALM-TRK-1119", driver: "194012, S. KURIAN", qty: 80 },
    ];
    const nowTime = new Date().toLocaleTimeString("en-GB", { hour12: false });

    demoSamples.forEach((s) => {
      const idx = todayRecords.findIndex((r) => r.waybill_no === s.no);
      if (idx >= 0) {
        todayRecords[idx] = {
          ...todayRecords[idx],
          status: "Scanned",
          dispensed_qty: 0,
          completed_at: undefined,
          scanned_at: nowTime,
        };
      } else {
        todayRecords = [
          {
            id: `TODAY-${s.no.slice(-4)}`,
            waybill_no: s.no,
            vehicle_no: s.vehicle,
            driver_name: s.driver,
            product: "AdBlue",
            entitlement_qty: s.qty,
            dispensed_qty: 0,
            status: "Scanned",
            scanned_at: nowTime,
            date_str: getTodayDateStr(),
          },
          ...todayRecords,
        ];
      }
    });

    this.saveTodayRecords(todayRecords);
    return todayRecords;
  }

  getTodayScannedCount(): number {
    return this.getTodayRecords().length;
  }

  getTodayAdBlueDispensedLitres(): number {
    return this.getTodayRecords().reduce((sum, r) => {
      return sum + (r.product.toLowerCase().includes("adblue") ? r.dispensed_qty : 0);
    }, 0);
  }

  resetTodayRecords() {
    this.saveTodayRecords(INITIAL_TODAY_RECORDS);
  }

  getIotLogs(): DBIotDispenseLog[] {
    const raw = localStorage.getItem(STORAGE_KEYS.IOT_LOGS);
    if (!raw) {
      this.saveIotLogs(INITIAL_IOT_LOGS);
      return INITIAL_IOT_LOGS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_IOT_LOGS;
    }
  }

  saveIotLogs(logs: DBIotDispenseLog[]) {
    localStorage.setItem(STORAGE_KEYS.IOT_LOGS, JSON.stringify(logs));
  }

  addIotLog(log: DBIotDispenseLog): DBIotDispenseLog[] {
    const list = this.getIotLogs();
    const updated = [log, ...list];
    this.saveIotLogs(updated);
    return updated;
  }

  // Reset database to initial seed data
  resetDB() {
    this.saveOrders(INITIAL_SEED_ORDERS);
    this.saveWaybills(INITIAL_SEED_WAYBILLS);
    this.saveTransactions(INITIAL_SEED_TRANSACTIONS);
    this.saveTodayRecords(INITIAL_TODAY_RECORDS);
    this.saveIotLogs(INITIAL_IOT_LOGS);
    window.location.reload();
  }
}

export const db = new KharjDatabase();

// Frappe API client for the Kharj console.
const BASE = import.meta.env.VITE_FRAPPE_URL ?? "";
const M = "/api/method/nimble_kharj.api";

// Check if running in local standalone / demo mode
const isDemoMode = typeof window !== "undefined" && (
  window.location.port === "5273" ||
  window.location.pathname.includes("/debug") ||
  !(window as any).frappe?.csrf_token
);

async function call<T>(method: string, body: Record<string, unknown> = {}): Promise<T | null> {
  if (isDemoMode) {
    // In standalone / Vite preview mode, skip remote fetch to keep browser console completely clean
    return null;
  }

  try {
    const res = await fetch(`${BASE}${M}.${method}`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-Frappe-CSRF-Token": (window as any).KHARJ_CSRF ?? "",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return (json.message as T) ?? null;
  } catch {
    return null;
  }
}

export interface IotDispenseLog {
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

export interface WorkerStats {
  total_txns: number;
  total_liters: number;
  today_txns: number;
  today_liters: number;
  vehicle_count: number;
}

export const workerApi = {
  getLogs: async (page = 1, pageSize = 50, date?: string, vehicle?: string) => {
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
      if (date) params.append("date", date);
      if (vehicle) params.append("vehicle", vehicle);
      const res = await fetch(`/api/logs?${params.toString()}`);
      if (!res.ok) return null;
      return (await res.json()) as { logs: IotDispenseLog[]; total: number; page: number; total_pages: number };
    } catch (e) {
      console.warn("Failed to fetch worker logs:", e);
      return null;
    }
  },

  getStats: async () => {
    try {
      const res = await fetch("/api/stats");
      if (!res.ok) return null;
      return (await res.json()) as WorkerStats;
    } catch (e) {
      console.warn("Failed to fetch worker stats:", e);
      return null;
    }
  },

  recordDispense: async (
    vehicleIdOrPayload: string | Record<string, unknown>,
    dispensedLiters?: number,
    dateTime?: string
  ) => {
    try {
      const body = typeof vehicleIdOrPayload === "string"
        ? {
            vehicle_id: vehicleIdOrPayload,
            dispensed_liters: dispensedLiters,
            date_time: dateTime,
          }
        : vehicleIdOrPayload;
      const res = await fetch("/api/dispense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn("Failed to record dispense:", e);
      return null;
    }
  },

  deleteLog: async (logId: number) => {
    try {
      const res = await fetch(`/api/logs/${logId}`, { method: "DELETE" });
      return res.ok;
    } catch {
      return false;
    }
  },

  clearLogs: async () => {
    try {
      const res = await fetch("/api/logs", { method: "DELETE" });
      return res.ok;
    } catch {
      return false;
    }
  },
};

export const authApi = {
  login: async (username: string, password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      return { ok: res.ok, data };
    } catch (e: any) {
      return { ok: false, data: { error: e.message || "Network error" } };
    }
  },

  verify: async (token: string) => {
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.valid ? data : null;
    } catch {
      return null;
    }
  },

  logout: async (token: string) => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ token }),
      });
    } catch {
      // ignore
    }
  }
};

export const api = {
  scan: (barcode: string, unitId: string, vehicleNo?: string, lat?: number, lng?: number) =>
    call("dispensing.scan", { barcode, unit_id: unitId, vehicle_no: vehicleNo, latitude: lat, longitude: lng }),

  authorise: (p: {
    barcode: string; unitId: string; requestedQty: number; idempotencyKey: string;
    nozzle?: number; vehicleNo?: string; lat?: number; lng?: number; capturedOffline?: boolean;
  }) => call("dispensing.authorise", {
    barcode: p.barcode, unit_id: p.unitId, requested_qty: p.requestedQty,
    idempotency_key: p.idempotencyKey, nozzle: p.nozzle ?? 1, vehicle_no: p.vehicleNo,
    latitude: p.lat, longitude: p.lng, captured_offline: p.capturedOffline ? 1 : 0,
  }),

  flow: (txn: string, dispensedQty: number, flowRate: number, authToken: string) =>
    call("dispensing.flow", { txn, dispensed_qty: dispensedQty, flow_rate_lpm: flowRate, auth_token: authToken }),

  complete: (txn: string, dispensedQty: number, authToken: string, totalizerEnd?: number) =>
    call("dispensing.complete", { txn, dispensed_qty: dispensedQty, auth_token: authToken, totalizer_end: totalizerEnd }),

  syncOfflineBatch: (unitId: string, records: unknown[]) =>
    call("dispensing.sync_offline_batch", { unit_id: unitId, records: JSON.stringify(records) }),

  heartbeat: (unitId: string, buffered = 0, totalizer?: number) =>
    call("telemetry.heartbeat", { unit_id: unitId, buffered_records: buffered, totalizer_l: totalizer }),

  gpsPing: (vehicle: string, lat: number, lng: number, speed = 0) =>
    call("telemetry.gps_ping", { vehicle, latitude: lat, longitude: lng, speed_kmph: speed }),

  dashboard: () => call("telemetry.dashboard"),

  getIotDispenseLogs: (limit = 50) =>
    call<IotDispenseLog[]>("telemetry.get_iot_dispense_logs", { limit }),

  recordIotDispense: (vehicleId: string, dispensedLiters: number, dateTime?: string) =>
    call("telemetry.record_iot_dispense", { vehicle_id: vehicleId, dispensed_liters: dispensedLiters, date_time: dateTime }),

  reconciliation: (from: string, to: string) =>
    call("sap.reconciliation", { from_date: from, to_date: to }),

  vehiclesAtStation: (station?: string) => call("gps.vehicles_at_station", { station }),
  track: (vehicle: string, from: string, to: string) =>
    call("gps.track", { vehicle, from_time: from, to_time: to }),
  dispensePositions: (from: string, to: string) =>
    call("gps.dispense_positions", { from_date: from, to_date: to }),
};

// Live event stream (frappe.publish_realtime -> socket.io)
export function subscribe(handlers: Record<string, (d: any) => void>) {
  const socket = (window as any).frappe?.socketio?.socket;
  if (!socket) return () => {};
  const keys = Object.keys(handlers);
  keys.forEach((k) => socket.on(k, handlers[k]));
  return () => keys.forEach((k) => socket.off(k, handlers[k]));
}

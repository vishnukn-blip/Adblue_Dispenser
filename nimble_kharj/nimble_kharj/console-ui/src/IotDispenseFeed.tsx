import React, { useMemo, useState, useEffect } from "react";
import { DBIotDispenseLog } from "./db";
import { WorkerStats, workerApi } from "./api";

interface IotDispenseFeedProps {
  logs: DBIotDispenseLog[];
  workerStats?: WorkerStats | null;
  onSimulatePacket: () => void;
  onRefresh: () => void;
  onDeleteLog?: (logId?: number) => void;
  onClearAllLogs?: () => void;
}

export const IotDispenseFeed: React.FC<IotDispenseFeedProps> = ({
  logs,
  workerStats,
  onSimulatePacket,
  onRefresh,
  onDeleteLog,
  onClearAllLogs,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);
  const [inspectedLog, setInspectedLog] = useState<DBIotDispenseLog | null>(null);
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Auto-poll every 3.5s for live MQTT telemetry updates
  useEffect(() => {
    const timer = setInterval(() => {
      if (currentPage === 1 && !searchTerm.trim() && !filterDate.trim()) {
        onRefresh();
      }
    }, 3500);
    return () => clearInterval(timer);
  }, [onRefresh, currentPage, searchTerm, filterDate]);

  // Compute metrics (fallback to workerStats if available)
  const totalLitres = useMemo(() => {
    if (workerStats?.total_liters != null) return workerStats.total_liters;
    return logs.reduce((sum, item) => sum + (Number(item.dispensed_liters) || 0), 0);
  }, [logs, workerStats]);

  const totalTxns = useMemo(() => {
    if (workerStats?.total_txns != null) return workerStats.total_txns;
    return logs.length;
  }, [logs, workerStats]);

  const todayLitres = useMemo(() => {
    if (workerStats?.today_liters != null) return workerStats.today_liters;
    const todayPrefix = new Date().toISOString().slice(0, 10);
    return logs
      .filter((l) => l.date_time && l.date_time.startsWith(todayPrefix))
      .reduce((sum, item) => sum + (Number(item.dispensed_liters) || 0), 0);
  }, [logs, workerStats]);

  const todayTxns = useMemo(() => {
    if (workerStats?.today_txns != null) return workerStats.today_txns;
    const todayPrefix = new Date().toISOString().slice(0, 10);
    return logs.filter((l) => l.date_time && l.date_time.startsWith(todayPrefix)).length;
  }, [logs, workerStats]);

  const uniqueVehicles = useMemo(() => {
    return new Set(logs.map((item) => item.vehicle_id)).size;
  }, [logs]);

  // Filter logs across vehicle_id, txn_id, waybill_no, trailer_no
  const filteredLogs = useMemo(() => {
    return logs.filter((item) => {
      const q = searchTerm.toLowerCase().trim();
      const matchSearch =
        !q ||
        (item.vehicle_id && item.vehicle_id.toLowerCase().includes(q)) ||
        (item.txn_id && item.txn_id.toLowerCase().includes(q)) ||
        (item.waybill_no && item.waybill_no.toLowerCase().includes(q)) ||
        (item.trailer_no && item.trailer_no.toLowerCase().includes(q)) ||
        (item.operator && item.operator.toLowerCase().includes(q));

      const matchDate =
        !filterDate.trim() ||
        (item.date_time && item.date_time.startsWith(filterDate.trim()));

      return matchSearch && matchDate;
    });
  }, [logs, searchTerm, filterDate]);

  // Paginated slice
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));

  const handleSimulateClick = () => {
    setIsSimulating(true);
    onSimulatePacket();
    setTimeout(() => setIsSimulating(false), 600);
  };

  const handleDelete = (id?: number) => {
    if (onDeleteLog) {
      onDeleteLog(id);
    } else if (id) {
      if (window.confirm(`Remove dispense log #${id}?`)) {
        workerApi.deleteLog(id).then(() => onRefresh());
      }
    }
  };

  const handleClearAll = () => {
    if (onClearAllLogs) {
      onClearAllLogs();
    } else {
      if (window.confirm("Are you sure you want to remove ALL dispense logs from the database?")) {
        workerApi.clearLogs().then(() => onRefresh());
      }
    }
  };

  return (
    <div className="animate-fade-in" style={{ marginBottom: "30px" }}>
      {/* Top Banner & Control Bar */}
      <div
        className="glass-panel"
        style={{
          padding: "18px 24px",
          marginBottom: "20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          borderLeft: "4px solid #8b5cf6",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <span style={{ fontSize: "20px" }}>📡</span>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--text-1, #0f172a)", letterSpacing: ".02em" }}>
              IoT Telemetry &amp; Dispensing Ledger
            </h2>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "rgba(16, 185, 129, 0.15)",
                color: "#059669",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                padding: "4px 10px",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: 700,
              }}
            >
              <span
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: "#10b981",
                  boxShadow: "0 0 8px #10b981",
                }}
              />
              Mosquitto MQTT: Online (Port 1883)
            </span>
          </div>
          <p style={{ margin: 0, fontSize: "12px", color: "var(--text-3, #64748b)" }}>
            Real-time telemetry stream synchronized via MQTT topic:{" "}
            <code style={{ background: "rgba(139, 92, 246, 0.1)", padding: "2px 8px", borderRadius: "4px", color: "#6d28d9", fontWeight: 600 }}>
              adblue/iot/dispense
            </code>{" "}
            &amp; SQLite Database
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={handleSimulateClick}
            disabled={isSimulating}
            className="btn-action"
            style={{
              background: isSimulating ? "#7c3aed" : "linear-gradient(135deg, #8b5cf6, #6d28d9)",
              color: "#fff",
              border: "none",
              fontWeight: 700,
              padding: "9px 16px",
              borderRadius: "8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 4px 14px rgba(139, 92, 246, 0.3)",
              fontSize: "12px",
            }}
            title="Simulate an IoT Fuel Dispenser sending 13 telemetry fields"
          >
            <span>{isSimulating ? "⚡ Sending..." : "🧪 Send Test IoT Packet"}</span>
          </button>

          <button
            onClick={onRefresh}
            className="btn-action"
            style={{
              background: "rgba(0, 0, 0, 0.04)",
              color: "var(--text-1, #1e293b)",
              border: "1px solid rgba(0, 0, 0, 0.12)",
              padding: "9px 14px",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "12px",
            }}
            title="Refresh stream from DB"
          >
            ↺ Refresh
          </button>

          <button
            onClick={handleClearAll}
            className="btn-action"
            style={{
              background: "#fef2f2",
              color: "#dc2626",
              border: "1px solid #fecaca",
              padding: "9px 14px",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: "12px",
            }}
            title="Clear all logs from database"
          >
            🗑️ Clear All Logs
          </button>
        </div>
      </div>

      {/* KPI Cards Row (Matching 8001 Dashboard) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        {/* KPI 1: Total Litres */}
        <div className="glass-panel" style={{ padding: "18px 20px", borderLeft: "4px solid #10b981" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-3, #64748b)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: "8px" }}>
            Total Liters Dispensed
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span style={{ fontSize: "28px", fontWeight: 800, color: "#059669", letterSpacing: "-0.02em" }}>
              {Number(totalLitres).toFixed(2)}
            </span>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#10b981" }}>LITERS</span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-3, #64748b)", marginTop: "4px" }}>
            Lifetime volume from IoT &amp; DB
          </div>
        </div>

        {/* KPI 2: Total IoT Records */}
        <div className="glass-panel" style={{ padding: "18px 20px", borderLeft: "4px solid #2563eb" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-3, #64748b)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: "8px" }}>
            Total Dispenses
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span style={{ fontSize: "28px", fontWeight: 800, color: "#2563eb", letterSpacing: "-0.02em" }}>
              {totalTxns}
            </span>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#3b82f6" }}>TRANSACTIONS</span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-3, #64748b)", marginTop: "4px" }}>
            Verified MQTT payload logs
          </div>
        </div>

        {/* KPI 3: Today's Volume */}
        <div className="glass-panel" style={{ padding: "18px 20px", borderLeft: "4px solid #f59e0b" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-3, #64748b)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: "8px" }}>
            Today's Volume
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span style={{ fontSize: "28px", fontWeight: 800, color: "#d97706", letterSpacing: "-0.02em" }}>
              {Number(todayLitres).toFixed(2)}
            </span>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#f59e0b" }}>LITERS</span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-3, #64748b)", marginTop: "4px" }}>
            {todayTxns} dispenses today
          </div>
        </div>

        {/* KPI 4: Active Dispenser */}
        <div className="glass-panel" style={{ padding: "18px 20px", borderLeft: "4px solid #8b5cf6" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-3, #64748b)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: "8px" }}>
            Active Dispenser
          </div>
          <div style={{ fontSize: "22px", fontWeight: 800, color: "#7c3aed", marginTop: "4px", letterSpacing: "-0.02em" }}>
            ADB-DU-01
          </div>
          <div style={{ fontSize: "11px", color: "#10b981", fontWeight: 600, marginTop: "6px" }}>
            ● Bay 1 Forecourt · Solenoid Armed
          </div>
        </div>
      </div>

      {/* Main Table Card (13 Telemetry Fields) */}
      <div className="glass-panel" style={{ padding: "20px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "16px" }}>📋</span>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-1, #0f172a)" }}>
              Live Telemetry Ledger ({filteredLogs.length})
            </h3>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "12px", color: "var(--text-3)", fontWeight: 600 }}>Filter Date:</span>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => {
                  setFilterDate(e.target.value);
                  setCurrentPage(1);
                }}
                style={{
                  background: "rgba(0, 0, 0, 0.03)",
                  border: "1px solid rgba(0, 0, 0, 0.15)",
                  color: "var(--text-1, #0f172a)",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
              />
              {filterDate && (
                <button
                  type="button"
                  className="btn-action"
                  onClick={() => {
                    setFilterDate("");
                    setCurrentPage(1);
                  }}
                  style={{ fontSize: "11px", padding: "4px 8px" }}
                >
                  All Dates
                </button>
              )}
            </div>

            <input
              type="text"
              placeholder="🔍 Search vehicle, txn, waybill..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                background: "rgba(0, 0, 0, 0.03)",
                border: "1px solid rgba(0, 0, 0, 0.15)",
                color: "var(--text-1, #0f172a)",
                padding: "7px 12px",
                borderRadius: "6px",
                fontSize: "12px",
                minWidth: "220px",
                outline: "none",
                fontWeight: 500,
              }}
            />

            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={{
                background: "rgba(0, 0, 0, 0.03)",
                border: "1px solid rgba(0, 0, 0, 0.15)",
                color: "var(--text-1, #0f172a)",
                padding: "6px 10px",
                borderRadius: "6px",
                fontSize: "12px",
              }}
            >
              <option value="10">10 / page</option>
              <option value="25">25 / page</option>
              <option value="50">50 / page</option>
            </select>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-3, #64748b)" }}>
            <span style={{ fontSize: "36px", display: "block", marginBottom: "10px" }}>📡</span>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--text-1, #1e293b)" }}>No IoT telemetry records found.</p>
            <p style={{ margin: "4px 0 16px 0", fontSize: "12px", color: "var(--text-3, #64748b)" }}>
              Publish an MQTT message to <code>adblue/iot/dispense</code> or click "Send Test IoT Packet" above.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr
                  style={{
                    background: "rgba(0, 0, 0, 0.03)",
                    borderBottom: "1.5px solid rgba(0, 0, 0, 0.1)",
                    textAlign: "left",
                  }}
                >
                  <th style={{ padding: "10px 12px", color: "var(--text-2, #475569)", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", width: "45px" }}>
                    #
                  </th>
                  <th style={{ padding: "10px 12px", color: "var(--text-2, #475569)", fontWeight: 700, fontSize: "11px", textTransform: "uppercase" }}>
                    TXN ID
                  </th>
                  <th style={{ padding: "10px 12px", color: "var(--text-2, #475569)", fontWeight: 700, fontSize: "11px", textTransform: "uppercase" }}>
                    DISPENSER
                  </th>
                  <th style={{ padding: "10px 12px", color: "var(--text-2, #475569)", fontWeight: 700, fontSize: "11px", textTransform: "uppercase" }}>
                    VEHICLE &amp; TRAILER
                  </th>
                  <th style={{ padding: "10px 12px", color: "var(--text-2, #475569)", fontWeight: 700, fontSize: "11px", textTransform: "uppercase" }}>
                    WAYBILL
                  </th>
                  <th style={{ padding: "10px 12px", color: "var(--text-2, #475569)", fontWeight: 700, fontSize: "11px", textTransform: "uppercase" }}>
                    DISPENSED VOLUME
                  </th>
                  <th style={{ padding: "10px 12px", color: "var(--text-2, #475569)", fontWeight: 700, fontSize: "11px", textTransform: "uppercase" }}>
                    TOTALISER (START ➔ END)
                  </th>
                  <th style={{ padding: "10px 12px", color: "var(--text-2, #475569)", fontWeight: 700, fontSize: "11px", textTransform: "uppercase" }}>
                    OPERATOR &amp; MODE
                  </th>
                  <th style={{ padding: "10px 12px", color: "var(--text-2, #475569)", fontWeight: 700, fontSize: "11px", textTransform: "uppercase" }}>
                    STATUS / STOP
                  </th>
                  <th style={{ padding: "10px 12px", color: "var(--text-2, #475569)", fontWeight: 700, fontSize: "11px", textTransform: "uppercase" }}>
                    DATE &amp; TIME (IST)
                  </th>
                  <th style={{ padding: "10px 12px", color: "var(--text-2, #475569)", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", textAlign: "right" }}>
                    ACTION
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedLogs.map((log, idx) => {
                  const rowNum = (currentPage - 1) * pageSize + idx + 1;
                  return (
                    <tr
                      key={log.id || log.name || idx}
                      style={{
                        borderBottom: "1px solid rgba(0, 0, 0, 0.06)",
                        background: idx === 0 && currentPage === 1 ? "rgba(139, 92, 246, 0.03)" : "transparent",
                      }}
                    >
                      {/* Row Num */}
                      <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", color: "var(--text-3)", fontWeight: 600 }}>
                        {rowNum}
                      </td>

                      {/* TXN ID */}
                      <td style={{ padding: "10px 12px" }}>
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
                          {log.txn_id || `TXN-${log.id || rowNum}`}
                        </span>
                      </td>

                      {/* Dispenser */}
                      <td style={{ padding: "10px 12px" }}>
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

                      {/* Vehicle & Trailer */}
                      <td style={{ padding: "10px 12px" }}>
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

                      {/* Waybill */}
                      <td style={{ padding: "10px 12px" }}>
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

                      {/* Dispensed Volume */}
                      <td style={{ padding: "10px 12px" }}>
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

                      {/* Totaliser */}
                      <td style={{ padding: "10px 12px" }}>
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

                      {/* Operator & Mode */}
                      <td style={{ padding: "10px 12px" }}>
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

                      {/* Stop Reason */}
                      <td style={{ padding: "10px 12px" }}>
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

                      {/* Date Time */}
                      <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", color: "var(--text-1)", fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap" }}>
                        {log.date_time}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "10px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            className="table-mini-btn"
                            style={{ color: "#2563eb", borderColor: "#bfdbfe", background: "#eff6ff", fontWeight: 700 }}
                            onClick={() => setInspectedLog(log)}
                            title="Inspect all 13 fields"
                          >
                            🔍 Audit Slip
                          </button>
                          <button
                            type="button"
                            className="table-mini-btn"
                            style={{ color: "#ef4444", borderColor: "#fecaca", background: "#fef2f2", fontWeight: 700 }}
                            onClick={() => handleDelete(log.id)}
                            title="Remove this dispense record"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination & Summary Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            marginTop: "16px",
            paddingTop: "14px",
            borderTop: "1px solid rgba(0, 0, 0, 0.08)",
            fontSize: "12px",
            color: "var(--text-3)",
          }}
        >
          <div>
            Showing <b>{paginatedLogs.length}</b> of <b>{filteredLogs.length}</b> records · Unique Vehicles: <b>{uniqueVehicles}</b>
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              className="btn-action"
              style={{ fontSize: "11px", padding: "4px 10px" }}
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              ◀ Prev
            </button>
            <span style={{ fontWeight: 700, color: "#2563eb" }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="btn-action"
              style={{ fontSize: "11px", padding: "4px 10px" }}
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Next ▶
            </button>
          </div>
        </div>
      </div>

      {/* Audit Slip Modal (Inspecting All 13 Fields) */}
      {inspectedLog && (
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
          onClick={() => setInspectedLog(null)}
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
                onClick={() => setInspectedLog(null)}
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
                    {inspectedLog.txn_id || `TXN-${inspectedLog.id}`}
                  </div>
                </div>

                <div style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "8px", padding: "10px 14px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>2. Dispenser ID</div>
                  <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--text-1)", marginTop: "2px" }}>
                    {inspectedLog.dispenser_id || "ADB-DU-01"}
                  </div>
                </div>

                <div style={{ background: "rgba(37,99,235,0.06)", border: "1px solid rgba(37,99,235,0.2)", borderRadius: "8px", padding: "10px 14px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase" }}>3. Vehicle ID</div>
                  <div style={{ fontSize: "15px", fontWeight: 800, color: "#1d4ed8", marginTop: "2px" }}>
                    🚚 {inspectedLog.vehicle_id}
                  </div>
                </div>

                <div style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "8px", padding: "10px 14px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>4. Trailer Number</div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-1)", marginTop: "2px" }}>
                    {inspectedLog.trailer_no || "—"}
                  </div>
                </div>

                <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "8px", padding: "10px 14px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#b45309", textTransform: "uppercase" }}>5. Waybill Number</div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-1)", marginTop: "2px" }}>
                    {inspectedLog.waybill_no || "—"}
                  </div>
                </div>

                <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: "8px", padding: "10px 14px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#047857", textTransform: "uppercase" }}>6. Dispensed Volume</div>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: "#047857", marginTop: "2px" }}>
                    💧 {Number(inspectedLog.dispensed_liters).toFixed(2)} L
                  </div>
                </div>

                <div style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "8px", padding: "10px 14px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>7. Date &amp; Time (IST)</div>
                  <div style={{ fontSize: "13px", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text-1)", marginTop: "2px" }}>
                    {inspectedLog.date_time}
                  </div>
                </div>

                <div style={{ background: "rgba(15,118,110,0.06)", border: "1px solid rgba(15,118,110,0.2)", borderRadius: "8px", padding: "10px 14px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#0f766e", textTransform: "uppercase" }}>8 &amp; 9. Totaliser (Start ➔ End)</div>
                  <div style={{ fontSize: "13px", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text-1)", marginTop: "2px" }}>
                    {Number(inspectedLog.totaliser_start || 0).toFixed(2)} ➔ {Number(inspectedLog.totaliser_end || 0).toFixed(2)} L
                  </div>
                </div>

                <div style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "8px", padding: "10px 14px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>10. Operator</div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-1)", marginTop: "2px" }}>
                    👤 {inspectedLog.operator || "Operator"}
                  </div>
                </div>

                <div style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "8px", padding: "10px 14px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>11. Entry Mode</div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-1)", marginTop: "2px" }}>
                    🏷️ {inspectedLog.entry_mode || "AUTO_MQTT"}
                  </div>
                </div>

                <div style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "8px", padding: "10px 14px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>12. Stop Reason</div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-1)", marginTop: "2px" }}>
                    🛑 {inspectedLog.stop_reason || "NOZZLE_STOWED"}
                  </div>
                </div>

                <div style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "8px", padding: "10px 14px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>13. Error Code</div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: inspectedLog.error_code && inspectedLog.error_code !== "NONE" ? "#ef4444" : "#10b981", marginTop: "2px" }}>
                    {inspectedLog.error_code || "NONE"}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: "14px 24px", background: "rgba(0,0,0,0.02)", borderTop: "1px solid rgba(0,0,0,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                Totaliser Net Delta: <b>{(Number(inspectedLog.totaliser_end || 0) - Number(inspectedLog.totaliser_start || 0)).toFixed(2)} L</b> · Synchronized via MQTT
              </span>
              <button type="button" className="btn-action" onClick={() => setInspectedLog(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

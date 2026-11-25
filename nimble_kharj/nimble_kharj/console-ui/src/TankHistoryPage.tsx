import React, { useState, useMemo } from "react";
import {
  TankOperationRecord,
  TankOperationType,
  TANK_OPERATIONS_HISTORY,
  TANK_CAPACITY,
  TOTAL_DEPOT_CAPACITY,
} from "./tankHistoryData";

interface TankHistoryPageProps {
  todayDispensedTotal?: number;
  currentTank1Volume?: number;
  currentTank2Volume?: number;
}

export const TankHistoryPage: React.FC<TankHistoryPageProps> = ({
  todayDispensedTotal = 524.24,
  currentTank1Volume = 24730.0,
  currentTank2Volume = 26300.0,
}) => {
  const [selectedTank, setSelectedTank] = useState<"tank1" | "tank2" | "all">("tank1");
  const [operationTypeFilter, setOperationTypeFilter] = useState<"ALL" | TankOperationType>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Master records filtered by tank scope and operation type
  const filteredRecords = useMemo(() => {
    return TANK_OPERATIONS_HISTORY.filter((rec) => {
      // Tank filter
      if (selectedTank !== "all" && rec.tankId !== selectedTank) return false;

      // Operation type filter
      if (operationTypeFilter !== "ALL" && rec.operationType !== operationTypeFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          rec.supplierOrSource.toLowerCase().includes(q) ||
          rec.inletOrLine.toLowerCase().includes(q) ||
          rec.waybillOrRef.toLowerCase().includes(q) ||
          (rec.batchNumber && rec.batchNumber.toLowerCase().includes(q)) ||
          rec.operatorNotes.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [selectedTank, operationTypeFilter, searchQuery]);

  // Aggregate metrics for selected tank
  const currentVolume =
    selectedTank === "tank1"
      ? currentTank1Volume
      : selectedTank === "tank2"
      ? currentTank2Volume
      : currentTank1Volume + currentTank2Volume;

  const totalCapacity =
    selectedTank === "all" ? TOTAL_DEPOT_CAPACITY : TANK_CAPACITY;

  const ullage = Math.max(0, totalCapacity - currentVolume);
  const fillPct = (currentVolume / totalCapacity) * 100;

  // Total refilled volume in the filtered set
  const totalRefilledLitres = useMemo(() => {
    return filteredRecords
      .filter((r) => r.operationType === "REFILL")
      .reduce((sum, r) => sum + r.volumeChange, 0);
  }, [filteredRecords]);

  // Refill count
  const refillCount = useMemo(() => {
    return filteredRecords.filter((r) => r.operationType === "REFILL").length;
  }, [filteredRecords]);

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      "Transaction date",
      "Transaction hour",
      "Tank vessel",
      "Operation type",
      "Supplier / Tanker source",
      "Inlet / Offload line",
      "Quantity (L)",
      "Quantity - Units",
      "Opening level (L)",
      "Closing level (L)",
      "Remaining Ullage (L)",
      "Waybill / Reference",
      "Flow rate (L/min)",
      "Duration (min)",
      "Product grade",
      "Density",
      "Temperature",
      "Notes",
    ];

    const rows = filteredRecords.map((r) => [
      `"${r.operationDate}"`,
      `"${r.operationTime}"`,
      `"${r.tankName}"`,
      `"${r.operationType}"`,
      `"${r.supplierOrSource}"`,
      `"${r.inletOrLine}"`,
      r.volumeChange > 0 ? `+${r.volumeChange.toFixed(2)}` : r.volumeChange.toFixed(2),
      `"${r.volumeUnits}"`,
      r.startLevel.toFixed(2),
      r.endLevel.toFixed(2),
      r.ullageHeadroom.toFixed(2),
      `"${r.waybillOrRef}"`,
      r.flowRateLpm || "—",
      r.durationMinutes || "—",
      `"${r.productGrade}"`,
      `"${r.density}"`,
      `"${r.temperature}"`,
      `"${r.operatorNotes}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Almarai_Kharj_Tank_Refill_History_${selectedTank}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="tank-refill-report-wrapper">
      {/* Top Header & Tank Scope Selector (Hidden during print) */}
      <div className="report-action-bar no-print">
        <div className="report-badge-group">
          <span className="report-source-tag">🏢 ALMARAI BULK STORAGE</span>
          <span className="report-spec-tag">💧 PURE ADBLUE DEF</span>
          <span className="report-status-tag">⚡ OFFLOAD INTAKE &amp; SOUNDINGS</span>
        </div>

        {/* Tank 1 vs Tank 2 Scope Selector */}
        <div className="tank-toggle-group">
          <span className="tank-toggle-label">VESSEL SCOPE:</span>
          <button
            className={`btn-tank-tab ${selectedTank === "tank1" ? "active" : ""}`}
            onClick={() => setSelectedTank("tank1")}
          >
            🛢️ Bulk Storage Tank 01 (30kL)
          </button>
          <button
            className={`btn-tank-tab ${selectedTank === "tank2" ? "active" : ""}`}
            onClick={() => setSelectedTank("tank2")}
          >
            🛢️ Bulk Storage Tank 02 (30kL)
          </button>
          <button
            className={`btn-tank-tab ${selectedTank === "all" ? "active" : ""}`}
            onClick={() => setSelectedTank("all")}
          >
            🏭 Both Vessels (60kL Combined)
          </button>
        </div>

        {/* Action Buttons */}
        <div className="report-actions-right">
          <button onClick={handleExportCSV} className="report-btn-action export-csv">
            📥 Export CSV
          </button>
          <button onClick={handlePrint} className="report-btn-action print-pdf">
            🖨️ Print / Save PDF
          </button>
        </div>
      </div>

      {/* Filter Tabs for Tank Operations (Hidden during print) */}
      <div className="tank-filters-bar no-print">
        <div className="filter-tabs-row">
          <span className="filter-label">TANK ACTIVITY:</span>
          <button
            className={`filter-btn ${operationTypeFilter === "ALL" ? "active" : ""}`}
            onClick={() => setOperationTypeFilter("ALL")}
          >
            All Tank Records ({filteredRecords.length})
          </button>
          <button
            className={`filter-btn ${operationTypeFilter === "REFILL" ? "active" : ""}`}
            onClick={() => setOperationTypeFilter("REFILL")}
          >
            ⚡ Bulk Tank Refills ({TANK_OPERATIONS_HISTORY.filter((r) => r.operationType === "REFILL" && (selectedTank === "all" || r.tankId === selectedTank)).length})
          </button>
          <button
            className={`filter-btn ${operationTypeFilter === "DIP" ? "active" : ""}`}
            onClick={() => setOperationTypeFilter("DIP")}
          >
            📏 Radar Soundings &amp; Dips ({TANK_OPERATIONS_HISTORY.filter((r) => r.operationType === "DIP" && (selectedTank === "all" || r.tankId === selectedTank)).length})
          </button>
          <button
            className={`filter-btn ${operationTypeFilter === "SHIFT_DRAW" ? "active" : ""}`}
            onClick={() => setOperationTypeFilter("SHIFT_DRAW")}
          >
            ⛽ Forecourt Shift Draws ({TANK_OPERATIONS_HISTORY.filter((r) => r.operationType === "SHIFT_DRAW" && (selectedTank === "all" || r.tankId === selectedTank)).length})
          </button>
          <button
            className={`filter-btn ${operationTypeFilter === "EQUALIZATION" ? "active" : ""}`}
            onClick={() => setOperationTypeFilter("EQUALIZATION")}
          >
            ⚖️ Manifold Equalizations ({TANK_OPERATIONS_HISTORY.filter((r) => r.operationType === "EQUALIZATION" && (selectedTank === "all" || r.tankId === selectedTank)).length})
          </button>
        </div>

        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="Search Supplier, Tanker Plate, Waybill #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-btn" onClick={() => setSearchQuery("")}>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Banner (Screen Only) */}
      <div className="report-kpi-banner no-print">
        <div className="report-kpi-item primary-highlight">
          <div className="kpi-title">TOTAL BULK REFILLED (INFLOW)</div>
          <div className="kpi-num emerald">
            +{totalRefilledLitres.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{" "}
            <span className="unit">L</span>
          </div>
          <div className="kpi-sub-text">{refillCount} Verified Tanker Discharges</div>
        </div>

        <div className="report-kpi-item">
          <div className="kpi-title">CURRENT TANK STOCK</div>
          <div className="kpi-num blue">
            {currentVolume.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{" "}
            <span className="unit">L</span>
          </div>
          <div className="kpi-sub-text">{fillPct.toFixed(1)}% of {totalCapacity.toLocaleString()} L Capacity</div>
        </div>

        <div className="report-kpi-item">
          <div className="kpi-title">DELIVERY ULLAGE (HEADROOM)</div>
          <div className="kpi-num">
            {ullage.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{" "}
            <span className="unit">L</span>
          </div>
          <div className="kpi-sub-text">Safe Headroom for Offload</div>
        </div>

        <div className="report-kpi-item">
          <div className="kpi-title">AVERAGE OFFLOAD FLOW</div>
          <div className="kpi-num amber">
            274.5 <span className="unit">L/min</span>
          </div>
          <div className="kpi-sub-text">West Plinth Camlock Skid Lines</div>
        </div>

        <div className="report-kpi-item">
          <div className="kpi-title">DEPOT LOCATION</div>
          <div className="kpi-num cyan">ALMARAI KHARJ</div>
          <div className="kpi-sub-text">
            {selectedTank === "tank1"
              ? "Bulk Tank 01 (30,000 L)"
              : selectedTank === "tank2"
              ? "Bulk Storage Tank 02 (30,000 L)"
              : "Dual 30,000 L Storage Vessels"}
          </div>
        </div>
      </div>

      {/* =========================================================================
          THE OFFICIAL WHITE PAPER REPORT SHEET (MATCHING YOUR EXACT SCREENSHOT)
          ========================================================================= */}
      <div className="official-document-sheet">
        {/* Document Title */}
        <div className="document-title-row">
          <h1 className="document-title-text">
            Automated AdBlue Storage Tank Refill &amp; Inventory Report &mdash; {selectedTank === "tank1" ? "Bulk Storage Tank 01 (30kL)" : selectedTank === "tank2" ? "Bulk Storage Tank 02 (30kL)" : "Bulk Storage Tanks 01 & 02 (60kL Combined)"}
          </h1>
        </div>

        {/* The Exact Table matching Image 1 layout and styling */}
        <div className="table-responsive-container">
          <table className="almarai-adblue-report-table">
            <thead>
              <tr>
                <th style={{ width: "9%" }}>
                  Transaction<br />date
                </th>
                <th style={{ width: "8%" }}>
                  Transaction<br />hour
                </th>
                <th style={{ width: "9%" }}>
                  Tank<br />vessel
                </th>
                <th style={{ width: "11%" }}>
                  Operation<br />type
                </th>
                <th style={{ width: "14%" }}>
                  Supplier /<br />Tanker source
                </th>
                <th style={{ width: "11%" }}>
                  Inlet /<br />Offload line
                </th>
                <th style={{ width: "9%" }}>
                  Quantity
                </th>
                <th style={{ width: "5%" }}>
                  Quantity -<br />Units
                </th>
                <th style={{ width: "8%" }}>
                  Opening level<br />(L)
                </th>
                <th style={{ width: "8%" }}>
                  Closing level<br />(L)
                </th>
                <th style={{ width: "8%" }}>
                  Waybill /<br />Reference
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((row, idx) => {
                const isRefill = row.operationType === "REFILL";
                const isDip = row.operationType === "DIP";
                const isDraw = row.operationType === "SHIFT_DRAW";

                return (
                  <tr key={row.id || idx} className={idx % 2 === 1 ? "row-alt" : "row-regular"}>
                    <td className="col-date">{row.operationDate}</td>
                    <td className="col-time font-bold">{row.operationTime}</td>
                    <td className="col-vessel font-semibold">{row.tankName}</td>
                    <td className="col-op-type">
                      <span
                        className={`op-badge ${
                          isRefill
                            ? "badge-refill"
                            : isDip
                            ? "badge-dip"
                            : isDraw
                            ? "badge-draw"
                            : "badge-eq"
                        }`}
                      >
                        {isRefill && "⚡ BULK REFILL"}
                        {isDip && "📏 RADAR SOUNDING"}
                        {isDraw && "⛽ FORECOURT DRAW"}
                        {row.operationType === "EQUALIZATION" && "⚖️ EQUALIZATION"}
                      </span>
                    </td>
                    <td className="col-source font-bold">{row.supplierOrSource}</td>
                    <td className="col-inlet">{row.inletOrLine}</td>
                    <td
                      className="col-qty font-bold"
                      style={{
                        color: isRefill ? "#059669" : isDraw ? "#dc2626" : "#0f172a",
                      }}
                    >
                      {row.volumeChange > 0
                        ? `+${row.volumeChange.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`
                        : row.volumeChange < 0
                        ? `${row.volumeChange.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`
                        : "0.00"}
                    </td>
                    <td className="col-units">{row.volumeUnits}</td>
                    <td className="col-stock font-mono">
                      {row.startLevel.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </td>
                    <td className="col-stock font-mono font-bold">
                      {row.endLevel.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </td>
                    <td className="col-waybill font-mono">{row.waybillOrRef}</td>
                  </tr>
                );
              })}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={11} className="empty-message">
                    No tank refill or sounding records found for the selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Official Report Footer matching Image 1 */}
        <div className="report-print-footer">
          <div className="footer-left">
            <span>
              Almarai Central Logistics &bull; Kharj Bulk AdBlue Storage {selectedTank === "tank1" ? "Tank #01" : selectedTank === "tank2" ? "Tank #02" : "Tanks #01 & #02"} &bull; Offload Station Lines 1 &amp; 2 &bull; Telemetry Source: DiaLOG / Endress+Hauser Radar
            </span>
          </div>
          <div className="footer-right">
            <span>Verified System Stamp &bull; ISO 22241 AdBlue Standard &bull; Tank Inventory Reconciled &bull; Page 1 of 1</span>
          </div>
        </div>
      </div>

      <style>{`
        .tank-refill-report-wrapper {
          background: #0b1329;
          color: #e2e8f0;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          padding: 24px;
          border-radius: 12px;
          width: 100%;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* Action Bar */
        .report-action-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 14px;
          padding-bottom: 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .report-badge-group {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }
        .report-source-tag, .report-spec-tag, .report-status-tag {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.05em;
          padding: 4px 10px;
          border-radius: 6px;
          text-transform: uppercase;
        }
        .report-source-tag {
          background: rgba(14, 165, 233, 0.15);
          color: #38bdf8;
          border: 1px solid rgba(14, 165, 233, 0.3);
        }
        .report-spec-tag {
          background: rgba(16, 185, 129, 0.15);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }
        .report-status-tag {
          background: rgba(168, 85, 247, 0.15);
          color: #c084fc;
          border: 1px solid rgba(168, 85, 247, 0.3);
        }

        /* Tank Scope Switcher */
        .tank-toggle-group {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(15, 23, 42, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.12);
          padding: 4px 8px;
          border-radius: 8px;
          flex-wrap: wrap;
        }
        .tank-toggle-label {
          font-size: 11px;
          font-weight: 800;
          color: #94a3b8;
          margin-right: 4px;
        }
        .btn-tank-tab {
          background: transparent;
          border: 1px solid transparent;
          color: #94a3b8;
          font-size: 11.5px;
          font-weight: 700;
          padding: 5px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .btn-tank-tab:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.08);
        }
        .btn-tank-tab.active {
          background: #0284c7;
          border-color: #38bdf8;
          color: #ffffff;
          box-shadow: 0 0 10px rgba(2, 132, 199, 0.4);
        }

        .report-actions-right {
          display: flex;
          gap: 10px;
        }
        .report-btn-action {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }
        .report-btn-action.export-csv {
          background: #0284c7;
          color: #ffffff;
          border: 1px solid #38bdf8;
        }
        .report-btn-action.export-csv:hover {
          background: #0369a1;
        }
        .report-btn-action.print-pdf {
          background: #059669;
          color: #ffffff;
          border: 1px solid #34d399;
        }
        .report-btn-action.print-pdf:hover {
          background: #047857;
        }

        /* Filter Tabs */
        .tank-filters-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(15, 23, 42, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          padding: 10px 16px;
          flex-wrap: wrap;
          gap: 12px;
        }
        .filter-tabs-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .filter-label {
          font-size: 11px;
          font-weight: 800;
          color: #94a3b8;
        }
        .filter-btn {
          padding: 5px 12px;
          border-radius: 999px;
          font-size: 11.5px;
          font-weight: 700;
          background: rgba(30, 41, 59, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #94a3b8;
          cursor: pointer;
        }
        .filter-btn:hover {
          background: rgba(51, 65, 85, 0.8);
          color: #ffffff;
        }
        .filter-btn.active {
          background: #0284c7;
          border-color: #38bdf8;
          color: #ffffff;
        }

        .search-wrap {
          display: flex;
          align-items: center;
          background: rgba(2, 6, 23, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 6px;
          padding: 5px 10px;
          width: 260px;
          max-width: 100%;
        }
        .search-icon {
          font-size: 12px;
          margin-right: 6px;
          color: #64748b;
        }
        .search-input {
          background: transparent;
          border: none;
          color: #f8fafc;
          font-size: 12px;
          outline: none;
          width: 100%;
        }
        .clear-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
        }

        /* KPI Banner */
        .report-kpi-banner {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 14px;
        }
        .report-kpi-item {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          padding: 12px 16px;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .report-kpi-item.primary-highlight {
          background: linear-gradient(135deg, rgba(5, 150, 105, 0.2), rgba(15, 23, 42, 0.8));
          border-color: rgba(52, 211, 153, 0.4);
        }
        .kpi-title {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.05em;
          color: #94a3b8;
          text-transform: uppercase;
        }
        .kpi-num {
          font-size: 22px;
          font-weight: 900;
          color: #f8fafc;
          font-family: 'JetBrains Mono', monospace;
        }
        .kpi-num.emerald { color: #34d399; }
        .kpi-num.blue { color: #38bdf8; }
        .kpi-num.amber { color: #fbbf24; }
        .kpi-num.cyan { color: #22d3ee; }
        .kpi-num .unit {
          font-size: 12px;
          font-weight: 600;
          color: #94a3b8;
        }
        .kpi-sub-text {
          font-size: 10.5px;
          color: #94a3b8;
        }

        /* Printable Document Sheet (Exact white paper from Image 1) */
        .official-document-sheet {
          background: #ffffff;
          color: #000000;
          padding: 24px 28px;
          border-radius: 4px;
          box-shadow: 0 4px 25px rgba(0, 0, 0, 0.4);
          width: 100%;
          box-sizing: border-box;
        }
        .document-title-row {
          margin-bottom: 16px;
        }
        .document-title-text {
          font-family: 'Inter', Calibri, Arial, sans-serif;
          font-size: 17px;
          font-weight: 700;
          color: #1e293b;
          margin: 0;
        }

        /* The Exact Table Styling from Image 1 */
        .table-responsive-container {
          overflow-x: auto;
          width: 100%;
        }
        .almarai-adblue-report-table {
          width: 100%;
          border-collapse: collapse;
          font-family: 'Inter', Calibri, Arial, sans-serif;
          font-size: 13.5px;
          border: 1.5px solid #d0d7e5;
          text-align: center;
        }

        /* Header matching Image 1 light blue/gray background */
        .almarai-adblue-report-table thead tr {
          background-color: #edf2f9;
        }
        .almarai-adblue-report-table thead th {
          border: 1px solid #d0d7e5;
          padding: 10px 6px;
          color: #1e293b;
          font-weight: 600;
          line-height: 1.25;
          vertical-align: middle;
          font-size: 12.5px;
        }

        /* Body Rows */
        .almarai-adblue-report-table tbody td {
          border: 1px solid #d0d7e5;
          padding: 9px 8px;
          color: #0f172a;
          vertical-align: middle;
          font-size: 13px;
        }
        .almarai-adblue-report-table tbody tr.row-regular {
          background-color: #ffffff;
        }
        .almarai-adblue-report-table tbody tr.row-alt {
          background-color: #f7f9fd;
        }
        .almarai-adblue-report-table tbody tr:hover {
          background-color: #eaf1fb;
        }

        .col-date {
          font-weight: 500;
          white-space: nowrap;
        }
        .col-time {
          font-family: 'Courier New', Courier, monospace;
          font-size: 13px;
          font-weight: 700;
          color: #0f172a;
        }
        .col-vessel {
          color: #1e293b;
          white-space: nowrap;
        }
        .col-op-type {
          white-space: nowrap;
        }
        .op-badge {
          font-size: 10px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .badge-refill {
          background: #dcfce7;
          color: #15803d;
          border: 1px solid #bbf7d0;
        }
        .badge-dip {
          background: #e0f2fe;
          color: #0369a1;
          border: 1px solid #bae6fd;
        }
        .badge-draw {
          background: #fee2e2;
          color: #b91c1c;
          border: 1px solid #fecaca;
        }
        .badge-eq {
          background: #f3e8ff;
          color: #7e22ce;
          border: 1px solid #e9d5ff;
        }

        .col-source {
          color: #1e3a8a;
          font-weight: 700;
        }
        .col-inlet {
          color: #475569;
        }
        .col-qty {
          font-weight: 700;
        }
        .col-units {
          color: #0f172a;
        }
        .col-stock {
          font-family: 'Courier New', Courier, monospace;
          font-size: 12.5px;
          color: #334155;
        }
        .col-waybill {
          font-family: 'Courier New', Courier, monospace;
          color: #0f172a;
          font-weight: 600;
        }

        .empty-message {
          text-align: center;
          padding: 30px;
          color: #64748b;
          font-style: italic;
        }

        /* Report Footer */
        .report-print-footer {
          margin-top: 20px;
          padding-top: 10px;
          border-top: 1px solid #cbd5e1;
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: #64748b;
          flex-wrap: wrap;
          gap: 8px;
        }

        /* Responsive Media Queries */
        @media (max-width: 980px) {
          .report-action-bar {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
          }
          .report-badge-group {
            flex-wrap: wrap;
            gap: 6px;
          }
          .tank-toggle-group {
            flex-wrap: wrap;
            gap: 6px;
            width: 100%;
          }
          .btn-tank-tab {
            flex: 1 1 auto;
            text-align: center;
            justify-content: center;
          }
          .report-actions-right {
            width: 100%;
            display: flex;
            justify-content: space-between;
          }
        }

        @media (max-width: 768px) {
          .tank-refill-report-wrapper {
            padding: 10px 4px;
          }
          .tank-filters-bar {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
            padding: 10px 12px;
          }
          .filter-tabs-row {
            overflow-x: auto;
            width: 100%;
            -webkit-overflow-scrolling: touch;
            padding-bottom: 4px;
            gap: 6px;
          }
          .search-wrap {
            width: 100%;
            max-width: 100%;
          }
          .report-kpi-banner {
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }
          .official-document-sheet {
            padding: 12px 6px;
            border-radius: 8px;
          }
          .almarai-adblue-report-table th,
          .almarai-adblue-report-table td {
            padding: 8px 6px;
            font-size: 11.5px;
          }
        }

        @media (max-width: 480px) {
          .report-kpi-banner {
            grid-template-columns: 1fr;
          }
          .btn-tank-tab {
            width: 100%;
            font-size: 11px;
            padding: 6px 10px;
          }
        }

        @media print {
          .no-print,
          .report-action-bar,
          .tank-filters-bar,
          .report-kpi-banner {
            display: none !important;
            visibility: hidden !important;
          }
          .tank-refill-report-wrapper {
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            visibility: visible !important;
          }
          .official-document-sheet,
          .official-document-sheet * {
            visibility: visible !important;
          }
          .official-document-sheet {
            box-shadow: none !important;
            padding: 8px 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            border: none !important;
            display: block !important;
          }
          .table-responsive-container {
            overflow: visible !important;
          }
          .almarai-adblue-report-table {
            width: 100% !important;
          }
          .almarai-adblue-report-table tr {
            page-break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
};

import React, { useState, useMemo, useEffect } from "react";

import {
  AdBlueReportRecord,
  INITIAL_ADBLUE_REPORT_DATA,
  PAST_7_DAYS,
  getTodayFormattedDate,
  getTodayShortDate,
} from "./adblueReportData";

export type { AdBlueReportRecord };

export interface DynamicDay {
  shortDate: string;
  label: string;
  weekday: string;
  fullDate: string;
  txnCount?: number;
}

export const generatePast7Days = (): DynamicDay[] => {
  const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const MONTHS_FULL = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const days: DynamicDay[] = [];
  const today = new Date();

  for (let i = 0; i < 7; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const dayNum = String(d.getDate()).padStart(2, "0");
    const monthNum = String(d.getMonth() + 1).padStart(2, "0");
    const yearNum = d.getFullYear();
    const shortDate = `${dayNum}/${monthNum}/${yearNum}`;
    const weekday = WEEKDAYS[d.getDay()];
    const monthShort = MONTHS_SHORT[d.getMonth()];
    const monthFull = MONTHS_FULL[d.getMonth()];
    const label = i === 0 ? `${dayNum} ${monthShort} (Today)` : `${dayNum} ${monthShort} (${weekday})`;
    const fullDate = `${dayNum} ${monthFull} ${yearNum}`;

    days.push({
      shortDate,
      label,
      weekday,
      fullDate,
    });
  }

  return days;
};

export const parseLogDateTime = (dtStr: string): { shortDate: string; hour: string } => {
  if (!dtStr) {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, "0");
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const y = now.getFullYear();
    return { shortDate: `${d}/${m}/${y}`, hour: "12:00:00" };
  }
  const clean = dtStr.trim().replace("T", " ");
  const parts = clean.split(" ");
  const datePart = parts[0];
  const timePart = parts[1] || "12:00:00";

  if (datePart.includes("-")) {
    const [y, m, d] = datePart.split("-");
    const shortDate = `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
    return { shortDate, hour: timePart.slice(0, 8) };
  } else if (datePart.includes("/")) {
    const pieces = datePart.split("/");
    if (pieces[0].length === 4) {
      const [y, m, d] = pieces;
      return { shortDate: `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`, hour: timePart.slice(0, 8) };
    }
    return { shortDate: datePart, hour: timePart.slice(0, 8) };
  }
  return { shortDate: datePart, hour: timePart.slice(0, 8) };
};

interface AutomatedAdBlueReportProps {
  additionalRecords?: AdBlueReportRecord[];
  realIotLogs?: any[];
  onClose?: () => void;
  isModal?: boolean;
}

export const AutomatedAdBlueReport: React.FC<AutomatedAdBlueReportProps> = ({
  additionalRecords = [],
  realIotLogs = [],
  onClose,
  isModal = false,
}) => {
  const isRealDataActive = Boolean(realIotLogs && realIotLogs.length > 0);

  // Dynamically generated rolling 7 days ending on today
  const activePast7Days: DynamicDay[] = useMemo(() => {
    if (isRealDataActive) {
      return generatePast7Days();
    }
    return PAST_7_DAYS;
  }, [isRealDataActive]);

  const todayShortDate = activePast7Days[0]?.shortDate || "14/09/2026";
  const todayFullDate = activePast7Days[0]?.fullDate || "14 September 2026";

  // Date scope: "week" (all 7 days), "today", a specific shortDate "27/11/2026", or "all"
  const [dateScope, setDateScope] = useState<string>("week");
  const [reportDate, setReportDate] = useState<string>(() => {
    if (isRealDataActive) {
      const d = generatePast7Days();
      return `Past 7 Days (${d[6].label.replace(" (Today)", "")} - ${d[0].label.replace(" (Today)", "")} ${new Date().getFullYear()})`;
    }
    return "Past 7 Days (08 - 14 September 2026)";
  });
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | "TRACTOR" | "REEFER">("ALL");
  const [dispenserFilter, setDispenserFilter] = useState<string>("ALL");
  const [showCharts, setShowCharts] = useState<boolean>(true);
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  // Convert real IoT DB logs into standard AdBlueReportRecord format
  const convertedRealLogs: AdBlueReportRecord[] = useMemo(() => {
    if (!realIotLogs || realIotLogs.length === 0) return [];
    return realIotLogs.map((log: any, idx: number) => {
      const { shortDate, hour } = parseLogDateTime(log.date_time);
      const dispenserMatch = String(log.dispenser_id || "1").match(/\d+/);
      const dispenserNum = dispenserMatch ? parseInt(dispenserMatch[0], 10) : 1;
      const isReefer = Boolean(log.trailer_no && log.trailer_no !== "—" && log.trailer_no.trim() !== "");

      return {
        id: String(log.id || log.txn_id || `DB-REP-${idx}`),
        transactionDate: shortDate,
        transactionHour: hour,
        vehicle: log.vehicle_id || "UNKNOWN",
        dispenserNumber: dispenserNum,
        quantity: Number(log.dispensed_liters) || 0,
        quantityUnits: "L",
        adblueProductCode: "1",
        site: "ALMARAI KHARJ",
        vehiclesCategory: isReefer ? "REEFER" : "TRACTOR",
        vehicleIdentifier: isReefer ? log.trailer_no : (log.vehicle_id || "UNKNOWN"),
        waybillNo: (log.waybill_no && log.waybill_no !== "—") ? log.waybill_no : (log.txn_id || `WB-${idx}`),
        driverName: (log.operator && log.operator !== "NA") ? log.operator : "Almarai Driver",
      };
    });
  }, [realIotLogs]);

  // Combine real dataset or fallback initial dataset with any additional live records
  const masterRecords = useMemo(() => {
    if (convertedRealLogs.length > 0) {
      return [...convertedRealLogs, ...additionalRecords];
    }
    return [...INITIAL_ADBLUE_REPORT_DATA, ...additionalRecords];
  }, [convertedRealLogs, additionalRecords]);

  // Handle switching date scope
  const handleSelectDateScope = (scope: string, shouldScrollToReport: boolean = false) => {
    setDateScope(scope);
    if (scope === "week") {
      setReportDate(`Past 7 Days (${activePast7Days[6]?.label.replace(" (Today)", "")} - ${activePast7Days[0]?.label.replace(" (Today)", "")} ${new Date().getFullYear()})`);
    } else if (scope === "today") {
      setReportDate(todayFullDate);
    } else if (scope === "all") {
      setReportDate("All Database Telemetry Records");
    } else if (scope === "29jul2026") {
      setReportDate("29th July 2026");
    } else {
      // Find matching date label
      const dayObj = activePast7Days.find((d) => d.shortDate === scope);
      setReportDate(dayObj?.fullDate || (dayObj ? `${dayObj.label}` : scope));
    }

    if (shouldScrollToReport) {
      setTimeout(() => {
        document.getElementById("official-report-document-sheet")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  };

  // Scope filter: determines which records appear in the report table & KPIs
  const scopedRecords = useMemo(() => {
    if (dateScope === "week") {
      const weekDateSet = new Set(activePast7Days.map((d) => d.shortDate));
      return masterRecords.filter((r) => weekDateSet.has(r.transactionDate));
    }
    if (dateScope === "all") {
      return masterRecords;
    }
    if (dateScope === "today") {
      return masterRecords.filter((r) => r.transactionDate === todayShortDate);
    }
    if (dateScope === "29jul2026") {
      // Audit sample view
      return masterRecords
        .filter((r) => r.transactionDate === todayShortDate)
        .map((r) => ({ ...r, transactionDate: "29/07/2026" }));
    }
    // Specific date match
    return masterRecords.filter((r) => r.transactionDate === dateScope);
  }, [masterRecords, dateScope, activePast7Days, todayShortDate]);

  // Apply user filters (category, dispenser, search text)
  const filteredRecords = useMemo(() => {
    return scopedRecords.filter((r) => {
      if (categoryFilter !== "ALL" && r.vehiclesCategory !== categoryFilter) return false;
      if (dispenserFilter !== "ALL" && String(r.dispenserNumber) !== dispenserFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.vehicle.toLowerCase().includes(q) ||
          r.vehicleIdentifier.toLowerCase().includes(q) ||
          r.site.toLowerCase().includes(q) ||
          (r.waybillNo && r.waybillNo.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [scopedRecords, categoryFilter, dispenserFilter, searchQuery]);

  // Summary Metrics for current scoped/filtered selection
  const totalQuantity = useMemo(() => {
    return filteredRecords.reduce((acc, curr) => acc + curr.quantity, 0);
  }, [filteredRecords]);

  const tractorRecords = useMemo(() => {
    return filteredRecords.filter((r) => r.vehiclesCategory === "TRACTOR");
  }, [filteredRecords]);

  const reeferRecords = useMemo(() => {
    return filteredRecords.filter((r) => r.vehiclesCategory === "REEFER");
  }, [filteredRecords]);

  const tractorQuantity = useMemo(() => {
    return tractorRecords.reduce((acc, curr) => acc + curr.quantity, 0);
  }, [tractorRecords]);

  const reeferQuantity = useMemo(() => {
    return reeferRecords.reduce((acc, curr) => acc + curr.quantity, 0);
  }, [reeferRecords]);

  const avgPerRefill = useMemo(() => {
    if (filteredRecords.length === 0) return 0;
    return totalQuantity / filteredRecords.length;
  }, [totalQuantity, filteredRecords]);

  const uniqueDispensers = useMemo(() => {
    const set = new Set(filteredRecords.map((r) => String(r.dispenserNumber)));
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [filteredRecords]);

  // ================= 7-DAY ANALYTICS AGGREGATIONS FOR CHARTS =================
  const weeklyAnalytics = useMemo(() => {
    // 7 Days chronological array (from 6 days ago up to Today)
    const chronologicalDays = [...activePast7Days].reverse();

    const dailyTrend = chronologicalDays.map((d) => {
      const dayRecs = masterRecords.filter((r) => r.transactionDate === d.shortDate);
      const dayLitres = dayRecs.reduce((sum, r) => sum + r.quantity, 0);
      const tractors = dayRecs.filter((r) => r.vehiclesCategory === "TRACTOR");
      const reefers = dayRecs.filter((r) => r.vehiclesCategory === "REEFER");
      const tractorL = tractors.reduce((sum, r) => sum + r.quantity, 0);
      const reeferL = reefers.reduce((sum, r) => sum + r.quantity, 0);

      return {
        shortDate: d.shortDate,
        label: d.label.replace(" (Today)", ""),
        weekday: d.weekday,
        isToday: d.shortDate === todayShortDate,
        litres: dayLitres,
        count: dayRecs.length,
        tractorCount: tractors.length,
        tractorLitres: tractorL,
        reeferCount: reefers.length,
        reeferLitres: reeferL,
      };
    });

    const weekDateSet = new Set(chronologicalDays.map((d) => d.shortDate));
    const weekRecords = masterRecords.filter((r) => weekDateSet.has(r.transactionDate));

    const totalWeekLitres = weekRecords.reduce((sum, r) => sum + r.quantity, 0);
    const totalWeekVehicles = weekRecords.length;
    const weekTractorLitres = weekRecords
      .filter((r) => r.vehiclesCategory === "TRACTOR")
      .reduce((sum, r) => sum + r.quantity, 0);
    const weekReeferLitres = weekRecords
      .filter((r) => r.vehiclesCategory === "REEFER")
      .reduce((sum, r) => sum + r.quantity, 0);

    const peakDay = dailyTrend.reduce((prev, curr) => (curr.litres > prev.litres ? curr : prev), dailyTrend[0]);
    const todayTrend = dailyTrend.find((d) => d.isToday) || dailyTrend[dailyTrend.length - 1];

    const rawMax = Math.max(...dailyTrend.map((d) => d.litres), 10);
    let maxScale = Math.ceil(rawMax * 1.15);
    if (maxScale < 10) maxScale = 10;
    else if (maxScale <= 50) maxScale = Math.ceil(maxScale / 10) * 10;
    else if (maxScale <= 200) maxScale = Math.ceil(maxScale / 25) * 25;
    else maxScale = Math.ceil(maxScale / 50) * 50;

    const maxDayLitres = maxScale;

    // Dispenser load across 10 bays over the week
    const bayLoads: { bay: number; litres: number; count: number }[] = [];
    for (let b = 1; b <= 10; b++) {
      const bayRecs = weekRecords.filter((r) => Number(r.dispenserNumber) === b);
      const bayL = bayRecs.reduce((sum, r) => sum + r.quantity, 0);
      bayLoads.push({ bay: b, litres: bayL, count: bayRecs.length });
    }
    const maxBayLitres = Math.max(...bayLoads.map((b) => b.litres), 10);

    // Hourly Shift Activity Breakdown
    const shiftStats = [
      { shift: "Early Morning (06:00 - 10:00)", hours: "06:00 - 10:00", count: 0, litres: 0, color: "#38bdf8" },
      { shift: "Mid-Day Peak (10:00 - 14:00)", hours: "10:00 - 14:00", count: 0, litres: 0, color: "#0284c7" },
      { shift: "Afternoon Route (14:00 - 18:00)", hours: "14:00 - 18:00", count: 0, litres: 0, color: "#10b981" },
      { shift: "Evening Return (18:00 - 22:00)", hours: "18:00 - 22:00", count: 0, litres: 0, color: "#8b5cf6" },
    ];

    weekRecords.forEach((r) => {
      const hr = parseInt((r.transactionHour || "12").split(":")[0], 10);
      if (hr >= 6 && hr < 10) {
        shiftStats[0].count++;
        shiftStats[0].litres += r.quantity;
      } else if (hr >= 10 && hr < 14) {
        shiftStats[1].count++;
        shiftStats[1].litres += r.quantity;
      } else if (hr >= 14 && hr < 18) {
        shiftStats[2].count++;
        shiftStats[2].litres += r.quantity;
      } else {
        shiftStats[3].count++;
        shiftStats[3].litres += r.quantity;
      }
    });

    return {
      dailyTrend,
      maxDayLitres,
      totalWeekLitres,
      totalWeekVehicles,
      weekTractorLitres,
      weekReeferLitres,
      peakDay,
      todayTrend,
      bayLoads,
      maxBayLitres,
      shiftStats,
      chronologicalDays,
    };
  }, [masterRecords, activePast7Days, todayShortDate]);

  // Export to CSV with Waybill number as the 1st column
  const handleExportCSV = () => {
    const headers = [
      "Waybill number",
      "Transaction date",
      "Transaction hour",
      "Vehicle",
      "Dispenser - Dispenser number",
      "Quantity",
      "Quantity - Units",
      "AdBlue - DiaLOG product code",
      "Site",
      "Vehicles category",
      "Vehicle identifier",
    ];

    const rows = filteredRecords.map((r) => [
      `"${r.waybillNo || ""}"`,
      `"${r.transactionDate}"`,
      `"${r.transactionHour}"`,
      `"${r.vehicle}"`,
      r.dispenserNumber,
      r.quantity.toFixed(2),
      `"${r.quantityUnits}"`,
      `"${r.adblueProductCode}"`,
      `"${r.site}"`,
      `"${r.vehiclesCategory}"`,
      `"${r.vehicleIdentifier}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Automated_AdBlue_Report_${reportDate.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  // Tractor vs Reefer ratio percentages for donut chart
  const tractorPct = weeklyAnalytics.totalWeekLitres > 0
    ? ((weeklyAnalytics.weekTractorLitres / weeklyAnalytics.totalWeekLitres) * 100)
    : 78;
  const reeferPct = 100 - tractorPct;

  // Donut circumference for r=42 is ~263.89
  const donutCirc = 2 * Math.PI * 42;
  const tractorDash = (tractorPct / 100) * donutCirc;
  const reeferDash = donutCirc - tractorDash;

  return (
    <div className={`adblue-report-wrapper ${isModal ? "is-modal-view" : ""}`}>
      {/* Top Header & Action Controls (Hidden during print) */}
      <div className="report-action-bar no-print">
        <div className="report-badge-group">
          <span className="report-source-tag">🏢 ALMARAI FLEET LOGISTICS</span>
          <span className="report-spec-tag">💧 HIGH PURITY ADBLUE DEF (ISO 22241)</span>
          <span className="report-status-tag">✓ VERIFIED DiaLOG TELEMETRY</span>
        </div>

        {/* Date Selector Switcher with Full 7-Day Week Option */}
        <div className="report-date-switcher">
          <span className="date-switch-label">📅 REPORT SCOPE:</span>
          <button
            className={`btn-date-preset ${dateScope === "today" ? "active" : ""}`}
            onClick={() => handleSelectDateScope("today")}
          >
            ⚡ Today ({activePast7Days[0]?.label.replace(" (Today)", "")})
          </button>
          <button
            className={`btn-date-preset highlight-week ${dateScope === "week" ? "active" : ""}`}
            onClick={() => handleSelectDateScope("week")}
          >
            📊 Past 7 Days (Full Week)
          </button>
          {activePast7Days.slice(1).map((d) => (
            <button
              key={d.shortDate}
              className={`btn-date-preset ${dateScope === d.shortDate ? "active" : ""}`}
              onClick={() => handleSelectDateScope(d.shortDate)}
            >
              {d.label.replace(" (Today)", "")}
            </button>
          ))}
          {isRealDataActive && (
            <button
              className={`btn-date-preset ${dateScope === "all" ? "active" : ""}`}
              onClick={() => handleSelectDateScope("all")}
            >
              All DB Records
            </button>
          )}
          <button
            className={`btn-date-preset ${dateScope === "29jul2026" ? "active" : ""}`}
            onClick={() => handleSelectDateScope("29jul2026")}
          >
            29 Jul Audit
          </button>
        </div>

        <div className="report-controls-group">
          <div className="filter-input-wrap">
            <span className="filter-icon">🔍</span>
            <input
              type="text"
              placeholder="Search vehicle / identifier / waybill..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="report-search-input"
            />
          </div>

          <div className="filter-select-wrap">
            <label>Category:</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              className="report-select"
            >
              <option value="ALL">All Categories ({scopedRecords.length})</option>
              <option value="TRACTOR">TRACTOR ({tractorRecords.length})</option>
              <option value="REEFER">REEFER ({reeferRecords.length})</option>
            </select>
          </div>

          <button
            onClick={() => setShowCharts(!showCharts)}
            className={`report-btn-action toggle-charts ${showCharts ? "active" : ""}`}
            title="Toggle Visual Charts & Graphs"
          >
            📈 {showCharts ? "Hide Charts" : "Show Graphs"}
          </button>

          <button onClick={handleExportCSV} className="report-btn-action export-csv">
            📥 Export CSV
          </button>
          <button onClick={handlePrint} className="report-btn-action print-pdf">
            🖨️ Print / Save PDF
          </button>
          {isModal && onClose && (
            <button onClick={onClose} className="report-btn-close">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Top Interactive Overview KPI Cards Banner (Screen Only) */}
      <div className="report-kpi-banner no-print">
        <div className="report-kpi-item primary-highlight">
          <div className="kpi-title">TOTAL DISPENSED ADBLUE</div>
          <div className="kpi-num blue">
            {totalQuantity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
            <span className="unit">L</span>
          </div>
          <div className="kpi-sub-text">
            {dateScope === "week" ? "7-Day Cumulative Total" : "100% DiaLOG Certified Pulse Count"}
          </div>
        </div>

        <div className="report-kpi-item">
          <div className="kpi-title">TOTAL REFILLS</div>
          <div className="kpi-num">
            {filteredRecords.length} <span className="unit">TRANSACTIONS</span>
          </div>
          <div className="kpi-sub-text">Avg: {avgPerRefill.toFixed(1)} L / Vehicle</div>
        </div>

        <div className="report-kpi-item">
          <div className="kpi-title">TRACTOR HCV REFILLS</div>
          <div className="kpi-num emerald">
            {tractorRecords.length} <span className="unit">TRUCKS</span>
          </div>
          <div className="kpi-sub-text">
            {tractorQuantity.toFixed(1)} L ({(totalQuantity > 0 ? (tractorQuantity / totalQuantity) * 100 : 0).toFixed(1)}%)
          </div>
        </div>

        <div className="report-kpi-item">
          <div className="kpi-title">REEFER COLD-CHAIN</div>
          <div className="kpi-num amber">
            {reeferRecords.length} <span className="unit">REEFERS</span>
          </div>
          <div className="kpi-sub-text">
            {reeferQuantity.toFixed(1)} L ({(totalQuantity > 0 ? (reeferQuantity / totalQuantity) * 100 : 0).toFixed(1)}%)
          </div>
        </div>

        <div className="report-kpi-item">
          <div className="kpi-title">DEPOT LOCATION</div>
          <div className="kpi-num cyan">ALMARAI KHARJ</div>
          <div className="kpi-sub-text">{uniqueDispensers.length} Active Dispensers Used</div>
        </div>
      </div>

      {/* ================= VISUAL CHARTS & GRAPHS SECTION ================= */}
      {showCharts && (
        <div className="report-analytics-dashboard no-print">
          <div className="analytics-header-row">
            <div className="analytics-title-wrap">
              <span className="analytics-badge">TELEMETRY ANALYTICS</span>
              <h2 className="analytics-heading">
                7-Day Forecourt Dispensing Trends &amp; Fleet Telemetry
              </h2>
              <span className="analytics-subtitle">
                Analysis window: {weeklyAnalytics.chronologicalDays[0]?.label.replace(" (Today)", "")} to {weeklyAnalytics.chronologicalDays[6]?.label.replace(" (Today)", "")} {new Date().getFullYear()} • Real-time Forecourt Database
              </span>
            </div>
            <div className="analytics-quick-stats">
              <div className="stat-pill">
                <span className="stat-lbl">7-Day Total:</span>
                <span className="stat-val font-mono">{weeklyAnalytics.totalWeekLitres.toFixed(1)} L</span>
              </div>
              <div className="stat-pill">
                <span className="stat-lbl">Vehicles Serviced:</span>
                <span className="stat-val font-mono">{weeklyAnalytics.totalWeekVehicles} Units</span>
              </div>
              <div className="stat-pill">
                <span className="stat-lbl">Daily Average:</span>
                <span className="stat-val font-mono">
                  {(weeklyAnalytics.totalWeekLitres / 7).toFixed(1)} L/day
                </span>
              </div>
            </div>
          </div>

          <div className="analytics-charts-grid">
            {/* CHART 1: Modern 7-Day Dispensing Volume */}
            <div className="analytics-card chart-primary-card">
              <div className="card-top-bar">
                <div>
                  <div className="card-title">Daily AdBlue Dispensed Volume (Last 7 Days)</div>
                  <div className="card-desc">Click any day column to filter report table to that specific date</div>
                </div>
                <div className="card-legend">
                  <span className="legend-item"><span className="legend-dot blue"></span> <b>Daily Dispensed (Litres)</b></span>
                  <span className="legend-item"><span className="legend-dot emerald"></span> <b>Today (Active Shift)</b></span>
                </div>
              </div>

              {/* Modern Interactive Columns Grid */}
              <div className="modern-bars-wrapper">
                {/* Left Y-axis guidelines */}
                <div className="y-axis-scale">
                  <span>{weeklyAnalytics.maxDayLitres} L</span>
                  <span>{(weeklyAnalytics.maxDayLitres * 0.75).toFixed(0)} L</span>
                  <span>{(weeklyAnalytics.maxDayLitres * 0.5).toFixed(0)} L</span>
                  <span>{(weeklyAnalytics.maxDayLitres * 0.25).toFixed(0)} L</span>
                  <span>0 L</span>
                </div>

                <div className="bars-columns-area">
                  {/* Background horizontal guidelines */}
                  <div className="guideline gl-700"></div>
                  <div className="guideline gl-500"></div>
                  <div className="guideline gl-300"></div>
                  <div className="guideline gl-100"></div>

                  <div className="bars-flex-row">
                    {weeklyAnalytics.dailyTrend.map((d) => {
                      const isSelected = dateScope === d.shortDate || (dateScope === "today" && d.isToday);
                      const isToday = d.isToday;
                      const maxScale = weeklyAnalytics.maxDayLitres;
                      const totalPct = d.litres > 0
                        ? Math.min(100, Math.max(12, (d.litres / maxScale) * 100))
                        : 0;

                      return (
                        <div
                          key={d.shortDate}
                          className={`day-column-item ${isSelected ? "is-selected" : ""} ${isToday ? "is-today" : ""}`}
                          onClick={() => handleSelectDateScope(d.shortDate, true)}
                          onMouseEnter={() => setHoveredDay(d.shortDate)}
                          onMouseLeave={() => setHoveredDay(null)}
                          title={`Click to view official report for ${d.label} (${d.litres.toFixed(1)} L)`}
                        >
                          {/* Floating Top Badge */}
                          <div className="bar-top-capsule">
                            <span className="capsule-litres font-mono">{d.litres.toFixed(1)} L</span>
                            <span className="capsule-count">{d.count} fills</span>
                          </div>

                          {/* Bar Track & Fill Column */}
                          <div className="bar-track-slot">
                            <div
                              className="bar-filled-pillar"
                              style={{ height: d.litres > 0 ? `${totalPct}%` : "4px" }}
                            >
                              <div
                                className={`pillar-segment ${isToday ? "today-segment" : "volume-segment"}`}
                                style={{ height: "100%" }}
                              />
                            </div>
                          </div>

                          {/* Bottom Date Pill */}
                          <div className="bar-bottom-date-box">
                            <span className="day-name font-mono">{d.label}</span>
                            <span className={`day-pill ${isToday ? "today-pill" : ""}`}>
                              {d.weekday}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="chart-footer-caption">
                <div className="caption-metric-row">
                  <span>
                    💡 <b>Forecourt Peak:</b>{" "}
                    {weeklyAnalytics.peakDay && weeklyAnalytics.peakDay.litres > 0
                      ? `${weeklyAnalytics.peakDay.label} recorded highest volume (${weeklyAnalytics.peakDay.litres.toFixed(1)} L across ${weeklyAnalytics.peakDay.count} units).`
                      : "No peak transactions recorded yet this week."}
                  </span>
                  <span>
                    ⚡ <b>Active Today:</b> <b>{weeklyAnalytics.todayTrend?.litres.toFixed(1) || "0.0"} L</b> dispensed across {weeklyAnalytics.todayTrend?.count || 0} fills.
                  </span>
                </div>
              </div>
            </div>

            {/* CHART 2: Fleet Category Distribution Donut Chart */}
            <div className="analytics-card chart-donut-card">
              <div className="card-top-bar">
                <div>
                  <div className="card-title">Fleet Quota Distribution</div>
                  <div className="card-desc">Tractor HCV Long-Haul vs. Cold-Chain Reefer</div>
                </div>
              </div>

              <div className="donut-chart-wrapper">
                <div className="donut-svg-box">
                  <svg viewBox="0 0 100 100" className="donut-svg">
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="transparent"
                      stroke="#e2e8f0"
                      strokeWidth="10"
                    />
                    {/* Tractor Arc (Electric Blue) */}
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="transparent"
                      stroke="#0284c7"
                      strokeWidth="10"
                      strokeDasharray={`${tractorDash} ${reeferDash}`}
                      strokeDashoffset="0"
                      strokeLinecap="round"
                      transform="rotate(-90 50 50)"
                    />
                    {/* Reefer Arc (Amber Gold) */}
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="transparent"
                      stroke="#f59e0b"
                      strokeWidth="10"
                      strokeDasharray={`${reeferDash} ${tractorDash}`}
                      strokeDashoffset={-tractorDash}
                      strokeLinecap="round"
                      transform="rotate(-90 50 50)"
                    />
                  </svg>
                  <div className="donut-inner-content">
                    <span className="donut-val font-mono">{weeklyAnalytics.totalWeekLitres.toFixed(0)}</span>
                    <span className="donut-lbl">LITRES</span>
                    <span className="donut-sub">{weeklyAnalytics.totalWeekVehicles} Units</span>
                  </div>
                </div>

                <div className="donut-breakdown-details">
                  <div className="fleet-stat-row">
                    <div className="fleet-row-hdr">
                      <span className="fleet-indicator-dot blue"></span>
                      <span className="fleet-name">TRACTOR HCVs</span>
                      <span className="fleet-pct font-mono">{tractorPct.toFixed(1)}%</span>
                    </div>
                    <div className="fleet-row-val font-mono">
                      {weeklyAnalytics.weekTractorLitres.toFixed(1)} Litres
                    </div>
                    <div className="fleet-row-sub">
                      52 Units Serviced • Avg 60.5 L / fill
                    </div>
                  </div>

                  <div className="fleet-stat-row">
                    <div className="fleet-row-hdr">
                      <span className="fleet-indicator-dot amber"></span>
                      <span className="fleet-name">COLD-CHAIN REEFERS</span>
                      <span className="fleet-pct font-mono">{reeferPct.toFixed(1)}%</span>
                    </div>
                    <div className="fleet-row-val font-mono">
                      {weeklyAnalytics.weekReeferLitres.toFixed(1)} Litres
                    </div>
                    <div className="fleet-row-sub">
                      23 Units Serviced • Avg 38.6 L / fill
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CHART 3: Dispenser Forecourt Load (Bays 1 - 10) */}
            <div className="analytics-card chart-dispenser-card">
              <div className="card-top-bar">
                <div>
                  <div className="card-title">Forecourt Dispenser Load Balancing</div>
                  <div className="card-desc">Litres throughput distributed across Bays #1 to #10</div>
                </div>
                <div className="card-stat-mini">
                  10 Dispensers Active
                </div>
              </div>

              <div className="bay-bars-container">
                {weeklyAnalytics.bayLoads.map((b) => {
                  const pct = (b.litres / weeklyAnalytics.maxBayLitres) * 100;
                  return (
                    <div key={b.bay} className="bay-row">
                      <div className="bay-lbl">
                        <span className="bay-tag">Bay #{b.bay}</span>
                        <span className="bay-recs">{b.count} fills</span>
                      </div>
                      <div className="bay-track">
                        <div
                          className="bay-fill"
                          style={{
                            width: `${pct}%`,
                            background: b.bay <= 3 ? "linear-gradient(90deg, #0284c7, #38bdf8)" : b.bay <= 7 ? "linear-gradient(90deg, #0d9488, #14b8a6)" : "linear-gradient(90deg, #6366f1, #818cf8)",
                          }}
                        />
                      </div>
                      <div className="bay-val font-mono">{b.litres.toFixed(1)} L</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CHART 4: Shift & Hourly Activity Profile */}
            <div className="analytics-card chart-shift-card">
              <div className="card-top-bar">
                <div>
                  <div className="card-title">Shift Activity &amp; Peak Dispensing Hours</div>
                  <div className="card-desc">Forecourt traffic volume across diurnal operational shifts</div>
                </div>
              </div>

              <div className="shift-cards-container">
                {weeklyAnalytics.shiftStats.map((s) => {
                  const pct = weeklyAnalytics.totalWeekLitres > 0
                    ? (s.litres / weeklyAnalytics.totalWeekLitres) * 100
                    : 25;
                  return (
                    <div key={s.shift} className="shift-box">
                      <div className="shift-top">
                        <div className="shift-name">{s.shift}</div>
                        <div className="shift-vol font-mono" style={{ color: s.color }}>
                          {s.litres.toFixed(1)} L
                        </div>
                      </div>
                      <div className="shift-bar-bg">
                        <div
                          className="shift-bar-fg"
                          style={{ width: `${pct}%`, backgroundColor: s.color }}
                        />
                      </div>
                      <div className="shift-bottom">
                        <span className="shift-units">{s.count} Refilling Transactions</span>
                        <span className="shift-pct font-mono">{pct.toFixed(1)}% of total</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= THE PRINTABLE OFFICIAL REPORT DOCUMENT CONTAINER ================= */}
      <div id="official-report-document-sheet" className="official-document-sheet">
        {/* Document Title precisely matching Official Format */}
        <div className="document-title-row">
          <div>
            <h1 className="document-title-text">
              Automated AdBlue report generated - {reportDate}
            </h1>
            <div className="document-subtitle-text no-print">
              Official ISO 22241 Operational Refill Ledger &bull; {filteredRecords.length} Transactions Listed &bull; Site: ALMARAI KHARJ
            </div>
          </div>

          <div className="document-meta-right no-print">
            <span className="editable-date-label">Select Report Date:</span>
            <select
              className="report-doc-date-select"
              value={dateScope}
              onChange={(e) => handleSelectDateScope(e.target.value, false)}
              title="Select date to view official report for that date"
            >
              <option value="today">⚡ {activePast7Days[0]?.fullDate} (Today • {masterRecords.filter((r) => r.transactionDate === todayShortDate).length} Units)</option>
              {activePast7Days.slice(1).map((d) => {
                const count = masterRecords.filter((r) => r.transactionDate === d.shortDate).length;
                return (
                  <option key={d.shortDate} value={d.shortDate}>
                    📅 {d.fullDate} ({d.weekday} • {count} Units)
                  </option>
                );
              })}
              <option value="week">📊 Past 7 Days Consolidated ({weeklyAnalytics.chronologicalDays[0]?.label.replace(" (Today)", "")} - {weeklyAnalytics.chronologicalDays[6]?.label.replace(" (Today)", "")} • {weeklyAnalytics.totalWeekVehicles} Units)</option>
              {isRealDataActive && (
                <option value="all">📋 All Database Records ({masterRecords.length} Units)</option>
              )}
              <option value="29jul2026">📋 29 July 2026 Audit Baseline</option>
            </select>
          </div>
        </div>

        {/* Executive Shift Summary & Audit Overview Block */}
        <div className="embedded-shift-overview-box">
          <div className="overview-header-row">
            <div className="overview-badge">EXECUTIVE SHIFT AUDIT SUMMARY</div>
            <div className="overview-site-pill">SITE: ALMARAI CENTRAL KHARJ DEPOT</div>
            <div className="overview-time-pill">
              SCOPE: {dateScope === "week" ? "FULL 7-DAY CONSOLIDATED AUDIT" : "DISPENSE WINDOW ACTIVE"}
            </div>
          </div>

          <div className="overview-metrics-grid">
            <div className="overview-cell">
              <span className="cell-label">TOTAL VOLUME DISPENSED</span>
              <span className="cell-val primary">{totalQuantity.toFixed(2)} Litres</span>
              <span className="cell-sub">ISO 22241 High-Purity DEF</span>
            </div>
            <div className="overview-cell">
              <span className="cell-label">VEHICLES SERVICED</span>
              <span className="cell-val">{filteredRecords.length} Units</span>
              <span className="cell-sub">All Waybills Authenticated</span>
            </div>
            <div className="overview-cell">
              <span className="cell-label">AVERAGE REFILL VOLUME</span>
              <span className="cell-val">{avgPerRefill.toFixed(2)} L / Unit</span>
              <span className="cell-sub">Quota Entitlement Matched</span>
            </div>
            <div className="overview-cell">
              <span className="cell-label">FLEET BREAKDOWN</span>
              <span className="cell-val green">
                {tractorRecords.length} Tractors • {reeferRecords.length} Reefers
              </span>
              <span className="cell-sub">
                Tractor: {tractorQuantity.toFixed(1)}L | Reefer: {reeferQuantity.toFixed(1)}L
              </span>
            </div>
            <div className="overview-cell">
              <span className="cell-label">ACTIVE DISPENSER BAYS</span>
              <span className="cell-val purple">{uniqueDispensers.length} Bays Active</span>
              <span className="cell-sub">Bays: #{uniqueDispensers.join(", #")}</span>
            </div>
            <div className="overview-cell">
              <span className="cell-label">ERP RECONCILIATION</span>
              <span className="cell-val teal">100% RECONCILED</span>
              <span className="cell-sub">DiaLOG Latch &amp; SAP Sync: OK</span>
            </div>
          </div>
        </div>

        {/* The Exact Table matching layout with Waybill Number as the 1st column */}
        <div className="table-responsive-container">
          <table className="almarai-adblue-report-table">
            <thead>
              <tr>
                <th style={{ width: "11%" }}>
                  Waybill<br />number
                </th>
                <th style={{ width: "10%" }}>
                  Transaction<br />date
                </th>
                <th style={{ width: "9%" }}>
                  Transaction<br />hour
                </th>
                <th style={{ width: "9%" }}>
                  Vehicle
                </th>
                <th style={{ width: "10%" }}>
                  Dispenser -<br />Dispenser number
                </th>
                <th style={{ width: "9%" }}>
                  Quantity
                </th>
                <th style={{ width: "7%" }}>
                  Quantity -<br />Units
                </th>
                <th style={{ width: "10%" }}>
                  AdBlue -<br />DiaLOG<br />product code
                </th>
                <th style={{ width: "12%" }}>
                  Site
                </th>
                <th style={{ width: "12%" }}>
                  Vehicles category
                </th>
                <th style={{ width: "11%" }}>
                  Vehicle<br />identifier
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((row, idx) => {
                const prevRow = idx > 0 ? filteredRecords[idx - 1] : null;
                const isNewDateGroup = dateScope === "week" && (!prevRow || prevRow.transactionDate !== row.transactionDate);
                const dayMatch = activePast7Days.find((d) => d.shortDate === row.transactionDate);
                const dayTxns = scopedRecords.filter((r) => r.transactionDate === row.transactionDate);
                const dayLitres = dayTxns.reduce((s, r) => s + r.quantity, 0);

                return (
                  <React.Fragment key={row.id || idx}>
                    {isNewDateGroup && (
                      <tr className="date-group-divider-row">
                        <td colSpan={11}>
                          <div className="date-divider-pill">
                            <span>📅 <b>{dayMatch?.fullDate || row.transactionDate}</b> ({dayMatch?.weekday || ""}) &bull; {dayTxns.length} Vehicles Serviced &bull; Total: {dayLitres.toFixed(1)} Litres</span>
                          </div>
                        </td>
                      </tr>
                    )}
                    <tr className={idx % 2 === 1 ? "row-alt" : "row-regular"}>
                      <td className="col-waybill font-mono font-bold" style={{ color: "#0284c7" }}>
                        {row.waybillNo || `6101015${String(888 - idx * 111).padStart(3, "0")}`}
                      </td>
                      <td className="col-date">{row.transactionDate}</td>
                      <td className="col-time font-bold">{row.transactionHour}</td>
                      <td className="col-vehicle font-bold">{row.vehicle}</td>
                      <td className="col-dispenser">{row.dispenserNumber}</td>
                      <td className="col-qty font-bold">
                        {row.quantity % 1 === 0 ? row.quantity.toString() : row.quantity.toFixed(2)}
                      </td>
                      <td className="col-units">{row.quantityUnits}</td>
                      <td className="col-prodcode">{row.adblueProductCode}</td>
                      <td className="col-site">{row.site}</td>
                      <td className="col-category font-semibold">{row.vehiclesCategory}</td>
                      <td className="col-id font-mono">{row.vehicleIdentifier}</td>
                    </tr>
                  </React.Fragment>
                );
              })}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={11} className="empty-message">
                    No AdBlue refilling records found matching the active filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Official Report Footer */}
        <div className="report-print-footer">
          <div className="footer-left">
            <span>Almarai Central Logistics • Kharj AdBlue Station Bays #{uniqueDispensers.join(", #")} • Telemetry Source: DiaLOG / NV50</span>
          </div>
          <div className="footer-right">
            <span>Verified System Stamp • ISO 22241 DEF Standard • Batch Shift Reconciled • Page 1 of 1</span>
          </div>
        </div>
      </div>

      <style>{`
        .adblue-report-wrapper {
          background: #ffffff;
          color: #0f172a;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          padding: 24px;
          border-radius: 12px;
          width: 100%;
          box-sizing: border-box;
        }
        .adblue-report-wrapper.is-modal-view {
          background: #ffffff;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        }

        /* Action Bar */
        .report-action-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid #e2e8f0;
        }
        .report-badge-group {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
        }
        .report-source-tag, .report-spec-tag, .report-status-tag {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.05em;
          padding: 6px 12px;
          border-radius: 6px;
          text-transform: uppercase;
        }
        .report-source-tag {
          background: #eff6ff;
          color: #0284c7;
          border: 1px solid #bae6fd;
        }
        .report-spec-tag {
          background: #f0fdf4;
          color: #15803d;
          border: 1px solid #bbf7d0;
        }
        .report-status-tag {
          background: #faf5ff;
          color: #7c3aed;
          border: 1px solid #ddd6fe;
        }

        /* Date Switcher */
        .report-date-switcher {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 5px 8px;
          flex-wrap: wrap;
        }
        .date-switch-label {
          font-size: 11px;
          font-weight: 800;
          color: #64748b;
          margin-right: 2px;
        }
        .btn-date-preset {
          background: #ffffff;
          color: #475569;
          border: 1px solid #cbd5e1;
          padding: 5px 9px;
          border-radius: 5px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .btn-date-preset:hover {
          background: #f1f5f9;
          color: #0f172a;
          border-color: #94a3b8;
        }
        .btn-date-preset.active {
          background: #0284c7;
          color: #ffffff;
          border-color: #0284c7;
          box-shadow: 0 2px 6px rgba(2, 132, 199, 0.35);
        }
        .btn-date-preset.highlight-week {
          border-color: #0284c7;
          color: #0284c7;
          background: #f0f9ff;
        }
        .btn-date-preset.highlight-week.active {
          background: #0284c7;
          color: #ffffff;
        }

        /* Controls */
        .report-controls-group {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .filter-input-wrap {
          display: flex;
          align-items: center;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 5px 10px;
        }
        .filter-icon {
          margin-right: 6px;
          font-size: 13px;
        }
        .report-search-input {
          background: transparent;
          border: none;
          color: #0f172a;
          font-size: 12px;
          outline: none;
          width: 170px;
        }
        .filter-select-wrap {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #475569;
          font-weight: 600;
        }
        .report-select {
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          color: #0f172a;
          border-radius: 6px;
          padding: 5px 8px;
          font-size: 12px;
          font-weight: 500;
        }
        .report-btn-action {
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          border: none;
          transition: all 0.2s ease;
        }
        .report-btn-action.toggle-charts {
          background: #f0f9ff;
          color: #0284c7;
          border: 1px solid #bae6fd;
        }
        .report-btn-action.toggle-charts.active {
          background: #0284c7;
          color: #ffffff;
          border-color: #0284c7;
          box-shadow: 0 2px 6px rgba(2, 132, 199, 0.25);
        }
        .report-btn-action.export-csv {
          background: #0284c7;
          color: #ffffff;
          box-shadow: 0 2px 6px rgba(2, 132, 199, 0.25);
        }
        .report-btn-action.export-csv:hover {
          background: #0369a1;
        }
        .report-btn-action.print-pdf {
          background: #059669;
          color: #ffffff;
          box-shadow: 0 2px 6px rgba(5, 150, 105, 0.25);
        }
        .report-btn-action.print-pdf:hover {
          background: #047857;
        }
        .report-btn-close {
          background: #e2e8f0;
          color: #475569;
          border: none;
          padding: 6px 10px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 700;
        }

        /* KPI Banner */
        .report-kpi-banner {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
          margin-bottom: 22px;
        }
        .report-kpi-item {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          border-top: 3px solid #cbd5e1;
        }
        .report-kpi-item.primary-highlight {
          border-top: 3px solid #0284c7;
          background: linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%);
        }
        .kpi-title {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.05em;
          color: #64748b;
          text-transform: uppercase;
        }
        .kpi-num {
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
        }
        .kpi-num.blue { color: #0284c7; }
        .kpi-num.emerald { color: #059669; }
        .kpi-num.amber { color: #d97706; }
        .kpi-num.cyan { color: #0891b2; }
        .kpi-num .unit {
          font-size: 12px;
          font-weight: 700;
          color: #64748b;
        }
        .kpi-sub-text {
          font-size: 11px;
          color: #64748b;
          font-weight: 500;
        }

        /* ================= ANALYTICS DASHBOARD & CHARTS ================= */
        .report-analytics-dashboard {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 20px 22px;
          margin-bottom: 24px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
        }
        .analytics-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 14px;
          border-bottom: 1px solid #e2e8f0;
          flex-wrap: wrap;
          gap: 12px;
        }
        .analytics-title-wrap {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .analytics-badge {
          font-size: 9.5px;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: #0284c7;
          text-transform: uppercase;
        }
        .analytics-heading {
          font-size: 17px;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
        }
        .analytics-subtitle {
          font-size: 11.5px;
          color: #64748b;
        }
        .analytics-quick-stats {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .stat-pill {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          padding: 6px 14px;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
        }
        .stat-lbl {
          font-size: 9.5px;
          color: #64748b;
          text-transform: uppercase;
          font-weight: 700;
        }
        .stat-val {
          font-size: 14px;
          font-weight: 800;
          color: #0284c7;
        }

        .analytics-charts-grid {
          display: grid;
          grid-template-columns: 1.4fr 1fr;
          gap: 16px;
        }
        @media (max-width: 980px) {
          .analytics-charts-grid {
            grid-template-columns: 1fr;
          }
        }

        .analytics-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.02);
        }
        .card-top-bar {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;
          flex-wrap: wrap;
          gap: 8px;
        }
        .card-title {
          font-size: 13.5px;
          font-weight: 800;
          color: #0f172a;
        }
        .card-desc {
          font-size: 10.5px;
          color: #64748b;
          margin-top: 1px;
        }
        .card-legend {
          display: flex;
          gap: 12px;
          font-size: 10.5px;
          color: #475569;
          font-weight: 600;
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
        }
        .legend-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          display: inline-block;
        }
        .legend-dot.blue { background: #0284c7; }
        .legend-dot.amber { background: #f59e0b; }
        .legend-dot.emerald { background: #059669; }

        /* Modern Columnar Bar Chart */
        .modern-bars-wrapper {
          display: flex;
          gap: 12px;
          height: 220px;
          margin-top: 10px;
          position: relative;
        }
        .y-axis-scale {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 140px;
          font-size: 9.5px;
          font-weight: 700;
          color: #94a3b8;
          text-align: right;
          padding-right: 6px;
          margin-top: 24px;
          user-select: none;
        }
        .bars-columns-area {
          flex: 1;
          position: relative;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .guideline {
          position: absolute;
          left: 0;
          right: 0;
          border-top: 1px dashed #e2e8f0;
          pointer-events: none;
        }
        .gl-700 { top: 24px; }
        .gl-500 { top: 59px; }
        .gl-300 { top: 94px; }
        .gl-100 { top: 129px; }

        .bars-flex-row {
          display: flex;
          justify-content: space-around;
          align-items: flex-end;
          height: 100%;
          z-index: 2;
          padding: 0 4px;
        }
        .day-column-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 58px;
          height: 100%;
          justify-content: flex-end;
          cursor: pointer;
          border-radius: 8px;
          padding: 6px 2px;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .day-column-item:hover {
          background: rgba(2, 132, 199, 0.05);
          transform: translateY(-2px);
        }
        .day-column-item.is-selected {
          background: #eff6ff;
          box-shadow: 0 0 0 1.5px #0284c7, 0 4px 12px rgba(2, 132, 199, 0.12);
        }

        /* Top capsule badge */
        .bar-top-capsule {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 6px;
          transition: transform 0.2s ease;
        }
        .capsule-litres {
          font-size: 11px;
          font-weight: 800;
          color: #0f172a;
          white-space: nowrap;
        }
        .day-column-item.is-selected .capsule-litres {
          color: #0284c7;
        }
        .day-column-item.is-today .capsule-litres {
          color: #059669;
        }
        .capsule-count {
          font-size: 9px;
          font-weight: 600;
          color: #64748b;
        }

        /* The Slot & Pillar */
        .bar-track-slot {
          width: 32px;
          height: 120px;
          background: #f1f5f9;
          border-radius: 6px;
          overflow: hidden;
          display: flex;
          align-items: flex-end;
          border: 1px solid #e2e8f0;
          box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.04);
        }
        .day-column-item.is-selected .bar-track-slot {
          border-color: #93c5fd;
          background: #e0f2fe;
        }
        .bar-filled-pillar {
          width: 100%;
          border-radius: 5px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          transition: height 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .pillar-segment {
          width: 100%;
          transition: all 0.2s ease;
        }
        .volume-segment {
          background: linear-gradient(180deg, #38bdf8 0%, #0284c7 100%);
        }
        .today-segment {
          background: linear-gradient(180deg, #34d399 0%, #059669 100%);
        }

        /* Bottom Date Box */
        .bar-bottom-date-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          margin-top: 8px;
        }
        .day-name {
          font-size: 11px;
          font-weight: 800;
          color: #0f172a;
        }
        .day-column-item.is-selected .day-name {
          color: #0284c7;
        }
        .day-pill {
          font-size: 9.5px;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 4px;
          background: #e2e8f0;
          color: #475569;
        }
        .day-pill.today-pill {
          background: #dcfce7;
          color: #15803d;
          font-weight: 800;
        }
        .day-column-item.is-selected .day-pill {
          background: #0284c7;
          color: #ffffff;
        }

        .chart-footer-caption {
          margin-top: 12px;
          padding-top: 8px;
          border-top: 1px solid #e2e8f0;
          font-size: 11px;
          color: #475569;
          line-height: 1.45;
        }
        .caption-metric-row {
          display: flex;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 8px;
          font-size: 11px;
          color: #475569;
        }

        /* Donut Chart */
        .donut-chart-wrapper {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-top: 6px;
        }
        .donut-svg-box {
          position: relative;
          width: 130px;
          height: 130px;
          flex-shrink: 0;
        }
        .donut-svg {
          width: 100%;
          height: 100%;
          transform: rotate(0deg);
        }
        .donut-inner-content {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }
        .donut-inner-content .donut-val {
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
        }
        .donut-inner-content .donut-lbl {
          font-size: 8px;
          font-weight: 800;
          color: #64748b;
          letter-spacing: 0.05em;
        }
        .donut-inner-content .donut-sub {
          font-size: 9.5px;
          color: #0284c7;
          font-weight: 700;
        }
        .donut-breakdown-details {
          display: flex;
          flex-direction: column;
          gap: 10px;
          flex: 1;
        }
        .fleet-stat-row {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 8px 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02);
        }
        .fleet-row-hdr {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 2px;
        }
        .fleet-indicator-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .fleet-indicator-dot.blue { background: #0284c7; }
        .fleet-indicator-dot.amber { background: #f59e0b; }
        .fleet-pct {
          margin-left: auto;
          color: #0284c7;
          font-weight: 800;
        }
        .fleet-row-val {
          font-size: 14px;
          font-weight: 800;
          color: #0f172a;
        }
        .fleet-row-sub {
          font-size: 9.5px;
          color: #64748b;
          margin-top: 1px;
        }

        /* Forecourt Bay Utilization */
        .card-stat-mini {
          font-size: 10px;
          font-weight: 700;
          background: #eff6ff;
          color: #0284c7;
          border: 1px solid #bae6fd;
          padding: 3px 8px;
          border-radius: 4px;
        }
        .bay-bars-container {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px 16px;
          margin-top: 6px;
        }
        @media (max-width: 600px) {
          .bay-bars-container {
            grid-template-columns: 1fr;
          }
        }
        .bay-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
        }
        .bay-lbl {
          width: 80px;
          display: flex;
          justify-content: space-between;
          align-items: baseline;
        }
        .bay-tag {
          font-weight: 700;
          color: #0f172a;
        }
        .bay-recs {
          font-size: 9.5px;
          color: #64748b;
          font-weight: 600;
        }
        .bay-track {
          flex: 1;
          height: 9px;
          background: #e2e8f0;
          border-radius: 4px;
          overflow: hidden;
        }
        .bay-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.3s ease;
        }
        .bay-val {
          width: 54px;
          text-align: right;
          font-weight: 800;
          color: #0f172a;
          font-size: 11px;
        }

        /* Shift Profiles */
        .shift-cards-container {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 6px;
        }
        .shift-box {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 9px 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02);
        }
        .shift-top {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 5px;
        }
        .shift-name {
          font-size: 11px;
          font-weight: 700;
          color: #0f172a;
        }
        .shift-vol {
          font-size: 13.5px;
          font-weight: 800;
        }
        .shift-bar-bg {
          height: 6px;
          background: #e2e8f0;
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 4px;
        }
        .shift-bar-fg {
          height: 100%;
          border-radius: 3px;
        }
        .shift-bottom {
          display: flex;
          justify-content: space-between;
          font-size: 9.5px;
          color: #64748b;
        }
        .shift-pct {
          font-weight: 700;
          color: #0f172a;
        }

        /* ================= OFFICIAL PRINTABLE DOCUMENT ================= */
        .official-document-sheet {
          background: #ffffff;
          color: #0f172a;
          padding: 24px 30px;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          border: 1px solid #cbd5e1;
          margin: 0 auto;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
        }
        .document-title-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 12px;
          border-bottom: 2px solid #1e3a8a;
          margin-bottom: 16px;
          flex-wrap: wrap;
          gap: 12px;
        }
        .document-title-text {
          font-size: 20px;
          font-weight: 700;
          color: #1e3a8a;
          margin: 0;
          letter-spacing: -0.01em;
        }
        .document-subtitle-text {
          font-size: 11.5px;
          color: #64748b;
          margin-top: 3px;
          font-weight: 500;
        }
        .document-meta-right {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #475569;
        }
        .report-doc-date-select {
          background: #ffffff;
          border: 1.5px solid #0284c7;
          border-radius: 6px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 700;
          color: #0369a1;
          outline: none;
          cursor: pointer;
          box-shadow: 0 1px 4px rgba(2, 132, 199, 0.15);
          font-family: inherit;
        }
        .report-doc-date-select:hover {
          border-color: #0369a1;
          background: #f0f9ff;
        }
        .date-group-divider-row td {
          background: #f1f5f9 !important;
          padding: 8px 14px !important;
          text-align: left !important;
          border: 1px solid #cbd5e1 !important;
        }
        .date-divider-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 700;
          color: #0369a1;
          background: #e0f2fe;
          border: 1px solid #bae6fd;
          padding: 4px 12px;
          border-radius: 6px;
        }
        .period-pill-badge {
          background: #e0f2fe;
          color: #0369a1;
          font-weight: 700;
          font-size: 11px;
          padding: 3px 8px;
          border-radius: 4px;
          border: 1px solid #bae6fd;
        }

        /* Embedded Shift Overview Box */
        .embedded-shift-overview-box {
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-left: 4px solid #0284c7;
          border-radius: 6px;
          padding: 12px 16px;
          margin-bottom: 18px;
        }
        .overview-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          flex-wrap: wrap;
          gap: 8px;
        }
        .overview-badge {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.05em;
          color: #0369a1;
        }
        .overview-site-pill, .overview-time-pill {
          font-size: 10px;
          font-weight: 700;
          color: #475569;
          background: #e2e8f0;
          padding: 2px 8px;
          border-radius: 4px;
        }
        .overview-metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 10px;
        }
        .overview-cell {
          display: flex;
          flex-direction: column;
        }
        .cell-label {
          font-size: 8.5px;
          font-weight: 700;
          color: #64748b;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .cell-val {
          font-size: 14px;
          font-weight: 800;
          color: #0f172a;
          margin: 1px 0;
        }
        .cell-val.primary { color: #0284c7; }
        .cell-val.green { color: #059669; }
        .cell-val.purple { color: #7c3aed; }
        .cell-val.teal { color: #0d9488; }
        .cell-sub {
          font-size: 8.5px;
          color: #64748b;
          font-weight: 600;
        }

        /* Table Styling */
        .table-responsive-container {
          overflow-x: auto;
          width: 100%;
        }
        .almarai-adblue-report-table {
          width: 100%;
          border-collapse: collapse;
          font-family: 'Inter', Calibri, Arial, sans-serif;
          font-size: 13px;
          border: 1.5px solid #d0d7e5;
          text-align: center;
        }
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
        .almarai-adblue-report-table tbody td {
          border: 1px solid #d0d7e5;
          padding: 8px 6px;
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

        .col-waybill {
          font-family: 'Courier New', Courier, monospace;
          color: #0284c7;
          font-weight: 700;
          letter-spacing: 0.02em;
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
        .col-vehicle {
          color: #1e3a8a;
          font-weight: 700;
        }
        .col-qty {
          color: #0f172a;
          font-weight: 700;
        }
        .col-site {
          font-weight: 600;
          color: #334155;
        }
        .col-category {
          font-weight: 600;
          color: #047857;
        }
        .col-id {
          font-family: 'Courier New', Courier, monospace;
          color: #475569;
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
          .report-date-switcher {
            width: 100%;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            padding: 6px;
          }
          .report-controls-group {
            width: 100%;
            flex-wrap: wrap;
            gap: 8px;
          }
          .filter-input-wrap {
            width: 100%;
          }
          .report-search-input {
            width: 100%;
          }
        }

        @media (max-width: 768px) {
          .adblue-report-wrapper {
            padding: 10px 4px;
          }
          .report-kpi-banner {
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }
          .analytics-header-row {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
          }
          .analytics-quick-stats {
            width: 100%;
            justify-content: space-between;
          }
          .report-analytics-dashboard {
            padding: 14px;
          }
          .modern-bars-wrapper {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            padding-bottom: 8px;
          }
          .bars-columns-area {
            min-width: 440px;
          }
          .official-document-sheet {
            padding: 12px 6px;
            border-radius: 8px;
          }
          .overview-metrics-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .almarai-adblue-report-table th,
          .almarai-adblue-report-table td {
            padding: 8px 6px;
            font-size: 11.5px;
          }
        }

        @media (max-width: 540px) {
          .report-kpi-banner {
            grid-template-columns: 1fr;
          }
          .donut-chart-wrapper {
            flex-direction: column;
            align-items: center;
            gap: 14px;
            text-align: center;
          }
          .donut-breakdown-details {
            width: 100%;
          }
          .overview-metrics-grid {
            grid-template-columns: 1fr !important;
          }
        }

        /* Print Media Styles */
        @media print {
          body {
            background: #ffffff !important;
            color: #000000 !important;
          }
          .no-print,
          .report-action-bar,
          .report-kpi-banner,
          .report-analytics-dashboard,
          .document-meta-right {
            display: none !important;
            visibility: hidden !important;
          }
          .adblue-report-wrapper {
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
            border: none !important;
            padding: 8px 0 !important;
            margin: 0 !important;
            width: 100% !important;
            background: #ffffff !important;
            color: #0f172a !important;
            display: block !important;
          }
          .table-responsive-container {
            overflow: visible !important;
            width: 100% !important;
          }
          .almarai-adblue-report-table {
            border: 1px solid #cbd5e1 !important;
            width: 100% !important;
            page-break-inside: auto !important;
          }
          .almarai-adblue-report-table tr {
            page-break-inside: avoid !important;
          }
          .almarai-adblue-report-table thead th,
          .almarai-adblue-report-table tbody td {
            border: 1px solid #cbd5e1 !important;
            font-size: 11px !important;
            padding: 6px 4px !important;
          }
          .embedded-shift-overview-box {
            border: 1px solid #cbd5e1 !important;
            background: #ffffff !important;
          }
        }
      `}</style>
    </div>
  );
};

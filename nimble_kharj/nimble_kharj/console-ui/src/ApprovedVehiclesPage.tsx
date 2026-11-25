import React, { useState, useMemo } from "react";

export interface ApprovedVehicle {
  id: string;
  vehicle_no: string;
  plate_no: string;
  category: "TRACTOR" | "REEFER" | "TANKER";
  sap_equipment_no: string;
  approval_status: "Verified & Whitelisted" | "Active Bay Priority" | "Routine Fleet";
  last_dispensed?: string;
}

export const INITIAL_APPROVED_VEHICLES: ApprovedVehicle[] = [
  {
    id: "AV-01",
    vehicle_no: "500497",
    plate_no: "8412 KHA",
    category: "TRACTOR",
    sap_equipment_no: "EQ-2023286",
    approval_status: "Verified & Whitelisted",
    last_dispensed: "14/09/2026 11:42",
  },
  {
    id: "AV-02",
    vehicle_no: "500948",
    plate_no: "3927 RSH",
    category: "TRACTOR",
    sap_equipment_no: "EQ-2023929",
    approval_status: "Active Bay Priority",
    last_dispensed: "14/09/2026 11:45",
  },
  {
    id: "AV-03",
    vehicle_no: "500952",
    plate_no: "6650 JDH",
    category: "TRACTOR",
    sap_equipment_no: "EQ-2023938",
    approval_status: "Verified & Whitelisted",
    last_dispensed: "14/09/2026 11:47",
  },
  {
    id: "AV-04",
    vehicle_no: "54113",
    plate_no: "1129 KHA",
    category: "REEFER",
    sap_equipment_no: "EQ-2024008",
    approval_status: "Verified & Whitelisted",
    last_dispensed: "14/09/2026 11:48",
  },
  {
    id: "AV-05",
    vehicle_no: "26386",
    plate_no: "4820 RSH",
    category: "REEFER",
    sap_equipment_no: "EQ-2025376",
    approval_status: "Routine Fleet",
    last_dispensed: "14/09/2026 11:49",
  },
  {
    id: "AV-06",
    vehicle_no: "500710",
    plate_no: "7714 JDH",
    category: "TRACTOR",
    sap_equipment_no: "EQ-2027864",
    approval_status: "Active Bay Priority",
    last_dispensed: "14/09/2026 11:50",
  },
  {
    id: "AV-07",
    vehicle_no: "500309",
    plate_no: "9021 KHA",
    category: "TRACTOR",
    sap_equipment_no: "EQ-2023049",
    approval_status: "Verified & Whitelisted",
    last_dispensed: "14/09/2026 11:54",
  },
  {
    id: "AV-08",
    vehicle_no: "54590",
    plate_no: "3310 RSH",
    category: "REEFER",
    sap_equipment_no: "EQ-2024649",
    approval_status: "Verified & Whitelisted",
    last_dispensed: "14/09/2026 11:54",
  },
  {
    id: "AV-09",
    vehicle_no: "500882",
    plate_no: "4418 JDH",
    category: "TRACTOR",
    sap_equipment_no: "EQ-2023882",
    approval_status: "Routine Fleet",
    last_dispensed: "14/09/2026 11:56",
  },
  {
    id: "AV-10",
    vehicle_no: "500612",
    plate_no: "8821 KHA",
    category: "TRACTOR",
    sap_equipment_no: "EQ-2023612",
    approval_status: "Verified & Whitelisted",
    last_dispensed: "14/09/2026 11:58",
  },
  {
    id: "AV-11",
    vehicle_no: "ALM-TRK-1041",
    plate_no: "8412 KHA",
    category: "TRACTOR",
    sap_equipment_no: "EQ-1041",
    approval_status: "Active Bay Priority",
    last_dispensed: "Today 08:00",
  },
  {
    id: "AV-12",
    vehicle_no: "ALM-TRK-1082",
    plate_no: "3927 RSH",
    category: "TRACTOR",
    sap_equipment_no: "EQ-1082",
    approval_status: "Verified & Whitelisted",
    last_dispensed: "Today 09:15",
  },
  {
    id: "AV-13",
    vehicle_no: "ALM-TRK-1119",
    plate_no: "6650 JDH",
    category: "TRACTOR",
    sap_equipment_no: "EQ-1119",
    approval_status: "Verified & Whitelisted",
    last_dispensed: "Today 07:00",
  },
  {
    id: "AV-14",
    vehicle_no: "ALM-TNK-201",
    plate_no: "5014 KHA",
    category: "TANKER",
    sap_equipment_no: "EQ-TNK201",
    approval_status: "Active Bay Priority",
    last_dispensed: "12/09/2026 10:20",
  },
  {
    id: "AV-15",
    vehicle_no: "ALM-TNK-202",
    plate_no: "5015 KHA",
    category: "TANKER",
    sap_equipment_no: "EQ-TNK202",
    approval_status: "Verified & Whitelisted",
    last_dispensed: "11/09/2026 15:45",
  },
  {
    id: "AV-16",
    vehicle_no: "54220",
    plate_no: "2190 RSH",
    category: "REEFER",
    sap_equipment_no: "EQ-2024220",
    approval_status: "Routine Fleet",
    last_dispensed: "14/09/2026 06:15",
  },
];

interface ApprovedVehiclesPageProps {
  onDispenseForVehicle?: (vehicle: ApprovedVehicle) => void;
  onViewWaybill?: (vehicleNo: string) => void;
}

export const ApprovedVehiclesPage: React.FC<ApprovedVehiclesPageProps> = () => {
  const [vehiclesList, setVehiclesList] = useState<ApprovedVehicle[]>(() => {
    const saved = localStorage.getItem("kharj_approved_vehicles_v3");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error reading saved approved vehicles", e);
      }
    }
    return INITIAL_APPROVED_VEHICLES;
  });

  const [categoryFilter, setCategoryFilter] = useState<"ALL" | "TRACTOR" | "REEFER" | "TANKER">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // New vehicle form state (vehicle, plate & category only)
  const [newVehicle, setNewVehicle] = useState({
    vehicle_no: "",
    plate_no: "",
    category: "TRACTOR" as "TRACTOR" | "REEFER" | "TANKER",
  });

  // Filtered vehicles
  const filteredVehicles = useMemo(() => {
    return vehiclesList.filter((v) => {
      if (categoryFilter !== "ALL" && v.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          v.vehicle_no.toLowerCase().includes(q) ||
          v.plate_no.toLowerCase().includes(q) ||
          v.sap_equipment_no.toLowerCase().includes(q) ||
          v.category.toLowerCase().includes(q) ||
          v.approval_status.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [vehiclesList, categoryFilter, searchQuery]);

  // Aggregate stats
  const totalVehicles = vehiclesList.length;
  const tractorCount = vehiclesList.filter((v) => v.category === "TRACTOR").length;
  const reeferCount = vehiclesList.filter((v) => v.category === "REEFER").length;
  const tankerCount = vehiclesList.filter((v) => v.category === "TANKER").length;

  const handleAddVehicleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVehicle.vehicle_no || !newVehicle.plate_no) {
      alert("Please fill in Vehicle Number and Plate Number");
      return;
    }

    const created: ApprovedVehicle = {
      id: "AV-" + (vehiclesList.length + 1).toString().padStart(2, "0"),
      vehicle_no: newVehicle.vehicle_no.trim().toUpperCase(),
      plate_no: newVehicle.plate_no.trim().toUpperCase(),
      category: newVehicle.category,
      sap_equipment_no: "EQ-" + newVehicle.vehicle_no.trim().toUpperCase(),
      approval_status: "Verified & Whitelisted",
      last_dispensed: "Just Registered",
    };

    const updated = [created, ...vehiclesList];
    setVehiclesList(updated);
    localStorage.setItem("kharj_approved_vehicles_v3", JSON.stringify(updated));
    setShowAddModal(false);
    setNewVehicle({
      vehicle_no: "",
      plate_no: "",
      category: "TRACTOR",
    });
  };

  return (
    <div className="approved-vehicles-page-wrapper animate-fade-in">
      {/* Top Banner & Context */}
      <div className="glass-panel appv-header-card no-print">
        <div className="appv-header-top">
          <div className="appv-title-block">
            <div className="appv-title-row">
              <span className="appv-badge-icon">🚚</span>
              <div>
                <h2>PRE-APPROVED FLEET DIRECTORY</h2>
                <p className="appv-subtitle">
                  Whitelisted Almarai fleet master reference data. Quick reference cards to verify approved vehicles, license plates, categories, and whitelist authorization status.
                </p>
              </div>
            </div>
          </div>

          <div className="appv-actions-row">
            <button
              className="btn-action auto-demo"
              onClick={() => setShowAddModal(true)}
              style={{ background: "#0d9488", borderColor: "#0f766e", color: "#fff", fontWeight: 700 }}
            >
              + Add Approved Vehicle
            </button>
          </div>
        </div>

        {/* Quick KPI Stat Chips */}
        <div className="appv-kpi-row">
          <div className="appv-kpi-chip">
            <span className="kpi-chip-label">TOTAL APPROVED FLEET</span>
            <span className="kpi-chip-num text-teal">{totalVehicles}</span>
            <span className="kpi-chip-sub">100% Whitelisted</span>
          </div>
          <div className="appv-kpi-chip">
            <span className="kpi-chip-label">TRACTORS</span>
            <span className="kpi-chip-num text-blue">{tractorCount}</span>
            <span className="kpi-chip-sub">Heavy Duty Long Haul</span>
          </div>
          <div className="appv-kpi-chip">
            <span className="kpi-chip-label">REEFERS</span>
            <span className="kpi-chip-num text-cyan">{reeferCount}</span>
            <span className="kpi-chip-sub">Cold Chain Logistics</span>
          </div>
          <div className="appv-kpi-chip">
            <span className="kpi-chip-label">DEPOT TANKERS</span>
            <span className="kpi-chip-num text-amber">{tankerCount}</span>
            <span className="kpi-chip-sub">Bulk Transfer Fleet</span>
          </div>
          <div className="appv-kpi-chip highlight">
            <span className="kpi-chip-label">SYSTEM STATUS</span>
            <span className="kpi-chip-num text-emerald">APPROVED</span>
            <span className="kpi-chip-sub">Master Fleet Whitelist</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass-panel appv-filter-bar no-print">
        <div className="appv-search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search by vehicle # (e.g. 500497) or plate # (8412 KHA)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="search-clear-btn" onClick={() => setSearchQuery("")}>
              ✕
            </button>
          )}
        </div>

        <div className="appv-category-pills">
          <button
            className={`category-pill ${categoryFilter === "ALL" ? "active" : ""}`}
            onClick={() => setCategoryFilter("ALL")}
          >
            All Fleet ({totalVehicles})
          </button>
          <button
            className={`category-pill ${categoryFilter === "TRACTOR" ? "active" : ""}`}
            onClick={() => setCategoryFilter("TRACTOR")}
          >
            🚜 Tractors ({tractorCount})
          </button>
          <button
            className={`category-pill ${categoryFilter === "REEFER" ? "active" : ""}`}
            onClick={() => setCategoryFilter("REEFER")}
          >
            ❄️ Reefers ({reeferCount})
          </button>
          <button
            className={`category-pill ${categoryFilter === "TANKER" ? "active" : ""}`}
            onClick={() => setCategoryFilter("TANKER")}
          >
            🚛 Tankers ({tankerCount})
          </button>
        </div>
      </div>

      {/* Main Section Header */}
      <div className="appv-section-header">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <h2 style={{ fontSize: "14.5px", fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-0.01em" }}>
            APPROVED VEHICLES DIRECTORY
          </h2>
          <span className="header-tag-pill emerald">
            {filteredVehicles.length} APPROVED
          </span>
        </div>
        <div style={{ fontSize: "12px", color: "var(--text-3)" }}>
          Almarai Approved Whitelist Fleet
        </div>
      </div>

      {/* Box-Wise Cards Grid */}
      <div className="appv-cards-grid">
        {filteredVehicles.length === 0 ? (
          <div className="appv-empty-box glass-panel">
            <span style={{ fontSize: "32px", display: "block", marginBottom: "8px" }}>🔍</span>
            <p style={{ margin: 0, fontWeight: 600, color: "var(--text-2)" }}>No approved vehicles found matching criteria.</p>
            <button
              className="category-pill"
              style={{ marginTop: "12px" }}
              onClick={() => {
                setCategoryFilter("ALL");
                setSearchQuery("");
              }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          filteredVehicles.map((v) => (
            <div key={v.id} className="appv-vehicle-box">
              {/* Box Top Header */}
              <div className="box-top-row">
                <div className="box-avatar-and-id">
                  <div className={`box-cat-avatar ${v.category.toLowerCase()}`}>
                    {v.category === "TRACTOR" ? "🚜" : v.category === "REEFER" ? "❄️" : "🚛"}
                  </div>
                  <div>
                    <div className="box-vehicle-title">{v.vehicle_no}</div>
                    <div className="box-sap-code">{v.sap_equipment_no}</div>
                  </div>
                </div>
                <div className="box-status-pill">
                  <span className="status-dot green" />
                  <span className="box-status-text">Approved</span>
                </div>
              </div>

              {/* Box Main Info Rows (No RFID, No DEF Tank, Pure Essential Details) */}
              <div className="box-details-list">
                <div className="box-info-item">
                  <span className="box-item-label">PLATE NUMBER</span>
                  <span className="box-plate-badge">{v.plate_no}</span>
                </div>

                <div className="box-info-item">
                  <span className="box-item-label">FLEET TYPE</span>
                  <span className={`cat-badge ${v.category.toLowerCase()}`}>
                    {v.category}
                  </span>
                </div>
              </div>

              {/* Box Footer Meta */}
              <div className="box-footer-row">
                <span className="box-footer-label">Whitelist Status</span>
                <span className="box-whitelist-tag">{v.approval_status}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal: Add New Approved Vehicle */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "460px" }}>
            <button className="modal-close-btn" onClick={() => setShowAddModal(false)}>
              &times;
            </button>
            <div className="panel-header">
              <h2>+ REGISTER APPROVED VEHICLE</h2>
              <span className="header-tag-pill cyan">WHITELIST ENTRY</span>
            </div>
            <div className="panel-body">
              <form onSubmit={handleAddVehicleSubmit}>
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "11.5px", fontWeight: 700, color: "#0F172A", marginBottom: "4px" }}>
                    Vehicle Asset # (e.g. 500999)*
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 500999"
                    value={newVehicle.vehicle_no}
                    onChange={(e) => setNewVehicle({ ...newVehicle, vehicle_no: e.target.value })}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: "7px", border: "1.5px solid #CBD5E1", fontSize: "13px" }}
                  />
                </div>

                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "11.5px", fontWeight: 700, color: "#0F172A", marginBottom: "4px" }}>
                    License Plate # (e.g. 9182 KHA)*
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 9182 KHA"
                    value={newVehicle.plate_no}
                    onChange={(e) => setNewVehicle({ ...newVehicle, plate_no: e.target.value })}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: "7px", border: "1.5px solid #CBD5E1", fontSize: "13px" }}
                  />
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "11.5px", fontWeight: 700, color: "#0F172A", marginBottom: "4px" }}>
                    Fleet Category*
                  </label>
                  <select
                    value={newVehicle.category}
                    onChange={(e) => setNewVehicle({ ...newVehicle, category: e.target.value as any })}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: "7px", border: "1.5px solid #CBD5E1", background: "#fff", fontSize: "13px" }}
                  >
                    <option value="TRACTOR">🚜 Tractor (Heavy Duty)</option>
                    <option value="REEFER">❄️ Reefer (Cold Chain)</option>
                    <option value="TANKER">🚛 Tanker (Bulk Transfer)</option>
                  </select>
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    className="btn-action"
                    onClick={() => setShowAddModal(false)}
                    style={{ flex: 1, justifyContent: "center" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-action auto-demo"
                    style={{ flex: 2, justifyContent: "center", background: "#0D9488", borderColor: "#0F766E", color: "#fff", fontWeight: 700 }}
                  >
                    ✓ Whitelist Vehicle
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Page Styling */}
      <style>{`
        .approved-vehicles-page-wrapper {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-bottom: 30px;
        }

        .appv-header-card {
          padding: 20px 24px;
          background: #ffffff !important;
          border-top: 3px solid #0d9488 !important;
          border-radius: 12px;
        }

        .appv-header-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 16px;
          margin-bottom: 18px;
        }

        .appv-title-row {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .appv-badge-icon {
          font-size: 30px;
          width: 52px;
          height: 52px;
          border-radius: 12px;
          background: #f0fdfa;
          border: 1px solid #ccfbf1;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .appv-title-block h2 {
          font-size: 17px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.01em;
          margin-bottom: 4px;
        }

        .appv-subtitle {
          font-size: 12.5px;
          color: #475569;
          max-width: 850px;
          line-height: 1.5;
        }

        /* KPI Row */
        .appv-kpi-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 12px;
          padding-top: 14px;
          border-top: 1px solid #f1f5f9;
        }

        .appv-kpi-chip {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .appv-kpi-chip.highlight {
          background: #f0fdfa;
          border-color: #99f6e4;
        }

        .kpi-chip-label {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.05em;
          color: #64748b;
          text-transform: uppercase;
        }

        .kpi-chip-num {
          font-size: 22px;
          font-weight: 800;
          font-family: var(--font-sans);
          line-height: 1.1;
        }

        .kpi-chip-sub {
          font-size: 10.5px;
          color: #64748b;
          font-weight: 600;
        }

        .text-teal { color: #0d9488; }
        .text-blue { color: #2563eb; }
        .text-cyan { color: #0284c7; }
        .text-amber { color: #d97706; }
        .text-emerald { color: #16a34a; }

        /* Filter Bar */
        .appv-filter-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 20px;
          flex-wrap: wrap;
          gap: 12px;
          background: #ffffff !important;
          border-radius: 10px;
        }

        .appv-search-box {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #f8fafc;
          border: 1.5px solid #cbd5e1;
          border-radius: 8px;
          padding: 6px 12px;
          flex: 1;
          max-width: 480px;
        }

        .appv-search-box:focus-within {
          border-color: #0d9488;
          background: #ffffff;
        }

        .appv-search-box input {
          background: transparent;
          border: none;
          outline: none;
          font-size: 12.5px;
          color: #0f172a;
          width: 100%;
        }

        .search-clear-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          font-weight: 700;
        }

        .appv-category-pills {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .category-pill {
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          color: #475569;
          font-size: 11.5px;
          font-weight: 700;
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .category-pill:hover {
          background: #e2e8f0;
          color: #0f172a;
        }

        .category-pill.active {
          background: #0d9488;
          color: #ffffff;
          border-color: #0d9488;
          box-shadow: 0 2px 6px rgba(13, 148, 136, 0.3);
        }

        .appv-section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          padding: 0 4px;
        }

        /* Box-Wise Cards Grid */
        .appv-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }

        .appv-empty-box {
          grid-column: 1 / -1;
          text-align: center;
          padding: 40px 20px;
          background: #ffffff !important;
          border-radius: 12px;
        }

        .appv-vehicle-box {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px 18px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          box-shadow: 0 1px 4px rgba(15, 23, 42, 0.04);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
        }

        .appv-vehicle-box:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
          border-color: #0d9488;
        }

        .box-top-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }

        .box-avatar-and-id {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .box-cat-avatar {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          flex-shrink: 0;
        }

        .box-cat-avatar.tractor {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
        }

        .box-cat-avatar.reefer {
          background: #f0fdfa;
          border: 1px solid #99f6e4;
        }

        .box-cat-avatar.tanker {
          background: #fffbeb;
          border: 1px solid #fde68a;
        }

        .box-vehicle-title {
          font-size: 16px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.01em;
          line-height: 1.2;
        }

        .box-sap-code {
          font-size: 11px;
          font-family: var(--font-mono);
          color: #64748b;
          font-weight: 600;
        }

        .box-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          padding: 3px 8px;
          border-radius: 6px;
        }

        .box-status-text {
          font-size: 11px;
          font-weight: 700;
          color: #15803d;
        }

        .status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }

        .status-dot.green {
          background: #16a34a;
          box-shadow: 0 0 6px rgba(22, 163, 74, 0.6);
        }

        .box-details-list {
          display: flex;
          flex-direction: column;
          gap: 9px;
          padding: 10px 12px;
          background: #f8fafc;
          border: 1px solid #f1f5f9;
          border-radius: 8px;
        }

        .box-info-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
        }

        .box-item-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.05em;
          color: #64748b;
          text-transform: uppercase;
        }

        .box-plate-badge {
          background: #ffffff;
          border: 1.5px solid #93c5fd;
          color: #1d4ed8;
          font-weight: 800;
          font-size: 12px;
          padding: 2px 8px;
          border-radius: 4px;
          letter-spacing: 0.03em;
        }

        .cat-badge {
          font-size: 10px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 4px;
          display: inline-block;
          letter-spacing: 0.04em;
        }

        .cat-badge.tractor {
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
        }

        .cat-badge.reefer {
          background: #f0fdfa;
          color: #0f766e;
          border: 1px solid #99f6e4;
        }

        .cat-badge.tanker {
          background: #fffbeb;
          color: #b45309;
          border: 1px solid #fde68a;
        }

        .box-footer-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 4px;
          border-top: 1px solid #f1f5f9;
          font-size: 11.5px;
        }

        .box-footer-label {
          color: #94a3b8;
          font-weight: 600;
          font-size: 10.5px;
        }

        .box-whitelist-tag {
          font-size: 11px;
          font-weight: 700;
          color: #0f766e;
        }

        /* Responsive */
        @media (max-width: 860px) {
          .appv-header-top {
            flex-direction: column;
            align-items: stretch;
          }
          .appv-filter-bar {
            flex-direction: column;
            align-items: stretch;
          }
          .appv-search-box {
            max-width: 100%;
          }
        }

        @media (max-width: 640px) {
          .appv-kpi-row {
            grid-template-columns: repeat(2, 1fr);
          }
          .appv-cards-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 440px) {
          .appv-kpi-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

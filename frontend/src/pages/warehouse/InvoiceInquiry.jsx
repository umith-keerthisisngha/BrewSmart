import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { WarehouseHeader, WarehouseFooter } from "../../components/warehouse/WarehouseHeader";
import "../../components/warehouse/WarehousePage.css";
import "./InvoiceInquiry.css";

const API = "http://localhost/BrewSmart/backend/api";

const TABS = [
  { key: "invoice", label: "Invoices", live: true },
  { key: "stock", label: "Stock", live: true },
  { key: "location", label: "Location", live: true },
  { key: "received", label: "Received" },
  { key: "issued", label: "Issued" },
  { key: "history", label: "History" },
];

const INVOICE_COLUMNS = [
  { key: "invoice_no", label: "Invoice No" },
  { key: "invoice_date", label: "Date" },
  { key: "mark", label: "Mark" },
  { key: "selling_mark", label: "Selling Mark" },
  { key: "grade", label: "Grade" },
  { key: "packing_type", label: "Packing" },
  { key: "broker", label: "Broker" },
  { key: "chests", label: "Chests" },
  { key: "net_weight_each", label: "Net/Chest kg" },
  { key: "total_net_weight", label: "Total Net kg" },
  { key: "allocated_locations", label: "Location(s)" },
  { key: "allocation_model", label: "Allocation" },
  { key: "allocation_score", label: "Score %" },
];

const STOCK_COLUMNS = [
  { key: "lot_number", label: "Lot Number" },
  { key: "tea_name", label: "Tea Type" },
  { key: "grade_code", label: "Grade" },
  { key: "total_bags", label: "Total Bags" },
  { key: "available_bags", label: "Available Bags" },
  { key: "allocated_bags", label: "Allocated Bags" },
  { key: "status", label: "Status" },
];

const LOCATION_COLUMNS = [
  { key: "location_code", label: "Location" },
  { key: "rack_code", label: "Rack" },
  { key: "status", label: "Status" },
  { key: "capacity_bags", label: "Capacity" },
  { key: "occupied_bags", label: "Occupied" },
  { key: "invoice_no", label: "Invoice" },
  { key: "invoice_grade", label: "Grade" },
  { key: "invoice_chests", label: "Invoice Chests" },
  { key: "lot_number", label: "Stock Lot" },
  { key: "bags_allocated", label: "Stock Bags" },
];

function InvoiceSearchPanel({ onResults }) {
  const [q, setQ] = useState("");
  const [year, setYear] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const runSearch = async () => {
    setBusy(true); setError("");
    try {
      const res = await axios.get(`${API}/invoices/list.php`, { params: { q, year }, withCredentials: true });
      if (res.data.success) onResults(res.data.data || []);
      else setError(res.data.message || "Search failed.");
    } catch (err) {
      setError(err.response?.data?.message || "Could not reach the server.");
    } finally { setBusy(false); }
  };

  return (
    <div className="wp-panel">
      <div className="wp-panel-header">Saved Invoice Inquiry</div>
      <div className="wp-panel-body">
        <div className="inq-grid-2">
          <label className="inq-field">
            <span>Invoice / Mark / Grade / Broker / Location</span>
            <input className="wp-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. INV-001, BOP, KEELLS, 03B24" onKeyDown={(e) => e.key === "Enter" && runSearch()} />
          </label>
          <label className="inq-field">
            <span>Invoice Year</span>
            <input className="wp-input" value={year} onChange={(e) => setYear(e.target.value)} placeholder="e.g. 2026" />
          </label>
        </div>
        {error && <p className="wp-hint" style={{ color: "#b91c1c", fontWeight: 700 }}>{error}</p>}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button className="wp-btn wp-btn-primary" onClick={runSearch} disabled={busy}>{busy ? "Searching..." : "Search Invoices"}</button>
          <button className="wp-btn wp-btn-outline" onClick={() => { setQ(""); setYear(""); }}>Clear</button>
        </div>
      </div>
    </div>
  );
}

function StockSearchPanel({ onResults }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const runSearch = async () => {
    setBusy(true); setError("");
    try {
      const res = await axios.get(`${API}/inventory/get.php`, { params: { q }, withCredentials: true });
      if (res.data.success) onResults(res.data.data || []); else setError(res.data.message || "Search failed.");
    } catch (err) { setError(err.response?.data?.message || "Could not reach the server."); }
    finally { setBusy(false); }
  };
  return (
    <div className="wp-panel">
      <div className="wp-panel-header">Stock Inquiry</div>
      <div className="wp-panel-body">
        <label className="inq-field"><span>Lot Number / Tea / Grade</span><input className="wp-input" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        {error && <p className="wp-hint" style={{ color: "#b91c1c", fontWeight: 700 }}>{error}</p>}
        <button className="wp-btn wp-btn-primary" style={{ marginTop: 14 }} onClick={runSearch} disabled={busy}>{busy ? "Searching..." : "Search Stock"}</button>
      </div>
    </div>
  );
}

function LocationSearchPanel({ onResults }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const runSearch = async () => {
    if (!q.trim()) { setError("Enter a location code, invoice or lot number."); return; }
    setBusy(true); setError("");
    try {
      const res = await axios.get(`${API}/location/search.php`, { params: { q }, withCredentials: true });
      if (res.data.success) onResults(res.data.data || []); else setError(res.data.message || "Search failed.");
    } catch (err) { setError(err.response?.data?.message || "Could not reach the server."); }
    finally { setBusy(false); }
  };
  return (
    <div className="wp-panel">
      <div className="wp-panel-header">Location Inquiry</div>
      <div className="wp-panel-body">
        <label className="inq-field"><span>Location / Invoice / Stock Lot</span><input className="wp-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. 01A01 or INV-001" /></label>
        {error && <p className="wp-hint" style={{ color: "#b91c1c", fontWeight: 700 }}>{error}</p>}
        <button className="wp-btn wp-btn-primary" style={{ marginTop: 14 }} onClick={runSearch} disabled={busy}>{busy ? "Searching..." : "Search Location"}</button>
      </div>
    </div>
  );
}

export default function InvoiceInquiry() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("invoice");
  const [rows, setRows] = useState([]);
  const [initialError, setInitialError] = useState("");

  useEffect(() => {
    axios.get(`${API}/auth/session-check.php`, { withCredentials: true })
      .then(async (res) => {
        if (!res.data.loggedIn) { navigate("/login"); return; }
        setDisplayName(res.data.display_name);
        try {
          const latest = await axios.get(`${API}/invoices/list.php`, { withCredentials: true });
          if (latest.data.success) setRows(latest.data.data || []);
        } catch (err) { setInitialError(err.response?.data?.message || "Could not load saved invoices."); }
      })
      .catch(() => navigate("/login"))
      .finally(() => setLoading(false));
  }, [navigate]);

  const switchTab = async (key) => {
    setActiveTab(key); setRows([]); setInitialError("");
    if (key === "invoice") {
      try {
        const res = await axios.get(`${API}/invoices/list.php`, { withCredentials: true });
        if (res.data.success) setRows(res.data.data || []);
      } catch (err) { setInitialError(err.response?.data?.message || "Could not load saved invoices."); }
    }
  };

  if (loading) return null;
  const activeTabDef = TABS.find((t) => t.key === activeTab);
  const columns = activeTab === "invoice" ? INVOICE_COLUMNS : activeTab === "location" ? LOCATION_COLUMNS : STOCK_COLUMNS;

  return (
    <div className="wp-page">
      <WarehouseHeader displayName={displayName} active="inquiry" />
      <div className="wp-content">
        <p className="wp-breadcrumb">Inquiry <span className="wp-crumb-current">/ Invoice Inquiry</span></p>

        {activeTab === "invoice" && <InvoiceSearchPanel onResults={setRows} />}
        {activeTab === "stock" && <StockSearchPanel onResults={setRows} />}
        {activeTab === "location" && <LocationSearchPanel onResults={setRows} />}
        {initialError && <p className="wp-hint" style={{ color: "#b91c1c", fontWeight: 700 }}>{initialError}</p>}

        <div className="wp-tabs" style={{ marginTop: 18 }}>
          {TABS.map((t) => (
            <div key={t.key} className={`wp-tab${activeTab === t.key ? " wp-tab-active" : ""}`} onClick={() => switchTab(t.key)}>
              {t.label}{t.live ? " ●" : ""}
            </div>
          ))}
        </div>

        <div className="wp-panel" style={{ borderRadius: "0 0 6px 6px" }}>
          <div className="wp-panel-header">{activeTabDef?.label} Details</div>
          <div className="wp-table-wrap">
            {activeTabDef?.live ? (
              <table className="wp-table">
                <thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={columns.length} className="wp-table-empty">No {activeTabDef.label.toLowerCase()} found.</td></tr>
                  ) : rows.map((r, i) => (
                    <tr key={r.invoice_id || r.location_id || r.inventory_id || i}>
                      {columns.map((c) => <td key={c.key}>{r[c.key] ?? ""}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="wp-table-empty" style={{ padding: 18 }}>"{activeTabDef?.label}" isn't wired to a backend endpoint yet.</p>}
          </div>
        </div>
      </div>
      <WarehouseFooter displayName={displayName} />
    </div>
  );
}

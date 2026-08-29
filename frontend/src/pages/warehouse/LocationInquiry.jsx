import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { WarehouseHeader, WarehouseFooter } from "../../components/warehouse/WarehouseHeader";
import usePermissions from "../../hooks/usePermissions";
import "./LocationInquiry.css";

const API = "http://localhost/BrewSmart/backend/api";
const LEVELS = ["F", "E", "D", "C", "B", "A"];
const POSITIONS = Array.from({ length: 60 }, (_, i) => i + 1);

const cellClass = (status) => {
  if (status === "FULL") return "loc-cell-full";
  if (status === "PARTIAL") return "loc-cell-partial";
  if (status === "BLOCKED") return "loc-cell-blocked";
  return "loc-cell-empty";
};

const getLevel = (loc) => {
  if (loc?.level_code) return String(loc.level_code).toUpperCase();
  const match = String(loc?.location_code || "").match(/\d{2}([A-F])\d{2}$/i);
  return match ? match[1].toUpperCase() : "";
};

const getPosition = (loc) => {
  if (loc?.position_number != null) return Number(loc.position_number);
  const match = String(loc?.location_code || "").match(/\d{2}[A-F](\d{2})$/i);
  if (match) return Number(match[1]);
  return Number(loc?.location_number || 0);
};

export default function LocationInquiry() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [displayName, setDisplayName] = useState("");
  const [sessionLoading, setSessionLoading] = useState(true);
  const [racks, setRacks] = useState([]);
  const [rackId, setRackId] = useState("");
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState(null);
  const [message, setMessage] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    axios.get(`${API}/auth/session-check.php`, { withCredentials: true })
      .then((res) => {
        if (!res.data.loggedIn) return navigate("/login");
        setDisplayName(res.data.display_name || "User");
      })
      .catch(() => navigate("/login"))
      .finally(() => setSessionLoading(false));
  }, [navigate]);

  useEffect(() => {
    if (sessionLoading) return;
    axios.get(`${API}/warehouse/racks.php`, { withCredentials: true })
      .then((res) => {
        const list = res.data.data || [];
        setRacks(list);
        if (list.length) setRackId(String(list[0].rack_id));
      })
      .catch((err) => setMessage({ type: "error", text: err.response?.data?.message || "Could not load racks." }));
  }, [sessionLoading]);

  const loadRack = useCallback(async (silent = false) => {
    if (!rackId) return;
    if (!silent) setLoading(true);
    try {
      const res = await axios.get(`${API}/warehouse/levels.php`, {
        params: { rack_id: rackId },
        withCredentials: true,
      });
      const rows = res.data.data || [];
      setLocations(rows);
      setLastUpdated(new Date());
      if (selected) {
        const updated = rows.find((r) => Number(r.location_id) === Number(selected.location_id));
        if (updated) setSelected(updated);
      }
    } catch (err) {
      if (!silent) setMessage({ type: "error", text: err.response?.data?.message || "Could not refresh warehouse locations." });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [rackId, selected]);

  useEffect(() => {
    if (!rackId) return;
    setSelected(null);
    setDetails(null);
    loadRack();
  }, [rackId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep Inquiry synchronized with invoice allocations and Gate Pass dispatches.
  useEffect(() => {
    if (!rackId) return undefined;
    const timer = setInterval(() => loadRack(true), 10000);
    return () => clearInterval(timer);
  }, [rackId, loadRack]);

  const matrix = useMemo(() => {
    const map = new Map();
    locations.forEach((loc) => map.set(`${getLevel(loc)}-${getPosition(loc)}`, loc));
    return map;
  }, [locations]);

  const selectLocation = async (loc) => {
    if (!loc) return;
    setSelected(loc);
    setDetails(null);
    setMessage(null);
    try {
      const res = await axios.get(`${API}/location/search.php`, {
        params: { q: loc.location_code },
        withCredentials: true,
      });
      const found = (res.data.data || []).find((r) => r.location_code === loc.location_code) || res.data.data?.[0] || null;
      setDetails(found);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Could not load location details." });
    }
  };

  const runSearch = async () => {
    const q = search.trim().toUpperCase();
    if (!q) return;
    setMessage(null);
    try {
      const res = await axios.get(`${API}/location/search.php`, { params: { q }, withCredentials: true });
      const row = (res.data.data || []).find((r) => r.location_code === q) || res.data.data?.[0];
      if (!row) {
        setMessage({ type: "error", text: `No location found for ${q}.` });
        return;
      }
      const rack = racks.find((r) => Number(r.rack_id) === Number(row.rack_id));
      if (rack && String(rack.rack_id) !== String(rackId)) setRackId(String(rack.rack_id));
      setSelected(row);
      setDetails(row);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Location search failed." });
    }
  };

  const changeStatus = async (status) => {
    if (!selected) return;
    setMessage(null);
    try {
      await axios.post(`${API}/warehouse/set-status.php`, { location_id: selected.location_id, status }, { withCredentials: true });
      setMessage({ type: "success", text: `${selected.location_code} updated to ${status}.` });
      await loadRack();
      if (status !== "BLOCKED") setDetails(null);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Location update failed." });
    }
  };

  const unallocate = async () => {
    if (!selected) return;
    if (!window.confirm(`Un-allocate all stock from ${selected.location_code}?`)) return;
    setMessage(null);
    try {
      await axios.post(`${API}/warehouse/unallocate.php`, { location_id: selected.location_id }, { withCredentials: true });
      setMessage({ type: "success", text: `${selected.location_code} stock un-allocated.` });
      setSelected(null);
      setDetails(null);
      await loadRack();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Could not un-allocate this location." });
    }
  };

  if (sessionLoading) return null;

  const current = details || selected;
  const remaining = current ? Math.max(0, Number(current.capacity_bags || 10) - Number(current.occupied_bags || 0)) : 0;

  return (
    <div className="li-page">
      <WarehouseHeader displayName={displayName} active="inquiry" />

      <main className="li-content">
        <div className="li-title-row">
          <div>
            <div className="li-kicker">INQUIRY / LOCATION</div>
            <h1>Location Inquiry</h1>
          </div>
          <div className="li-live">● LIVE {lastUpdated ? `· ${lastUpdated.toLocaleTimeString()}` : ""}</div>
        </div>

        <section className="li-toolbar-card">
          <div className="li-actions">
            {can("warehousing.chest_location") && (
              <>
                <button className="li-btn danger" onClick={unallocate} disabled={!selected || Number(selected.occupied_bags || 0) === 0}>Un-Allocate</button>
                <button className="li-btn success" onClick={() => changeStatus("EMPTY")} disabled={!selected || selected.status !== "BLOCKED"}>Un-Block</button>
                <button className="li-btn danger" onClick={() => changeStatus("BLOCKED")} disabled={!selected || selected.status === "BLOCKED" || Number(selected.occupied_bags || 0) > 0}>Block</button>
              </>
            )}
          </div>

          <div className="li-controls">
            <label>Warehouse</label>
            <input value="BrewSmart Warehouse" readOnly />
            <label>Rack No</label>
            <select value={rackId} onChange={(e) => setRackId(e.target.value)}>
              {racks.map((r) => <option key={r.rack_id} value={r.rack_id}>{r.rack_code || r.rack_name}</option>)}
            </select>
            <label>Location</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runSearch()} placeholder="e.g. 01A01" />
            <button className="li-btn primary" onClick={runSearch}>Search</button>
            <button className="li-btn secondary" onClick={() => loadRack()}>{loading ? "Refreshing..." : "Refresh"}</button>
          </div>
        </section>

        {message && <div className={`li-message ${message.type}`}>{message.text}</div>}

        <section className="li-grid-card">
          <div className="li-grid-head">
            <strong>Rack Location Map</strong>
            <span>{selected ? `Selected: ${selected.location_code}` : "Select a location to view details"}</span>
          </div>
          <div className="li-grid-scroll">
            <table className="li-grid-table">
              <thead>
                <tr>
                  <th className="level-col">LEVEL</th>
                  {POSITIONS.map((p) => <th key={p}>COL{p}</th>)}
                </tr>
              </thead>
              <tbody>
                {LEVELS.map((level) => (
                  <tr key={level}>
                    <th className="level-col">{level}</th>
                    {POSITIONS.map((pos) => {
                      const loc = matrix.get(`${level}-${pos}`);
                      return (
                        <td key={`${level}-${pos}`}>
                          {loc ? (
                            <button
                              type="button"
                              className={`li-cell ${cellClass(loc.status)} ${Number(selected?.location_id) === Number(loc.location_id) ? "selected" : ""}`}
                              title={`${loc.location_code} · ${loc.status} · ${loc.occupied_bags}/${loc.capacity_bags} bags`}
                              onClick={() => selectLocation(loc)}
                            >
                              {loc.location_code}
                            </button>
                          ) : <span className="li-missing">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="li-legend">
            <span className="loc-cell-empty">Available</span>
            <span className="loc-cell-partial">Partially Occupied</span>
            <span className="loc-cell-full">Full</span>
            <span className="loc-cell-blocked">Blocked</span>
            <span className="legend-selected">Currently Selected</span>
          </div>
        </section>

        <section className="li-detail-card">
          <div className="li-grid-head"><strong>Location Details</strong></div>
          {!current ? (
            <div className="li-empty-detail">Select a cell or search a location code.</div>
          ) : (
            <div className="li-detail-grid">
              <div><span>Location</span><strong>{current.location_code}</strong></div>
              <div><span>Rack</span><strong>{current.rack_code || "-"}</strong></div>
              <div><span>Level</span><strong>{getLevel(current) || "-"}</strong></div>
              <div><span>Position</span><strong>{String(getPosition(current) || "-").padStart(2, "0")}</strong></div>
              <div><span>Status</span><strong>{current.status}</strong></div>
              <div><span>Capacity</span><strong>{current.capacity_bags || 10} bags</strong></div>
              <div><span>Current Bags</span><strong>{current.occupied_bags || 0}</strong></div>
              <div><span>Remaining</span><strong>{remaining} bags</strong></div>
              <div><span>Current Weight</span><strong>{Number(current.current_weight || 0).toFixed(2)} kg</strong></div>
              <div><span>Invoices</span><strong>{current.invoice_no || "-"}</strong></div>
              <div><span>Grade</span><strong>{current.invoice_grade || "-"}</strong></div>
              <div><span>Allocated Invoice Bags</span><strong>{current.invoice_chests || 0}</strong></div>
            </div>
          )}
        </section>
      </main>

      <WarehouseFooter displayName={displayName} />
    </div>
  );
}

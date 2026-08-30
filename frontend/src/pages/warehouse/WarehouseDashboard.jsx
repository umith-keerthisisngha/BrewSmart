import { API_BASE as API } from "../../config/api";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { WarehouseHeader, WarehouseFooter } from "../../components/warehouse/WarehouseHeader";
import "../../components/warehouse/WarehouseHeader.css";
import "./WarehouseDashboard.css";

const fmt = (value, digits = 0) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: digits });

export default function WarehouseDashboard() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const [session, dashboard] = await Promise.all([
        axios.get(`${API}/auth/session-check.php`, { withCredentials: true }),
        axios.get(`${API}/dashboard/warehouse.php`, { withCredentials: true }),
      ]);
      if (!session.data.loggedIn) return navigate("/login");
      setDisplayName(session.data.display_name || "");
      setData(dashboard.data.data || null);
      setLastUpdated(new Date());
    } catch (err) {
      if (err.response?.status === 401) navigate("/login");
      else setError(err.response?.data?.message || "Could not load live warehouse dashboard data.");
    } finally { if (!quiet) setLoading(false); }
  }, [navigate]);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => load(true), 30000);
    return () => window.clearInterval(timer);
  }, [load]);

  const summary = data?.summary || {};
  const racks = data?.racks || [];
  const recent = data?.recent_movements || [];
  const maxRack = useMemo(() => Math.max(100, ...racks.map((r) => Number(r.utilization_pct || 0))), [racks]);

  if (loading) return null;

  return (
    <div className="wd-page">
      <WarehouseHeader displayName={displayName} active="dashboard" />
      <main className="wd-content">
        <div className="wd-titlebar">
          <div><span>WAREHOUSE DASHBOARD</span><h1>Live Stock & Capacity Control</h1><p>Automatically refreshes every 30 seconds from current database stock.</p></div>
          <div className="wd-refresh"><small>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Not updated"}</small><button onClick={() => load()}>Refresh</button></div>
        </div>

        {error && <div className="wd-error">{error}</div>}

        <section className="wd-kpi-grid">
          <article><span>CURRENT STOCK</span><strong>{fmt(summary.stock_bags)} <small>bags</small></strong><em>{fmt(summary.stock_weight,2)} kg</em></article>
          <article><span>WAREHOUSE UTILIZATION</span><strong>{fmt(summary.utilization_pct,1)}%</strong><em>{fmt(summary.stock_bags)} / {fmt(summary.capacity_bags)} bag spaces</em></article>
          <article><span>TODAY'S ARRIVALS</span><strong>{fmt(data?.today_arrivals?.bags)} <small>bags</small></strong><em>{fmt(data?.today_arrivals?.weight,2)} kg · {fmt(data?.today_arrivals?.invoices)} invoice(s)</em></article>
          <article><span>TODAY'S DELIVERIES</span><strong>{fmt(data?.today_deliveries?.bags)} <small>bags</small></strong><em>{fmt(data?.today_deliveries?.weight,2)} kg dispatched</em></article>
          <article><span>AVAILABLE LOCATIONS</span><strong>{fmt(summary.available_locations)}</strong><em>{fmt(summary.partial_locations)} partial · {fmt(summary.full_locations)} full</em></article>
          <article><span>ACTIVE STOCK LINES</span><strong>{fmt(data?.active_invoices)}</strong><em>Invoices with live location stock</em></article>
          <article><span>PENDING DISPATCH</span><strong>{fmt(data?.pending_dispatch?.bags)} <small>bags</small></strong><em>{fmt(data?.pending_dispatch?.gins)} pending GIN(s)</em></article>
          <article><span>BLOCKED LOCATIONS</span><strong>{fmt(summary.blocked_locations)}</strong><em>Excluded from allocation</em></article>
        </section>

        <section className="wd-grid-2">
          <article className="wd-panel">
            <div className="wd-panel-head"><div><span>RACK LOAD</span><h2>Rack Utilization</h2></div><small>Highest utilization first</small></div>
            <div className="wd-racks">
              {racks.map((rack) => <div className="wd-rack-row" key={rack.rack_code}><div><strong>{rack.rack_code}</strong><small>{fmt(rack.occupied_bags)} / {fmt(rack.capacity_bags)} bags</small></div><div className="wd-bar"><i style={{ width: `${Math.min(100, (Number(rack.utilization_pct || 0) / maxRack) * 100)}%` }}></i></div><b>{fmt(rack.utilization_pct,1)}%</b></div>)}
            </div>
          </article>

          <article className="wd-panel">
            <div className="wd-panel-head"><div><span>RECENT ACTIVITY</span><h2>Stock Movements</h2></div><small>Latest database movements</small></div>
            <div className="wd-movement-list">
              {!recent.length ? <p className="wd-empty">No stock movement history yet.</p> : recent.map((m, i) => <div className="wd-movement" key={`${m.created_at}-${i}`}><span className={`wd-move-type ${String(m.movement_type).toLowerCase()}`}>{m.movement_type}</span><div><strong>{m.invoice_no || m.reference_no || "Stock movement"}</strong><small>{m.location_code || "—"} · {fmt(m.quantity_bags)} bags · {fmt(m.weight,2)} kg</small></div><time>{new Date(m.created_at).toLocaleString()}</time></div>)}
            </div>
          </article>
        </section>
      </main>
      <WarehouseFooter displayName={displayName} />
    </div>
  );
}

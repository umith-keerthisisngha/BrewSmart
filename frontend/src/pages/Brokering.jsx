import { API_BASE as API } from "../config/api";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import usePermissions from "../hooks/usePermissions";
import brewSmartLogo from "../assets/brewsmart-logo.png";
import "./Brokering.css";


const MASTER_ITEMS = [
  { key: "master.access_manager", label: "Access Manager", path: "/master/access-manager", desc: "Assign functions to each user" },
  { key: "master.broker", label: "Broker Master", path: "/master/broker", desc: "Add and maintain tea brokers" },
  { key: "master.buyer", label: "Buyer Master", path: "/master/buyer", desc: "Maintain dispatch buyers" },
  { key: "master.auction_calendar", label: "Tea Auction Calendar", path: "/master/auction-calendar", desc: "Set upcoming auction dates" },
  { key: "master.mark", label: "Mark Master", path: "/master/mark", desc: "Maintain marks and selling marks" },
  { key: "master.grade", label: "Grade Master", path: "/master/grade", desc: "Maintain tea grades" },
  { key: "master.packing_type", label: "Packing Type", path: "/master/packing-type", desc: "Maintain packing standards" },
  { key: "master.user_account", label: "User Accounts", path: "/master/user-account", desc: "Create system users" },
];

const formatAuctionDate = (value) => value
  ? new Intl.DateTimeFormat(undefined, { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`))
  : "Not scheduled";

export default function Brokering() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [sessionLoading, setSessionLoading] = useState(true);
  const [masterOpen, setMasterOpen] = useState(false);
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState("");
  const { loading: permissionsLoading, can } = usePermissions();

  useEffect(() => {
    axios.get(`${API}/auth/session-check.php`, { withCredentials: true })
      .then((res) => res.data.loggedIn ? setDisplayName(res.data.display_name) : navigate("/login"))
      .catch(() => navigate("/login"))
      .finally(() => setSessionLoading(false));
  }, [navigate]);

  const loadSummary = async () => {
    setSummaryError("");
    try {
      const res = await axios.get(`${API}/dashboard/brokering.php`, { withCredentials: true });
      setSummary(res.data.data || null);
    } catch (err) {
      setSummary(null);
      setSummaryError(err.response?.data?.message || "Brokering summary could not be loaded.");
    }
  };

  useEffect(() => { loadSummary(); }, []);

  const allowedMasterItems = useMemo(() => MASTER_ITEMS.filter((item) => can(item.key)), [can]);

  const handleLogout = async () => {
    await axios.post(`${API}/auth/logout.php`, {}, { withCredentials: true });
    navigate("/login");
  };

  if (sessionLoading || permissionsLoading) return null;

  const next = summary?.next_auction;
  const stat = summary?.stats || {};
  const recentBrokers = summary?.recent_brokers || [];
  const recentBuyers = summary?.recent_buyers || [];
  const upcomingAuctions = summary?.upcoming_auctions || [];

  return (
    <div className="br-page">
      <header className="br-navbar">
        <button className="br-brand" type="button" onClick={() => navigate("/dashboard")}>
          <img className="br-logo-image" src={brewSmartLogo} alt="BrewSmart" />
        </button>
        <div className="br-navbar-right">
          <div className="br-user-info"><span className="br-logged-label">Logged in as</span><span className="br-user-name">{displayName}</span></div>
          <button className="br-logout-button" onClick={handleLogout}>LOGOUT</button>
        </div>
      </header>

      <nav className="br-nav-links">
        {allowedMasterItems.length > 0 && (
          <div className="br-master-dropdown" onMouseEnter={() => setMasterOpen(true)} onMouseLeave={() => setMasterOpen(false)}>
            <span className="br-master-trigger">MASTER</span>
            {masterOpen && <div className="br-dropdown-menu">{allowedMasterItems.map((item) => <div key={item.key} className="br-dropdown-item" onClick={() => navigate(item.path)}>{item.label}</div>)}</div>}
          </div>
        )}
        {can("brokering.home") && <span className="active" onClick={() => navigate("/brokering")}>HOME</span>}
      </nav>

      <main className="br-content">
        <div className="br-content-inner">
          <div className="br-hero-row">
            <div>
              <span className="br-eyebrow">BROKERING OPERATIONS</span>
              <h1>Tea brokering control centre</h1>
              <p>Manage brokers, buyers, marks, grades, packing standards, users and the tea auction calendar from one connected workspace.</p>
              <div className="br-hero-actions">
                {can("master.broker") && <button onClick={() => navigate("/master/broker")}>+ Add Broker</button>}
                {can("master.buyer") && <button onClick={() => navigate("/master/buyer")}>+ Add Buyer</button>}
                {can("master.auction_calendar") && <button onClick={() => navigate("/master/auction-calendar")}>Auction Calendar</button>}
              </div>
            </div>
            <div className="br-auction-card">
              <span>NEXT TEA AUCTION</span>
              <strong>{formatAuctionDate(next?.auction_date)}</strong>
              <small>{next ? `${next.sale_no || "Scheduled auction"}${Number(next.days_remaining) === 0 ? " · Today" : ` · ${next.days_remaining} day(s) remaining`}` : "No upcoming auction has been scheduled."}</small>
              {!next && can("master.auction_calendar") && <button className="br-inline-action" onClick={() => navigate("/master/auction-calendar")}>Set auction date</button>}
            </div>
          </div>

          {summaryError && <div className="br-summary-error">{summaryError} <button onClick={loadSummary}>Retry</button></div>}

          <section className="br-stat-grid">
            <article><span>ACTIVE BROKERS</span><strong>{stat.active_brokers ?? 0}</strong><small>Configured broker records</small></article>
            <article><span>REGISTERED BUYERS</span><strong>{stat.active_buyers ?? 0}</strong><small>Available for GIN / dispatch</small></article>
            <article><span>ACTIVE MARKS</span><strong>{stat.active_marks ?? 0}</strong><small>Available during arrival entry</small></article>
            <article><span>UPCOMING AUCTIONS</span><strong>{stat.upcoming_auctions ?? 0}</strong><small>Scheduled from today onward</small></article>
          </section>

          <section className="br-operations-panel">
            <div className="br-panel-head"><div><span>MASTER OPERATIONS</span><h2>Functions available to your account</h2></div><small>{allowedMasterItems.length} function(s)</small></div>
            <div className="br-quick-grid">
              {allowedMasterItems.length ? allowedMasterItems.map((item) => (
                <button key={item.path} type="button" onClick={() => navigate(item.path)}>
                  <strong>{item.label}</strong><small>{item.desc}</small><span>Open function →</span>
                </button>
              )) : <p className="br-no-actions">No Brokering Master functions are assigned to this account.</p>}
            </div>
          </section>

          <section className="br-live-grid">
            <article className="br-live-panel">
              <div className="br-panel-head"><div><span>BROKERS</span><h2>Recently configured</h2></div>{can("master.broker") && <button onClick={() => navigate("/master/broker")}>Manage</button>}</div>
              {!recentBrokers.length ? <p className="br-empty">No broker records yet.</p> : recentBrokers.map((row) => <div className="br-live-row" key={row.broker_id}><strong>{row.broker_code}</strong><span>{row.broker_name}</span></div>)}
            </article>
            <article className="br-live-panel">
              <div className="br-panel-head"><div><span>BUYERS</span><h2>Recently configured</h2></div>{can("master.buyer") && <button onClick={() => navigate("/master/buyer")}>Manage</button>}</div>
              {!recentBuyers.length ? <p className="br-empty">No buyer records yet.</p> : recentBuyers.map((row) => <div className="br-live-row" key={row.buyer_id}><strong>{row.buyer_code}</strong><span>{row.buyer_name}</span></div>)}
            </article>
            <article className="br-live-panel">
              <div className="br-panel-head"><div><span>AUCTIONS</span><h2>Upcoming schedule</h2></div>{can("master.auction_calendar") && <button onClick={() => navigate("/master/auction-calendar")}>Manage</button>}</div>
              {!upcomingAuctions.length ? <p className="br-empty">No upcoming auctions.</p> : upcomingAuctions.map((row) => <div className="br-live-row" key={row.auction_id}><strong>{row.sale_no || "Auction"}</strong><span>{formatAuctionDate(row.auction_date)}</span></div>)}
            </article>
          </section>
        </div>
      </main>

      <footer className="br-footer"><div className="br-footer-title">BrewSmart Tea Warehouse Management System</div><p className="br-copyright">Copyright © 2026 · Secure operational workspace</p></footer>
    </div>
  );
}

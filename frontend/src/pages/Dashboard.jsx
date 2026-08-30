import { API_BASE as API } from "../config/api";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import usePermissions from "../hooks/usePermissions";
import brewSmartLogo from "../assets/brewsmart-logo.png";
import "./Dashboard.css";


const getGreeting = (date = new Date()) => {
  const hour = date.getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  if (hour < 21) return "Good Evening";
  return "Good Night";
};

const formatClock = (date) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

const ModuleIcon = ({ type }) => {
  if (type === "brokering") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M8 20.5 17.5 11l8 6.5L33 12l7 7-12.5 13.5a5 5 0 0 1-7.2.1L8 20.5Z" />
        <path d="m15 27 5 5m0-10 7 7m-3-12 8 8" />
      </svg>
    );
  }
  if (type === "warehouse-dashboard") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <rect x="7" y="8" width="34" height="32" rx="6" />
        <path d="M14 31V24m10 7V17m10 14v-9" />
        <path d="M12 36h24" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M6 19 24 8l18 11v21H6V19Z" />
      <path d="M14 40V25h20v15M10 19h28" />
      <path d="M20 31h8" />
    </svg>
  );
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [sessionLoading, setSessionLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const { loading: permissionsLoading, permissions, can } = usePermissions();

  useEffect(() => {
    axios
      .get(`${API}/auth/session-check.php`, { withCredentials: true })
      .then((res) => {
        if (res.data.loggedIn) setDisplayName(res.data.display_name);
        else navigate("/login");
      })
      .catch(() => navigate("/login"))
      .finally(() => setSessionLoading(false));
  }, [navigate]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const firstAllowedRoute = (prefix, fallback) => {
    if (can(`${prefix}.home`)) return fallback;
    const found = permissions.find(
      (p) => p.permission_key?.startsWith(`${prefix}.`) && p.has_access && p.route_path
    );
    return found?.route_path || null;
  };

  const brokeringRoute = useMemo(() => {
    const home = firstAllowedRoute("brokering", "/brokering");
    if (home) return home;
    const master = permissions.find(
      (p) => p.permission_key?.startsWith("master.") && p.has_access && p.route_path
    );
    return master?.route_path || null;
  }, [permissions, can]);

  const warehousingRoute = useMemo(
    () => firstAllowedRoute("warehousing", "/warehousing"),
    [permissions, can]
  );

  const warehouseDashboardRoute = can("warehousing.dashboard")
    ? "/warehousing/dashboard"
    : null;

  const handleLogout = async () => {
    await axios.post(`${API}/auth/logout.php`, {}, { withCredentials: true });
    navigate("/login");
  };

  if (sessionLoading || permissionsLoading) return null;

  const modules = [
    brokeringRoute && {
      key: "brokering",
      label: "BROKERING",
      iconType: "brokering",
      route: brokeringRoute,
    },
    warehousingRoute && {
      key: "warehousing",
      label: "WAREHOUSING",
      iconType: "warehousing",
      route: warehousingRoute,
    },
    warehouseDashboardRoute && {
      key: "warehouse-dashboard",
      label: "WAREHOUSE DASHBOARD",
      iconType: "warehouse-dashboard",
      route: warehouseDashboardRoute,
    },
  ].filter(Boolean);

  return (
    <div className="dashboard-page">
      <div className="dashboard-container">
        <img
          className="dashboard-logo-image"
          src={brewSmartLogo}
          alt="BrewSmart"
        />

        <div className="dashboard-welcome-block">
          <span className="dashboard-eyebrow">BREWSMART OPERATIONS PORTAL</span>
          <h1 className="greeting">{getGreeting(now)},</h1>
          <h2 className="username">{displayName || "User"}</h2>
          <p className="dashboard-clock">{formatClock(now)}</p>
        </div>

        <div className="dashboard-actions">
          <span className="dashboard-status"><i></i> System ready</span>
          <button className="logout-button" onClick={handleLogout}>LOGOUT</button>
        </div>

        <div className="dashboard-cards">
          {modules.map((module) => (
            <button
              type="button"
              key={module.key}
              className="dashboard-card"
              onClick={() => navigate(module.route)}
            >
              <span className="card-icon"><ModuleIcon type={module.iconType} /></span>
              <span className="card-copy">
                <strong>{module.label}</strong>
              </span>
              <span className="card-arrow">→</span>
            </button>
          ))}
        </div>

        {!modules.length && (
          <p className="dashboard-empty">
            No application functions are assigned to this account. Contact an Administrator or Manager.
          </p>
        )}
      </div>

      <div className="dashboard-footer">
        <span>BrewSmart Tea Warehouse Management System</span>
        <span className="footer-divider">•</span>
        <span className="footer-green">Smart Warehouse. Stronger Future.</span>
      </div>
    </div>
  );
}

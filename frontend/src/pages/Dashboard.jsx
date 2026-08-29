import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import usePermissions from "../hooks/usePermissions";
import "./Dashboard.css";

const API = "http://localhost/BrewSmart/backend/api";

export default function Dashboard() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [sessionLoading, setSessionLoading] = useState(true);
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

  const handleLogout = async () => {
    await axios.post(`${API}/auth/logout.php`, {}, { withCredentials: true });
    navigate("/login");
  };

  if (sessionLoading || permissionsLoading) return null;

  return (
    <div className="dashboard-page">
      <div className="dashboard-overlay"></div>

      <div className="dashboard-container">
        <div className="brand">
          <div className="leaf-logo">
            <svg viewBox="0 0 64 64">
              <path d="M49 8C29 10 15 20 15 36c0 9 6 16 15 16 16 0 25-16 19-44Z" />
              <path d="M14 54C25 42 33 32 47 20" />
            </svg>
          </div>
          <h1>Brew<span>Smart</span></h1>
        </div>

        <h2 className="greeting">Good Morning!</h2>
        <h3 className="username">{displayName},</h3>
        <p className="welcome">Welcome to <span>BrewSmart</span></p>
        <div className="divider-icon">🍃</div>

        <button className="logout-button" onClick={handleLogout}>⏻ LOGOUT</button>

        <div className="dashboard-cards">
          {brokeringRoute && (
            <div className="dashboard-card" onClick={() => navigate(brokeringRoute)}>
              <div className="card-icon">⚖️</div>
              <p>BROKERING</p>
            </div>
          )}

          {warehousingRoute && (
            <div className="dashboard-card" onClick={() => navigate(warehousingRoute)}>
              <div className="card-icon">🗄️</div>
              <p>WAREHOUSING</p>
            </div>
          )}
        </div>

        {!brokeringRoute && !warehousingRoute && (
          <p style={{ marginTop: 16, color: "#eee", fontWeight: 600 }}>
            No application functions are assigned to this user. Contact an Administrator or Manager.
          </p>
        )}
      </div>

      <div className="dashboard-footer">
        <span className="footer-icon">🍃</span>
        <span>BrewSmart Tea Warehouse Management System</span>
        <span className="footer-divider">|</span>
        <span className="footer-green">Empowering Efficiency, Ensuring Quality</span>
      </div>
    </div>
  );
}

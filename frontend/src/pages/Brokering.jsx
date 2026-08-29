import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import usePermissions from "../hooks/usePermissions";
import "./Brokering.css";

const API = "http://localhost/BrewSmart/backend/api";

const MASTER_ITEMS = [
  { key: "master.access_manager", label: "Access Manager", path: "/master/access-manager" },
  { key: "master.mark", label: "Mark", path: "/master/mark" },
  { key: "master.grade", label: "Grade", path: "/master/grade" },
  { key: "master.packing_type", label: "Packing Type", path: "/master/packing-type" },
  { key: "master.user_account", label: "User Account", path: "/master/user-account" },
];

export default function Brokering() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [sessionLoading, setSessionLoading] = useState(true);
  const [masterOpen, setMasterOpen] = useState(false);
  const { loading: permissionsLoading, can } = usePermissions();

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

  const allowedMasterItems = useMemo(
    () => MASTER_ITEMS.filter((item) => can(item.key)),
    [can]
  );

  const handleLogout = async () => {
    await axios.post(`${API}/auth/logout.php`, {}, { withCredentials: true });
    navigate("/login");
  };

  if (sessionLoading || permissionsLoading) return null;

  return (
    <div className="br-page">
      <header className="br-navbar">
        <div className="br-brand">
          <div className="br-leaf-logo">
            <svg viewBox="0 0 64 64">
              <path d="M49 8C29 10 15 20 15 36c0 9 6 16 15 16 16 0 25-16 19-44Z" />
              <path d="M14 54C25 42 33 32 47 20" />
            </svg>
          </div>
          <span className="br-brand-text">Brew<span>Smart</span></span>
        </div>

        <div className="br-navbar-right">
          <div className="br-user-info">
            <span className="br-logged-label">Logged in as</span>
            <span className="br-user-name">{displayName}</span>
          </div>
          <button className="br-logout-button" onClick={handleLogout}>⏻ LOGOUT</button>
        </div>
      </header>

      <nav className="br-nav-links">
        {allowedMasterItems.length > 0 && (
          <div
            className="br-master-dropdown"
            onMouseEnter={() => setMasterOpen(true)}
            onMouseLeave={() => setMasterOpen(false)}
          >
            <span className="br-master-trigger">MASTER</span>
            {masterOpen && (
              <div className="br-dropdown-menu">
                {allowedMasterItems.map((item) => (
                  <div
                    key={item.key}
                    className="br-dropdown-item"
                    onClick={() => navigate(item.path)}
                  >
                    {item.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {can("brokering.home") && (
          <span className="active" onClick={() => navigate("/brokering")}>HOME</span>
        )}
      </nav>

      <div className="br-content">
        <div className="br-overlay"></div>
        <div className="br-content-inner">
          <div className="br-cards-row">
            <div className="br-card">
              <div className="br-card-icon">⚖️</div>
              <div>
                <h3>Tea Brokering</h3>
                <p>Only the functions assigned to your user account are displayed in BrewSmart.</p>
              </div>
            </div>

            <div className="br-card">
              <div className="br-card-icon">🔐</div>
              <div>
                <h3>User Based Access</h3>
                <p className="br-subtext">
                  Administrators and Managers can control access per user from Master → Access Manager.
                </p>
              </div>
            </div>
          </div>

          <div className="br-about">
            <h4>ABOUT BREWSMART</h4>
            <p>
              BrewSmart provides controlled tea brokering and warehouse workflows with database-driven master data and user-specific access.
            </p>
          </div>
        </div>
      </div>

      <footer className="br-footer">
        <div className="br-footer-title">
          <span className="br-footer-icon">🍃</span>
          <span>BrewSmart Tea Warehouse Management System</span>
        </div>
        <p className="br-copyright">Copyright © 2026 {displayName} All Rights Reserved.</p>
        <p className="br-legal">User Agreement, Privacy and Cookies.</p>
      </footer>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./Warehousing.css";

export default function Warehousing() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get("http://localhost/BrewSmart/backend/api/auth/session-check.php", {
        withCredentials: true,
      })
      .then((res) => {
        if (res.data.loggedIn) {
          setDisplayName(res.data.display_name);
        } else {
          navigate("/login");
        }
      })
      .catch(() => navigate("/login"))
      .finally(() => setLoading(false));
  }, [navigate]);

  const handleLogout = async () => {
    await axios.post(
      "http://localhost/BrewSmart/backend/api/auth/logout.php",
      {},
      { withCredentials: true }
    );
    navigate("/login");
  };

  if (loading) return null;

  return (
    <div className="wh-page">
      {/* Top Navbar */}
      <header className="wh-navbar">
        <div className="wh-brand">
          <div className="wh-leaf-logo">
            <svg viewBox="0 0 64 64">
              <path d="M49 8C29 10 15 20 15 36c0 9 6 16 15 16 16 0 25-16 19-44Z" />
              <path d="M14 54C25 42 33 32 47 20" />
            </svg>
          </div>
          <span className="wh-brand-text">
            Brew<span>Smart</span>
          </span>
        </div>

        <div className="wh-navbar-right">
          <div className="wh-user-info">
            <span className="wh-logged-label">Logged in as</span>
            <span className="wh-user-name">{displayName}</span>
          </div>
          <button className="wh-logout-button" onClick={handleLogout}>
            ⏻ LOGOUT
          </button>
        </div>
      </header>

      {/* Nav Links */}
      <nav className="wh-nav-links">
        <span onClick={() => navigate("/warehousing/bin-operation")}>
          BIN OPERATION
        </span>
        <span onClick={() => navigate("/warehousing/reports")}>REPORTS</span>
        <span onClick={() => navigate("/warehousing/inquiry")}>INQUIRY</span>
        <span onClick={() => navigate("/warehousing/master")}>MASTER</span>
        <span className="active">HOME</span>
      </nav>

      {/* Background photo section */}
      <div className="wh-content">
        <div className="wh-overlay"></div>

        <div className="wh-content-inner">
          {/* Info Cards */}
          <div className="wh-cards-row">
            <div className="wh-card">
              <div className="wh-card-icon">♻️</div>
              <div>
                <h3>Eco Friendly Application</h3>
                <p>
                  We leverage digital solutions to minimize paper waste in
                  tea warehouse administration and streamline eco-conscious
                  workflows.
                </p>
              </div>
            </div>

            <div className="wh-card">
              <div className="wh-card-icon">📅</div>
              <div>
                <h3>Next Tea Auction</h3>
                <p className="wh-na">N/A</p>
                <p className="wh-subtext">
                  Currently no upcoming scheduled auctions
                </p>
              </div>
            </div>
          </div>

          {/* About Section */}
          <div className="wh-about">
            <h4>ABOUT BREWSMART</h4>
            <p>
              About BrewSmart — The Special Project Division of who excels
              in providing unique and creative Business and Web Based
              solutions in working towards the plural vision of hSenid Biz.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="wh-footer">
        <div className="wh-footer-title">
          <span className="wh-footer-icon">🍃</span>
          <span>BrewSmart Tea Warehouse Management System</span>
        </div>
        <p className="wh-copyright">
          Copyright © 2026 {displayName} All Rights Reserved.
        </p>
        <p className="wh-legal">User Agreement, Privacy and Cookies.</p>
      </footer>
    </div>
  );
}
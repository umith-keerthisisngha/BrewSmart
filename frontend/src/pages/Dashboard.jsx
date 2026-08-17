import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./Dashboard.css";

export default function Dashboard() {
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
    <div className="dashboard-page">
      <div className="dashboard-overlay"></div>

      <div className="dashboard-container">
        {/* Brand */}
        <div className="brand">
          <div className="leaf-logo">
            <svg viewBox="0 0 64 64">
              <path d="M49 8C29 10 15 20 15 36c0 9 6 16 15 16 16 0 25-16 19-44Z" />
              <path d="M14 54C25 42 33 32 47 20" />
            </svg>
          </div>
          <h1>
            Brew<span>Smart</span>
          </h1>
        </div>

        {/* Greeting */}
        <h2 className="greeting">Good Morning!</h2>
        <h3 className="username">{displayName},</h3>
        <p className="welcome">
          Welcome to <span>BrewSmart</span>
        </p>

        <div className="divider-icon">🍃</div>

        <button className="logout-button" onClick={handleLogout}>
          ⏻ LOGOUT
        </button>

        {/* Cards */}
        <div className="dashboard-cards">
          <div
            className="dashboard-card"
            onClick={() => navigate("/brokering")}
          >
            <div className="card-icon">⚖️</div>
            <p>BROKERING</p>
          </div>

          <div
            className="dashboard-card"
            onClick={() => navigate("/warehousing")}
          >
            <div className="card-icon">🗄️</div>
            <p>WAREHOUSING</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="dashboard-footer">
        <span className="footer-icon">🍃</span>
        <span>BrewSmart Tea Warehouse Management System</span>
        <span className="footer-divider">|</span>
        <span className="footer-green">
          Empowering Efficiency, Ensuring Quality
        </span>
      </div>
    </div>
  );
}
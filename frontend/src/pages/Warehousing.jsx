import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { WarehouseHeader, WarehouseFooter } from "../components/warehouse/WarehouseHeader";
import "../components/warehouse/WarehouseHeader.css";
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

  if (loading) return null;

  return (
    <div className="wh-page">
      <WarehouseHeader displayName={displayName} active="home" />

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

      <WarehouseFooter displayName={displayName} />
    </div>
  );
}
import { API_BASE as API } from "../config/api";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import usePermissions from "../hooks/usePermissions";
import { WarehouseHeader, WarehouseFooter } from "../components/warehouse/WarehouseHeader";
import "../components/warehouse/WarehouseHeader.css";
import "./Warehousing.css";


const formatAuctionDate = (value) => value
  ? new Intl.DateTimeFormat(undefined, { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date(`${value}T00:00:00`))
  : "Not scheduled";

export default function Warehousing() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [nextAuction, setNextAuction] = useState(null);
  const { loading: permissionsLoading, can } = usePermissions();

  useEffect(() => {
    axios.get(`${API}/auth/session-check.php`, { withCredentials: true })
      .then((res) => res.data.loggedIn ? setDisplayName(res.data.display_name) : navigate("/login"))
      .catch(() => navigate("/login"))
      .finally(() => setLoading(false));
    axios.get(`${API}/auction/next.php`, { withCredentials: true })
      .then((res) => setNextAuction(res.data.data || null))
      .catch(() => setNextAuction(null));
  }, [navigate]);

  if (loading || permissionsLoading) return null;

  const actions = [
    can("warehousing.invoice_add") && { label: "New Arrival", desc: "Create a turn and invoice lines", route: "/warehousing/bin-operation/invoice-entry/add" },
    can("warehousing.grn_add_edit") && { label: "GRN Receiving", desc: "Load a turn and create GRN", route: "/warehousing/bin-operation/grn/add-edit" },
    can("warehousing.location_inquiry") && { label: "Location Inquiry", desc: "Inspect live rack locations", route: "/warehousing/inquiry/location" },
  ].filter(Boolean);

  return (
    <div className="wh-page">
      <WarehouseHeader displayName={displayName} active="home" />
      <main className="wh-content">
        <div className="wh-content-inner">
          <div className="wh-home-hero">
            <div>
              <span className="wh-home-kicker">WAREHOUSE OPERATIONS</span>
              <h1>BrewSmart Warehouse</h1>
              <p>Operational workspace for receiving, storage, location control, dispatch and warehouse reporting.</p>
            </div>
            <div className="wh-auction-live">
              <span>NEXT TEA AUCTION</span>
              <strong>{formatAuctionDate(nextAuction?.auction_date)}</strong>
              <small>{nextAuction ? `${nextAuction.sale_no || "Scheduled"} · ${nextAuction.days_remaining} day(s) remaining` : "Set the date from Brokering → Master → Tea Auction Calendar"}</small>
            </div>
          </div>

          <section className="wh-home-actions">
            {actions.map((action) => (
              <button key={action.route} type="button" onClick={() => navigate(action.route)}>
                <strong>{action.label}</strong><span>{action.desc}</span><i>→</i>
              </button>
            ))}
          </section>

          <section className="wh-about wh-home-about">
            <span className="wh-home-kicker">OPERATING PRINCIPLE</span>
            <h2>One connected warehouse flow</h2>
            <p>Arrival entry, AI-assisted safe location allocation, GRN receiving, live location stock, Gate Pass dispatch and inquiry history are connected through the BrewSmart database.</p>
          </section>
        </div>
      </main>
      <WarehouseFooter displayName={displayName} />
    </div>
  );
}

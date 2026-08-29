import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { WarehouseHeader, WarehouseFooter } from "./WarehouseHeader";
import "./WarehousePage.css";

export function Field({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#444a44" }}>{label}</span>
      {children}
    </label>
  );
}

export function FieldGrid({ children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      {children}
    </div>
  );
}

export default function FormShell({ crumb, title, active = "bin-operation", children }) {
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
    <div className="wp-page">
      <WarehouseHeader displayName={displayName} active={active} />

      <div className="wp-content">
        <p className="wp-breadcrumb">
          {crumb} <span className="wp-crumb-current">/ {title}</span>
        </p>

        <div className="wp-panel">
          <div className="wp-panel-header">
            <span>{title}</span>
          </div>
          <div className="wp-panel-body">{children}</div>
        </div>
      </div>

      <WarehouseFooter displayName={displayName} />
    </div>
  );
}

import { API_BASE as API } from "../../config/api";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { WarehouseHeader, WarehouseFooter } from "../../components/warehouse/WarehouseHeader";
import "../../components/warehouse/WarehousePage.css";


const STATUS_CLASS = {
  EMPTY: "wp-cell-empty",
  PARTIAL: "wp-cell-catalogued",
  FULL: "wp-cell-sold",
  BLOCKED: "wp-cell-inactive",
};

const LEGEND = [
  { label: "Empty", cls: "wp-cell-empty" },
  { label: "Partially Filled", cls: "wp-cell-catalogued" },
  { label: "Full", cls: "wp-cell-sold" },
  { label: "Blocked", cls: "wp-cell-inactive" },
];

export default function ChestLocationDetails() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);

  const [racks, setRacks] = useState([]);
  const [rackId, setRackId] = useState(null);
  const [locations, setLocations] = useState([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [actionMsg, setActionMsg] = useState(null);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    axios
      .get(`${API}/auth/session-check.php`, { withCredentials: true })
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

  useEffect(() => {
    if (loading) return;
    axios
      .get(`${API}/warehouse/racks.php`, { withCredentials: true })
      .then((res) => {
        if (res.data.success) {
          setRacks(res.data.data);
          if (res.data.data.length) setRackId(res.data.data[0].rack_id);
        }
      })
      .catch(() => {});
  }, [loading]);

  const loadLocations = useCallback(() => {
    if (!rackId) return;
    setLocationsLoading(true);
    axios
      .get(`${API}/warehouse/levels.php`, {
        params: { rack_id: rackId },
        withCredentials: true,
      })
      .then((res) => {
        if (res.data.success) setLocations(res.data.data);
      })
      .catch(() => {})
      .finally(() => setLocationsLoading(false));
  }, [rackId]);

  useEffect(() => {
    setSelected(null);
    setActionMsg(null);
    loadLocations();
  }, [loadLocations]);

  const setStatus = async (status) => {
    if (!selected) return;
    setActing(true);
    setActionMsg(null);
    try {
      const res = await axios.post(
        `${API}/warehouse/set-status.php`,
        { location_id: selected.location_id, status },
        { withCredentials: true }
      );
      if (res.data.success) {
        setActionMsg({ type: "success", text: `${selected.location_code} set to ${status}.` });
        loadLocations();
        setSelected(null);
      } else {
        setActionMsg({ type: "error", text: res.data.message || "Update failed." });
      }
    } catch (err) {
      setActionMsg({
        type: "error",
        text: err.response?.data?.message || "Could not reach the server.",
      });
    } finally {
      setActing(false);
    }
  };

  const unallocate = async () => {
    if (!selected) return;
    setActing(true);
    setActionMsg(null);
    try {
      const res = await axios.post(
        `${API}/warehouse/unallocate.php`,
        { location_id: selected.location_id },
        { withCredentials: true }
      );
      if (res.data.success) {
        setActionMsg({ type: "success", text: `${selected.location_code} released — stock returned to inventory.` });
        loadLocations();
        setSelected(null);
      } else {
        setActionMsg({ type: "error", text: res.data.message || "Could not release this location." });
      }
    } catch (err) {
      setActionMsg({
        type: "error",
        text: err.response?.data?.message || "Could not reach the server.",
      });
    } finally {
      setActing(false);
    }
  };

  if (loading) return null;

  return (
    <div className="wp-page">
      <WarehouseHeader displayName={displayName} active="bin-operation" />

      <div className="wp-content">
        <p className="wp-breadcrumb">
          Bin Operation / GRN <span className="wp-crumb-current">/ Chest Location Details</span>
        </p>

        <div className="wp-panel">
          <div className="wp-panel-header">
            <span>Chest Location Details</span>
          </div>

          <div className="wp-panel-body">
            <div className="wp-grid-toolbar">
              <button
                className="wp-btn wp-btn-danger"
                disabled={!selected || acting || !selected.occupied_bags}
                onClick={unallocate}
              >
                Un-Allocate
              </button>

              <button
                className="wp-btn wp-btn-danger"
                disabled={!selected || acting || selected.status !== "BLOCKED"}
                onClick={() => setStatus("EMPTY")}
              >
                Un-Block
              </button>

              <span className="wp-field-label" style={{ minWidth: "auto" }}>
                Rack No
              </span>
              <select
                className="wp-select"
                style={{ maxWidth: 140 }}
                value={rackId ?? ""}
                onChange={(e) => setRackId(Number(e.target.value))}
              >
                {racks.map((r) => (
                  <option key={r.rack_id} value={r.rack_id}>
                    {r.rack_code}
                  </option>
                ))}
              </select>

              <button
                className="wp-btn wp-btn-danger"
                disabled={!selected || acting || selected.status === "BLOCKED" || selected.occupied_bags > 0}
                onClick={() => setStatus("BLOCKED")}
              >
                Block
              </button>

              {selected && (
                <span className="wp-hint" style={{ marginTop: 0 }}>
                  Selected: <strong>{selected.location_code}</strong> — {selected.status} (
                  {selected.occupied_bags}/{selected.capacity_bags} bags)
                </span>
              )}
            </div>

            {actionMsg && (
              <p
                className="wp-hint"
                style={{ color: actionMsg.type === "error" ? "#b91c1c" : "#1a7a3c", fontWeight: 600 }}
              >
                {actionMsg.text}
              </p>
            )}

            {locationsLoading ? (
              <p className="wp-hint">Loading locations…</p>
            ) : (
              <div className="wp-rack-grid-wrap">
                <table className="wp-rack-grid">
                  <thead>
                    <tr>
                      <th>LEVEL</th>
                      <th>LOCATION</th>
                      <th>STATUS</th>
                      <th>OCCUPIED / CAPACITY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {locations.map((loc) => (
                      <tr key={loc.location_id}>
                        <td className="wp-level-label">L{loc.location_number}</td>
                        <td>
                          <div
                            className={
                              "wp-rack-cell " +
                              (STATUS_CLASS[loc.status] || "wp-cell-empty") +
                              (selected?.location_id === loc.location_id ? " wp-cell-selected" : "")
                            }
                            style={{
                              display: "inline-block",
                              cursor: "pointer",
                              ...(selected?.location_id === loc.location_id
                                ? { outline: "2px solid #232823", outlineOffset: "-2px" }
                                : {}),
                            }}
                            onClick={() => setSelected(loc)}
                            title={loc.location_code}
                          >
                            {loc.location_code}
                          </div>
                        </td>
                        <td>{loc.status}</td>
                        <td>
                          {loc.occupied_bags} / {loc.capacity_bags}
                        </td>
                      </tr>
                    ))}
                    {!locations.length && (
                      <tr>
                        <td colSpan={4} className="wp-table-empty">
                          No locations found for this rack.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="wp-legend">
              {LEGEND.map((item) => (
                <div key={item.label} className={"wp-legend-chip " + item.cls}>
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <WarehouseFooter displayName={displayName} />
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { WarehouseHeader, WarehouseFooter } from "../../components/warehouse/WarehouseHeader";
import "../../components/warehouse/WarehousePage.css";
import "./AIOptimization.css";

const API = "http://localhost/BrewSmart/backend/api";

function ScoreBar({ label, value }) {
  return (
    <div className="ai-score-row">
      <span className="ai-score-label">{label}</span>
      <div className="ai-score-track">
        <div className="ai-score-fill" style={{ width: `${value}%` }} />
      </div>
      <span className="ai-score-value">{value}%</span>
    </div>
  );
}

export default function AIOptimization() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);

  const [lots, setLots] = useState([]);
  const [lotsLoading, setLotsLoading] = useState(false);
  const [inventoryId, setInventoryId] = useState("");
  const [bags, setBags] = useState("");

  const [recommendations, setRecommendations] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);

  const [allocatingId, setAllocatingId] = useState(null);
  const [allocMsg, setAllocMsg] = useState(null);

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

  const loadLots = () => {
    setLotsLoading(true);
    axios
      .get(`${API}/inventory/get.php`, { withCredentials: true })
      .then((res) => {
        if (res.data.success) {
          const withStock = res.data.data.filter((l) => l.available_bags > 0);
          setLots(withStock);
          if (withStock.length && !inventoryId) {
            setInventoryId(String(withStock[0].inventory_id));
            setBags(String(Math.min(withStock[0].available_bags, 10)));
          }
        }
      })
      .catch(() => {})
      .finally(() => setLotsLoading(false));
  };

  useEffect(() => {
    if (!loading) loadLots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const selectedLot = lots.find((l) => String(l.inventory_id) === String(inventoryId));

  const runRecommendation = async () => {
    setError(null);
    setAllocMsg(null);
    setRecommendations(null);

    if (!inventoryId) {
      setError("Choose a tea lot first.");
      return;
    }
    const bagsNum = Number(bags);
    if (!bagsNum || bagsNum <= 0) {
      setError("Enter a valid number of bags.");
      return;
    }
    if (selectedLot && bagsNum > selectedLot.available_bags) {
      setError(`Only ${selectedLot.available_bags} bags are available on this lot.`);
      return;
    }

    setFetching(true);
    try {
      const res = await axios.get(`${API}/ai/predict.php`, {
        params: { inventory_id: inventoryId, bags: bagsNum },
        withCredentials: true,
      });
      if (res.data.success) {
        setRecommendations(res.data.data);
        if (!res.data.data.length) {
          setError(res.data.message || "No suitable locations found.");
        }
      } else {
        setError(res.data.message || "Could not generate recommendations.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Could not reach the server.");
    } finally {
      setFetching(false);
    }
  };

  const allocateHere = async (locationId) => {
    setAllocatingId(locationId);
    setAllocMsg(null);
    try {
      const res = await axios.post(
        `${API}/allocation/allocate.php`,
        {
          inventory_id: Number(inventoryId),
          location_id: locationId,
          bags_allocated: Number(bags),
          allocation_type: "AI",
        },
        { withCredentials: true }
      );
      if (res.data.success) {
        setAllocMsg({ type: "success", text: "Allocated successfully." });
        setRecommendations(null);
        loadLots();
      } else {
        setAllocMsg({ type: "error", text: res.data.message || "Allocation failed." });
      }
    } catch (err) {
      setAllocMsg({
        type: "error",
        text: err.response?.data?.message || "Could not reach the server.",
      });
    } finally {
      setAllocatingId(null);
    }
  };

  if (loading) return null;

  return (
    <div className="wp-page">
      <WarehouseHeader displayName={displayName} active="ai" />

      <div className="wp-content">
        <p className="wp-breadcrumb">
          Warehousing <span className="wp-crumb-current">/ AI Location Allocation</span>
        </p>

        <div className="wp-panel">
          <div className="wp-panel-header">
            <span className="wp-icon">🤖</span>
            <span>AI Location Allocation</span>
          </div>
          <div className="wp-panel-body">
            <p className="wp-hint" style={{ marginTop: 0 }}>
              Ranks every location with enough free space using a weighted score: best fit
              (40%), consolidation with existing same tea/grade stock (35%), and rack load
              balancing (25%). This is a transparent rule-based scoring engine, not a trained
              ML model — every score comes with a plain-English reason.
            </p>

            <div className="ai-form-row">
              <label className="inq-field" style={{ minWidth: 260 }}>
                <span>Tea Lot</span>
                <select
                  className="wp-select"
                  value={inventoryId}
                  onChange={(e) => {
                    setInventoryId(e.target.value);
                    setRecommendations(null);
                    setAllocMsg(null);
                  }}
                  disabled={lotsLoading}
                >
                  {lots.length === 0 && <option value="">No lots with available stock</option>}
                  {lots.map((l) => (
                    <option key={l.inventory_id} value={l.inventory_id}>
                      {l.lot_number} — {l.tea_name} {l.grade_code} ({l.available_bags} bags available)
                    </option>
                  ))}
                </select>
              </label>

              <label className="inq-field" style={{ maxWidth: 160 }}>
                <span>Bags to place</span>
                <input
                  className="wp-input"
                  type="number"
                  min="1"
                  value={bags}
                  onChange={(e) => setBags(e.target.value)}
                />
              </label>

              <button
                className="wp-btn wp-btn-primary"
                onClick={runRecommendation}
                disabled={fetching || !lots.length}
                style={{ alignSelf: "flex-end" }}
              >
                {fetching ? "Thinking..." : "Get AI Recommendations"}
              </button>
            </div>

            {error && (
              <p className="wp-hint" style={{ color: "#b91c1c", fontWeight: 600 }}>
                {error}
              </p>
            )}
            {allocMsg && (
              <p
                className="wp-hint"
                style={{ color: allocMsg.type === "error" ? "#b91c1c" : "#1a7a3c", fontWeight: 600 }}
              >
                {allocMsg.text}
              </p>
            )}

            {recommendations && recommendations.length > 0 && (
              <div className="ai-results">
                {recommendations.map((r, i) => (
                  <div key={r.location_id} className={"ai-card" + (i === 0 ? " ai-card-best" : "")}>
                    <div className="ai-card-head">
                      <div>
                        {i === 0 && <span className="ai-badge">TOP PICK</span>}
                        <span className="ai-card-loc">{r.location_code}</span>
                        <span className="ai-card-rack"> · {r.rack_name}</span>
                      </div>
                      <div className="ai-card-score">{r.score}<span>/100</span></div>
                    </div>

                    <p className="ai-card-reason">{r.reason}</p>

                    <div className="ai-score-breakdown">
                      <ScoreBar label="Fit" value={r.fit_score} />
                      <ScoreBar label="Consolidation" value={r.consolidation_score} />
                      <ScoreBar label="Rack balance" value={r.balance_score} />
                    </div>

                    <div className="ai-card-meta">
                      <span>{r.occupied_bags}/{r.capacity_bags} bags used</span>
                      <span>{r.available_capacity} bags free</span>
                      <span>Rack {r.rack_utilization_pct}% full</span>
                    </div>

                    <button
                      className="wp-btn wp-btn-primary"
                      style={{ marginTop: 12 }}
                      disabled={allocatingId === r.location_id}
                      onClick={() => allocateHere(r.location_id)}
                    >
                      {allocatingId === r.location_id ? "Allocating..." : `Allocate ${bags} bags here`}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <WarehouseFooter displayName={displayName} />
    </div>
  );
}

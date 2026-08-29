import { WarehouseHeader, WarehouseFooter } from "../../components/warehouse/WarehouseHeader";
import "../../components/warehouse/WarehousePage.css";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API = "http://localhost/BrewSmart/backend/api";

// Entities backed by a real backend table today.
const LIVE_ENTITIES = {
  Rack: {
    fetch: () => axios.get(`${API}/warehouse/racks.php`, { withCredentials: true }),
    pick: (res) => res.data.data,
    columns: [
      { key: "rack_code", label: "Rack Code" },
      { key: "rack_name", label: "Name" },
      { key: "status", label: "Status" },
      { key: "location_count", label: "Locations" },
      { key: "occupied_bags", label: "Occupied Bags" },
    ],
  },
  Grade: {
    fetch: () => axios.get(`${API}/meta.php`, { withCredentials: true }),
    pick: (res) => res.data.data.grades,
    columns: [
      { key: "grade_code", label: "Code" },
      { key: "grade_name", label: "Name" },
    ],
    add: {
      codeLabel: "Grade Code",
      nameLabel: "Grade Name",
      create: (code, name) =>
        axios.post(`${API}/master/grade-create.php`, { grade_code: code, grade_name: name }, { withCredentials: true }),
    },
  },
  Mark: {
    fetch: () => axios.get(`${API}/master/marks-list.php`, { withCredentials: true }),
    pick: (res) => res.data.data,
    columns: [
      { key: "mark_code", label: "Code" },
      { key: "mark_name", label: "Name" },
    ],
    add: {
      codeLabel: "Mark Code",
      nameLabel: "Mark Name",
      create: (code, name) =>
        axios.post(`${API}/master/marks-create.php`, { mark_code: code, mark_name: name }, { withCredentials: true }),
    },
  },
  "Packing Type": {
    fetch: () => axios.get(`${API}/master/packing-list.php`, { withCredentials: true }),
    pick: (res) => res.data.data,
    columns: [
      { key: "packing_code", label: "Code" },
      { key: "packing_name", label: "Name" },
    ],
    add: {
      codeLabel: "Packing Code",
      nameLabel: "Packing Name",
      create: (code, name) =>
        axios.post(`${API}/master/packing-create.php`, { packing_code: code, packing_name: name }, { withCredentials: true }),
    },
  },
  "Tea Type": {
    fetch: () => axios.get(`${API}/meta.php`, { withCredentials: true }),
    pick: (res) => res.data.data.tea_types,
    columns: [
      { key: "tea_code", label: "Code" },
      { key: "tea_name", label: "Name" },
      { key: "description", label: "Description" },
    ],
  },
  Supplier: {
    fetch: () => axios.get(`${API}/meta.php`, { withCredentials: true }),
    pick: (res) => res.data.data.suppliers,
    columns: [
      { key: "supplier_code", label: "Code" },
      { key: "supplier_name", label: "Name" },
      { key: "status", label: "Status" },
    ],
  },
};

const OTHER_ENTITIES = [
  "Store",
  "Broker",
  "Buyer",
  "Owner",
  "Category",
  "User Account",
  "User Group",
];

const MASTER_ENTITIES = [...Object.keys(LIVE_ENTITIES), ...OTHER_ENTITIES];

export default function WarehouseMaster() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [rows, setRows] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState(null);

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

  const openEntity = async (name) => {
    setSelected(name);
    setError(null);
    setRows([]);
    setNewCode("");
    setNewName("");
    setAddError(null);

    const live = LIVE_ENTITIES[name];
    if (!live) {
      setError(`"${name}" doesn't have a backend table yet — add one to master data before this card can go live.`);
      return;
    }

    setFetching(true);
    try {
      const res = await live.fetch();
      if (res.data.success !== false) {
        setRows(live.pick(res));
      } else {
        setError(res.data.message || "Failed to load.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Could not reach the server.");
    } finally {
      setFetching(false);
    }
  };

  const handleAddNew = async () => {
    const live = LIVE_ENTITIES[selected];
    if (!live?.add) return;
    if (!newCode.trim()) {
      setAddError(`${live.add.codeLabel} is required.`);
      return;
    }
    setAddSaving(true);
    setAddError(null);
    try {
      await live.add.create(newCode.trim(), newName.trim() || newCode.trim());
      setNewCode("");
      setNewName("");
      await openEntity(selected);
    } catch (err) {
      setAddError(err.response?.data?.message || "Could not add this item.");
    } finally {
      setAddSaving(false);
    }
  };

  if (loading) return null;

  const columns = selected ? LIVE_ENTITIES[selected]?.columns : null;

  return (
    <div className="wp-page">
      <WarehouseHeader displayName={displayName} active="master" />

      <div className="wp-content">
        <p className="wp-breadcrumb">
          Master <span className="wp-crumb-current">/ Master Data</span>
        </p>

        <div className="wp-panel">
          <div className="wp-panel-header">Master Data</div>
          <div className="wp-panel-body">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                gap: 12,
              }}
            >
              {MASTER_ENTITIES.map((name) => (
                <div
                  key={name}
                  className="wp-panel"
                  style={{
                    margin: 0,
                    cursor: "pointer",
                    outline: selected === name ? "2px solid #2f7a3e" : "none",
                  }}
                  onClick={() => openEntity(name)}
                >
                  <div className="wp-panel-body" style={{ textAlign: "center", fontWeight: 700, fontSize: 13 }}>
                    {name}
                    {LIVE_ENTITIES[name] ? " ●" : ""}
                  </div>
                </div>
              ))}
            </div>

            {selected && (
              <div style={{ marginTop: 18 }}>
                <h4 style={{ margin: "0 0 10px" }}>{selected}</h4>

                {fetching && <p className="wp-hint">Loading…</p>}

                {error && (
                  <p className="wp-hint" style={{ color: "#b91c1c", fontWeight: 600 }}>
                    {error}
                  </p>
                )}

                {!fetching && columns && (
                  <div className="wp-table-wrap">
                    <table className="wp-table">
                      <thead>
                        <tr>
                          {columns.map((c) => (
                            <th key={c.key}>{c.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.length === 0 ? (
                          <tr>
                            <td colSpan={columns.length} className="wp-table-empty">
                              No {selected.toLowerCase()} records found.
                            </td>
                          </tr>
                        ) : (
                          rows.map((r, i) => (
                            <tr key={i}>
                              {columns.map((c) => (
                                <td key={c.key}>{r[c.key] ?? ""}</td>
                              ))}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {!fetching && LIVE_ENTITIES[selected]?.add && (
                  <div
                    style={{
                      marginTop: 14,
                      border: "1px dashed #6baa2e",
                      borderRadius: 6,
                      padding: 12,
                      background: "#f7fbf4",
                      maxWidth: 420,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                      Add New {selected}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <input
                        className="wp-input"
                        placeholder={LIVE_ENTITIES[selected].add.codeLabel}
                        value={newCode}
                        onChange={(e) => setNewCode(e.target.value)}
                        style={{ flex: "1 1 140px" }}
                      />
                      <input
                        className="wp-input"
                        placeholder={`${LIVE_ENTITIES[selected].add.nameLabel} (optional)`}
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        style={{ flex: "1 1 180px" }}
                      />
                      <button
                        className="wp-btn wp-btn-primary"
                        onClick={handleAddNew}
                        disabled={addSaving}
                        style={{ flex: "0 0 auto" }}
                      >
                        {addSaving ? "Saving..." : "Add"}
                      </button>
                    </div>
                    {addError && (
                      <p className="wp-hint" style={{ color: "#b91c1c", fontWeight: 600, marginBottom: 0 }}>
                        {addError}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <p className="wp-hint">
              Entities marked ● are live. The rest need a database table and backend endpoint
              before they can show real records.
            </p>
          </div>
        </div>
      </div>

      <WarehouseFooter displayName={displayName} />
    </div>
  );
}

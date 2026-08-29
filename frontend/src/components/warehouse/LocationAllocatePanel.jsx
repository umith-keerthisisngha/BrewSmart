import { useEffect, useState } from "react";
import axios from "axios";

const API = "http://localhost/BrewSmart/backend/api";

/**
 * Inline "Location Allocate" picker. Lets the user browse/search warehouse
 * locations and pick one to attach to the invoice being entered/edited.
 * Purely a picker — persisting the choice is up to the parent (either as
 * part of the invoice payload on Save, or immediately via the
 * invoice_location_allocate endpoint when editing an already-saved invoice).
 */
export default function LocationAllocatePanel({ selected, onSelect, onClose }) {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    axios
      .get(`${API}/warehouse/locations.php`, { withCredentials: true })
      .then((res) => setLocations(res.data.data || []))
      .catch((err) => setError(err.response?.data?.message || "Could not load locations."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = locations.filter((l) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      l.location_code?.toLowerCase().includes(q) ||
      l.rack_code?.toLowerCase().includes(q) ||
      l.rack_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div
      style={{
        border: "1px solid #c7cdc7",
        borderRadius: 6,
        marginTop: 10,
        background: "#fbfcfb",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 14px",
          background: "#f4f6f4",
          borderBottom: "1px solid #dfe3df",
        }}
      >
        <strong style={{ fontSize: 13 }}>Location Allocate — choose a storage location</strong>
        <button
          type="button"
          onClick={onClose}
          style={{ border: "none", background: "none", cursor: "pointer", fontSize: 14, color: "#6a7370" }}
        >
          ✕
        </button>
      </div>

      <div style={{ padding: 12 }}>
        <input
          className="wp-input"
          placeholder="Search by location or rack code..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ marginBottom: 10 }}
        />

        {loading && <p className="wp-hint">Loading locations…</p>}
        {error && <p className="wp-hint" style={{ color: "#b91c1c", fontWeight: 600 }}>{error}</p>}

        {!loading && !error && (
          <div className="wp-table-wrap" style={{ maxHeight: 260, overflowY: "auto" }}>
            <table className="wp-table">
              <thead>
                <tr>
                  <th>Location</th>
                  <th>Rack</th>
                  <th>Capacity</th>
                  <th>Occupied</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="wp-table-empty">
                      No locations match your search.
                    </td>
                  </tr>
                ) : (
                  filtered.map((l) => {
                    const isSelected = selected?.location_id === l.location_id;
                    const disabled = l.status === "BLOCKED" || l.status === "FULL";
                    return (
                      <tr
                        key={l.location_id}
                        style={{
                          background: isSelected ? "#eaf5e2" : undefined,
                          opacity: disabled && !isSelected ? 0.55 : 1,
                        }}
                      >
                        <td>{l.location_code}</td>
                        <td>{l.rack_code}</td>
                        <td>{l.capacity_bags}</td>
                        <td>{l.occupied_bags}</td>
                        <td>{l.status}</td>
                        <td>
                          <button
                            type="button"
                            className="wp-btn wp-btn-outline"
                            style={{ padding: "4px 10px", fontSize: 11 }}
                            disabled={disabled}
                            onClick={() =>
                              onSelect({ location_id: l.location_id, location_code: l.location_code })
                            }
                          >
                            {isSelected ? "Selected" : "Select"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

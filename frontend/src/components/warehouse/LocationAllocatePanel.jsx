import { API_BASE as API } from "../../config/api";
import { useEffect, useState } from "react";
import axios from "axios";


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
    <div className="wp-location-picker">
      <div className="wp-location-picker-head">
        <strong>Location Allocate — choose a storage location</strong>
        <button type="button" onClick={onClose} className="wp-location-picker-close">✕</button>
      </div>

      <div className="wp-location-picker-body">
        <input
          className="wp-input wp-location-picker-search"
          placeholder="Search by location or rack code..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {loading && <p className="wp-hint">Loading locations…</p>}
        {error && <p className="wp-hint wp-text-error">{error}</p>}

        {!loading && !error && (
          <div className="wp-table-wrap wp-location-picker-table">
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
                    <td colSpan={6} className="wp-table-empty">No locations match your search.</td>
                  </tr>
                ) : (
                  filtered.map((l) => {
                    const isSelected = selected?.location_id === l.location_id;
                    const disabled = l.status === "BLOCKED" || l.status === "FULL";
                    return (
                      <tr
                        key={l.location_id}
                        className={`${isSelected ? "wp-row-selected" : ""} ${disabled && !isSelected ? "wp-row-disabled" : ""}`}
                      >
                        <td>{l.location_code}</td>
                        <td>{l.rack_code}</td>
                        <td>{l.capacity_bags}</td>
                        <td>{l.occupied_bags}</td>
                        <td>{l.status}</td>
                        <td>
                          <button
                            type="button"
                            className="wp-btn wp-btn-outline wp-btn-compact"
                            disabled={disabled}
                            onClick={() => onSelect({ location_id: l.location_id, location_code: l.location_code })}
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

import { useState } from "react";
import axios from "axios";
import FormShell, { Field, FieldGrid } from "../../../components/warehouse/FormShell";

const API = "http://localhost/BrewSmart/backend/api";

export default function GRNPrint() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [grnNo, setGrnNo] = useState("");
  const [rows, setRows] = useState(null);
  const [checked, setChecked] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const params = {};
      if (date) params.date = date;
      if (grnNo.trim()) params.grn_no = grnNo.trim();
      const res = await axios.get(`${API}/grn/list.php`, { params, withCredentials: true });
      setRows(res.data.data || []);
      setChecked({});
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Could not reach the server." });
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleAll = (value) => {
    if (!rows) return;
    const next = {};
    if (value) rows.forEach((r) => (next[r.grn_id] = true));
    setChecked(next);
  };

  const selectedRows = rows ? rows.filter((r) => checked[r.grn_id]) : [];

  return (
    <FormShell crumb="Bin Operation / GRN" title="GRN Print / Unloading List">
      <FieldGrid>
        <Field label="Date">
          <input className="wp-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="GRN No">
          <input className="wp-input" value={grnNo} onChange={(e) => setGrnNo(e.target.value)} />
        </Field>
      </FieldGrid>

      <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="wp-btn wp-btn-primary" onClick={load} disabled={loading}>
          {loading ? "Loading..." : "Load"}
        </button>
        <button className="wp-btn wp-btn-outline" onClick={() => toggleAll(true)} disabled={!rows?.length}>
          Select All
        </button>
        <button className="wp-btn wp-btn-outline" onClick={() => toggleAll(false)} disabled={!rows?.length}>
          Clear All
        </button>
        <button
          className="wp-btn wp-btn-outline"
          disabled={!selectedRows.length}
          onClick={() => window.print()}
        >
          🖶 View GRN / Print
        </button>
        <button
          className="wp-btn wp-btn-outline"
          disabled={!selectedRows.length}
          onClick={() => setMessage({ type: "success", text: `Email dispatch queued for ${selectedRows.length} GRN(s).` })}
        >
          Send Email
        </button>
      </div>

      {message && (
        <p className="wp-hint" style={{ color: message.type === "error" ? "#b91c1c" : "#1a7a3c", fontWeight: 600 }}>
          {message.text}
        </p>
      )}

      {rows !== null && (
        <div className="wp-table-wrap" style={{ marginTop: 18 }}>
          <table className="wp-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && selectedRows.length === rows.length}
                    onChange={(e) => toggleAll(e.target.checked)}
                  />
                </th>
                <th>GRN No</th>
                <th>Date</th>
                <th>Vehicle No</th>
                <th>Supplier</th>
                <th>Chests</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="wp-table-empty">
                    No unloading records found for the selected criteria.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.grn_id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={!!checked[r.grn_id]}
                        onChange={(e) => setChecked((c) => ({ ...c, [r.grn_id]: e.target.checked }))}
                      />
                    </td>
                    <td>{r.grn_no}</td>
                    <td>{r.grn_date}</td>
                    <td>{r.vehicle_no}</td>
                    <td>{r.supplier}</td>
                    <td>{r.chests}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </FormShell>
  );
}

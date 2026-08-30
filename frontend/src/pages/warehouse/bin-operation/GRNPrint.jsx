import { API_BASE as API } from "../../../config/api";
import { useMemo, useState } from "react";
import axios from "axios";
import FormShell, { Field } from "../../../components/warehouse/FormShell";
import { downloadReportPdf } from "../../../utils/reportPdf";
import { printTableDocument } from "../../../utils/printDocument";
import "./ReceivingIssuing.css";

const DEFAULT_STORE = "BrewSmart Warehouse";

export default function GRNPrint() {
  const [mode, setMode] = useState("unloading");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [store, setStore] = useState(DEFAULT_STORE);
  const [query, setQuery] = useState("");
  const [otherBroker, setOtherBroker] = useState(false);
  const [reprint, setReprint] = useState(false);
  const [amalgamation, setAmalgamation] = useState(false);
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [checked, setChecked] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const params = { date };
      if (query.trim()) params.q = query.trim();
      if (amalgamation) params.amalgamation = 1;
      if (otherBroker) params.broker_only = 1;
      const res = await axios.get(`${API}/grn/list.php`, { params, withCredentials: true });
      setRows(res.data.data || []);
      setChecked({});
      setLoaded(true);
    } catch (err) {
      setRows([]);
      setLoaded(true);
      setMessage({ type: "error", text: err.response?.data?.message || "Could not load GRN / unloading records." });
    } finally {
      setLoading(false);
    }
  };

  const selectedRows = useMemo(() => rows.filter((r) => checked[r.grn_id]), [rows, checked]);
  const toggleAll = (value) => {
    const next = {};
    if (value) rows.forEach((r) => { next[r.grn_id] = true; });
    setChecked(next);
  };

  const documentColumns = mode === "unloading"
    ? [
        { key: "turn_no", label: "Turn No" },
        { key: "grn_no", label: "GRN No" },
        { key: "chests", label: "No. of Bags" },
        { key: "mark", label: "Mark / Estate" },
        { key: "broker", label: "Broker" },
        { key: "vehicle_no", label: "Lorry No" },
      ]
    : [
        { key: "grn_no", label: "GRN No" },
        { key: "broker", label: "Broker" },
        { key: "mark", label: "Mark / Estate" },
        { key: "turn_no", label: "Turn No" },
        { key: "chests", label: "Bags" },
        { key: "invoice_numbers", label: "Invoice(s)" },
      ];

  const preparedRows = (selectedRows.length ? selectedRows : rows).map((r) => ({
    ...r,
    turn_no: r.turn_no || "-",
    grn_no: r.grn_no || "-",
    chests: r.chests ?? 0,
    mark: r.mark || r.selling_marks || "-",
    broker: r.broker || r.supplier || r.buyer || "-",
    vehicle_no: r.vehicle_no || "-",
    invoice_numbers: r.invoice_numbers || "-",
  }));

  const title = mode === "unloading"
    ? `${reprint ? "Reprint - " : ""}Unloading / Arrival Slip Report`
    : `${reprint ? "Reprint - " : ""}Goods Received Note (GRN) Report`;

  const exportPdf = () => {
    if (!preparedRows.length) return setMessage({ type: "error", text: "Load and select at least one record first." });
    downloadReportPdf({ title, columns: documentColumns, rows: preparedRows, generatedBy: "BrewSmart User" });
  };

  const printSelected = () => {
    if (!preparedRows.length) return setMessage({ type: "error", text: "Load and select at least one record first." });
    try {
      printTableDocument({
        title,
        subtitle: mode === "unloading" ? "Unloading Turn Information" : "GRN Information",
        columns: documentColumns,
        rows: preparedRows,
        meta: [
          { label: "Store", value: store },
          { label: "Date", value: date },
          { label: "Copy", value: reprint ? "REPRINT" : "ORIGINAL" },
        ],
      });
    } catch (e) {
      setMessage({ type: "error", text: e.message });
    }
  };

  const clear = () => {
    setQuery("");
    setRows([]);
    setLoaded(false);
    setChecked({});
    setMessage(null);
  };

  return (
    <FormShell crumb="Bin Operation / GRN" title="Unloading Reports Printing">
      <div className="bi-workspace">
        <div className="bi-toolbar">
          <div className="bi-segmented">
            <button className={mode === "unloading" ? "active" : ""} onClick={() => setMode("unloading")}>Unloading Print</button>
            <button className={mode === "grn" ? "active" : ""} onClick={() => setMode("grn")}>GRN Print</button>
          </div>
          <div className="bi-toolbar-group">
            <button className="wp-btn wp-btn-outline" onClick={printSelected} disabled={!preparedRows.length}>🖶 Print Selected</button>
            <button className="wp-btn wp-btn-primary" onClick={exportPdf} disabled={!preparedRows.length}>PDF Download</button>
          </div>
        </div>

        <div className="bi-section">
          <div className="bi-section-title">Search & Print Filters</div>
          <div className="bi-section-body">
            <div className="bi-grid-3">
              <Field label="Store">
                <input className="wp-input" value={store} onChange={(e) => setStore(e.target.value)} />
              </Field>
              <Field label="Date">
                <input className="wp-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Toggle / Search">
                <input className="wp-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="GRN, turn, broker, mark, lorry..." />
              </Field>
            </div>
            <div className="bi-check-row" style={{ marginTop: 14 }}>
              <label><input type="checkbox" checked={otherBroker} onChange={(e) => setOtherBroker(e.target.checked)} /> Broker Only</label>
              <label><input type="checkbox" checked={reprint} onChange={(e) => setReprint(e.target.checked)} /> {mode === "grn" ? "GRN Reprint" : "Arrival Slip Reprint"}</label>
              {mode === "grn" && <label><input type="checkbox" checked={amalgamation} onChange={(e) => setAmalgamation(e.target.checked)} /> Amalgamation</label>}
            </div>
            <div className="bi-actionbar" style={{ marginTop: 14 }}>
              <button className="wp-btn wp-btn-primary" onClick={load} disabled={loading}>{loading ? "Loading..." : "Load"}</button>
              <button className="wp-btn wp-btn-outline" onClick={() => toggleAll(true)} disabled={!rows.length}>Select All</button>
              <button className="wp-btn wp-btn-outline" onClick={() => toggleAll(false)} disabled={!rows.length}>Clear All</button>
              <button className="wp-btn wp-btn-outline" onClick={clear}>Clear Screen</button>
            </div>
          </div>
        </div>

        {message && <div className={`bi-message ${message.type}`}>{message.text}</div>}

        <div className="bi-section">
          <div className="bi-section-title">{mode === "unloading" ? "Unloading Turn Information" : "GRN Information"}</div>
          <div className="wp-table-wrap">
            <table className="wp-table">
              <thead>
                <tr>
                  <th><input type="checkbox" checked={rows.length > 0 && selectedRows.length === rows.length} onChange={(e) => toggleAll(e.target.checked)} /></th>
                  {mode === "unloading" ? <>
                    <th>Turn No</th><th>No. of Bags</th><th>Mark / Estate</th><th>Lorry No</th><th>GRN No</th>
                  </> : <>
                    <th>Broker</th><th>GRN No</th><th>Mark / Estate</th><th>Turn No</th><th>Bags</th>
                  </>}
                </tr>
              </thead>
              <tbody>
                {!loaded ? (
                  <tr><td colSpan={6} className="wp-table-empty">Choose a date and press Load.</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={6} className="wp-table-empty">No matching records found.</td></tr>
                ) : rows.map((r) => (
                  <tr key={r.grn_id} className={checked[r.grn_id] ? "bi-row-selected" : ""}>
                    <td><input type="checkbox" checked={!!checked[r.grn_id]} onChange={(e) => setChecked((c) => ({ ...c, [r.grn_id]: e.target.checked }))} /></td>
                    {mode === "unloading" ? <>
                      <td className="bi-strong">{r.turn_no || "-"}</td><td>{r.chests || 0}</td><td>{r.mark || r.selling_marks || "-"}</td><td>{r.vehicle_no || "-"}</td><td>{r.grn_no}</td>
                    </> : <>
                      <td>{r.broker || r.supplier || r.buyer || "-"}</td><td className="bi-strong">{r.grn_no}</td><td>{r.mark || r.selling_marks || "-"}</td><td>{r.turn_no || "-"}</td><td>{r.chests || 0}</td>
                    </>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bi-actionbar">
          <button className="wp-btn wp-btn-primary" onClick={printSelected} disabled={!preparedRows.length}>{mode === "unloading" ? "View Arrival Slip" : "View GRN"}</button>
          <button className="wp-btn wp-btn-outline" onClick={exportPdf} disabled={!preparedRows.length}>Download PDF</button>
          <p className="bi-print-note">If rows are selected, only selected rows are printed/exported; otherwise all loaded rows are used.</p>
        </div>
      </div>
    </FormShell>
  );
}

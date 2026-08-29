import { useMemo, useState } from "react";
import axios from "axios";
import FormShell, { Field } from "../../../components/warehouse/FormShell";
import { downloadReportPdf } from "../../../utils/reportPdf";
import { printTableDocument } from "../../../utils/printDocument";
import "./ReceivingIssuing.css";

const API = "http://localhost/BrewSmart/backend/api";
const DEFAULT_STORE = "BrewSmart Warehouse";

export default function GINPickingList() {
  const [mode, setMode] = useState("picking");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [store, setStore] = useState(DEFAULT_STORE);
  const [query, setQuery] = useState("");
  const [reprint, setReprint] = useState(false);
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [checked, setChecked] = useState({});
  const [loading, setLoading] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [message, setMessage] = useState(null);

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const params = { date };
      if (query.trim()) params.q = query.trim();
      const res = await axios.get(`${API}/gin/list.php`, { params, withCredentials: true });
      setRows(res.data.data || []);
      setChecked({});
      setLoaded(true);
    } catch (err) {
      setRows([]);
      setLoaded(true);
      setMessage({ type: "error", text: err.response?.data?.message || "Could not load loading / GIN records." });
    } finally {
      setLoading(false);
    }
  };

  const selectedRows = useMemo(() => rows.filter((r) => checked[r.gin_id]), [rows, checked]);
  const toggleAll = (value) => {
    const next = {};
    if (value) rows.forEach((r) => { next[r.gin_id] = true; });
    setChecked(next);
  };

  const titleMap = {
    picking: `${reprint ? "Reprint - " : ""}Picking List`,
    gin: `${reprint ? "Reprint - " : ""}Goods Issued Note (GIN)`,
    gate: `${reprint ? "Reprint - " : ""}Gate Pass`,
  };

  const columnsMap = {
    picking: [
      { key: "turn_no", label: "Turn No" },
      { key: "gin_no", label: "GIN No" },
      { key: "chests", label: "No. of Bags" },
      { key: "vehicle_no", label: "Lorry No" },
      { key: "buyer", label: "Buyer Name" },
      { key: "locations", label: "Picking Locations" },
    ],
    gin: [
      { key: "gin_no", label: "GIN No" },
      { key: "buyer", label: "Buyer" },
      { key: "invoice_numbers", label: "Invoice(s)" },
      { key: "chests", label: "Issued Bags" },
      { key: "vehicle_no", label: "Lorry No" },
      { key: "turn_no", label: "Turn No" },
    ],
    gate: [
      { key: "gin_no", label: "GIN No" },
      { key: "gate_pass_no", label: "Gate Pass No" },
      { key: "dispatch_status", label: "Status" },
      { key: "buyer", label: "Buyer" },
      { key: "vehicle_no", label: "Lorry No" },
      { key: "collection_person", label: "Collection Person" },
      { key: "collection_nic", label: "NIC" },
      { key: "turn_no", label: "Turn No" },
    ],
  };

  const preparedRows = (selectedRows.length ? selectedRows : rows).map((r) => ({
    ...r,
    turn_no: r.turn_no || "-",
    gin_no: r.gin_no || "-",
    chests: r.chests ?? 0,
    vehicle_no: r.vehicle_no || "-",
    buyer: r.buyer || "-",
    locations: r.locations || "-",
    invoice_numbers: r.invoice_numbers || r.invoice_no || "-",
    collection_person: r.collection_person || "-",
    collection_nic: r.collection_nic || "-",
    gate_pass_no: r.gate_pass_no || "-",
    dispatch_status: r.dispatch_status || "PENDING",
  }));

  const issueGatePass = async () => {
    const targets = selectedRows;
    if (!targets.length) return setMessage({ type: "error", text: "Select at least one GIN before issuing a Gate Pass." });
    setDispatching(true);
    setMessage(null);
    try {
      const updates = {};
      for (const row of targets) {
        if (row.dispatch_status === "DISPATCHED") {
          updates[row.gin_id] = row;
          continue;
        }
        const res = await axios.post(`${API}/gin/dispatch.php`, { gin_id: Number(row.gin_id) }, { withCredentials: true });
        updates[row.gin_id] = { ...row, ...(res.data.data || {}) };
      }
      const nextRows = rows.map((r) => updates[r.gin_id] ? { ...r, ...updates[r.gin_id] } : r);
      setRows(nextRows);
      const printRows = targets.map((r) => {
        const u = updates[r.gin_id] || r;
        return {
          ...r,
          ...u,
          gate_pass_no: u.gate_pass_no || "-",
          dispatch_status: u.dispatch_status || "DISPATCHED",
          buyer: r.buyer || "-",
          vehicle_no: r.vehicle_no || "-",
          collection_person: r.collection_person || "-",
          collection_nic: r.collection_nic || "-",
          turn_no: r.turn_no || "-",
        };
      });
      printTableDocument({
        title: "Gate Pass",
        subtitle: "Vehicle Gate Pass / Confirmed Warehouse Dispatch",
        columns: columnsMap.gate,
        rows: printRows,
        meta: [
          { label: "Store", value: store },
          { label: "Date", value: date },
          { label: "Dispatch", value: "CONFIRMED" },
        ],
      });
      setMessage({ type: "success", text: `${targets.length} Gate Pass record(s) confirmed. Dispatched stock was removed from warehouse locations and moved to Issued Inquiry.` });
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Gate Pass dispatch could not be completed." });
    } finally {
      setDispatching(false);
    }
  };

  const printSelected = () => {
    if (!preparedRows.length) return setMessage({ type: "error", text: "Load and select at least one record first." });
    try {
      printTableDocument({
        title: titleMap[mode],
        subtitle: mode === "picking" ? "Loading Turn Information" : mode === "gin" ? "GIN Information" : "Vehicle Gate Pass",
        columns: columnsMap[mode],
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

  const exportPdf = () => {
    if (!preparedRows.length) return setMessage({ type: "error", text: "Load and select at least one record first." });
    if (mode === "gate" && !reprint && preparedRows.some((r) => r.dispatch_status !== "DISPATCHED")) {
      return setMessage({ type: "error", text: "Issue/confirm the Gate Pass first. Pending stock must not be printed as a final Gate Pass." });
    }
    downloadReportPdf({ title: titleMap[mode], columns: columnsMap[mode], rows: preparedRows, generatedBy: "BrewSmart User" });
  };

  const clear = () => {
    setQuery("");
    setRows([]);
    setLoaded(false);
    setChecked({});
    setMessage(null);
  };

  return (
    <FormShell crumb="Bin Operation / GIN" title="Loading Reports Printing">
      <div className="bi-workspace">
        <div className="bi-toolbar">
          <div className="bi-segmented">
            <button className={mode === "picking" ? "active" : ""} onClick={() => setMode("picking")}>Picking List Print</button>
            <button className={mode === "gin" ? "active" : ""} onClick={() => setMode("gin")}>GIN Print</button>
            <button className={mode === "gate" ? "active" : ""} onClick={() => setMode("gate")}>Gate Pass</button>
          </div>
          <div className="bi-toolbar-group">
            {mode === "gate" && !reprint && (
              <button className="wp-btn wp-btn-primary" onClick={issueGatePass} disabled={dispatching || !selectedRows.length}>
                {dispatching ? "Dispatching..." : "Issue Gate Pass / Dispatch"}
              </button>
            )}
            {(mode !== "gate" || reprint) && (
              <button className="wp-btn wp-btn-outline" onClick={printSelected} disabled={!preparedRows.length}>🖶 Print Selected</button>
            )}
            <button
              className="wp-btn wp-btn-primary"
              onClick={exportPdf}
              disabled={!preparedRows.length || (mode === "gate" && !reprint && preparedRows.some((r) => r.dispatch_status !== "DISPATCHED"))}
            >
              PDF Download
            </button>
          </div>
        </div>

        <div className="bi-section">
          <div className="bi-section-title">Loading Report Filters</div>
          <div className="bi-section-body">
            <div className="bi-grid-3">
              <Field label="Store"><input className="wp-input" value={store} onChange={(e) => setStore(e.target.value)} /></Field>
              <Field label="Date"><input className="wp-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
              <Field label="Toggle / Search"><input className="wp-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="GIN, turn, buyer, vehicle..." /></Field>
            </div>
            <div className="bi-check-row" style={{ marginTop: 14 }}>
              <label><input type="checkbox" checked={reprint} onChange={(e) => setReprint(e.target.checked)} /> {mode === "gate" ? "Gate Pass Reprint" : mode === "gin" ? "GIN Reprint" : "Picking List Reprint"}</label>
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
          <div className="bi-section-title">{mode === "picking" ? "Loading Turn Information" : mode === "gin" ? "GIN Information" : "Gate Pass Information"}</div>
          <div className="wp-table-wrap">
            <table className="wp-table">
              <thead>
                <tr><th><input type="checkbox" checked={rows.length > 0 && selectedRows.length === rows.length} onChange={(e) => toggleAll(e.target.checked)} /></th>{columnsMap[mode].map((c) => <th key={c.key}>{c.label}</th>)}</tr>
              </thead>
              <tbody>
                {!loaded ? <tr><td colSpan={columnsMap[mode].length + 1} className="wp-table-empty">Choose a date and press Load.</td></tr> : rows.length === 0 ? <tr><td colSpan={columnsMap[mode].length + 1} className="wp-table-empty">No loading records found.</td></tr> : rows.map((r) => {
                  const prepared = preparedRows.find((x) => x.gin_id === r.gin_id) || r;
                  return <tr key={r.gin_id} className={checked[r.gin_id] ? "bi-row-selected" : ""}>
                    <td><input type="checkbox" checked={!!checked[r.gin_id]} onChange={(e) => setChecked((c) => ({ ...c, [r.gin_id]: e.target.checked }))} /></td>
                    {columnsMap[mode].map((c) => <td key={c.key} className={c.key === "gin_no" || c.key === "turn_no" ? "bi-strong" : ""}>{prepared[c.key] ?? "-"}</td>)}
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bi-actionbar">
          <button
            className="wp-btn wp-btn-primary"
            onClick={mode === "gate" && !reprint ? issueGatePass : printSelected}
            disabled={mode === "gate" && !reprint ? (dispatching || !selectedRows.length) : !preparedRows.length}
          >
            {mode === "picking" ? "View Picking List" : mode === "gin" ? "View GIN" : reprint ? "Reprint Gate Pass" : dispatching ? "Dispatching..." : "Issue Gate Pass / Dispatch & Print"}
          </button>
          <button
            className="wp-btn wp-btn-outline"
            onClick={exportPdf}
            disabled={!preparedRows.length || (mode === "gate" && !reprint && preparedRows.some((r) => r.dispatch_status !== "DISPATCHED"))}
          >
            Download PDF
          </button>
          <p className="bi-print-note">{mode === "gate" && !reprint ? "Select the GIN(s) to dispatch. Stock is deducted only once when the Gate Pass is confirmed." : "Selection is optional. With no selection, all loaded records are included."}</p>
        </div>
      </div>
    </FormShell>
  );
}

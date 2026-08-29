import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import FormShell, { Field } from "../../../components/warehouse/FormShell";
import "./ReceivingIssuing.css";

const API = "http://localhost/BrewSmart/backend/api";
const DEFAULT_STORE = "BrewSmart Warehouse";
const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = () => ({
  grn_id: null,
  grnNo: "",
  date: today(),
  store: DEFAULT_STORE,
  turnNo: "",
  vehicleNo: "",
  driverName: "",
  driverNic: "",
  sourceType: "BROKER",
  broker: "",
  buyer: "",
  mark: "",
  amalgamation: false,
  commonRemark: "",
});

export default function GRNAddEdit() {
  const [form, setForm] = useState(emptyForm);
  const [mode, setMode] = useState("add");
  const [existingNo, setExistingNo] = useState("");
  const [marks, setMarks] = useState([]);
  const [brokers, setBrokers] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState({});
  const [received, setReceived] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const lastAutoTurn = useRef("");
  const turnLookupInFlight = useRef(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  useEffect(() => {
    axios.get(`${API}/meta.php`, { withCredentials: true })
      .then((res) => {
        setMarks(res.data.data?.marks || []);
        setBrokers(res.data.data?.brokers || []);
      })
      .catch(() => { setMarks([]); setBrokers([]); });
  }, []);

  const loadByTurn = async (manual = false) => {
    const turn = form.turnNo.trim();
    if (!turn || turnLookupInFlight.current || turn === lastAutoTurn.current) return;
    turnLookupInFlight.current = true;
    lastAutoTurn.current = turn;
    setLoading(true);
    if (manual) setMessage(null);
    try {
      const params = { turn_no: turn };
      if (form.grn_id) params.grn_id = form.grn_id;
      const res = await axios.get(`${API}/grn/turn-lookup.php`, { params, withCredentials: true });
      const data = res.data.data || {};
      const h = data.header || {};
      const rows = data.items || [];
      setForm((f) => ({
        ...f,
        turnNo: h.turn_no || turn,
        date: h.date || f.date,
        store: h.store || f.store,
        vehicleNo: h.vehicle_no || "",
        driverName: h.driver_name || "",
        driverNic: h.driver_nic || "",
        sourceType: h.source_type || (h.buyer && !h.broker ? "BUYER" : "BROKER"),
        broker: h.broker || "",
        buyer: h.buyer || "",
        mark: h.mark || "",
      }));
      setCandidates(rows);
      setSelected(Object.fromEntries(rows.map((r) => [r.invoice_id, true])));
      setReceived(Object.fromEntries(rows.map((r) => [r.invoice_id, Number(r.chests || 0)])));
      setMessage({ type: "success", text: `Turn ${turn} loaded automatically. ${rows.length} arrival/invoice line(s) selected for GRN.` });
    } catch (err) {
      lastAutoTurn.current = "";
      if (manual) setMessage({ type: "error", text: err.response?.data?.message || "No arrival details found for that turn number." });
    } finally {
      turnLookupInFlight.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    const turn = form.turnNo.trim();
    if (mode !== "add" || form.grn_id || turn.length < 2 || turn === lastAutoTurn.current) return undefined;
    const timer = setTimeout(() => loadByTurn(false), 650);
    return () => clearTimeout(timer);
  }, [form.turnNo, mode, form.grn_id]);

  const loadInvoices = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const params = { date: form.date };
      if (form.sourceType === "BROKER" && form.broker.trim()) params.broker = form.broker.trim();
      if (form.sourceType === "BUYER" && form.buyer.trim()) params.buyer = form.buyer.trim();
      if (form.mark) params.mark = form.mark;
      if (form.grn_id) params.grn_id = form.grn_id;
      const res = await axios.get(`${API}/grn/invoice-candidates.php`, { params, withCredentials: true });
      const rows = res.data.data || [];
      setCandidates(rows);
      if (!form.grn_id) {
        setSelected({});
        setReceived(Object.fromEntries(rows.map((r) => [r.invoice_id, Number(r.chests || 0)])));
      }
    } catch (err) {
      setCandidates([]);
      setMessage({ type: "error", text: err.response?.data?.message || "Could not load invoice receiving data." });
    } finally {
      setLoading(false);
    }
  };

  const loadExisting = async () => {
    if (!existingNo.trim()) return setMessage({ type: "error", text: "Enter a GRN number to edit." });
    setLoading(true);
    setMessage(null);
    try {
      const res = await axios.get(`${API}/grn/get.php`, { params: { grn_no: existingNo.trim() }, withCredentials: true });
      const { grn, items } = res.data.data;
      setForm({
        grn_id: grn.grn_id,
        grnNo: grn.grn_no || "",
        date: grn.grn_date || today(),
        store: grn.store || DEFAULT_STORE,
        turnNo: grn.turn_no || "",
        vehicleNo: grn.vehicle_no || "",
        driverName: grn.driver_name || "",
        driverNic: grn.driver_nic || "",
        sourceType: grn.source_type || "BROKER",
        broker: grn.broker || grn.supplier || "",
        buyer: grn.buyer || "",
        mark: grn.mark || "",
        amalgamation: Number(grn.amalgamation) === 1,
        commonRemark: grn.remarks || "",
      });
      const itemMap = Object.fromEntries((items || []).map((i) => [i.invoice_id, true]));
      const receivedMap = Object.fromEntries((items || []).map((i) => [i.invoice_id, Number(i.received_chests || 0)]));
      setSelected(itemMap);
      setReceived(receivedMap);
      const params = { date: grn.grn_date, grn_id: grn.grn_id };
      if (grn.source_type === "BUYER" && grn.buyer) params.buyer = grn.buyer;
      else if (grn.broker) params.broker = grn.broker;
      if (grn.mark) params.mark = grn.mark;
      const candidatesRes = await axios.get(`${API}/grn/invoice-candidates.php`, { params, withCredentials: true });
      setCandidates(candidatesRes.data.data || []);
      setMessage({ type: "info", text: `Loaded ${grn.grn_no} for editing.` });
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "GRN could not be loaded." });
    } finally {
      setLoading(false);
    }
  };

  const selectedRows = useMemo(() => candidates.filter((r) => selected[r.invoice_id]), [candidates, selected]);
  const totalBags = selectedRows.reduce((sum, r) => sum + Number(received[r.invoice_id] ?? r.chests ?? 0), 0);
  const totalWeight = selectedRows.reduce((sum, r) => sum + Number(received[r.invoice_id] ?? r.chests ?? 0) * Number(r.net_weight_each || 0), 0);

  const toggleAll = (value) => {
    const next = {};
    if (value) candidates.forEach((r) => { next[r.invoice_id] = true; });
    setSelected(next);
    setReceived((prev) => ({ ...Object.fromEntries(candidates.map((r) => [r.invoice_id, Number(r.chests || 0)])), ...prev }));
  };

  const save = async () => {
    if (!selectedRows.length) return setMessage({ type: "error", text: "Select at least one invoice from Invoice Receive Information." });
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        ...form,
        items: selectedRows.map((r) => ({
          invoice_id: Number(r.invoice_id),
          received_chests: Number(received[r.invoice_id] ?? r.chests ?? 0),
        })),
      };
      const res = await axios.post(`${API}/grn/create.php`, payload, { withCredentials: true });
      setMessage({ type: "success", text: `${res.data.data.grn_no} saved successfully. Turn: ${res.data.data.turn_no}.` });
      setMode("edit");
      setExistingNo(res.data.data.grn_no);
      setForm((f) => ({ ...f, grn_id: res.data.data.grn_id, grnNo: res.data.data.grn_no, turnNo: res.data.data.turn_no }));
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Could not save GRN." });
    } finally {
      setSaving(false);
    }
  };

  const clear = () => {
    setForm(emptyForm());
    setCandidates([]);
    setSelected({});
    setReceived({});
    setExistingNo("");
    setMessage(null);
    lastAutoTurn.current = "";
    setMode("add");
  };

  return (
    <FormShell crumb="Bin Operation / GRN" title="Invoice Chest Receiving">
      <div className="bi-workspace">
        <div className="bi-toolbar">
          <div className="bi-segmented">
            <button className={mode === "add" ? "active" : ""} onClick={() => { clear(); setMode("add"); }}>＋ Add New GRN</button>
            <button className={mode === "edit" ? "active" : ""} onClick={() => setMode("edit")}>✎ Edit GRN</button>
          </div>
          {mode === "edit" && (
            <div className="bi-inline-actions">
              <input className="wp-input" style={{ width: 240, flex: "none" }} value={existingNo} onChange={(e) => setExistingNo(e.target.value)} placeholder="GRN number" />
              <button className="wp-btn wp-btn-outline" onClick={loadExisting} disabled={loading}>Load GRN</button>
            </div>
          )}
        </div>

        <div className="bi-section">
          <div className="bi-section-title">Turn / Vehicle Information</div>
          <div className="bi-section-body">
            <div className="bi-grid-3">
              <Field label="Store"><input className="wp-input" value={form.store} onChange={set("store")} /></Field>
              <Field label="Turn Date"><input className="wp-input" type="date" value={form.date} onChange={set("date")} /></Field>
              <Field label="Turn Number">
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="wp-input"
                    value={form.turnNo}
                    onChange={(e) => {
                      lastAutoTurn.current = "";
                      setForm((f) => ({ ...f, turnNo: e.target.value }));
                    }}
                    onBlur={() => loadByTurn(true)}
                    onKeyDown={(e) => e.key === "Enter" && loadByTurn(true)}
                    placeholder="Enter arrival turn to auto-load"
                  />
                  <button type="button" className="wp-btn wp-btn-outline" onClick={() => loadByTurn(true)} disabled={loading || !form.turnNo.trim()}>
                    Load Arrival
                  </button>
                </div>
              </Field>
              <Field label="Lorry No"><input className="wp-input" value={form.vehicleNo} onChange={set("vehicleNo")} /></Field>
              <Field label="NIC / DV No"><input className="wp-input" value={form.driverNic} onChange={set("driverNic")} /></Field>
              <Field label="Driver Name"><input className="wp-input" value={form.driverName} onChange={set("driverName")} /></Field>
            </div>
          </div>
        </div>

        <div className="bi-section">
          <div className="bi-section-title">Broker / Buyer Selection</div>
          <div className="bi-section-body">
            <div className="bi-check-row" style={{ marginBottom: 12 }}>
              <label><input type="radio" name="source" checked={form.sourceType === "BROKER"} onChange={() => setForm((f) => ({ ...f, sourceType: "BROKER" }))} /> Broker</label>
              <label><input type="radio" name="source" checked={form.sourceType === "BUYER"} onChange={() => setForm((f) => ({ ...f, sourceType: "BUYER" }))} /> Buyer</label>
              <label><input type="checkbox" checked={form.amalgamation} onChange={(e) => setForm((f) => ({ ...f, amalgamation: e.target.checked }))} /> Amalgamation</label>
            </div>
            <div className="bi-grid-3">
              <Field label={form.sourceType === "BROKER" ? "Broker" : "Buyer"}>
                {form.sourceType === "BROKER" ? (
                  <select className="wp-input" value={form.broker} onChange={set("broker")}>
                    <option value="">-- Select Broker --</option>
                    {brokers.map((b) => (
                      <option key={b.broker_id || b.broker_code} value={b.broker_name || b.broker_code}>
                        {b.broker_code ? `${b.broker_code} - ` : ""}{b.broker_name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input className="wp-input" value={form.buyer} onChange={set("buyer")} placeholder="Buyer name / code" />
                )}
              </Field>
              <Field label="Mark / Estate">
                <select className="wp-input" value={form.mark} onChange={set("mark")}>
                  <option value="">-- All Marks --</option>
                  {marks.map((m) => <option key={m.mark_id || m.mark_code} value={m.mark_code}>{m.mark_code} - {m.mark_name}</option>)}
                </select>
              </Field>
              <Field label="GRN No"><input className="wp-input" value={form.grnNo} onChange={set("grnNo")} placeholder="Auto if blank" /></Field>
            </div>
            <div className="bi-actionbar" style={{ marginTop: 14 }}>
              <button className="wp-btn wp-btn-primary" onClick={loadInvoices} disabled={loading}>{loading ? "Loading..." : "Load Invoice Receiving Data"}</button>
              <button className="wp-btn wp-btn-outline" onClick={() => toggleAll(true)} disabled={!candidates.length}>Select All</button>
              <button className="wp-btn wp-btn-outline" onClick={() => toggleAll(false)} disabled={!candidates.length}>Clear All</button>
            </div>
          </div>
        </div>

        {message && <div className={`bi-message ${message.type}`}>{message.text}</div>}

        <div className="bi-section">
          <div className="bi-section-title">Invoice Receive Information</div>
          <div className="wp-table-wrap">
            <table className="wp-table">
              <thead>
                <tr>
                  <th><input type="checkbox" checked={candidates.length > 0 && selectedRows.length === candidates.length} onChange={(e) => toggleAll(e.target.checked)} /></th>
                  <th>Selling Mark</th><th>Invoice Number</th><th>Grade</th><th>No. of Chests</th><th>Received Chests</th><th>Net Wt Each</th><th>Packing Type</th><th>Location</th>
                </tr>
              </thead>
              <tbody>
                {!candidates.length ? <tr><td colSpan={9} className="wp-table-empty">Press Load to show saved invoices that are not already attached to another GRN.</td></tr> : candidates.map((r) => (
                  <tr key={r.invoice_id} className={selected[r.invoice_id] ? "bi-row-selected" : ""}>
                    <td><input type="checkbox" checked={!!selected[r.invoice_id]} onChange={(e) => setSelected((s) => ({ ...s, [r.invoice_id]: e.target.checked }))} /></td>
                    <td>{r.selling_mark || r.mark || "-"}</td><td className="bi-strong">{r.invoice_no}</td><td>{r.grade || "-"}</td><td>{r.chests}</td>
                    <td><input className="bi-qty-input" type="number" min="1" max={r.chests} value={received[r.invoice_id] ?? r.chests} onChange={(e) => setReceived((x) => ({ ...x, [r.invoice_id]: e.target.value }))} disabled={!selected[r.invoice_id]} /></td>
                    <td>{Number(r.net_weight_each || 0).toFixed(2)}</td><td>{r.packing_type || "-"}</td><td>{r.allocated_locations || r.location_code || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bi-toolbar">
          <div className="bi-toolbar-group">
            <div className="bi-summary-card"><div className="bi-summary-label">Selected Invoices</div><div className="bi-summary-value">{selectedRows.length}</div></div>
            <div className="bi-summary-card"><div className="bi-summary-label">Total Received Bags</div><div className="bi-summary-value">{totalBags}</div></div>
            <div className="bi-summary-card"><div className="bi-summary-label">Approx. Net Weight</div><div className="bi-summary-value">{totalWeight.toFixed(2)} kg</div></div>
          </div>
          <div className="bi-toolbar-group">
            <input className="wp-input" style={{ minWidth: 300 }} value={form.commonRemark} onChange={set("commonRemark")} placeholder="Common remark" />
            <button className="wp-btn wp-btn-outline" onClick={clear}>Clear</button>
            <button className="wp-btn wp-btn-primary" onClick={save} disabled={saving || !selectedRows.length}>{saving ? "Saving..." : mode === "edit" && form.grn_id ? "Update GRN" : "Save GRN"}</button>
          </div>
        </div>
      </div>
    </FormShell>
  );
}

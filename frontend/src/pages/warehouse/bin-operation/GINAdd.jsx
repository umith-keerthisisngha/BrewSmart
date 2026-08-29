import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import FormShell, { Field } from "../../../components/warehouse/FormShell";
import "./ReceivingIssuing.css";

const API = "http://localhost/BrewSmart/backend/api";
const DEFAULT_STORE = "BrewSmart Warehouse";
const today = () => new Date().toISOString().slice(0, 10);

const emptyHeader = () => ({
  ginNo: "",
  date: today(),
  store: DEFAULT_STORE,
  turnNo: "",
  collectionPerson: "",
  collectionNic: "",
  vehicleNo: "",
  buyer: "",
  saleType: "Auction Sale",
  otherBroker: false,
  remarks: "",
});

export default function GINAdd() {
  const [header, setHeader] = useState(emptyHeader);
  const [marks, setMarks] = useState([]);
  const [search, setSearch] = useState({ invoiceNo: "", mark: "", sellingMark: "" });
  const [results, setResults] = useState([]);
  const [activeInvoice, setActiveInvoice] = useState(null);
  const [issuedQty, setIssuedQty] = useState("");
  const [grid, setGrid] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    axios.get(`${API}/meta.php`, { withCredentials: true })
      .then((res) => setMarks(res.data.data?.marks || []))
      .catch(() => setMarks([]));
  }, []);

  const setH = (key) => (e) => setHeader((h) => ({ ...h, [key]: e.target.value }));
  const setS = (key) => (e) => setSearch((s) => ({ ...s, [key]: e.target.value }));

  const loadStock = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const params = {};
      if (search.invoiceNo.trim()) params.invoice_no = search.invoiceNo.trim();
      if (search.mark) params.mark = search.mark;
      if (search.sellingMark.trim()) params.selling_mark = search.sellingMark.trim();
      const res = await axios.get(`${API}/gin/stock-search.php`, { params, withCredentials: true });
      const rows = res.data.data || [];
      setResults(rows);
      if (rows.length === 1) {
        setActiveInvoice(rows[0]);
        setIssuedQty(String(rows[0].available_chests));
      }
    } catch (err) {
      setResults([]);
      setActiveInvoice(null);
      setMessage({ type: "error", text: err.response?.data?.message || "Could not load available invoice stock." });
    } finally {
      setLoading(false);
    }
  };

  const chooseInvoice = (row) => {
    setActiveInvoice(row);
    setIssuedQty(String(row.available_chests || ""));
    if (!header.buyer.trim() && row.buyer) setHeader((h) => ({ ...h, buyer: row.buyer }));
  };

  const addToGrid = () => {
    if (!activeInvoice) return setMessage({ type: "error", text: "Select an invoice first." });
    const qty = Number(issuedQty);
    const available = Number(activeInvoice.available_chests || 0);
    if (!Number.isInteger(qty) || qty <= 0) return setMessage({ type: "error", text: "Issued quantity must be a whole number greater than 0." });
    if (qty > available) return setMessage({ type: "error", text: `Only ${available} chest(s) are available for this invoice.` });
    if (grid.some((g) => Number(g.invoice_id) === Number(activeInvoice.invoice_id))) return setMessage({ type: "error", text: "This invoice is already in the issuing grid." });
    setGrid((g) => [...g, { ...activeInvoice, quantity: qty }]);
    setMessage({ type: "info", text: `${activeInvoice.invoice_no} added to the issuing grid.` });
  };

  const totalQty = useMemo(() => grid.reduce((s, r) => s + Number(r.quantity || 0), 0), [grid]);
  const totalWeight = useMemo(() => grid.reduce((s, r) => s + Number(r.quantity || 0) * Number(r.net_weight_each || 0), 0), [grid]);

  const save = async () => {
    if (!header.buyer.trim()) return setMessage({ type: "error", text: "Buyer is required." });
    if (!grid.length) return setMessage({ type: "error", text: "Add at least one invoice to the issuing grid." });
    setSaving(true);
    setMessage(null);
    try {
      const res = await axios.post(`${API}/gin/create.php`, {
        ...header,
        items: grid.map((r) => ({ invoice_id: Number(r.invoice_id), quantity: Number(r.quantity) })),
      }, { withCredentials: true });
      setMessage({ type: "success", text: `${res.data.data.gin_no} saved. ${res.data.data.chests} chest(s) reserved for dispatch. Stock stays in its location until Gate Pass is issued.` });
      setGrid([]);
      setResults([]);
      setActiveInvoice(null);
      setIssuedQty("");
      setHeader(emptyHeader());
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Could not save GIN." });
    } finally {
      setSaving(false);
    }
  };

  const clear = () => {
    setHeader(emptyHeader());
    setSearch({ invoiceNo: "", mark: "", sellingMark: "" });
    setResults([]);
    setActiveInvoice(null);
    setIssuedQty("");
    setGrid([]);
    setMessage(null);
  };

  return (
    <FormShell crumb="Bin Operation / GIN" title="Invoice Chest Issuing">
      <div className="bi-workspace">
        <div className="bi-toolbar">
          <div className="bi-strong">Create Goods Issued Note. Stock is reserved here and removed from locations only when Gate Pass dispatch is confirmed.</div>
          <div className="bi-toolbar-group">
            <button className="wp-btn wp-btn-outline" onClick={clear}>Clear Screen</button>
            <button className="wp-btn wp-btn-primary" onClick={save} disabled={saving || !grid.length}>{saving ? "Issuing..." : "Save GIN"}</button>
          </div>
        </div>

        <div className="bi-section">
          <div className="bi-section-title">Loading / Collection Information</div>
          <div className="bi-section-body">
            <div className="bi-grid-3">
              <Field label="Store"><input className="wp-input" value={header.store} onChange={setH("store")} /></Field>
              <Field label="Turn Date"><input className="wp-input" type="date" value={header.date} onChange={setH("date")} /></Field>
              <Field label="Turn Number"><input className="wp-input" value={header.turnNo} onChange={setH("turnNo")} placeholder="Auto if blank" /></Field>
              <Field label="Collection Person Name"><input className="wp-input" value={header.collectionPerson} onChange={setH("collectionPerson")} /></Field>
              <Field label="Collection Person NIC"><input className="wp-input" value={header.collectionNic} onChange={setH("collectionNic")} /></Field>
              <Field label="Vehicle No"><input className="wp-input" value={header.vehicleNo} onChange={setH("vehicleNo")} /></Field>
            </div>
          </div>
        </div>

        <div className="bi-section">
          <div className="bi-section-title">Sale / Buyer Information</div>
          <div className="bi-section-body">
            <div className="bi-grid-3">
              <Field label="Buyer *"><input className="wp-input" value={header.buyer} onChange={setH("buyer")} /></Field>
              <Field label="Sale Type">
                <select className="wp-input" value={header.saleType} onChange={setH("saleType")}>
                  <option>Auction Sale</option><option>Private Sale</option><option>Direct Dispatch</option>
                </select>
              </Field>
              <Field label="GIN No"><input className="wp-input" value={header.ginNo} onChange={setH("ginNo")} placeholder="Auto if blank" /></Field>
            </div>
            <div className="bi-check-row" style={{ marginTop: 12 }}>
              <label><input type="checkbox" checked={header.otherBroker} onChange={(e) => setHeader((h) => ({ ...h, otherBroker: e.target.checked }))} /> Other Broker</label>
            </div>
          </div>
        </div>

        <div className="bi-section">
          <div className="bi-section-title">Find Invoice Stock</div>
          <div className="bi-section-body">
            <div className="bi-grid-3">
              <Field label="Invoice No"><input className="wp-input" value={search.invoiceNo} onChange={setS("invoiceNo")} /></Field>
              <Field label="Mark">
                <select className="wp-input" value={search.mark} onChange={setS("mark")}>
                  <option value="">-- All Marks --</option>
                  {marks.map((m) => <option key={m.mark_id || m.mark_code} value={m.mark_code}>{m.mark_code} - {m.mark_name}</option>)}
                </select>
              </Field>
              <Field label="Selling Mark"><input className="wp-input" value={search.sellingMark} onChange={setS("sellingMark")} /></Field>
            </div>
            <div className="bi-actionbar" style={{ marginTop: 14 }}>
              <button className="wp-btn wp-btn-primary" onClick={loadStock} disabled={loading}>{loading ? "Loading..." : "Load Available Stock"}</button>
            </div>
          </div>
        </div>

        {message && <div className={`bi-message ${message.type}`}>{message.text}</div>}

        <div className="bi-section">
          <div className="bi-section-title">Available Invoice Results</div>
          <div className="wp-table-wrap">
            <table className="wp-table">
              <thead><tr><th></th><th>Invoice No</th><th>Mark</th><th>Selling Mark</th><th>Grade</th><th>Available Chests</th><th>Net Wt Each</th><th>Location Info</th></tr></thead>
              <tbody>
                {!results.length ? <tr><td colSpan={8} className="wp-table-empty">Search for an invoice to load available stock.</td></tr> : results.map((r) => (
                  <tr key={r.invoice_id} className={activeInvoice?.invoice_id === r.invoice_id ? "bi-row-selected" : ""}>
                    <td><button className="wp-btn wp-btn-outline" style={{ padding: "5px 10px" }} onClick={() => chooseInvoice(r)}>Select</button></td>
                    <td className="bi-strong">{r.invoice_no}</td><td>{r.mark || "-"}</td><td>{r.selling_mark || "-"}</td><td>{r.grade || "-"}</td><td>{r.available_chests}</td><td>{Number(r.net_weight_each || 0).toFixed(2)}</td><td>{r.allocated_locations || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {activeInvoice && (
          <div className="bi-section">
            <div className="bi-section-title">Selected Stock / Location Info</div>
            <div className="bi-section-body">
              <div className="bi-grid-4">
                <div className="bi-summary-card"><div className="bi-summary-label">Invoice</div><div className="bi-summary-value" style={{ fontSize: 15 }}>{activeInvoice.invoice_no}</div></div>
                <div className="bi-summary-card"><div className="bi-summary-label">Available Chests</div><div className="bi-summary-value">{activeInvoice.available_chests}</div></div>
                <div className="bi-summary-card"><div className="bi-summary-label">Net Weight Each</div><div className="bi-summary-value">{Number(activeInvoice.net_weight_each || 0).toFixed(2)} kg</div></div>
                <div className="bi-summary-card"><div className="bi-summary-label">Locations</div><div className="bi-strong" style={{ marginTop: 5 }}>{activeInvoice.allocated_locations || "-"}</div></div>
              </div>
              <div className="bi-actionbar" style={{ marginTop: 14 }}>
                <Field label="Issued Quantity"><input className="wp-input" style={{ width: 160, flex: "none" }} type="number" min="1" max={activeInvoice.available_chests} value={issuedQty} onChange={(e) => setIssuedQty(e.target.value)} /></Field>
                <button className="wp-btn wp-btn-primary" style={{ marginTop: 18 }} onClick={addToGrid}>Add to Grid</button>
              </div>
            </div>
          </div>
        )}

        <div className="bi-section">
          <div className="bi-section-title">DO / GIN Information</div>
          <div className="wp-table-wrap">
            <table className="wp-table">
              <thead><tr><th>Invoice No</th><th>Selling Mark</th><th>Buyer Name</th><th>Issued Qty</th><th>Net Wt Each</th><th>Current Locations</th><th></th></tr></thead>
              <tbody>
                {!grid.length ? <tr><td colSpan={7} className="wp-table-empty">No invoices added to the issuing grid.</td></tr> : grid.map((r) => (
                  <tr key={r.invoice_id}><td className="bi-strong">{r.invoice_no}</td><td>{r.selling_mark || r.mark || "-"}</td><td>{header.buyer || "-"}</td><td>{r.quantity}</td><td>{Number(r.net_weight_each || 0).toFixed(2)}</td><td>{r.allocated_locations || "-"}</td><td><button className="wp-btn wp-btn-danger" style={{ padding: "5px 10px" }} onClick={() => setGrid((g) => g.filter((x) => x.invoice_id !== r.invoice_id))}>Delete</button></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bi-toolbar">
          <div className="bi-toolbar-group">
            <div className="bi-summary-card"><div className="bi-summary-label">Invoices</div><div className="bi-summary-value">{grid.length}</div></div>
            <div className="bi-summary-card"><div className="bi-summary-label">Issued Chests</div><div className="bi-summary-value">{totalQty}</div></div>
            <div className="bi-summary-card"><div className="bi-summary-label">Issued Net Weight</div><div className="bi-summary-value">{totalWeight.toFixed(2)} kg</div></div>
          </div>
          <div className="bi-toolbar-group">
            <input className="wp-input" style={{ minWidth: 300 }} value={header.remarks} onChange={setH("remarks")} placeholder="Remarks" />
            <button className="wp-btn wp-btn-outline" onClick={clear}>Clear Screen</button>
            <button className="wp-btn wp-btn-primary" onClick={save} disabled={saving || !grid.length}>{saving ? "Saving..." : "Save GIN"}</button>
          </div>
        </div>
      </div>
    </FormShell>
  );
}

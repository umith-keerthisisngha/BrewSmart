import { useEffect, useState } from "react";
import axios from "axios";
import FormShell, { Field } from "../../../components/warehouse/FormShell";
import LocationAllocatePanel from "../../../components/warehouse/LocationAllocatePanel";

const API = "http://localhost/BrewSmart/backend/api";
const CHEST_TYPES = ["A", "B", "C", "D", "BAG"];

export default function InvoiceEntryEdit() {
  const [searchYear, setSearchYear] = useState("");
  const [searchNo, setSearchNo] = useState("");
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  const [marks, setMarks] = useState([]);
  const [grades, setGrades] = useState([]);
  const [packingTypes, setPackingTypes] = useState([]);
  const [brokers, setBrokers] = useState([]);

  const [form, setForm] = useState(null); // the invoice currently being edited
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [showLocationPanel, setShowLocationPanel] = useState(false);

  useEffect(() => {
    axios
      .get(`${API}/meta.php`, { withCredentials: true })
      .then((res) => {
        const d = res.data.data || {};
        setMarks(d.marks || []);
        setGrades(d.grades || []);
        setPackingTypes(d.packing_types || []);
        setBrokers(d.brokers || []);
      })
      .catch(() => {});
  }, []);

  const runSearch = async () => {
    setSearchError(null);
    setSearching(true);
    try {
      const params = {};
      if (searchYear.trim()) params.year = searchYear.trim();
      if (searchNo.trim()) params.invoice_no = searchNo.trim();
      const res = await axios.get(`${API}/invoices/list.php`, { params, withCredentials: true });
      setResults(res.data.data || []);
    } catch (err) {
      setSearchError(err.response?.data?.message || "Could not reach the server.");
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const openForEdit = (row) => {
    setMessage(null);
    setShowLocationPanel(false);
    setForm({
      invoice_id: row.invoice_id,
      invoiceYear: row.invoice_year ?? "",
      invoiceNo: row.invoice_no ?? "",
      mark: row.mark ?? "",
      sellingMark: row.selling_mark ?? "",
      grade: row.grade ?? "",
      packingType: row.packing_type ?? "",
      chestType: row.chest_type ?? "",
      broker: row.broker ?? "",
      buyer: row.buyer ?? "",
      turnNo: row.arrival_turn_no ?? "",
      vehicleNo: row.arrival_vehicle_no ?? "",
      driverName: row.arrival_driver_name ?? "",
      driverNic: row.arrival_driver_nic ?? "",
      chests: row.chests ?? "",
      weightPerChest: row.weight_per_chest ?? "",
      netWeightEach: row.net_weight_each ?? "",
      totalGrossWeight: row.total_gross_weight ?? "",
      moistureContent: row.moisture_content ?? "",
      mfdDate: row.mfd_date ?? "",
      store: row.store ?? "BrewSmart Warehouse",
      date: row.invoice_date ?? "",
      location: row.location_id ? { location_id: row.location_id, location_code: row.allocated_location || row.location_code } : null,
    });
  };

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setMark = (e) => {
    const code = e.target.value;
    const selectedMark = marks.find((m) => String(m.mark_code) === String(code));
    setForm((f) => ({ ...f, mark: code, sellingMark: selectedMark ? (selectedMark.mark_name || selectedMark.mark_code || code) : "" }));
  };


  const allocateLocation = async (loc) => {
    setShowLocationPanel(false);
    try {
      await axios.post(
        `${API}/invoices/allocate-location.php`,
        { invoice_id: form.invoice_id, location_id: loc.location_id },
        { withCredentials: true }
      );
      setForm((f) => ({ ...f, location: loc }));
      setMessage({ type: "success", text: `Location ${loc.location_code} allocated.` });
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Could not allocate location." });
    }
  };

  const handleSave = async () => {
    setMessage(null);
    setSaving(true);
    try {
      const res = await axios.post(
        `${API}/invoices/update.php`,
        { invoice_id: form.invoice_id, ...form },
        { withCredentials: true }
      );
      if (res.data.success) {
        setMessage({ type: "success", text: "Invoice updated successfully." });
      } else {
        setMessage({ type: "error", text: res.data.message || "Update failed." });
      }
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Could not reach the server." });
    } finally {
      setSaving(false);
    }
  };


  return (
    <FormShell crumb="Bin Operation / Invoice Entry" title="Edit">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Invoice Year">
          <input className="wp-input" placeholder="e.g. 2026" value={searchYear} onChange={(e) => setSearchYear(e.target.value)} />
        </Field>
        <Field label="Invoice No">
          <input className="wp-input" value={searchNo} onChange={(e) => setSearchNo(e.target.value)} />
        </Field>
      </div>

      <button className="wp-btn wp-btn-primary" style={{ marginTop: 14 }} onClick={runSearch} disabled={searching}>
        {searching ? "Searching..." : "Search Query"}
      </button>

      {searchError && (
        <p className="wp-hint" style={{ color: "#b91c1c", fontWeight: 600 }}>{searchError}</p>
      )}

      {results !== null && (
        <div className="wp-table-wrap" style={{ marginTop: 18 }}>
          <table className="wp-table">
            <thead>
              <tr>
                <th>Invoice#</th>
                <th>Mark</th>
                <th>Grade</th>
                <th>Chests</th>
                <th>Store</th>
                <th>Location</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 ? (
                <tr>
                  <td colSpan={7} className="wp-table-empty">
                    No matching invoice found — search by invoice number above.
                  </td>
                </tr>
              ) : (
                results.map((r) => (
                  <tr key={r.invoice_id}>
                    <td>{r.invoice_no}</td>
                    <td>{r.mark}</td>
                    <td>{r.grade}</td>
                    <td>{r.chests}</td>
                    <td>{r.store}</td>
                    <td>{r.allocated_location || "-"}</td>
                    <td>
                      <button className="wp-btn wp-btn-outline" onClick={() => openForEdit(r)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <div style={{ marginTop: 24, borderTop: "1px solid #dfe3df", paddingTop: 18 }}>
          <h4 style={{ margin: "0 0 12px" }}>Editing Invoice {form.invoiceNo}</h4>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Invoice Year">
              <input className="wp-input" value={form.invoiceYear} onChange={set("invoiceYear")} />
            </Field>
            <Field label="Invoice No">
              <input className="wp-input" value={form.invoiceNo} disabled />
            </Field>

            <Field label="Mark">
              <select className="wp-input" value={form.mark} onChange={setMark}>
                <option value="">-- Select from Mark Master --</option>
                {marks.map((m) => (
                  <option key={m.mark_id || m.mark_code} value={m.mark_code}>{m.mark_code} - {m.mark_name}</option>
                ))}
              </select>
            </Field>
            <Field label="Selling Mark">
              <input className="wp-input" value={form.sellingMark} readOnly style={{ background: "#f4f7f2", fontWeight: 700 }} />
            </Field>

            <Field label="Grade">
              <select className="wp-input" value={form.grade} onChange={set("grade")}>
                <option value="">-- Select from Grade Master --</option>
                {grades.map((g) => (
                  <option key={g.grade_id || g.grade_code} value={g.grade_code}>{g.grade_code} - {g.grade_name}</option>
                ))}
              </select>
            </Field>

            <Field label="Packing Type">
              <select className="wp-input" value={form.packingType} onChange={set("packingType")}>
                <option value="">-- Select from Packing Type Master --</option>
                {packingTypes.map((p) => (
                  <option key={p.packing_type_id || p.packing_code} value={p.packing_code}>{p.packing_code} - {p.packing_name}</option>
                ))}
              </select>
            </Field>

            <Field label="Chest Type">
              <select className="wp-input" value={form.chestType} onChange={set("chestType")}>
                <option value="">-- Select --</option>
                {CHEST_TYPES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Broker">
              <select className="wp-input" value={form.broker} onChange={set("broker")}>
                <option value="">-- Select from Broker Master --</option>
                {brokers.map((b) => (
                  <option key={b.broker_id || b.broker_code} value={b.broker_name || b.broker_code}>
                    {b.broker_code ? `${b.broker_code} - ` : ""}{b.broker_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Buyer">
              <input className="wp-input" value={form.buyer} onChange={set("buyer")} />
            </Field>
            <Field label="Arrival / Turn No">
              <input className="wp-input" value={form.turnNo} onChange={set("turnNo")} />
            </Field>
            <Field label="Lorry / Vehicle No">
              <input className="wp-input" value={form.vehicleNo} onChange={set("vehicleNo")} />
            </Field>
            <Field label="Driver Name">
              <input className="wp-input" value={form.driverName} onChange={set("driverName")} />
            </Field>
            <Field label="Driver NIC / DV No">
              <input className="wp-input" value={form.driverNic} onChange={set("driverNic")} />
            </Field>
            <Field label="Chests">
              <input className="wp-input" type="number" min="0" value={form.chests} onChange={set("chests")} />
            </Field>
            <Field label="Weight Per Chest (kg)">
              <input className="wp-input" type="number" min="0" step="0.01" value={form.weightPerChest} onChange={set("weightPerChest")} />
            </Field>
            <Field label="Net Weight Each (kg)">
              <input className="wp-input" type="number" min="0" step="0.01" value={form.netWeightEach} onChange={set("netWeightEach")} />
            </Field>
            <Field label="Moisture Content %">
              <input className="wp-input" type="number" min="0" step="0.01" value={form.moistureContent} onChange={set("moistureContent")} />
            </Field>
            <Field label="MFD Date">
              <input className="wp-input" type="date" value={form.mfdDate || ""} onChange={set("mfdDate")} />
            </Field>
            <Field label="Store">
              <input className="wp-input" value={form.store} onChange={set("store")} />
            </Field>
            <Field label="Date">
              <input className="wp-input" type="date" value={form.date || ""} onChange={set("date")} />
            </Field>
          </div>

          <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 10 }}>
            <button type="button" className="wp-btn wp-btn-outline" onClick={() => setShowLocationPanel((s) => !s)}>
              Location Allocate
            </button>
            {form.location && (
              <span style={{ fontSize: 13, fontWeight: 700, color: "#2f7a3e" }}>
                Allocated: {form.location.location_code}
              </span>
            )}
          </div>

          {showLocationPanel && (
            <LocationAllocatePanel
              selected={form.location}
              onSelect={allocateLocation}
              onClose={() => setShowLocationPanel(false)}
            />
          )}

          {message && (
            <p className="wp-hint" style={{ color: message.type === "error" ? "#b91c1c" : "#1a7a3c", fontWeight: 600 }}>
              {message.text}
            </p>
          )}

          <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
            <button className="wp-btn wp-btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Details"}
            </button>
            <button className="wp-btn wp-btn-outline" onClick={() => setForm(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </FormShell>
  );
}

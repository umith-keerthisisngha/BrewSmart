import { useState } from "react";
import axios from "axios";
import FormShell, { Field, FieldGrid } from "../../../components/warehouse/FormShell";

const EMPTY_FORM = {
  grnNo: "",
  date: new Date().toISOString().slice(0, 10),
  vehicleNo: "",
  supplier: "",
  chests: "",
  remarks: "",
};

export default function GRNAddEdit() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    setMessage(null);
    setSaving(true);
    try {
      const res = await axios.post(
        "http://localhost/BrewSmart/backend/api/grn/create.php",
        form,
        { withCredentials: true }
      );
      if (res.data.success) {
        setMessage({ type: "success", text: `GRN ${res.data.data.grn_no} saved successfully.` });
        setForm(EMPTY_FORM);
      } else {
        setMessage({ type: "error", text: res.data.message || "Save failed." });
      }
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Could not reach the server." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormShell crumb="Bin Operation / GRN" title="Add / Edit GRN">
      <FieldGrid>
        <Field label="GRN No (leave blank to auto-generate)">
          <input className="wp-input" value={form.grnNo} onChange={set("grnNo")} />
        </Field>
        <Field label="Date">
          <input className="wp-input" type="date" value={form.date} onChange={set("date")} />
        </Field>
        <Field label="Vehicle No">
          <input className="wp-input" value={form.vehicleNo} onChange={set("vehicleNo")} />
        </Field>
        <Field label="Supplier">
          <input className="wp-input" value={form.supplier} onChange={set("supplier")} />
        </Field>
        <Field label="Chests">
          <input className="wp-input" type="number" min="0" value={form.chests} onChange={set("chests")} />
        </Field>
        <Field label="Remarks">
          <input className="wp-input" value={form.remarks} onChange={set("remarks")} />
        </Field>
      </FieldGrid>

      {message && (
        <p className="wp-hint" style={{ color: message.type === "error" ? "#b91c1c" : "#1a7a3c", fontWeight: 600 }}>
          {message.text}
        </p>
      )}

      <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
        <button className="wp-btn wp-btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          className="wp-btn wp-btn-outline"
          onClick={() => {
            setForm(EMPTY_FORM);
            setMessage(null);
          }}
        >
          Clear
        </button>
      </div>
    </FormShell>
  );
}

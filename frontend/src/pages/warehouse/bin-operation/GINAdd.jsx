import { useState } from "react";
import axios from "axios";
import FormShell, { Field, FieldGrid } from "../../../components/warehouse/FormShell";

const EMPTY_FORM = {
  ginNo: "",
  date: new Date().toISOString().slice(0, 10),
  buyer: "",
  invoiceNo: "",
  chests: "",
};

export default function GINAdd() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    setMessage(null);
    setSaving(true);
    try {
      const res = await axios.post(
        "http://localhost/BrewSmart/backend/api/gin/create.php",
        form,
        { withCredentials: true }
      );
      if (res.data.success) {
        setMessage({ type: "success", text: `GIN ${res.data.data.gin_no} saved successfully.` });
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
    <FormShell crumb="Bin Operation / GIN" title="Add GIN">
      <FieldGrid>
        <Field label="GIN No (leave blank to auto-generate)">
          <input className="wp-input" value={form.ginNo} onChange={set("ginNo")} />
        </Field>
        <Field label="Date">
          <input className="wp-input" type="date" value={form.date} onChange={set("date")} />
        </Field>
        <Field label="Buyer">
          <input className="wp-input" value={form.buyer} onChange={set("buyer")} />
        </Field>
        <Field label="Invoice No">
          <input className="wp-input" value={form.invoiceNo} onChange={set("invoiceNo")} />
        </Field>
        <Field label="Chests">
          <input className="wp-input" type="number" min="0" value={form.chests} onChange={set("chests")} />
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

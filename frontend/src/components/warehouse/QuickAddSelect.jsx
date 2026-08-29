import { useState } from "react";

/**
 * A <select> bound to a master-data list (Mark / Grade / Packing Type / ...),
 * with a small "+ Add" affordance so a missing option can be created on the
 * spot without leaving the page. The newly created option is selected right
 * away, and `onAdded` lets the parent refresh its cached meta list too.
 */
export default function QuickAddSelect({
  label,
  required = false,
  options, // [{ value, label }]
  value,
  onChange,
  onCreate, // async ({ code, name }) => { value, label }
  onAdded, // optional: (newOption) => void, e.g. to update a shared meta cache
  codeLabel = "Code",
  nameLabel = "Name",
  placeholder = "-- Select --",
}) {
  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const startAdd = () => {
    setError(null);
    setCode("");
    setName("");
    setAdding(true);
  };

  const cancelAdd = () => {
    setAdding(false);
    setError(null);
  };

  const submitAdd = async () => {
    if (!code.trim()) {
      setError(`${codeLabel} is required.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await onCreate({ code: code.trim(), name: name.trim() || code.trim() });
      onChange(created.value);
      onAdded?.(created);
      setAdding(false);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Could not add this item.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#444a44", display: "flex", justifyContent: "space-between" }}>
        <span>
          {label}
          {required ? " *" : ""}
        </span>
        {!adding && (
          <button
            type="button"
            onClick={startAdd}
            style={{
              border: "none",
              background: "none",
              color: "#2f7a3e",
              fontWeight: 700,
              fontSize: 11,
              cursor: "pointer",
              padding: 0,
            }}
          >
            + Add New
          </button>
        )}
      </span>

      {!adding ? (
        <select className="wp-input" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <div
          style={{
            border: "1px dashed #6baa2e",
            borderRadius: 4,
            padding: 8,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            background: "#f7fbf4",
          }}
        >
          <input
            className="wp-input"
            placeholder={codeLabel}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
          />
          <input
            className="wp-input"
            placeholder={`${nameLabel} (optional)`}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {error && <span style={{ color: "#b91c1c", fontSize: 11, fontWeight: 600 }}>{error}</span>}
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              className="wp-btn wp-btn-primary"
              style={{ padding: "6px 14px", fontSize: 12 }}
              onClick={submitAdd}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              className="wp-btn wp-btn-outline"
              style={{ padding: "6px 14px", fontSize: 12 }}
              onClick={cancelAdd}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

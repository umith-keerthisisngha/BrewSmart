import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import FormShell, { Field } from "../../../components/warehouse/FormShell";
import LocationAllocatePanel from "../../../components/warehouse/LocationAllocatePanel";

const API = "http://localhost/BrewSmart/backend/api";
const CHEST_TYPES = ["A", "B", "C", "D", "BAG"];

const makeEmptyForm = () => ({
  invoiceYear: new Date().getFullYear().toString(),
  invoiceNo: "",
  mark: "",
  sellingMark: "",
  grade: "",
  packingType: "",
  chestType: "",
  broker: "",
  chests: "",
  weightPerChest: "",
  netWeightEach: "",
  totalGrossWeight: "",
  moistureContent: "",
  mfdDate: "",
  sampleDrawn: false,
  reprint: false,
  exportable: false,
  colourSeparated: false,
  store: "",
  date: new Date().toISOString().slice(0, 10),
});

export default function InvoiceEntryAdd() {
  const [form, setForm] = useState(makeEmptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [marks, setMarks] = useState([]);
  const [grades, setGrades] = useState([]);
  const [packingTypes, setPackingTypes] = useState([]);
  const [metaLoading, setMetaLoading] = useState(true);

  const [showLocationPanel, setShowLocationPanel] = useState(false);
  const [location, setLocation] = useState(null);
  const [autoAllocate, setAutoAllocate] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState("");

  const totalNetWeight = useMemo(() => {
    const chests = Number(form.chests || 0);
    const each = Number(form.netWeightEach || 0);
    return chests > 0 && each > 0 ? (chests * each).toFixed(2) : "0.00";
  }, [form.chests, form.netWeightEach]);

  useEffect(() => {
    axios
      .get(`${API}/meta.php`, { withCredentials: true })
      .then((res) => {
        const d = res.data.data || {};
        setMarks(d.marks || []);
        setGrades(d.grades || []);
        setPackingTypes(d.packing_types || []);
      })
      .finally(() => setMetaLoading(false));
  }, []);

  // AI model is embedded in the Add New screen. Once the core weight details are
  // available it previews a safe allocation plan automatically.
  useEffect(() => {
    const chests = Number(form.chests || 0);
    const bagWeight = Number(form.netWeightEach || 0);
    if (chests <= 0 || bagWeight <= 0) {
      setAiResult(null);
      setAiError("");
      if (autoAllocate) setLocation(null);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setAiLoading(true);
      setAiError("");
      try {
        const res = await axios.post(`${API}/invoices/recommend-location.php`, form, {
          withCredentials: true,
        });
        if (cancelled) return;
        const data = res.data.data || null;
        setAiResult(data);
        if (autoAllocate) {
          const first = data?.plan?.[0];
          setLocation(
            first
              ? {
                  location_id: first.location_id,
                  location_code: first.location_code,
                  score: first.score,
                }
              : null
          );
        }
      } catch (err) {
        if (cancelled) return;
        setAiResult(null);
        setAiError(err.response?.data?.message || "AI location model could not be reached.");
        if (autoAllocate) setLocation(null);
      } finally {
        if (!cancelled) setAiLoading(false);
      }
    }, 550);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    form.chests,
    form.netWeightEach,
    form.grade,
    form.packingType,
    form.mark,
    form.chestType,
    autoAllocate,
  ]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setChecked = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.checked }));

  const resetForm = () => {
    setForm(makeEmptyForm());
    setLocation(null);
    setShowLocationPanel(false);
    setMessage(null);
    setAiResult(null);
    setAiError("");
    setAutoAllocate(true);
  };

  const handleSave = async () => {
    setMessage(null);
    if (!form.invoiceNo.trim()) {
      setMessage({ type: "error", text: "Invoice No is required." });
      return;
    }
    if (!form.chests || Number(form.chests) <= 0) {
      setMessage({ type: "error", text: "Chests must be greater than 0." });
      return;
    }
    if (!form.netWeightEach || Number(form.netWeightEach) <= 0) {
      setMessage({ type: "error", text: "Net Weight Each is required for net-weight calculation and safe AI allocation." });
      return;
    }
    if (autoAllocate && (!aiResult?.can_allocate || !aiResult?.plan?.length)) {
      setMessage({ type: "error", text: "No complete safe AI allocation plan is available yet. Check the entered weight/capacity details." });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        totalNetWeight,
        autoAllocate,
        locationId: autoAllocate ? "" : location?.location_id ?? "",
        locationCode: autoAllocate ? "" : location?.location_code ?? "",
      };
      const res = await axios.post(`${API}/invoices/create.php`, payload, { withCredentials: true });
      if (res.data.success) {
        const plan = res.data.data?.allocation_plan || [];
        const allocationText = plan.length
          ? ` Locations: ${plan.map((p) => `${p.location_code} × ${p.chests_allocated}`).join(", ")}.`
          : "";
        setMessage({
          type: "success",
          text: `Invoice ${res.data.data.invoice_no} saved successfully. Net weight ${Number(res.data.data.total_net_weight || 0).toFixed(2)} kg.${allocationText}`,
        });
        setForm(makeEmptyForm());
        setLocation(null);
        setAiResult(null);
        setShowLocationPanel(false);
        setAutoAllocate(true);
      } else {
        setMessage({ type: "error", text: res.data.message || "Save failed." });
      }
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Could not reach the server.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormShell crumb="Bin Operation / Invoice Entry" title="Add New">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Invoice Year">
          <input className="wp-input" value={form.invoiceYear} onChange={set("invoiceYear")} placeholder="e.g. 2026" />
        </Field>
        <Field label="Invoice No *">
          <input className="wp-input" value={form.invoiceNo} onChange={set("invoiceNo")} />
        </Field>

        {!metaLoading && (
          <>
            <Field label="Mark">
              <select className="wp-input" value={form.mark} onChange={set("mark")}>
                <option value="">-- Select from Mark Master --</option>
                {marks.map((m) => (
                  <option key={m.mark_id || m.mark_code} value={m.mark_code}>{m.mark_code} - {m.mark_name}</option>
                ))}
              </select>
            </Field>
            <Field label="Selling Mark">
              <input className="wp-input" value={form.sellingMark} onChange={set("sellingMark")} />
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
          </>
        )}

        <Field label="Chest Type">
          <select className="wp-input" value={form.chestType} onChange={set("chestType")}>
            <option value="">-- Select --</option>
            {CHEST_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>

        <Field label="Broker">
          <input className="wp-input" value={form.broker} onChange={set("broker")} />
        </Field>
        <Field label="Chests *">
          <input className="wp-input" type="number" min="0" value={form.chests} onChange={set("chests")} />
        </Field>
        <Field label="Weight Per Chest (kg)">
          <input className="wp-input" type="number" min="0" step="0.01" value={form.weightPerChest} onChange={set("weightPerChest")} />
        </Field>
        <Field label="Net Weight Each (kg) *">
          <input className="wp-input" type="number" min="0" step="0.01" value={form.netWeightEach} onChange={set("netWeightEach")} />
        </Field>
        <Field label="Total Net Weight (kg) - Auto">
          <input className="wp-input" value={totalNetWeight} readOnly style={{ fontWeight: 800, background: "#f0f7ed" }} />
        </Field>
        <Field label="Total Gross Weight (kg)">
          <input className="wp-input" type="number" min="0" step="0.01" value={form.totalGrossWeight} onChange={set("totalGrossWeight")} />
        </Field>
        <Field label="Moisture Content %">
          <input className="wp-input" type="number" min="0" step="0.01" value={form.moistureContent} onChange={set("moistureContent")} />
        </Field>
        <Field label="MFD Date">
          <input className="wp-input" type="date" value={form.mfdDate} onChange={set("mfdDate")} />
        </Field>
        <Field label="Store">
          <input className="wp-input" value={form.store} onChange={set("store")} />
        </Field>
        <Field label="Date">
          <input className="wp-input" type="date" value={form.date} onChange={set("date")} />
        </Field>
      </div>

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 16 }}>
        {[
          ["sampleDrawn", "Sample Drawn"],
          ["reprint", "Reprint"],
          ["exportable", "Exportable"],
          ["colourSeparated", "Colour Separated"],
        ].map(([key, label]) => (
          <label key={key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={form[key]} onChange={setChecked(key)} /> {label}
          </label>
        ))}
      </div>

      <div className="wp-panel" style={{ marginTop: 20 }}>
        <div className="wp-panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <span>AI Location Allocation Model</span>
          <span style={{ fontSize: 11, opacity: 0.8 }}>Rule Engine + Weighted Model 2026.2</span>
        </div>
        <div className="wp-panel-body">
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={autoAllocate}
              onChange={(e) => {
                setAutoAllocate(e.target.checked);
                if (!e.target.checked) setLocation(null);
              }}
            />
            Automatically allocate the best safe location when I save
          </label>

          {aiLoading && <p className="wp-hint" style={{ marginTop: 12 }}>Analyzing capacity, weight, safety rules and rack balance...</p>}
          {aiError && <p className="wp-hint" style={{ color: "#b91c1c", fontWeight: 700 }}>{aiError}</p>}
          {!aiLoading && !aiResult && !aiError && (
            <p className="wp-hint" style={{ marginTop: 12 }}>Enter Chests and Net Weight Each to run the location model automatically.</p>
          )}

          {aiResult && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <strong style={{ color: aiResult.can_allocate ? "#236c38" : "#b45309" }}>
                  {aiResult.can_allocate ? "SAFE ALLOCATION PLAN READY" : "PARTIAL PLAN ONLY"}
                </strong>
                <span className="wp-hint">Allowed levels: {(aiResult.profile?.allowed_levels || []).join(", ") || "None"}</span>
                <span className="wp-hint">Model: {aiResult.model_version}</span>
              </div>

              {(aiResult.profile?.rules_applied || []).length > 0 && (
                <p className="wp-hint" style={{ marginTop: 8 }}>
                  Safety rules: {aiResult.profile.rules_applied.join(" • ")}
                </p>
              )}

              <div className="wp-table-wrap" style={{ marginTop: 12 }}>
                <table className="wp-table">
                  <thead>
                    <tr>
                      <th>Location</th><th>Level</th><th>Chests</th><th>Weight</th><th>Score</th><th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(aiResult.plan || []).length === 0 ? (
                      <tr><td colSpan={6} className="wp-table-empty">No safe location can currently accept this invoice.</td></tr>
                    ) : (
                      aiResult.plan.map((p) => (
                        <tr key={p.location_id}>
                          <td style={{ fontWeight: 800 }}>{p.location_code}</td>
                          <td>{p.level_code}</td>
                          <td>{p.chests_allocated}</td>
                          <td>{Number(p.weight_allocated || 0).toFixed(2)} kg</td>
                          <td>{p.score}%</td>
                          <td style={{ maxWidth: 420 }}>{p.reason}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {!aiResult.can_allocate && aiResult.remaining_bags > 0 && (
                <p className="wp-hint" style={{ color: "#b45309", fontWeight: 700 }}>
                  {aiResult.remaining_bags} chest(s) still need safe capacity.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          className="wp-btn wp-btn-outline"
          onClick={() => {
            setAutoAllocate(false);
            setShowLocationPanel((s) => !s);
          }}
        >
          Manual Location Override
        </button>
        {location && (
          <span style={{ fontSize: 13, fontWeight: 700, color: "#2f7a3e" }}>
            {autoAllocate ? "AI Primary Location" : "Manual Location"}: {location.location_code}
            {location.score ? ` (${location.score}%)` : ""}
          </span>
        )}
      </div>

      {showLocationPanel && (
        <LocationAllocatePanel
          selected={location}
          onSelect={(loc) => {
            setLocation(loc);
            setAutoAllocate(false);
            setShowLocationPanel(false);
          }}
          onClose={() => setShowLocationPanel(false)}
        />
      )}

      {message && (
        <p className="wp-hint" style={{ color: message.type === "error" ? "#b91c1c" : "#1a7a3c", fontWeight: 700, marginTop: 14 }}>
          {message.text}
        </p>
      )}

      <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
        <button className="wp-btn wp-btn-primary" onClick={handleSave} disabled={saving || aiLoading}>
          {saving ? "Saving & Allocating..." : "Save Invoice"}
        </button>
        <button className="wp-btn wp-btn-outline" onClick={resetForm}>Clear</button>
      </div>
    </FormShell>
  );
}

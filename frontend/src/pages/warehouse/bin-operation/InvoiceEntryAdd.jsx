import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import FormShell from "../../../components/warehouse/FormShell";
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
  chestType: "B",
  broker: "",
  turnNo: "",
  vehicleNo: "",
  driverName: "",
  driverNic: "",
  chests: "",
  netWeightEach: "",
  moistureContent: "",
  mfdDate: "",
  sampleDrawn: false,
  reprint: false,
  exportable: false,
  colourSeparated: false,
  store: "BrewSmart Warehouse",
  date: new Date().toISOString().slice(0, 10),
});

function InlineField({ label, children, className = "" }) {
  return (
    <label className={`wp-inline-field ${className}`.trim()}>
      <span className="wp-inline-label">{label}</span>
      <span className="wp-inline-control">{children}</span>
    </label>
  );
}

export default function InvoiceEntryAdd() {
  const [form, setForm] = useState(makeEmptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [marks, setMarks] = useState([]);
  const [grades, setGrades] = useState([]);
  const [packingTypes, setPackingTypes] = useState([]);
  const [brokers, setBrokers] = useState([]);
  const [metaLoading, setMetaLoading] = useState(true);

  const [showLocationPanel, setShowLocationPanel] = useState(false);
  const [showAiDetails, setShowAiDetails] = useState(false);
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
        setBrokers(d.brokers || []);
      })
      .catch(() => setMessage({ type: "error", text: "Could not load Master data." }))
      .finally(() => setMetaLoading(false));
  }, []);

  // Keep the AI model live in the Add New form. The actual save endpoint runs the
  // same safety/optimization flow again, so frontend preview is never authoritative.
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
    }, 450);

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
  const setMark = (e) => {
    const code = e.target.value;
    const selectedMark = marks.find((m) => String(m.mark_code) === String(code));
    setForm((f) => ({
      ...f,
      mark: code,
      sellingMark: selectedMark ? selectedMark.mark_name || selectedMark.mark_code || code : "",
    }));
  };
  const setChecked = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.checked }));

  const resetForm = () => {
    setForm(makeEmptyForm());
    setLocation(null);
    setShowLocationPanel(false);
    setShowAiDetails(false);
    setMessage(null);
    setAiResult(null);
    setAiError("");
    setAutoAllocate(true);
  };

  const handleSave = async () => {
    setMessage(null);
    if (!form.broker.trim()) {
      setMessage({ type: "error", text: "Broker is required." });
      return;
    }
    if (!form.turnNo.trim()) {
      setMessage({ type: "error", text: "Turn No is required so GRN can auto-load this arrival later." });
      return;
    }
    if (!form.invoiceNo.trim()) {
      setMessage({ type: "error", text: "Invoice No is required." });
      return;
    }
    if (!form.chests || Number(form.chests) <= 0) {
      setMessage({ type: "error", text: "No. of Chests must be greater than 0." });
      return;
    }
    if (!form.netWeightEach || Number(form.netWeightEach) <= 0) {
      setMessage({ type: "error", text: "Net Weight Each is required." });
      return;
    }
    if (autoAllocate && (!aiResult?.can_allocate || !aiResult?.plan?.length)) {
      setMessage({ type: "error", text: "No complete safe AI allocation plan is available yet." });
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
          text: `Invoice ${res.data.data.invoice_no} saved successfully. Net weight ${Number(
            res.data.data.total_net_weight || 0
          ).toFixed(2)} kg.${allocationText}`,
        });
        setForm(makeEmptyForm());
        setLocation(null);
        setAiResult(null);
        setShowLocationPanel(false);
        setShowAiDetails(false);
        setAutoAllocate(true);
      } else {
        setMessage({ type: "error", text: res.data.message || "Save failed." });
      }
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Could not reach the server." });
    } finally {
      setSaving(false);
    }
  };

  const previewReady = Boolean(form.invoiceNo || form.chests || form.grade || form.mark);

  return (
    <FormShell crumb="Bin Operation / Invoice Entry" title="Invoice Entry">
      <div className="wp-entry-screen">
        <div className="wp-entry-strip">
          <div>
            <span className="wp-entry-strip-label">RECEIVING MODE</span>
            <strong>Broker Arrival</strong>
          </div>
          <div className="wp-entry-strip-actions">
            <span className="wp-status-pill">BrewSmart Warehouse</span>
          </div>
        </div>

        <section className="wp-form-section">
          <div className="wp-form-section-title">Arrival / Turn Information</div>
          <div className="wp-form-section-body wp-entry-grid wp-entry-grid-4">
            <InlineField label="Broker *" className="wp-span-2">
              <select className="wp-input" value={form.broker} onChange={set("broker")} disabled={metaLoading}>
                <option value="">-- Select Broker --</option>
                {brokers.map((b) => (
                  <option key={b.broker_id || b.broker_code} value={b.broker_name || b.broker_code}>
                    {b.broker_code ? `${b.broker_code} - ` : ""}{b.broker_name}
                  </option>
                ))}
              </select>
            </InlineField>

            <InlineField label="Store" className="wp-span-2">
              <input className="wp-input wp-readonly" value={form.store} readOnly />
            </InlineField>

            <InlineField label="Turn Date">
              <input className="wp-input" type="date" value={form.date} onChange={set("date")} />
            </InlineField>
            <InlineField label="Turn No. *">
              <input className="wp-input" value={form.turnNo} onChange={set("turnNo")} placeholder="e.g. TURN-020" />
            </InlineField>
            <InlineField label="Lorry No.">
              <input className="wp-input" value={form.vehicleNo} onChange={set("vehicleNo")} />
            </InlineField>
            <InlineField label="NIC/DV No.">
              <input className="wp-input" value={form.driverNic} onChange={set("driverNic")} />
            </InlineField>

            <InlineField label="Invoice Date">
              <input className="wp-input" type="date" value={form.date} onChange={set("date")} />
            </InlineField>
            <InlineField label="Invoice Year">
              <input className="wp-input" value={form.invoiceYear} onChange={set("invoiceYear")} />
            </InlineField>
            <InlineField label="Driver Name" className="wp-span-2">
              <input className="wp-input" value={form.driverName} onChange={set("driverName")} />
            </InlineField>

            <InlineField label="Mark" className="wp-span-2">
              <select className="wp-input" value={form.mark} onChange={setMark} disabled={metaLoading}>
                <option value="">-- Select Mark --</option>
                {marks.map((m) => (
                  <option key={m.mark_id || m.mark_code} value={m.mark_code}>
                    {m.mark_code} - {m.mark_name}
                  </option>
                ))}
              </select>
            </InlineField>
            <InlineField label="Selling Mark" className="wp-span-2">
              <input className="wp-input wp-readonly" value={form.sellingMark} readOnly placeholder="Auto from selected Mark" />
            </InlineField>
          </div>
        </section>

        <section className="wp-form-section">
          <div className="wp-form-section-title">Invoice Details</div>
          <div className="wp-form-section-body wp-entry-grid wp-entry-grid-4">
            <InlineField label="Invoice Number">
              <input className="wp-input" value={form.invoiceNo} onChange={set("invoiceNo")} />
            </InlineField>
            <InlineField label="Grade">
              <select className="wp-input" value={form.grade} onChange={set("grade")} disabled={metaLoading}>
                <option value="">-- Select Grade --</option>
                {grades.map((g) => (
                  <option key={g.grade_id || g.grade_code} value={g.grade_code}>
                    {g.grade_code} - {g.grade_name}
                  </option>
                ))}
              </select>
            </InlineField>
            <InlineField label="No. of Chests *">
              <input className="wp-input" type="number" min="1" value={form.chests} onChange={set("chests")} />
            </InlineField>
            <InlineField label="Chest Type">
              <select className="wp-input" value={form.chestType} onChange={set("chestType")}>
                {CHEST_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </InlineField>

            <InlineField label="Net Weight Each *">
              <input className="wp-input" type="number" min="0" step="0.01" value={form.netWeightEach} onChange={set("netWeightEach")} />
            </InlineField>
            <InlineField label="Packing Type">
              <select className="wp-input" value={form.packingType} onChange={set("packingType")} disabled={metaLoading}>
                <option value="">-- Select Packing Type --</option>
                {packingTypes.map((p) => (
                  <option key={p.packing_type_id || p.packing_code} value={p.packing_code}>
                    {p.packing_code} - {p.packing_name}
                  </option>
                ))}
              </select>
            </InlineField>
            <InlineField label="Moisture Content %">
              <input className="wp-input" type="number" min="0" step="0.01" value={form.moistureContent} onChange={set("moistureContent")} />
            </InlineField>
            <InlineField label="MFD">
              <input className="wp-input" type="date" value={form.mfdDate} onChange={set("mfdDate")} />
            </InlineField>

            <div className="wp-checkbox-line wp-span-3">
              {[
                ["sampleDrawn", "Sample Drawn"],
                ["reprint", "Reprint"],
                ["exportable", "Exportable"],
                ["colourSeparated", "Colour Separated"],
              ].map(([key, label]) => (
                <label key={key}>
                  <input type="checkbox" checked={form[key]} onChange={setChecked(key)} /> {label}
                </label>
              ))}
            </div>

            <InlineField label="Total Net Weight">
              <input className="wp-input wp-readonly wp-total-input" value={`${totalNetWeight} kg`} readOnly />
            </InlineField>

            <div className="wp-location-command wp-span-4">
              <button
                type="button"
                className="wp-btn wp-btn-info"
                onClick={() => setShowAiDetails((v) => !v)}
                disabled={!form.chests || !form.netWeightEach}
              >
                Location Allocate
              </button>
              {aiLoading && <span className="wp-ai-inline">AI analyzing...</span>}
              {!aiLoading && location && (
                <span className="wp-ai-inline wp-ai-success">
                  AI Primary Location: {location.location_code}{location.score ? ` (${location.score}%)` : ""}
                </span>
              )}
              {!aiLoading && aiError && <span className="wp-ai-inline wp-ai-error">{aiError}</span>}
            </div>
          </div>
        </section>

        {showAiDetails && (
          <section className="wp-form-section wp-ai-section">
            <div className="wp-form-section-title wp-title-with-meta">
              <span>AI Location Allocation</span>
              <small>Safety Rule Engine + Weighted Optimization Model</small>
            </div>
            <div className="wp-form-section-body">
              <div className="wp-ai-toolbar">
                <label className="wp-checkbox-strong">
                  <input
                    type="checkbox"
                    checked={autoAllocate}
                    onChange={(e) => {
                      setAutoAllocate(e.target.checked);
                      if (!e.target.checked) setLocation(null);
                    }}
                  />
                  Auto allocate best safe location when saving
                </label>
                <button
                  type="button"
                  className="wp-btn wp-btn-outline"
                  onClick={() => {
                    setAutoAllocate(false);
                    setShowLocationPanel(true);
                  }}
                >
                  Manual Override
                </button>
              </div>

              {aiResult && (
                <>
                  <div className="wp-ai-summary-row">
                    <strong className={aiResult.can_allocate ? "ok" : "warn"}>
                      {aiResult.can_allocate ? "SAFE ALLOCATION PLAN READY" : "PARTIAL PLAN ONLY"}
                    </strong>
                    <span>Allowed levels: {(aiResult.profile?.allowed_levels || []).join(", ") || "None"}</span>
                    <span>Model: {aiResult.model_version}</span>
                  </div>
                  <div className="wp-table-wrap wp-compact-table-wrap">
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
                              <td><strong>{p.location_code}</strong></td>
                              <td>{p.level_code}</td>
                              <td>{p.chests_allocated}</td>
                              <td>{Number(p.weight_allocated || 0).toFixed(2)} kg</td>
                              <td>{p.score}%</td>
                              <td>{p.reason}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </section>
        )}

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

        <section className="wp-form-section wp-entry-detail-section">
          <div className="wp-form-section-title">Invoice Entry Details</div>
          <div className="wp-table-wrap">
            <table className="wp-table wp-entry-preview-table">
              <thead>
                <tr>
                  <th>Invoice Number</th>
                  <th>No. of Chests</th>
                  <th>Net Weight Each</th>
                  <th>Total Net Weight</th>
                  <th>Grade</th>
                  <th>Chest Type</th>
                  <th>Packing Type</th>
                  <th>MFD Date</th>
                  <th>Moisture %</th>
                  <th>Sample</th>
                  <th>AI</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {previewReady ? (
                  <tr>
                    <td>{form.invoiceNo || "—"}</td>
                    <td>{form.chests || "—"}</td>
                    <td>{form.netWeightEach ? `${form.netWeightEach} kg` : "—"}</td>
                    <td>{totalNetWeight} kg</td>
                    <td>{form.grade || "—"}</td>
                    <td>{form.chestType || "—"}</td>
                    <td>{form.packingType || "—"}</td>
                    <td>{form.mfdDate || "—"}</td>
                    <td>{form.moistureContent || "—"}</td>
                    <td>{form.sampleDrawn ? "Yes" : "No"}</td>
                    <td>{autoAllocate ? "Auto" : "Manual"}</td>
                    <td><strong>{location?.location_code || "Pending"}</strong></td>
                  </tr>
                ) : (
                  <tr><td colSpan={12} className="wp-table-empty">No records to view</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {message && (
          <div className={`wp-message ${message.type === "error" ? "error" : "success"}`}>{message.text}</div>
        )}

        <div className="wp-entry-footer-actions">
          <button className="wp-btn wp-btn-warning" type="button" onClick={resetForm}>Reset Form</button>
          <button className="wp-btn wp-btn-primary" type="button" onClick={handleSave} disabled={saving || aiLoading}>
            {saving ? "Saving & Allocating..." : "Save Details"}
          </button>
        </div>
      </div>
    </FormShell>
  );
}

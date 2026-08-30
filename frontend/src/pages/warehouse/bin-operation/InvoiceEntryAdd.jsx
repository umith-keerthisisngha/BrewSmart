import { API_BASE as API } from "../../../config/api";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import FormShell from "../../../components/warehouse/FormShell";
import LocationAllocatePanel from "../../../components/warehouse/LocationAllocatePanel";

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

function invoiceOnlyBlank(form) {
  return {
    ...form,
    invoiceNo: "",
    mark: "",
    sellingMark: "",
    grade: "",
    packingType: "",
    chestType: "B",
    chests: "",
    netWeightEach: "",
    moistureContent: "",
    mfdDate: "",
    sampleDrawn: false,
    reprint: false,
    exportable: false,
    colourSeparated: false,
  };
}

export default function InvoiceEntryAdd() {
  const [form, setForm] = useState(makeEmptyForm);
  const [turnInvoices, setTurnInvoices] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
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

  const headerLocked = turnInvoices.length > 0;

  const totalNetWeight = useMemo(() => {
    const chests = Number(form.chests || 0);
    const each = Number(form.netWeightEach || 0);
    return chests > 0 && each > 0 ? (chests * each).toFixed(2) : "0.00";
  }, [form.chests, form.netWeightEach]);

  const selectedGrade = useMemo(() => grades.find((g) => String(g.grade_code) === String(form.grade)) || null, [grades, form.grade]);
  const gradeWeightError = useMemo(() => {
    if (!form.grade) return "";
    if (!selectedGrade) return "Selected grade is not available in Grade Master.";
    const density = Number(selectedGrade.packing_density || 0);
    const minW = Number(selectedGrade.min_bag_weight || 0);
    const maxW = Number(selectedGrade.max_bag_weight || 0);
    if (!(density > 0) || !(minW > 0) || !(maxW > 0)) return `Grade ${form.grade} is not configured with Packing Density and Bag Weight range.`;
    const weight = Number(form.netWeightEach || 0);
    if (weight > 0 && (weight < minW || weight > maxW)) return `Grade ${form.grade} allows ${minW.toFixed(2)}–${maxW.toFixed(2)} kg per bag. Entered: ${weight.toFixed(2)} kg.`;
    return "";
  }, [form.grade, form.netWeightEach, selectedGrade]);

  const turnTotals = useMemo(() => {
    return turnInvoices.reduce(
      (acc, row) => {
        acc.invoices += 1;
        acc.chests += Number(row.chests || 0);
        acc.weight += Number(row.totalNetWeight || 0);
        return acc;
      },
      { invoices: 0, chests: 0, weight: 0 }
    );
  }, [turnInvoices]);

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

  // Live AI preview for the invoice currently being entered. Final Save Turn
  // recalculates every invoice sequentially on the backend inside one transaction.
  useEffect(() => {
    const chests = Number(form.chests || 0);
    const bagWeight = Number(form.netWeightEach || 0);
    if (chests <= 0 || bagWeight <= 0 || gradeWeightError) {
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
    gradeWeightError,
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

  const clearCurrentInvoice = () => {
    setForm((f) => invoiceOnlyBlank(f));
    setEditingIndex(null);
    setLocation(null);
    setAiResult(null);
    setAiError("");
    setShowLocationPanel(false);
    setShowAiDetails(false);
    setAutoAllocate(true);
    setMessage(null);
  };

  const resetTurn = () => {
    setForm(makeEmptyForm());
    setTurnInvoices([]);
    setEditingIndex(null);
    setLocation(null);
    setShowLocationPanel(false);
    setShowAiDetails(false);
    setMessage(null);
    setAiResult(null);
    setAiError("");
    setAutoAllocate(true);
  };

  const validateCurrentInvoice = () => {
    if (!form.broker.trim()) return "Broker is required.";
    if (!form.turnNo.trim()) return "Turn No is required.";
    if (!form.invoiceNo.trim()) return "Invoice No is required.";
    if (!form.mark.trim()) return "Mark is required.";
    if (!form.grade.trim()) return "Grade is required.";
    if (!form.chests || Number(form.chests) <= 0) return "No. of Chests must be greater than 0.";
    if (!form.netWeightEach || Number(form.netWeightEach) <= 0) return "Net Weight Each is required.";
    if (gradeWeightError) return gradeWeightError;
    if (autoAllocate && (!aiResult?.can_allocate || !aiResult?.plan?.length)) {
      return "No complete safe AI allocation plan is available for this invoice yet.";
    }
    if (!autoAllocate && !location?.location_id) return "Choose a manual location or enable Auto Allocate.";
    return "";
  };

  const handleAddToGrid = () => {
    setMessage(null);
    const error = validateCurrentInvoice();
    if (error) {
      setMessage({ type: "error", text: error });
      return;
    }

    const duplicateIndex = turnInvoices.findIndex(
      (row, idx) => idx !== editingIndex && row.invoiceNo.trim().toLowerCase() === form.invoiceNo.trim().toLowerCase()
    );
    if (duplicateIndex >= 0) {
      setMessage({ type: "error", text: `Invoice ${form.invoiceNo} is already in this Turn grid.` });
      return;
    }

    const row = {
      invoiceYear: form.invoiceYear,
      invoiceNo: form.invoiceNo.trim(),
      mark: form.mark,
      sellingMark: form.sellingMark,
      grade: form.grade,
      packingType: form.packingType,
      chestType: form.chestType,
      chests: Number(form.chests),
      netWeightEach: Number(form.netWeightEach),
      totalNetWeight: Number(totalNetWeight),
      moistureContent: form.moistureContent,
      mfdDate: form.mfdDate,
      sampleDrawn: form.sampleDrawn,
      reprint: form.reprint,
      exportable: form.exportable,
      colourSeparated: form.colourSeparated,
      autoAllocate,
      locationId: autoAllocate ? "" : location?.location_id ?? "",
      locationCode: autoAllocate ? "" : location?.location_code ?? "",
      previewPlan: aiResult?.plan || [],
      previewPrimary: location?.location_code || "Pending",
      previewScore: location?.score || null,
    };

    setTurnInvoices((rows) => {
      if (editingIndex === null) return [...rows, row];
      return rows.map((r, idx) => (idx === editingIndex ? row : r));
    });
    setMessage({
      type: "success",
      text: editingIndex === null
        ? `Invoice ${row.invoiceNo} added to Turn ${form.turnNo}. Enter the next invoice, then save the Turn when finished.`
        : `Invoice ${row.invoiceNo} updated in the Turn grid.`,
    });
    setForm((f) => invoiceOnlyBlank(f));
    setEditingIndex(null);
    setLocation(null);
    setAiResult(null);
    setAiError("");
    setShowLocationPanel(false);
    setShowAiDetails(false);
    setAutoAllocate(true);
  };

  const handleEditGridRow = (index) => {
    const row = turnInvoices[index];
    setForm((f) => ({
      ...f,
      invoiceYear: String(row.invoiceYear || f.invoiceYear),
      invoiceNo: row.invoiceNo || "",
      mark: row.mark || "",
      sellingMark: row.sellingMark || "",
      grade: row.grade || "",
      packingType: row.packingType || "",
      chestType: row.chestType || "B",
      chests: String(row.chests || ""),
      netWeightEach: String(row.netWeightEach || ""),
      moistureContent: row.moistureContent ?? "",
      mfdDate: row.mfdDate || "",
      sampleDrawn: Boolean(row.sampleDrawn),
      reprint: Boolean(row.reprint),
      exportable: Boolean(row.exportable),
      colourSeparated: Boolean(row.colourSeparated),
    }));
    setEditingIndex(index);
    setAutoAllocate(Boolean(row.autoAllocate));
    setLocation(
      row.autoAllocate
        ? row.previewPlan?.[0]
          ? {
              location_id: row.previewPlan[0].location_id,
              location_code: row.previewPlan[0].location_code,
              score: row.previewPlan[0].score,
            }
          : null
        : row.locationId
          ? { location_id: row.locationId, location_code: row.locationCode, score: row.previewScore }
          : null
    );
    setMessage({ type: "success", text: `Editing ${row.invoiceNo}. Click Update Invoice after changes.` });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteGridRow = (index) => {
    setTurnInvoices((rows) => rows.filter((_, idx) => idx !== index));
    if (editingIndex === index) clearCurrentInvoice();
    else if (editingIndex !== null && editingIndex > index) setEditingIndex((v) => v - 1);
  };

  const currentInvoiceHasData = Boolean(
    form.invoiceNo || form.mark || form.grade || form.chests || form.netWeightEach || form.packingType
  );

  const handleSaveTurn = async () => {
    setMessage(null);
    if (!form.broker.trim()) {
      setMessage({ type: "error", text: "Broker is required." });
      return;
    }
    if (!form.turnNo.trim()) {
      setMessage({ type: "error", text: "Turn No is required." });
      return;
    }
    if (editingIndex !== null) {
      setMessage({ type: "error", text: "Finish updating the current invoice before saving the Turn." });
      return;
    }
    if (currentInvoiceHasData) {
      setMessage({ type: "error", text: "You have an invoice that is not in the grid yet. Click Add Invoice to Turn first." });
      return;
    }
    if (!turnInvoices.length) {
      setMessage({ type: "error", text: "Add at least one invoice to the grid before saving the Turn." });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        turn: {
          broker: form.broker,
          turnNo: form.turnNo,
          vehicleNo: form.vehicleNo,
          driverName: form.driverName,
          driverNic: form.driverNic,
          store: form.store,
          date: form.date,
          invoiceYear: form.invoiceYear,
        },
        invoices: turnInvoices.map(({ previewPlan, previewPrimary, previewScore, ...row }) => row),
      };
      const res = await axios.post(`${API}/invoices/create-turn.php`, payload, { withCredentials: true });
      if (!res.data.success) throw new Error(res.data.message || "Turn save failed.");
      const data = res.data.data || {};
      setMessage({
        type: "success",
        text: `Turn ${data.turn_no || form.turnNo} saved successfully: ${data.invoice_count || turnInvoices.length} invoices, ${data.total_bags || turnTotals.chests} bags, ${Number(data.total_net_weight || turnTotals.weight).toFixed(2)} kg.`,
      });
      setForm(makeEmptyForm());
      setTurnInvoices([]);
      setEditingIndex(null);
      setLocation(null);
      setAiResult(null);
      setAiError("");
      setShowLocationPanel(false);
      setShowAiDetails(false);
      setAutoAllocate(true);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || err.message || "Could not reach the server." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormShell crumb="Bin Operation / Invoice Entry" title="Invoice Entry">
      <div className="wp-entry-screen">
        <div className="wp-entry-strip">
          <div>
            <span className="wp-entry-strip-label">RECEIVING MODE</span>
            <strong>Broker Turn / Multi-Invoice Entry</strong>
          </div>
          <div className="wp-entry-strip-actions">
            <span className="wp-status-pill">BrewSmart Warehouse</span>
            {turnInvoices.length > 0 && <span className="wp-status-pill">{turnInvoices.length} Invoice(s) in Turn</span>}
          </div>
        </div>

        <section className="wp-form-section">
          <div className="wp-form-section-title wp-title-with-meta">
            <span>Arrival / Turn Information</span>
            {headerLocked && <small>Turn header locked after first invoice is added</small>}
          </div>
          <div className="wp-form-section-body wp-entry-grid wp-entry-grid-4">
            <InlineField label="Broker *" className="wp-span-2">
              <select className="wp-input" value={form.broker} onChange={set("broker")} disabled={metaLoading || headerLocked}>
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
              <input className="wp-input" type="date" value={form.date} onChange={set("date")} disabled={headerLocked} />
            </InlineField>
            <InlineField label="Turn No. *">
              <input className="wp-input" value={form.turnNo} onChange={set("turnNo")} placeholder="e.g. TURN-020" disabled={headerLocked} />
            </InlineField>
            <InlineField label="Lorry No.">
              <input className="wp-input" value={form.vehicleNo} onChange={set("vehicleNo")} disabled={headerLocked} />
            </InlineField>
            <InlineField label="NIC/DV No.">
              <input className="wp-input" value={form.driverNic} onChange={set("driverNic")} disabled={headerLocked} />
            </InlineField>

            <InlineField label="Invoice Date">
              <input className="wp-input" type="date" value={form.date} readOnly={headerLocked} onChange={set("date")} />
            </InlineField>
            <InlineField label="Invoice Year">
              <input className="wp-input" value={form.invoiceYear} onChange={set("invoiceYear")} disabled={headerLocked} />
            </InlineField>
            <InlineField label="Driver Name" className="wp-span-2">
              <input className="wp-input" value={form.driverName} onChange={set("driverName")} disabled={headerLocked} />
            </InlineField>
          </div>
        </section>

        <section className="wp-form-section">
          <div className="wp-form-section-title wp-title-with-meta">
            <span>{editingIndex === null ? "New Invoice for this Turn" : `Edit Invoice Row ${editingIndex + 1}`}</span>
            <small>Add each invoice to the grid. Save the Turn only after all invoices are entered.</small>
          </div>
          <div className="wp-form-section-body wp-entry-grid wp-entry-grid-4">
            <InlineField label="Invoice Number">
              <input className="wp-input" value={form.invoiceNo} onChange={set("invoiceNo")} />
            </InlineField>
            <InlineField label="Mark">
              <select className="wp-input" value={form.mark} onChange={setMark} disabled={metaLoading}>
                <option value="">-- Select Mark --</option>
                {marks.map((m) => (
                  <option key={m.mark_id || m.mark_code} value={m.mark_code}>
                    {m.mark_code} - {m.mark_name}
                  </option>
                ))}
              </select>
            </InlineField>
            <InlineField label="Selling Mark">
              <input className="wp-input wp-readonly" value={form.sellingMark} readOnly placeholder="Auto from Mark" />
            </InlineField>
            <InlineField label="Grade">
              <select className="wp-input" value={form.grade} onChange={set("grade")} disabled={metaLoading}>
                <option value="">-- Select Grade --</option>
                {grades.map((g) => {
                  const minW = Number(g.min_bag_weight || 0);
                  const maxW = Number(g.max_bag_weight || 0);
                  const density = Number(g.packing_density || 0);
                  const enteredWeight = Number(form.netWeightEach || 0);
                  const configured = density > 0 && minW > 0 && maxW > 0;
                  const outsideRange = enteredWeight > 0 && configured && (enteredWeight < minW || enteredWeight > maxW);
                  return (
                    <option key={g.grade_id || g.grade_code} value={g.grade_code} disabled={!configured || outsideRange}>
                      {g.grade_code} - {g.grade_name}{configured ? ` | ${minW.toFixed(2)}–${maxW.toFixed(2)} kg | Density ${density.toFixed(3)}` : " | Configure in Grade Master"}
                    </option>
                  );
                })}
              </select>
            </InlineField>
            {form.grade && (
              <InlineField label="Grade Storage Profile" className="wp-span-2">
                <input className={`wp-input wp-readonly ${gradeWeightError ? "wp-input-error" : ""}`} readOnly value={selectedGrade && selectedGrade.packing_density ? `Density ${Number(selectedGrade.packing_density).toFixed(3)} | ${Number(selectedGrade.min_bag_weight).toFixed(2)}–${Number(selectedGrade.max_bag_weight).toFixed(2)} kg per bag` : "Configure this grade in Grade Master"} />
              </InlineField>
            )}

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
            <InlineField label="Total Net Weight" className="wp-span-2">
              <input className="wp-input wp-readonly wp-total-input" value={`${totalNetWeight} kg`} readOnly />
            </InlineField>

            <div className="wp-checkbox-line wp-span-4">
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

            <div className="wp-location-command wp-span-4">
              <button
                type="button"
                className="wp-btn wp-btn-info"
                onClick={() => setShowAiDetails((v) => !v)}
                disabled={!form.chests || !form.netWeightEach}
              >
                Location Allocate
              </button>
              {gradeWeightError && <span className="wp-ai-inline wp-ai-error">{gradeWeightError}</span>}
              {aiLoading && !gradeWeightError && <span className="wp-ai-inline">AI analyzing...</span>}
              {!aiLoading && location && (
                <span className="wp-ai-inline wp-ai-success">
                  AI Primary Location: {location.location_code}{location.score ? ` (${location.score}%)` : ""}
                </span>
              )}
              {!aiLoading && aiError && <span className="wp-ai-inline wp-ai-error">{aiError}</span>}
            </div>

            <div className="wp-invoice-add-actions wp-span-4">
              <button className="wp-btn wp-btn-outline" type="button" onClick={clearCurrentInvoice}>Clear Invoice</button>
              <button className="wp-btn wp-btn-primary" type="button" onClick={handleAddToGrid} disabled={aiLoading}>
                {editingIndex === null ? "+ Add Invoice to Turn" : "Update Invoice in Grid"}
              </button>
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
                  Auto allocate best safe location on final Turn save
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
                      {aiResult.can_allocate ? "SAFE ALLOCATION PREVIEW READY" : "PARTIAL PLAN ONLY"}
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
          <div className="wp-form-section-title wp-title-with-meta">
            <span>Invoice Entry Details — Turn {form.turnNo || "Not Set"}</span>
            <small>{turnTotals.invoices} invoices / {turnTotals.chests} bags / {turnTotals.weight.toFixed(2)} kg</small>
          </div>
          <div className="wp-table-wrap">
            <table className="wp-table wp-entry-preview-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Invoice Number</th>
                  <th>Mark</th>
                  <th>Selling Mark</th>
                  <th>Grade</th>
                  <th>No. of Chests</th>
                  <th>Net Weight Each</th>
                  <th>Total Net Weight</th>
                  <th>Chest Type</th>
                  <th>Packing Type</th>
                  <th>AI / Location Preview</th>
                  <th>Edit</th>
                  <th>Delete</th>
                </tr>
              </thead>
              <tbody>
                {turnInvoices.length ? (
                  turnInvoices.map((row, index) => {
                    const preview = row.previewPlan?.length
                      ? row.previewPlan.map((p) => `${p.location_code} (${p.chests_allocated})`).join(", ")
                      : row.locationCode || row.previewPrimary || "Pending";
                    return (
                      <tr key={`${row.invoiceNo}-${index}`} className={editingIndex === index ? "wp-row-editing" : ""}>
                        <td>{index + 1}</td>
                        <td><strong>{row.invoiceNo}</strong></td>
                        <td>{row.mark || "—"}</td>
                        <td>{row.sellingMark || "—"}</td>
                        <td>{row.grade || "—"}</td>
                        <td>{row.chests}</td>
                        <td>{Number(row.netWeightEach || 0).toFixed(2)} kg</td>
                        <td>{Number(row.totalNetWeight || 0).toFixed(2)} kg</td>
                        <td>{row.chestType || "—"}</td>
                        <td>{row.packingType || "—"}</td>
                        <td>{row.autoAllocate ? `AI: ${preview}` : `Manual: ${preview}`}</td>
                        <td><button type="button" className="wp-mini-btn" onClick={() => handleEditGridRow(index)}>Edit</button></td>
                        <td><button type="button" className="wp-mini-btn wp-mini-danger" onClick={() => handleDeleteGridRow(index)}>Delete</button></td>
                      </tr>
                    );
                  })
                ) : (
                  <tr><td colSpan={13} className="wp-table-empty">No invoices added to this Turn yet. Enter an invoice above and click “Add Invoice to Turn”.</td></tr>
                )}
              </tbody>
              {turnInvoices.length > 0 && (
                <tfoot>
                  <tr className="wp-grid-total-row">
                    <td colSpan={5}><strong>TURN TOTAL</strong></td>
                    <td><strong>{turnTotals.chests}</strong></td>
                    <td>—</td>
                    <td><strong>{turnTotals.weight.toFixed(2)} kg</strong></td>
                    <td colSpan={5}>{turnTotals.invoices} invoice(s)</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>

        {message && (
          <div className={`wp-message ${message.type === "error" ? "error" : "success"}`}>{message.text}</div>
        )}

        <div className="wp-turn-save-bar">
          <div className="wp-turn-save-summary">
            <span>Turn</span><strong>{form.turnNo || "—"}</strong>
            <span>Invoices</span><strong>{turnTotals.invoices}</strong>
            <span>Bags</span><strong>{turnTotals.chests}</strong>
            <span>Weight</span><strong>{turnTotals.weight.toFixed(2)} kg</strong>
          </div>
          <div className="wp-entry-footer-actions">
            <button className="wp-btn wp-btn-warning" type="button" onClick={resetTurn}>Reset Turn</button>
            <button className="wp-btn wp-btn-primary" type="button" onClick={handleSaveTurn} disabled={saving || !turnInvoices.length}>
              {saving ? "Saving Turn & Allocating..." : `Save Turn (${turnInvoices.length} Invoice${turnInvoices.length === 1 ? "" : "s"})`}
            </button>
          </div>
        </div>
      </div>
    </FormShell>
  );
}

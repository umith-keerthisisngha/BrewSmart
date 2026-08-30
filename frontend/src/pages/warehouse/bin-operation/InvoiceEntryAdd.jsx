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
  turnDate: new Date().toISOString().slice(0, 10),
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

  const [turnLookup, setTurnLookup] = useState(null);
  const [turnLookupLoading, setTurnLookupLoading] = useState(false);
  const [turnLookupError, setTurnLookupError] = useState("");
  const [turnLookupNonce, setTurnLookupNonce] = useState(0);
  const [duplicateState, setDuplicateState] = useState({ checking: false, exists: false, message: "" });

  const [showLocationPanel, setShowLocationPanel] = useState(false);
  const [showAiDetails, setShowAiDetails] = useState(false);
  const [location, setLocation] = useState(null);
  const [autoAllocate, setAutoAllocate] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState("");

  const headerLocked = turnInvoices.length > 0;
  const turnKnown = Boolean(turnLookup?.found);
  const markSelected = Boolean(form.mark.trim());

  const brokerUsage = useMemo(() => {
    const map = new Map();
    (turnLookup?.brokers || []).forEach((row) => {
      map.set(String(row.broker || "").toLowerCase(), row);
    });
    return map;
  }, [turnLookup]);

  const selectedBrokerUsage = useMemo(
    () => brokerUsage.get(String(form.broker || "").toLowerCase()) || null,
    [brokerUsage, form.broker]
  );

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
  useEffect(() => {
    const turnNo = form.turnNo.trim();
    if (!turnNo || headerLocked) {
      if (!turnNo) {
        setTurnLookup(null);
        setTurnLookupError("");
      }
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setTurnLookupLoading(true);
      setTurnLookupError("");
      try {
        const res = await axios.get(`${API}/invoices/turn-lookup.php`, {
          params: { turn_no: turnNo },
          withCredentials: true,
        });
        if (cancelled) return;
        const data = res.data.data || { found: false, turn_no: turnNo, header: null, brokers: [] };
        setTurnLookup(data);

        if (data.found && data.header) {
          const h = data.header;
          setForm((f) => ({
            ...f,
            turnDate: h.turn_date || f.turnDate,
            store: h.store || "BrewSmart Warehouse",
            vehicleNo: h.vehicle_no || "",
            driverName: h.driver_name || "",
            driverNic: h.driver_nic || "",
          }));
        }
      } catch (err) {
        if (cancelled) return;
        setTurnLookup(null);
        setTurnLookupError(err.response?.data?.message || "Could not load this Turn Number.");
      } finally {
        if (!cancelled) setTurnLookupLoading(false);
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.turnNo, headerLocked, turnLookupNonce]);
  useEffect(() => {
    const mark = form.mark.trim();
    const invoiceNo = form.invoiceNo.trim();
    if (!mark || !invoiceNo) {
      setDuplicateState({ checking: false, exists: false, message: "" });
      return undefined;
    }

    const stagedDuplicate = turnInvoices.some(
      (row, idx) =>
        idx !== editingIndex &&
        String(row.mark || "").trim().toLowerCase() === mark.toLowerCase() &&
        String(row.invoiceNo || "").trim().toLowerCase() === invoiceNo.toLowerCase()
    );
    if (stagedDuplicate) {
      setDuplicateState({
        checking: false,
        exists: true,
        message: `Invoice ${invoiceNo} is already staged for Mark ${mark}.`,
      });
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setDuplicateState({ checking: true, exists: false, message: "Checking invoice..." });
      try {
        const res = await axios.get(`${API}/invoices/check-duplicate.php`, {
          params: { invoice_no: invoiceNo, mark },
          withCredentials: true,
        });
        if (cancelled) return;
        const exists = Boolean(res.data.data?.exists);
        setDuplicateState({
          checking: false,
          exists,
          message: exists
            ? `Invoice ${invoiceNo} already exists for Mark ${mark}.`
            : `Invoice ${invoiceNo} is available for Mark ${mark}.`,
        });
      } catch (err) {
        if (cancelled) return;
        setDuplicateState({
          checking: false,
          exists: false,
          message: err.response?.data?.message || "Duplicate check unavailable; final save will re-check.",
        });
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.mark, form.invoiceNo, turnInvoices, editingIndex]);
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
  const setTurnNo = (e) => {
    const value = e.target.value.toUpperCase();
    setForm((f) => ({
      ...f,
      turnNo: value,
      ...(f.turnNo !== value ? { vehicleNo: "", driverName: "", driverNic: "" } : {}),
    }));
    setTurnLookup(null);
    setTurnLookupError("");
  };
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
    setDuplicateState({ checking: false, exists: false, message: "" });
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
    setTurnLookup(null);
    setTurnLookupError("");
    setDuplicateState({ checking: false, exists: false, message: "" });
  };

  const validateCurrentInvoice = () => {
    if (!form.turnNo.trim()) return "Turn No is required.";
    if (!form.broker.trim()) return "Select the Broker for this arrival batch.";
    if (!form.mark.trim()) return "Select the Mark before entering an Invoice Number.";
    if (!form.invoiceNo.trim()) return "Invoice No is required after the Mark is selected.";
    if (duplicateState.exists) return duplicateState.message || "This Invoice Number already exists for the selected Mark.";
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

  const handleAddToGrid = async () => {
    setMessage(null);
    const error = validateCurrentInvoice();
    if (error) {
      setMessage({ type: "error", text: error });
      return;
    }

    const duplicateIndex = turnInvoices.findIndex(
      (row, idx) =>
        idx !== editingIndex &&
        String(row.mark || "").trim().toLowerCase() === form.mark.trim().toLowerCase() &&
        String(row.invoiceNo || "").trim().toLowerCase() === form.invoiceNo.trim().toLowerCase()
    );
    if (duplicateIndex >= 0) {
      setMessage({ type: "error", text: `Invoice ${form.invoiceNo} is already in this batch for Mark ${form.mark}.` });
      return;
    }

    try {
      const duplicateRes = await axios.get(`${API}/invoices/check-duplicate.php`, {
        params: { invoice_no: form.invoiceNo.trim(), mark: form.mark.trim() },
        withCredentials: true,
      });
      if (duplicateRes.data.data?.exists) {
        setDuplicateState({
          checking: false,
          exists: true,
          message: `Invoice ${form.invoiceNo} already exists for Mark ${form.mark}.`,
        });
        setMessage({ type: "error", text: `Duplicate blocked: Invoice ${form.invoiceNo} already exists for Mark ${form.mark}.` });
        return;
      }
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Could not verify the Invoice Number. Please try again.",
      });
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
    setDuplicateState({ checking: false, exists: false, message: "" });
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
    setDuplicateState({ checking: false, exists: false, message: "" });
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
    if (!form.turnNo.trim()) {
      setMessage({ type: "error", text: "Turn No is required." });
      return;
    }
    if (!form.broker.trim()) {
      setMessage({ type: "error", text: "Select the Broker for this arrival batch." });
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
          turnDate: form.turnDate,
          date: form.date,
          invoiceYear: form.invoiceYear,
        },
        invoices: turnInvoices.map(({ previewPlan, previewPrimary, previewScore, ...row }) => row),
      };
      const res = await axios.post(`${API}/invoices/create-turn.php`, payload, { withCredentials: true });
      if (!res.data.success) throw new Error(res.data.message || "Turn save failed.");
      const data = res.data.data || {};
      const savedTurnNo = data.turn_no || form.turnNo;
      const savedBroker = data.broker || form.broker;
      const h = data.turn_header || {};
      setMessage({
        type: "success",
        text: `${savedBroker} arrival batch saved for Turn ${savedTurnNo}: ${data.invoice_count || turnInvoices.length} invoice(s), ${data.total_bags || turnTotals.chests} bags, ${Number(data.total_net_weight || turnTotals.weight).toFixed(2)} kg. Turn transport details are retained so you can now select the next Broker.`,
      });
      setForm({
        ...makeEmptyForm(),
        turnNo: savedTurnNo,
        turnDate: h.turn_date || form.turnDate,
        store: h.store || form.store || "BrewSmart Warehouse",
        vehicleNo: h.vehicle_no || form.vehicleNo,
        driverName: h.driver_name || form.driverName,
        driverNic: h.driver_nic || form.driverNic,
        date: form.date,
        invoiceYear: form.invoiceYear,
        broker: "",
      });
      setTurnInvoices([]);
      setEditingIndex(null);
      setLocation(null);
      setAiResult(null);
      setAiError("");
      setDuplicateState({ checking: false, exists: false, message: "" });
      setShowLocationPanel(false);
      setShowAiDetails(false);
      setAutoAllocate(true);
      setTurnLookupNonce((n) => n + 1);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || err.message || "Could not reach the server." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormShell crumb="Bin Operation / Invoice Entry" title="Invoice Entry — Add New">
      <div className="wp-entry-screen">
        <div className="wp-entry-flow" aria-label="Invoice entry progress">
          <div className={`wp-flow-step ${form.turnNo && form.broker ? "done" : "active"}`}>
            <span>01</span><strong>Turn & Broker</strong>
          </div>
          <div className={`wp-flow-step ${markSelected ? "done" : form.turnNo && form.broker ? "active" : ""}`}>
            <span>02</span><strong>Select Mark</strong>
          </div>
          <div className={`wp-flow-step ${turnInvoices.length ? "done" : markSelected ? "active" : ""}`}>
            <span>03</span><strong>Add Invoices</strong>
          </div>
          <div className={`wp-flow-step ${turnInvoices.length ? "active" : ""}`}>
            <span>04</span><strong>Save Batch</strong>
          </div>
        </div>

        <section className="wp-form-section wp-turn-card">
          <div className="wp-form-section-title">01 — Arrival / Turn & Broker Information</div>
          <div className="wp-form-section-body">
            <div className="wp-entry-grid wp-entry-grid-4">
              <InlineField label="Turn No. *" className="wp-span-2 wp-priority-field">
                <input
                  className="wp-input"
                  value={form.turnNo}
                  onChange={setTurnNo}
                  placeholder="Enter Turn No. e.g. TURN-020"
                  disabled={headerLocked}
                  autoComplete="off"
                />
              </InlineField>
              <InlineField label="Turn Date">
                <input
                  className="wp-input"
                  type="date"
                  value={form.turnDate}
                  onChange={set("turnDate")}
                  disabled={headerLocked || turnKnown}
                />
              </InlineField>
              <InlineField label="Store">
                <input className="wp-input wp-readonly" value={form.store} readOnly />
              </InlineField>

              <InlineField label="Broker *" className="wp-span-2 wp-priority-field">
                <select
                  className="wp-input"
                  value={form.broker}
                  onChange={set("broker")}
                  disabled={metaLoading || headerLocked || !form.turnNo.trim()}
                >
                  <option value="">-- Select Broker for this batch --</option>
                  {brokers.map((b) => {
                    const value = b.broker_name || b.broker_code;
                    const usage = brokerUsage.get(String(value || "").toLowerCase());
                    return (
                      <option key={b.broker_id || b.broker_code} value={value}>
                        {b.broker_code ? `${b.broker_code} - ` : ""}{b.broker_name}
                        {usage ? ` • ${usage.invoice_count} saved invoice(s)` : ""}
                      </option>
                    );
                  })}
                </select>
              </InlineField>

              <InlineField label="Lorry No.">
                <input
                  className={`wp-input ${turnKnown ? "wp-readonly" : ""}`}
                  value={form.vehicleNo}
                  onChange={set("vehicleNo")}
                  readOnly={turnKnown}
                  disabled={headerLocked}
                  placeholder="Vehicle / lorry number"
                />
              </InlineField>
              <InlineField label="NIC / ID No.">
                <input
                  className={`wp-input ${turnKnown ? "wp-readonly" : ""}`}
                  value={form.driverNic}
                  onChange={set("driverNic")}
                  readOnly={turnKnown}
                  disabled={headerLocked}
                  placeholder="Driver NIC / ID"
                />
              </InlineField>

              <InlineField label="Driver Name" className="wp-span-2">
                <input
                  className={`wp-input ${turnKnown ? "wp-readonly" : ""}`}
                  value={form.driverName}
                  onChange={set("driverName")}
                  readOnly={turnKnown}
                  disabled={headerLocked}
                  placeholder="Driver name"
                />
              </InlineField>

              {(turnLookupLoading || turnLookupError || turnKnown) && (
                <div className={`wp-turn-lookup-status wp-span-2 ${turnKnown ? "found" : ""} ${turnLookupError ? "error" : ""}`}>
                  {turnLookupLoading ? (
                    <><span className="wp-live-dot pulse" /><strong>Checking Turn...</strong></>
                  ) : turnLookupError ? (
                    <><span className="wp-live-dot error" /><strong>{turnLookupError}</strong></>
                  ) : (
                    <><span className="wp-live-dot" /><strong>Turn {form.turnNo} loaded from database</strong></>
                  )}
                </div>
              )}
            </div>

            {turnKnown && (turnLookup?.brokers || []).length > 0 && (
              <div className="wp-existing-brokers">
                <span className="wp-existing-label">Already saved on this Turn</span>
                {(turnLookup.brokers || []).map((row) => (
                  <span className="wp-broker-chip" key={row.broker}>
                    <strong>{row.broker}</strong>
                    <small>{row.invoice_count} invoice(s) · {row.bag_count} bags</small>
                  </span>
                ))}
              </div>
            )}

            {selectedBrokerUsage && !headerLocked && (
              <div className="wp-soft-warning">
                {selectedBrokerUsage.invoice_count} invoice(s) already saved for this Broker on Turn {form.turnNo}.
              </div>
            )}
          </div>
        </section>

        <section className="wp-form-section wp-invoice-card">
          <div className="wp-form-section-title">
            02 — {editingIndex === null ? "Invoice Entry" : `Edit Staged Invoice ${editingIndex + 1}`}
          </div>
          <div className="wp-form-section-body">
            <div className="wp-mark-row">
              <InlineField label="Mark *" className="wp-priority-field">
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
                <input className="wp-input wp-readonly" value={form.sellingMark} readOnly />
              </InlineField>
            </div>

            <div className={`wp-invoice-unlock-zone ${markSelected ? "unlocked" : "locked"}`}>
              <div className="wp-entry-grid wp-entry-grid-4">
                <InlineField label="Invoice Number *" className="wp-span-2 wp-priority-field">
                  <input
                    className={`wp-input ${duplicateState.exists ? "wp-input-error" : ""}`}
                    value={form.invoiceNo}
                    onChange={set("invoiceNo")}
                    disabled={!markSelected}
                    placeholder="Enter Invoice Number"
                    autoComplete="off"
                  />
                </InlineField>
                <div className="wp-duplicate-cell wp-span-2">
                  {duplicateState.checking && <span className="wp-field-feedback"><span className="wp-live-dot pulse" /> Checking duplicate...</span>}
                  {duplicateState.exists && <span className="wp-field-feedback error"><span className="wp-live-dot error" /> {duplicateState.message}</span>}
                </div>

                <InlineField label="Invoice Date">
                  <input className="wp-input" type="date" value={form.date} onChange={set("date")} disabled={!markSelected} />
                </InlineField>
                <InlineField label="Invoice Year">
                  <input className="wp-input" value={form.invoiceYear} onChange={set("invoiceYear")} disabled={!markSelected} />
                </InlineField>

                <InlineField label="Grade *" className="wp-span-2">
                  <select className="wp-input" value={form.grade} onChange={set("grade")} disabled={metaLoading || !markSelected}>
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

                <InlineField label="Grade Storage Profile" className="wp-span-2">
                  <input
                    className={`wp-input wp-readonly ${gradeWeightError ? "wp-input-error" : ""}`}
                    readOnly
                    value={
                      form.grade
                        ? selectedGrade && selectedGrade.packing_density
                          ? `Density ${Number(selectedGrade.packing_density).toFixed(3)} | ${Number(selectedGrade.min_bag_weight).toFixed(2)}–${Number(selectedGrade.max_bag_weight).toFixed(2)} kg per bag`
                          : "Configure this grade in Grade Master"
                        : "Select Grade to view density and allowed bag weight"
                    }
                  />
                </InlineField>

                <InlineField label="No. of Bags *">
                  <input className="wp-input" type="number" min="1" value={form.chests} onChange={set("chests")} disabled={!markSelected} />
                </InlineField>
                <InlineField label="Chest / Bag Type">
                  <select className="wp-input" value={form.chestType} onChange={set("chestType")} disabled={!markSelected}>
                    {CHEST_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </InlineField>
                <InlineField label="Net Weight Each *">
                  <input className="wp-input" type="number" min="0" step="0.01" value={form.netWeightEach} onChange={set("netWeightEach")} disabled={!markSelected} />
                </InlineField>
                <InlineField label="Packing Type">
                  <select className="wp-input" value={form.packingType} onChange={set("packingType")} disabled={metaLoading || !markSelected}>
                    <option value="">-- Select Packing Type --</option>
                    {packingTypes.map((p) => (
                      <option key={p.packing_type_id || p.packing_code} value={p.packing_code}>
                        {p.packing_code} - {p.packing_name}
                      </option>
                    ))}
                  </select>
                </InlineField>

                <InlineField label="Moisture Content %">
                  <input className="wp-input" type="number" min="0" step="0.01" value={form.moistureContent} onChange={set("moistureContent")} disabled={!markSelected} />
                </InlineField>
                <InlineField label="MFD">
                  <input className="wp-input" type="date" value={form.mfdDate} onChange={set("mfdDate")} disabled={!markSelected} />
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
                      <input type="checkbox" checked={form[key]} onChange={setChecked(key)} disabled={!markSelected} /> {label}
                    </label>
                  ))}
                </div>

                <div className="wp-location-command wp-span-4">
                  <button
                    type="button"
                    className="wp-btn wp-btn-info"
                    onClick={() => setShowAiDetails((v) => !v)}
                    disabled={!markSelected || !form.chests || !form.netWeightEach}
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
                  <button
                    className="wp-btn wp-btn-primary"
                    type="button"
                    onClick={handleAddToGrid}
                    disabled={aiLoading || duplicateState.checking || duplicateState.exists || !markSelected || !form.broker || !form.turnNo}
                  >
                    {editingIndex === null ? "+ Add Invoice to Broker Batch" : "Update Staged Invoice"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {showAiDetails && (
          <section className="wp-form-section wp-ai-section">
            <div className="wp-form-section-title">AI Location Allocation</div>
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
                  Auto allocate the best safe location when this Broker batch is saved
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
                          <th>Location</th><th>Level</th><th>Bags</th><th>Weight</th><th>Score</th><th>Reason</th>
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
            <span>03 — Staged Invoices · {form.broker || "Select Broker"} · Turn {form.turnNo || "Not Set"}</span>
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
                  <th>No. of Bags</th>
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
                  <tr><td colSpan={13} className="wp-table-empty">No staged invoices.</td></tr>
                )}
              </tbody>
              {turnInvoices.length > 0 && (
                <tfoot>
                  <tr className="wp-grid-total-row">
                    <td colSpan={5}><strong>BROKER BATCH TOTAL</strong></td>
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
            <span>Broker</span><strong>{form.broker || "—"}</strong>
            <span>Invoices</span><strong>{turnTotals.invoices}</strong>
            <span>Bags</span><strong>{turnTotals.chests}</strong>
            <span>Weight</span><strong>{turnTotals.weight.toFixed(2)} kg</strong>
          </div>
          <div className="wp-entry-footer-actions">
            <button className="wp-btn wp-btn-warning" type="button" onClick={resetTurn}>Reset Turn</button>
            <button className="wp-btn wp-btn-primary" type="button" onClick={handleSaveTurn} disabled={saving || !turnInvoices.length}>
              {saving ? "Saving Broker Batch & Allocating..." : `Save Broker Batch (${turnInvoices.length} Invoice${turnInvoices.length === 1 ? "" : "s"})`}
            </button>
          </div>
        </div>
      </div>
    </FormShell>
  );
}

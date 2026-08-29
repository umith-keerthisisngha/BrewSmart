import { useState } from "react";
import FormShell, { Field, FieldGrid } from "../../../components/warehouse/FormShell";

export default function InvoiceEntryDownload() {
  const [ready, setReady] = useState(false);

  return (
    <FormShell crumb="Bin Operation / Invoice Entry" title="Download">
      <FieldGrid>
        <Field label="Invoice Year">
          <input className="wp-input" placeholder="e.g. 2026" />
        </Field>
        <Field label="From Date">
          <input className="wp-input" type="date" />
        </Field>
        <Field label="To Date">
          <input className="wp-input" type="date" />
        </Field>
        <Field label="Format">
          <select className="wp-select">
            <option>Excel (.xlsx)</option>
            <option>CSV</option>
            <option>PDF</option>
          </select>
        </Field>
      </FieldGrid>

      <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
        <button className="wp-btn wp-btn-primary" onClick={() => setReady(true)}>
          Generate
        </button>
        <button className="wp-btn wp-btn-outline" disabled={!ready}>
          Download File
        </button>
      </div>

      {ready && (
        <p className="wp-hint">
          File generated. Wire this action to backend/api/reports or a dedicated
          export endpoint to produce a real download.
        </p>
      )}
    </FormShell>
  );
}

import { useState } from "react";
import FormShell, { Field, FieldGrid } from "../../../components/warehouse/FormShell";

export default function GINPickingList() {
  const [rows, setRows] = useState(null);

  return (
    <FormShell crumb="Bin Operation / GIN" title="Picking List / GIN Print">
      <FieldGrid>
        <Field label="GIN No">
          <input className="wp-input" />
        </Field>
        <Field label="Buyer">
          <input className="wp-input" />
        </Field>
      </FieldGrid>

      <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
        <button className="wp-btn wp-btn-primary" onClick={() => setRows([])}>
          Search Query
        </button>
        <button className="wp-btn wp-btn-outline" disabled={!rows || rows.length === 0}>
          🖶 Print
        </button>
      </div>

      {rows !== null && (
        <div className="wp-table-wrap" style={{ marginTop: 18 }}>
          <table className="wp-table">
            <thead>
              <tr>
                <th>GIN No</th>
                <th>Buyer</th>
                <th>Invoice No</th>
                <th>Chests</th>
                <th>Location</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="wp-table-empty">
                    No matching picking list items found.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => <tr key={i} />)
              )}
            </tbody>
          </table>
        </div>
      )}
    </FormShell>
  );
}

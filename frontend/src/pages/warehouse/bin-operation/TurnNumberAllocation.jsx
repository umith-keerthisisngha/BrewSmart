import { useState } from "react";
import FormShell, { Field, FieldGrid } from "../../../components/warehouse/FormShell";

export default function TurnNumberAllocation() {
  const [rows, setRows] = useState(null);

  return (
    <FormShell crumb="Bin Operation / GRN" title="Turn Number Allocation">
      <FieldGrid>
        <Field label="Date">
          <input className="wp-input" type="date" />
        </Field>
        <Field label="Vehicle No">
          <input className="wp-input" />
        </Field>
      </FieldGrid>

      <button className="wp-btn wp-btn-primary" style={{ marginTop: 14 }} onClick={() => setRows([])}>
        Search Query
      </button>

      {rows !== null && (
        <div className="wp-table-wrap" style={{ marginTop: 18 }}>
          <table className="wp-table">
            <thead>
              <tr>
                <th>Vehicle No</th>
                <th>Arrival Time</th>
                <th>Turn No</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="wp-table-empty">
                    No vehicles pending turn number allocation.
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

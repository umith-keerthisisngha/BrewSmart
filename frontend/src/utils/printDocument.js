function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function printTableDocument({ title, subtitle = "", columns = [], rows = [], meta = [] }) {
  const popup = window.open("", "_blank", "width=1100,height=760");
  if (!popup) throw new Error("Popup blocked. Allow popups to print this document.");

  const headers = columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("");
  const body = rows.length
    ? rows.map((row) => `<tr>${columns.map((c) => `<td>${escapeHtml(row[c.key])}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${Math.max(columns.length, 1)}" class="empty">No records selected.</td></tr>`;
  const metaHtml = meta.filter((m) => m?.label).map((m) => `<div><b>${escapeHtml(m.label)}:</b> ${escapeHtml(m.value)}</div>`).join("");

  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
  <style>
    @page{size:A4 landscape;margin:12mm}body{font-family:Arial,sans-serif;color:#1f291f;margin:0;font-size:11px}
    .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #4a9c1e;padding-bottom:10px;margin-bottom:14px}
    h1{font-size:22px;margin:0;color:#182318}.brand{color:#4a9c1e}.sub{margin-top:4px;color:#667066;font-size:11px}.meta{text-align:right;line-height:1.65}
    table{width:100%;border-collapse:collapse;margin-top:10px}th{background:#edf4e9;font-size:10px;text-align:left}th,td{border:1px solid #cfd8cf;padding:7px;vertical-align:top}.empty{text-align:center;color:#788078;padding:24px}
    footer{margin-top:12px;border-top:1px solid #d8dfd8;padding-top:7px;color:#707970;font-size:9px;display:flex;justify-content:space-between}
    @media print{button{display:none}}
  </style></head><body>
  <div class="head"><div><h1>Brew<span class="brand">Smart</span></h1><div class="sub">AI-Based Smart Tea Warehouse Management & Optimization System</div><h2>${escapeHtml(title)}</h2>${subtitle ? `<div class="sub">${escapeHtml(subtitle)}</div>` : ""}</div><div class="meta">${metaHtml}<div><b>Printed:</b> ${escapeHtml(new Date().toLocaleString())}</div></div></div>
  <table><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table>
  <footer><span>BrewSmart Warehouse Document</span><span>Records: ${rows.length}</span></footer>
  <script>window.onload=()=>{window.print();};<\/script></body></html>`);
  popup.document.close();
}

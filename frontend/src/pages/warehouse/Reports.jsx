import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { WarehouseHeader, WarehouseFooter } from "../../components/warehouse/WarehouseHeader";
import "../../components/warehouse/WarehousePage.css";
import "./Reports.css";
import { downloadReportPdf } from "../../utils/reportPdf";

const API = "http://localhost/BrewSmart/backend/api";

// Reports actually backed by a live endpoint today.
const LIVE_REPORTS = {
  "Daily Stock Summary": {
    endpoint: "/reports/daily-stock-summary.php",
    columns: [
      { key: "report_date", label: "Date" },
      { key: "arrival_bags", label: "Arrivals (Bags)" },
      { key: "arrival_weight", label: "Arrivals Weight (kg)" },
      { key: "delivery_bags", label: "Deliveries (Bags)" },
      { key: "delivery_weight", label: "Deliveries Weight (kg)" },
      { key: "stock_bags", label: "Stock (Bags)" },
      { key: "stock_weight", label: "Stock Weight (kg)" },
    ],
  },
  "Invoice / Arrival Register": {
    endpoint: "/reports/invoices.php",
    columns: [
      { key: "invoice_date", label: "Date" },
      { key: "invoice_no", label: "Invoice No" },
      { key: "mark", label: "Mark" },
      { key: "grade", label: "Grade" },
      { key: "packing_type", label: "Packing" },
      { key: "broker", label: "Broker" },
      { key: "chests", label: "Chests" },
      { key: "net_weight_each", label: "Net/Chest kg" },
      { key: "total_net_weight", label: "Total Net kg" },
      { key: "allocated_locations", label: "Location(s)" },
      { key: "allocation_model", label: "Allocation" },
      { key: "allocation_score", label: "Score %" },
    ],
  },
  "Arrival Report (With Pallets)": {
    endpoint: "/reports/invoices.php",
    columns: [
      { key: "invoice_date", label: "Date" },
      { key: "invoice_no", label: "Invoice No" },
      { key: "mark", label: "Mark" },
      { key: "grade", label: "Grade" },
      { key: "packing_type", label: "Packing" },
      { key: "broker", label: "Broker" },
      { key: "chests", label: "Chests" },
      { key: "total_net_weight", label: "Total Net kg" },
      { key: "allocated_locations", label: "Location(s)" },
      { key: "allocation_score", label: "AI Score %" },
    ],
  },
  "Daily Arrivals Summary For All Brokers": {
    endpoint: "/reports/daily-arrivals.php",
    columns: [
      { key: "invoice_date", label: "Date" },
      { key: "broker", label: "Broker" },
      { key: "invoices", label: "Invoices" },
      { key: "chests", label: "Chests" },
      { key: "total_net_weight", label: "Total Net kg" },
    ],
  },
  "Rack Wise Stock": {
    endpoint: "/reports/warehouse.php",
    columns: [
      { key: "rack_code", label: "Rack" },
      { key: "locations", label: "Locations" },
      { key: "capacity_bags", label: "Capacity (bags)" },
      { key: "occupied_bags", label: "Occupied (bags)" },
      { key: "free_bags", label: "Free (bags)" },
    ],
  },
  "Mark Wise Stock": {
    endpoint: "/reports/inventory.php",
    columns: [
      { key: "tea_name", label: "Tea Type" },
      { key: "grade_code", label: "Grade" },
      { key: "lots", label: "Lots" },
      { key: "total_bags", label: "Total Bags" },
      { key: "available_bags", label: "Available Bags" },
      { key: "allocated_bags", label: "Allocated Bags" },
    ],
  },
  "Daily Unloaded Turns": {
    endpoint: "/reports/movements.php",
    columns: [
      { key: "movement_date", label: "Date" },
      { key: "movement_type", label: "Type" },
      { key: "bags", label: "Bags" },
      { key: "transactions", label: "Transactions" },
    ],
  },
};

const OTHER_REPORTS = [
  "Bin List By Date Range",
  "Buyer Wise Uncollected List",
  "CBA Stock",
  "Daily Arrivals Summary Broker Wise",
  "Daily Arrivals Summary Owner Wise",
  "Daily Delivery Summary",
  "Daily Statatements Of Arrivals Other Broker",
  "Daily Statatements Of Arrivals Own Broker",
  "Deleted Lines Details",
  "Empty Pallets",
  "Extra Store Rent For Buyers",
  "Extra Store Rent Summary For Buyers",
  "Full RA Marks Details",
  "Insurance Recovery",
  "Issuing Details Broker Wise",
  "Line With More Arrivals",
  "Loose Chest Report",
  "Missing Chests Report",
  "Owner Wise Stock Summary",
  "Pallet Wise Stock",
  "Received vs Issued Summary",
  "Store Rent Summary",
  "Turn Number Wise Report",
  "Unloading Summary",
  "Weight Variance Report",
];

const REPORT_OPTIONS = [...Object.keys(LIVE_REPORTS), ...OTHER_REPORTS];

export default function Reports() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [rows, setRows] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);

  useEffect(() => {
    axios
      .get(`${API}/auth/session-check.php`, { withCredentials: true })
      .then((res) => {
        if (res.data.loggedIn) {
          setDisplayName(res.data.display_name);
        } else {
          navigate("/login");
        }
      })
      .catch(() => navigate("/login"))
      .finally(() => setLoading(false));
  }, [navigate]);

  const fetchReportRows = async () => {
    if (!selectedReport) return null;
    setError(null);

    const live = LIVE_REPORTS[selectedReport];
    if (!live) {
      setRows(null);
      setError(`"${selectedReport}" isn't wired to a backend report endpoint yet.`);
      return null;
    }

    setFetching(true);
    try {
      const res = await axios.get(`${API}${live.endpoint}`, { withCredentials: true });
      if (res.data.success) {
        const liveRows = Array.isArray(res.data.data) ? res.data.data : [];
        setRows(liveRows);
        return liveRows;
      }

      setError(res.data.message || "Failed to load report.");
      setRows(null);
      return null;
    } catch (err) {
      setError(err.response?.data?.message || "Could not reach the server.");
      setRows(null);
      return null;
    } finally {
      setFetching(false);
    }
  };

  const handlePrint = async () => {
    await fetchReportRows();
  };

  const handlePdf = async () => {
    if (!selectedReport || pdfGenerating) return;

    const live = LIVE_REPORTS[selectedReport];
    if (!live) {
      setError(`"${selectedReport}" is not connected to a live report endpoint yet, so a PDF cannot be generated.`);
      return;
    }

    setPdfGenerating(true);
    try {
      const pdfRows = rows !== null ? rows : await fetchReportRows();
      if (pdfRows === null) return;

      downloadReportPdf({
        title: selectedReport,
        columns: live.columns,
        rows: pdfRows,
        generatedBy: displayName,
      });
    } catch (err) {
      setError(err?.message || "Could not generate PDF report.");
    } finally {
      setPdfGenerating(false);
    }
  };

  const columns = LIVE_REPORTS[selectedReport]?.columns;

  if (loading) return null;

  return (
    <div className="wp-page">
      <WarehouseHeader displayName={displayName} active="reports" />

      <div className="wp-content">
        <p className="wp-breadcrumb">
          Reports <span className="wp-crumb-current">/ Store Reports</span>
        </p>

        <div className="wp-panel">
          <div className="wp-panel-header">
            <span className="wp-icon">🖶</span>
            <span>Store Reports</span>
          </div>

          <div className="wp-panel-body">
            <div className="wp-field-row">
              <span className="wp-field-label">Report</span>

              <div className="rpt-select-wrap">
                <button
                  type="button"
                  className="rpt-select-trigger"
                  onClick={() => setDropdownOpen((o) => !o)}
                >
                  <span>{selectedReport || "Select"}</span>
                  <span className="rpt-caret">▾</span>
                </button>

                {dropdownOpen && (
                  <div className="rpt-select-menu">
                    <div
                      className="rpt-select-option rpt-select-placeholder"
                      onClick={() => {
                        setSelectedReport("");
                        setDropdownOpen(false);
                        setRows(null);
                        setError(null);
                      }}
                    >
                      Select
                    </div>
                    {REPORT_OPTIONS.map((opt) => (
                      <div
                        key={opt}
                        className={
                          "rpt-select-option" +
                          (opt === selectedReport ? " rpt-select-option-active" : "")
                        }
                        onClick={() => {
                          setSelectedReport(opt);
                          setDropdownOpen(false);
                          setRows(null);
                          setError(null);
                        }}
                      >
                        {opt}
                        {LIVE_REPORTS[opt] ? " ●" : ""}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                className="wp-btn wp-btn-primary"
                onClick={handlePrint}
                disabled={!selectedReport || fetching || pdfGenerating}
              >
                {fetching ? "Loading..." : "View Report"}
              </button>

              <button
                className="wp-btn rpt-pdf-btn"
                onClick={handlePdf}
                disabled={!selectedReport || fetching || pdfGenerating}
                title="Download the selected live report as a PDF"
              >
                {pdfGenerating ? "Creating PDF..." : "Download PDF"}
              </button>
            </div>

            {error && (
              <p className="wp-hint" style={{ color: "#b91c1c", fontWeight: 600 }}>
                {error}
              </p>
            )}

            {rows !== null && columns && (
              <div className="wp-table-wrap" style={{ marginTop: 18 }}>
                <table className="wp-table">
                  <thead>
                    <tr>
                      {columns.map((c) => (
                        <th key={c.key}>{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={columns.length} className="wp-table-empty">
                          No data available for "{selectedReport}".
                        </td>
                      </tr>
                    ) : (
                      rows.map((r, i) => (
                        <tr key={i}>
                          {columns.map((c) => (
                            <td key={c.key}>{r[c.key]}</td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <WarehouseFooter displayName={displayName} />
    </div>
  );
}

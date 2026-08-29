import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import usePermissions from "../../hooks/usePermissions";
import "./WarehouseHeader.css";

const API = "http://localhost/BrewSmart/backend/api";

const BIN_OPERATION_MENU = [
  {
    heading: "INVOICE ENTRY",
    items: [
      { label: "Add New", path: "/warehousing/bin-operation/invoice-entry/add", permission: "warehousing.invoice_add" },
      { label: "Edit", path: "/warehousing/bin-operation/invoice-entry/edit", permission: "warehousing.invoice_edit" },
    ],
  },
  {
    heading: "GRN",
    items: [
      { label: "Unloading / GRN Print", path: "/warehousing/bin-operation/grn/print", permission: "warehousing.grn_print" },
      { label: "Invoice Chest Receiving / GRN", path: "/warehousing/bin-operation/grn/add-edit", permission: "warehousing.grn_add_edit" },
    ],
  },
  {
    heading: "GIN",
    items: [
      { label: "Invoice Chest Issuing / GIN", path: "/warehousing/bin-operation/gin/add", permission: "warehousing.gin_add" },
      { label: "Loading / Picking / GIN Print", path: "/warehousing/bin-operation/gin/picking-list", permission: "warehousing.gin_picking" },
    ],
  },
];

export function WarehouseHeader({ displayName, active }) {
  const navigate = useNavigate();
  const [binMenuOpen, setBinMenuOpen] = useState(false);
  const [inquiryMenuOpen, setInquiryMenuOpen] = useState(false);
  const { loading, can } = usePermissions();

  const allowedGroups = useMemo(
    () =>
      BIN_OPERATION_MENU.map((group) => ({
        ...group,
        items: group.items.filter((item) => can(item.permission)),
      })).filter((group) => group.items.length > 0),
    [can]
  );

  const handleLogout = async () => {
    try {
      await axios.post(`${API}/auth/logout.php`, {}, { withCredentials: true });
    } catch {
      // Continue to login even if logout request fails.
    }
    navigate("/login");
  };

  return (
    <>
      <header className="wh-navbar">
        <div className="wh-brand" onClick={() => can("warehousing.home") && navigate("/warehousing")}>
          <div className="wh-leaf-logo">
            <svg viewBox="0 0 64 64">
              <path d="M49 8C29 10 15 20 15 36c0 9 6 16 15 16 16 0 25-16 19-44Z" />
              <path d="M14 54C25 42 33 32 47 20" />
            </svg>
          </div>
          <span className="wh-brand-text">Brew<span>Smart</span></span>
        </div>

        <div className="wh-navbar-right">
          <div className="wh-user-info">
            <span className="wh-logged-label">Logged in as</span>
            <span className="wh-user-name">{displayName || "User"}</span>
          </div>
          <button className="wh-logout-button" onClick={handleLogout}>⏻ LOGOUT</button>
        </div>
      </header>

      {!loading && (
        <nav className="wh-nav-links">
          {allowedGroups.length > 0 && (
            <div
              className="wh-nav-dropdown"
              onMouseEnter={() => setBinMenuOpen(true)}
              onMouseLeave={() => setBinMenuOpen(false)}
            >
              <span className={active === "bin-operation" ? "active" : ""}>BIN OPERATION</span>
              {binMenuOpen && (
                <div className="wh-mega-menu">
                  {allowedGroups.map((group) => (
                    <div className="wh-mega-col" key={group.heading}>
                      <div className="wh-mega-heading">{group.heading}</div>
                      {group.items.map((item) => (
                        <div
                          key={item.path}
                          className="wh-mega-item"
                          onClick={() => {
                            setBinMenuOpen(false);
                            navigate(item.path);
                          }}
                        >
                          {item.label}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {can("warehousing.reports") && (
            <span className={active === "reports" ? "active" : ""} onClick={() => navigate("/warehousing/reports")}>REPORTS</span>
          )}
          {(can("warehousing.inquiry") || can("warehousing.location_inquiry")) && (
            <div
              className="wh-nav-dropdown wh-inquiry-dropdown"
              onMouseEnter={() => setInquiryMenuOpen(true)}
              onMouseLeave={() => setInquiryMenuOpen(false)}
            >
              <span className={active === "inquiry" ? "active" : ""}>INQUIRY</span>
              {inquiryMenuOpen && (
                <div className="wh-inquiry-menu">
                  {can("warehousing.inquiry") && (
                    <div className="wh-mega-item" onClick={() => { setInquiryMenuOpen(false); navigate("/warehousing/inquiry"); }}>
                      Stock / Invoice Inquiry
                    </div>
                  )}
                  {can("warehousing.location_inquiry") && (
                    <div className="wh-mega-item" onClick={() => { setInquiryMenuOpen(false); navigate("/warehousing/inquiry/location"); }}>
                      Location Inquiry
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {can("warehousing.master") && (
            <span className={active === "master" ? "active" : ""} onClick={() => navigate("/warehousing/master")}>MASTER</span>
          )}
          {can("warehousing.home") && (
            <span className={active === "home" ? "active" : ""} onClick={() => navigate("/warehousing")}>HOME</span>
          )}
        </nav>
      )}
    </>
  );
}

export function WarehouseFooter({ displayName }) {
  return (
    <footer className="wh-footer">
      <div className="wh-footer-title">
        <span className="wh-footer-icon">🍃</span>
        <span>BrewSmart Tea Warehouse Management System</span>
      </div>
      <p className="wh-copyright">Copyright © 2026 {displayName || ""} All Rights Reserved.</p>
      <p className="wh-legal">User Agreement, Privacy and Cookies.</p>
    </footer>
  );
}

export default WarehouseHeader;

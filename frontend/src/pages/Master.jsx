import { API_BASE as API } from "../config/api";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import brewSmartLogo from "../assets/brewsmart-logo.png";
import "./Master.css";


const MASTER_CONFIG = {
  mark: {
    title: "Mark Master",
    permission: "master.mark",
    load: async () => {
      const res = await axios.get(`${API}/master/marks-list.php`, { withCredentials: true });
      return res.data.data || [];
    },
    create: (code, name) =>
      axios.post(`${API}/master/marks-create.php`, { mark_code: code, mark_name: name }, { withCredentials: true }),
    codeKey: "mark_code",
    nameKey: "mark_name",
    idKey: "mark_id",
    codeLabel: "Mark Code",
    nameLabel: "Mark Name",
  },
  grade: {
    title: "Grade Master",
    permission: "master.grade",
    load: async () => {
      const res = await axios.get(`${API}/meta.php`, { withCredentials: true });
      return res.data.data?.grades || [];
    },
    create: (code, name, extra = {}) =>
      axios.post(`${API}/master/grade-create.php`, { grade_code: code, grade_name: name, ...extra }, { withCredentials: true }),
    updateProfile: (grade_id, extra = {}) =>
      axios.post(`${API}/master/grade-update.php`, { grade_id, ...extra }, { withCredentials: true }),
    hasStorageProfile: true,
    codeKey: "grade_code",
    nameKey: "grade_name",
    idKey: "grade_id",
    codeLabel: "Grade Code",
    nameLabel: "Grade Name",
  },
  broker: {
    title: "Broker Master",
    permission: "master.broker",
    load: async () => {
      const res = await axios.get(`${API}/master/brokers-list.php`, { withCredentials: true });
      return res.data.data || [];
    },
    create: (code, name) =>
      axios.post(`${API}/master/brokers-create.php`, { broker_code: code, broker_name: name }, { withCredentials: true }),
    codeKey: "broker_code",
    nameKey: "broker_name",
    idKey: "broker_id",
    codeLabel: "Broker Code",
    nameLabel: "Broker Name",
  },
  buyer: {
    title: "Buyer Master",
    permission: "master.buyer",
    load: async () => {
      const res = await axios.get(`${API}/master/buyers-list.php`, { withCredentials: true });
      return res.data.data || [];
    },
    create: (code, name) =>
      axios.post(`${API}/master/buyers-create.php`, { buyer_code: code, buyer_name: name }, { withCredentials: true }),
    codeKey: "buyer_code",
    nameKey: "buyer_name",
    idKey: "buyer_id",
    codeLabel: "Buyer Code",
    nameLabel: "Buyer Name",
  },
  "packing-type": {
    title: "Packing Type Master",
    permission: "master.packing_type",
    load: async () => {
      const res = await axios.get(`${API}/master/packing-list.php`, { withCredentials: true });
      return res.data.data || [];
    },
    create: (code, name) =>
      axios.post(`${API}/master/packing-create.php`, { packing_code: code, packing_name: name }, { withCredentials: true }),
    codeKey: "packing_code",
    nameKey: "packing_name",
    idKey: "packing_type_id",
    codeLabel: "Packing Code",
    nameLabel: "Packing Name",
  },
};

function MasterHeader({ displayName, role, title, onBack }) {
  return (
    <>
      <header className="master-topbar">
        <button className="master-brand" type="button" onClick={onBack}>
          <img className="master-brand-logo" src={brewSmartLogo} alt="BrewSmart" />
        </button>
        <div className="master-user-block">
          <div>
            <span className="master-user-label">Logged in as</span>
            <strong>{displayName || "User"}</strong>
          </div>
          <span className="master-role-badge">{role || "USER"}</span>
        </div>
      </header>
      <div className="master-page-title">
        <div>
          <p>BROKERING / MASTER</p>
          <h1>{title}</h1>
        </div>
        <button className="master-back-btn" type="button" onClick={onBack}>← Brokering</button>
      </div>
    </>
  );
}

function AccessManager() {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [savingKey, setSavingKey] = useState("");
  const [message, setMessage] = useState(null);

  useEffect(() => {
    axios
      .get(`${API}/permissions/users.php`, { withCredentials: true })
      .then((res) => {
        const list = res.data.data || [];
        setUsers(list);
        if (list.length) setSelectedUserId(String(list[0].user_id));
      })
      .catch((err) => setMessage({ type: "error", text: err.response?.data?.message || "Could not load users." }))
      .finally(() => setLoadingUsers(false));
  }, []);

  const loadUserPermissions = async (userId) => {
    if (!userId) return;
    setLoadingPermissions(true);
    setMessage(null);
    try {
      const res = await axios.get(`${API}/permissions/user.php?user_id=${encodeURIComponent(userId)}`, {
        withCredentials: true,
      });
      setSelectedUser(res.data.data?.user || null);
      setPermissions(res.data.data?.permissions || []);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Could not load user permissions." });
      setPermissions([]);
    } finally {
      setLoadingPermissions(false);
    }
  };

  useEffect(() => {
    if (selectedUserId) loadUserPermissions(selectedUserId);
  }, [selectedUserId]);

  const grouped = useMemo(() => {
    const map = new Map();
    permissions.forEach((p) => {
      const module = p.module_name || "OTHER";
      const group = p.group_name || "General";
      const moduleEntry = map.get(module) || new Map();
      const rows = moduleEntry.get(group) || [];
      rows.push(p);
      moduleEntry.set(group, rows);
      map.set(module, moduleEntry);
    });
    return Array.from(map.entries());
  }, [permissions]);

  const togglePermission = async (permission) => {
    if (!selectedUser) return;
    const nextValue = !Boolean(permission.has_access);
    setSavingKey(permission.permission_key);
    setMessage(null);
    try {
      await axios.post(
        `${API}/permissions/update-user.php`,
        {
          user_id: selectedUser.user_id,
          permission_key: permission.permission_key,
          has_access: nextValue ? 1 : 0,
        },
        { withCredentials: true }
      );
      setPermissions((prev) =>
        prev.map((p) =>
          p.permission_key === permission.permission_key
            ? { ...p, has_access: nextValue, is_override: true, override_value: nextValue }
            : p
        )
      );
      setMessage({ type: "success", text: `Access updated for ${selectedUser.full_name || selectedUser.username}.` });
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Could not update access." });
    } finally {
      setSavingKey("");
    }
  };

  const resetToRoleDefaults = async () => {
    if (!selectedUser) return;
    setMessage(null);
    try {
      await axios.post(
        `${API}/permissions/reset-user.php`,
        { user_id: selectedUser.user_id },
        { withCredentials: true }
      );
      await loadUserPermissions(selectedUser.user_id);
      setMessage({ type: "success", text: "User access reset to role defaults." });
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Could not reset access." });
    }
  };

  if (loadingUsers) return <div className="master-card">Loading users…</div>;

  return (
    <div className="master-grid master-access-layout">
      <aside className="master-card master-user-list-card">
        <div className="master-card-head">
          <div>
            <span className="master-kicker">USER ACCESS</span>
            <h3>Select User</h3>
          </div>
          <span className="master-count">{users.length}</span>
        </div>

        <select
          className="master-input"
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
        >
          {users.map((u) => (
            <option key={u.user_id} value={u.user_id}>
              {u.full_name || u.username} — {u.role}
            </option>
          ))}
        </select>

        {selectedUser && (
          <div className="master-selected-user">
            <div className="master-avatar">{(selectedUser.full_name || selectedUser.username || "U").charAt(0).toUpperCase()}</div>
            <div>
              <strong>{selectedUser.full_name || selectedUser.username}</strong>
              <span>@{selectedUser.username}</span>
              <span>{selectedUser.role} · {selectedUser.status}</span>
            </div>
          </div>
        )}

        <p className="master-help">
          Admin or Manager can grant access per user. The user sees only the functions that are allowed here.
        </p>

        <button className="master-btn master-btn-secondary" type="button" onClick={resetToRoleDefaults} disabled={!selectedUser}>
          Reset to Role Defaults
        </button>
      </aside>

      <section className="master-card master-permission-card">
        <div className="master-card-head">
          <div>
            <span className="master-kicker">FUNCTION ACCESS</span>
            <h3>Allowed Functions</h3>
          </div>
        </div>

        {message && <div className={`master-message ${message.type}`}>{message.text}</div>}

        {loadingPermissions ? (
          <p className="master-help">Loading permissions…</p>
        ) : permissions.length === 0 ? (
          <p className="master-help">No permission catalog found. Import migration_user_function_access.sql.</p>
        ) : (
          <div className="master-permission-groups">
            {grouped.map(([moduleName, groupMap]) => (
              <div className="master-module" key={moduleName}>
                <h4>{moduleName}</h4>
                {Array.from(groupMap.entries()).map(([groupName, rows]) => (
                  <div className="master-permission-group" key={`${moduleName}-${groupName}`}>
                    <div className="master-group-name">{groupName}</div>
                    {rows.map((p) => {
                      const locked = selectedUser?.role === "ADMIN" ||
                        (p.permission_key === "master.access_manager" && selectedUser?.role !== "MANAGER");
                      return (
                        <div className="master-permission-row" key={p.permission_key}>
                          <div>
                            <strong>{p.permission_label}</strong>
                            <span>{p.permission_key}</span>
                          </div>
                          <label className={`access-switch ${locked ? "locked" : ""}`}>
                            <input
                              type="checkbox"
                              checked={Boolean(p.has_access)}
                              disabled={locked || savingKey === p.permission_key}
                              onChange={() => togglePermission(p)}
                            />
                            <span className="access-slider"></span>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SimpleMaster({ type }) {
  const config = MASTER_CONFIG[type];
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [packingDensity, setPackingDensity] = useState("");
  const [minBagWeight, setMinBagWeight] = useState("");
  const [maxBagWeight, setMaxBagWeight] = useState("");
  const [editingGradeId, setEditingGradeId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await config.load());
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Could not load master data." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [type]);

  const add = async () => {
    if (!code.trim()) {
      setMessage({ type: "error", text: `${config.codeLabel} is required.` });
      return;
    }
    if (config.hasStorageProfile) {
      const density = Number(packingDensity);
      const minW = Number(minBagWeight);
      const maxW = Number(maxBagWeight);
      if (!(density > 0)) return setMessage({ type: "error", text: "Packing Density must be greater than 0." });
      if (!(minW > 0) || !(maxW > 0)) return setMessage({ type: "error", text: "Minimum and Maximum Bag Weight are required." });
      if (minW > maxW) return setMessage({ type: "error", text: "Minimum Bag Weight cannot be greater than Maximum Bag Weight." });
    }
    setSaving(true);
    setMessage(null);
    try {
      const profile = config.hasStorageProfile ? {
        packing_density: Number(packingDensity),
        min_bag_weight: Number(minBagWeight),
        max_bag_weight: Number(maxBagWeight),
      } : {};
      await config.create(code.trim(), name.trim() || code.trim(), profile);
      setCode("");
      setName("");
      setPackingDensity("");
      setMinBagWeight("");
      setMaxBagWeight("");
      await load();
      setMessage({ type: "success", text: `${config.title.replace(" Master", "")} added successfully.` });
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Could not add master record." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="master-grid master-data-layout">
      <section className="master-card">
        <div className="master-card-head">
          <div>
            <span className="master-kicker">MASTER DATA ONLY</span>
            <h3>Add New</h3>
          </div>
        </div>
        <p className="master-help">
          New {config.title.replace(" Master", "").toLowerCase()} records are created here only. Transaction screens use the saved list and cannot create new master values.
        </p>
        <div className="master-form-stack">
          <label>
            <span>{config.codeLabel}</span>
            <input className="master-input" value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          <label>
            <span>{config.nameLabel}</span>
            <input className="master-input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          {config.hasStorageProfile && (
            <>
              <label>
                <span>Packing Density</span>
                <input className="master-input" type="number" min="0.001" step="0.001" value={packingDensity} onChange={(e) => setPackingDensity(e.target.value)} placeholder="e.g. 350" />
              </label>
              <label>
                <span>Minimum Bag Weight (kg)</span>
                <input className="master-input" type="number" min="0.01" step="0.01" value={minBagWeight} onChange={(e) => setMinBagWeight(e.target.value)} placeholder="e.g. 45" />
              </label>
              <label>
                <span>Maximum Bag Weight (kg)</span>
                <input className="master-input" type="number" min="0.01" step="0.01" value={maxBagWeight} onChange={(e) => setMaxBagWeight(e.target.value)} placeholder="e.g. 55" />
              </label>
              <p className="master-help">Invoice Entry will accept this grade only when Net Weight Each is inside this configured range.</p>
            </>
          )}
          <button className="master-btn master-btn-primary" type="button" onClick={add} disabled={saving}>
            {saving ? "Saving…" : "Add New"}
          </button>
        </div>
        {message && <div className={`master-message ${message.type}`}>{message.text}</div>}
      </section>

      <section className="master-card master-list-card">
        <div className="master-card-head">
          <div>
            <span className="master-kicker">CURRENT RECORDS</span>
            <h3>{config.title}</h3>
          </div>
          <span className="master-count">{rows.length}</span>
        </div>
        <div className="master-table-wrap">
          <table className="master-table">
            <thead>
              {config.hasStorageProfile ? (
                <tr><th>Code</th><th>Name</th><th>Packing Density</th><th>Allowed Bag Weight</th><th>Profile</th></tr>
              ) : (
                <tr><th>Code</th><th>Name</th><th>Status</th></tr>
              )}
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={config.hasStorageProfile ? 5 : 3}>Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={config.hasStorageProfile ? 5 : 3}>No records found.</td></tr>
              ) : rows.map((row, index) => (
                <tr key={row[config.idKey] || `${row[config.codeKey]}-${index}`}>
                  <td>{row[config.codeKey]}</td>
                  <td>{row[config.nameKey]}</td>
                  {config.hasStorageProfile ? (
                    <>
                      <td>{row.packing_density ? Number(row.packing_density).toFixed(3) : "Not configured"}</td>
                      <td>{row.min_bag_weight && row.max_bag_weight ? `${Number(row.min_bag_weight).toFixed(2)}–${Number(row.max_bag_weight).toFixed(2)} kg` : "Not configured"}</td>
                      <td>
                        <button className="master-btn master-btn-secondary" type="button" onClick={() => {
                          setEditingGradeId(row.grade_id);
                          setPackingDensity(row.packing_density ?? "");
                          setMinBagWeight(row.min_bag_weight ?? "");
                          setMaxBagWeight(row.max_bag_weight ?? "");
                        }}>Configure</button>
                      </td>
                    </>
                  ) : (
                    <td><span className="master-status active">{row.status || (row.active === 0 ? "INACTIVE" : "ACTIVE")}</span></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {config.hasStorageProfile && editingGradeId && (
          <div className="master-form-stack" style={{ marginTop: 18 }}>
            <div className="master-card-head"><div><span className="master-kicker">GRADE STORAGE PROFILE</span><h3>Configure Existing Grade</h3></div></div>
            <label><span>Packing Density</span><input className="master-input" type="number" min="0.001" step="0.001" value={packingDensity} onChange={(e) => setPackingDensity(e.target.value)} /></label>
            <label><span>Minimum Bag Weight (kg)</span><input className="master-input" type="number" min="0.01" step="0.01" value={minBagWeight} onChange={(e) => setMinBagWeight(e.target.value)} /></label>
            <label><span>Maximum Bag Weight (kg)</span><input className="master-input" type="number" min="0.01" step="0.01" value={maxBagWeight} onChange={(e) => setMaxBagWeight(e.target.value)} /></label>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="master-btn master-btn-primary" type="button" onClick={async () => {
                const density = Number(packingDensity), minW = Number(minBagWeight), maxW = Number(maxBagWeight);
                if (!(density > 0) || !(minW > 0) || !(maxW > 0) || minW > maxW) return setMessage({ type: "error", text: "Enter a valid packing density and weight range." });
                setSaving(true); setMessage(null);
                try {
                  await config.updateProfile(editingGradeId, { packing_density: density, min_bag_weight: minW, max_bag_weight: maxW });
                  await load(); setEditingGradeId(null); setPackingDensity(""); setMinBagWeight(""); setMaxBagWeight("");
                  setMessage({ type: "success", text: "Grade storage profile updated successfully." });
                } catch (err) { setMessage({ type: "error", text: err.response?.data?.message || "Could not update grade profile." }); }
                finally { setSaving(false); }
              }} disabled={saving}>Save Profile</button>
              <button className="master-btn master-btn-secondary" type="button" onClick={() => { setEditingGradeId(null); setPackingDensity(""); setMinBagWeight(""); setMaxBagWeight(""); }}>Cancel</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function AuctionCalendarMaster() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ auction_date: "", sale_no: "", notes: "", status: "SCHEDULED" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/master/auctions-list.php`, { withCredentials: true });
      setRows(res.data.data || []);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Could not load auction calendar." });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const create = async () => {
    if (!form.auction_date) return setMessage({ type: "error", text: "Auction date is required." });
    setSaving(true); setMessage(null);
    try {
      await axios.post(`${API}/master/auctions-create.php`, form, { withCredentials: true });
      setForm({ auction_date: "", sale_no: "", notes: "", status: "SCHEDULED" });
      await load();
      setMessage({ type: "success", text: "Tea auction date saved. Home screens now use the next scheduled date." });
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Could not save auction date." });
    } finally { setSaving(false); }
  };

  return (
    <div className="master-grid master-data-layout">
      <section className="master-card">
        <div className="master-card-head"><div><span className="master-kicker">AUCTION SCHEDULE</span><h3>Add Tea Auction</h3></div></div>
        <div className="master-form-stack">
          <label><span>Auction Date</span><input className="master-input" type="date" value={form.auction_date} onChange={set("auction_date")} /></label>
          <label><span>Sale / Auction No</span><input className="master-input" value={form.sale_no} onChange={set("sale_no")} placeholder="e.g. SALE-35" /></label>
          <label><span>Status</span><select className="master-input" value={form.status} onChange={set("status")}><option>SCHEDULED</option><option>COMPLETED</option><option>CANCELLED</option></select></label>
          <label><span>Notes</span><input className="master-input" value={form.notes} onChange={set("notes")} placeholder="Optional" /></label>
          <button className="master-btn master-btn-primary" type="button" onClick={create} disabled={saving}>{saving ? "Saving…" : "Save Auction Date"}</button>
        </div>
        {message && <div className={`master-message ${message.type}`}>{message.text}</div>}
      </section>
      <section className="master-card master-list-card">
        <div className="master-card-head"><div><span className="master-kicker">AUCTION CALENDAR</span><h3>Scheduled Dates</h3></div><span className="master-count">{rows.length}</span></div>
        <div className="master-table-wrap"><table className="master-table"><thead><tr><th>Date</th><th>Sale No</th><th>Status</th><th>Created By</th><th>Notes</th></tr></thead><tbody>
          {loading ? <tr><td colSpan="5">Loading…</td></tr> : rows.length === 0 ? <tr><td colSpan="5">No auction dates found.</td></tr> : rows.map((r) => <tr key={r.auction_id}><td>{r.auction_date}</td><td>{r.sale_no || "—"}</td><td><span className={`master-status ${r.status === "SCHEDULED" ? "active" : "inactive"}`}>{r.status}</span></td><td>{r.created_by_name || "—"}</td><td>{r.notes || "—"}</td></tr>)}
        </tbody></table></div>
      </section>
    </div>
  );
}

function UserAccountMaster({ actorRole }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [form, setForm] = useState({ username: "", full_name: "", email: "", password: "", role: "WAREHOUSE_STAFF" });

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/users/list.php`, { withCredentials: true });
      setUsers(res.data.data || []);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Could not load users." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const roles = actorRole === "MANAGER"
    ? ["WAREHOUSE_STAFF", "BROKER"]
    : ["ADMIN", "MANAGER", "WAREHOUSE_STAFF", "BROKER"];

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const create = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await axios.post(`${API}/users/create.php`, form, { withCredentials: true });
      setForm({ username: "", full_name: "", email: "", password: "", role: "WAREHOUSE_STAFF" });
      await load();
      setMessage({ type: "success", text: "User account created. You can now assign function access from Access Manager." });
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Could not create user." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="master-grid master-data-layout">
      <section className="master-card">
        <div className="master-card-head"><div><span className="master-kicker">USER MASTER</span><h3>Add User</h3></div></div>
        <div className="master-form-stack">
          <label><span>Username</span><input className="master-input" value={form.username} onChange={set("username")} /></label>
          <label><span>Full Name</span><input className="master-input" value={form.full_name} onChange={set("full_name")} /></label>
          <label><span>Email</span><input className="master-input" type="email" value={form.email} onChange={set("email")} /></label>
          <label><span>Password</span><input className="master-input" type="password" value={form.password} onChange={set("password")} /></label>
          <label><span>Role</span><select className="master-input" value={form.role} onChange={set("role")}>{roles.map((r) => <option key={r}>{r}</option>)}</select></label>
          <button className="master-btn master-btn-primary" type="button" onClick={create} disabled={saving}>{saving ? "Creating…" : "Create User"}</button>
        </div>
        {message && <div className={`master-message ${message.type}`}>{message.text}</div>}
      </section>

      <section className="master-card master-list-card">
        <div className="master-card-head"><div><span className="master-kicker">CURRENT USERS</span><h3>User Accounts</h3></div><span className="master-count">{users.length}</span></div>
        <div className="master-table-wrap">
          <table className="master-table">
            <thead><tr><th>Username</th><th>Name</th><th>Role</th><th>Status</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="4">Loading…</td></tr> : users.map((u) => (
                <tr key={u.user_id}><td>{u.username}</td><td>{u.full_name}</td><td>{u.role}</td><td><span className={`master-status ${u.status === "ACTIVE" ? "active" : "inactive"}`}>{u.status}</span></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function Master({ section = "access-manager" }) {
  const navigate = useNavigate();
  const [session, setSession] = useState({ display_name: "", role: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get(`${API}/auth/session-check.php`, { withCredentials: true })
      .then((res) => {
        if (!res.data.loggedIn) navigate("/login");
        else setSession({ display_name: res.data.display_name, role: res.data.role });
      })
      .catch(() => navigate("/login"))
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading) return null;

  const title = section === "access-manager"
    ? "Access Manager"
    : section === "user-account"
      ? "User Account Master"
      : section === "auction-calendar"
        ? "Tea Auction Calendar"
        : MASTER_CONFIG[section]?.title || "Brokering Master";

  return (
    <div className="master-page">
      <MasterHeader
        displayName={session.display_name}
        role={session.role}
        title={title}
        onBack={() => navigate("/brokering")}
      />
      <main className="master-content">
        {section === "access-manager" && <AccessManager />}
        {section === "user-account" && <UserAccountMaster actorRole={session.role} />}
        {section === "auction-calendar" && <AuctionCalendarMaster />}
        {MASTER_CONFIG[section] && <SimpleMaster type={section} />}
      </main>
    </div>
  );
}

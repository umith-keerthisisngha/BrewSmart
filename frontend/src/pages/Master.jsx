import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./Master.css";

const API = "http://localhost/BrewSmart/backend/api";

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
    create: (code, name) =>
      axios.post(`${API}/master/grade-create.php`, { grade_code: code, grade_name: name }, { withCredentials: true }),
    codeKey: "grade_code",
    nameKey: "grade_name",
    idKey: "grade_id",
    codeLabel: "Grade Code",
    nameLabel: "Grade Name",
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
          <span className="master-leaf">🍃</span>
          <span>Brew<span>Smart</span></span>
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
    setSaving(true);
    setMessage(null);
    try {
      await config.create(code.trim(), name.trim() || code.trim());
      setCode("");
      setName("");
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
              <tr><th>Code</th><th>Name</th><th>Status</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="3">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="3">No records found.</td></tr>
              ) : rows.map((row, index) => (
                <tr key={row[config.idKey] || `${row[config.codeKey]}-${index}`}>
                  <td>{row[config.codeKey]}</td>
                  <td>{row[config.nameKey]}</td>
                  <td><span className="master-status active">{row.status || (row.active === 0 ? "INACTIVE" : "ACTIVE")}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
        {MASTER_CONFIG[section] && <SimpleMaster type={section} />}
      </main>
    </div>
  );
}

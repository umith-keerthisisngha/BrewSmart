import { API_BASE as API } from "../config/api";
import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";


export default function usePermissions() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("");
  const [permissions, setPermissions] = useState([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/permissions/current.php`, {
        withCredentials: true,
      });
      const data = res.data?.data || {};
      setRole(data.role || "");
      setPermissions(data.permissions || []);
    } catch {
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const map = useMemo(() => {
    const next = new Map();
    permissions.forEach((p) => next.set(p.permission_key, Boolean(p.has_access)));
    return next;
  }, [permissions]);

  const can = useCallback(
    (permissionKey) => role === "ADMIN" || map.get(permissionKey) === true,
    [map, role]
  );

  return { loading, role, permissions, can, refresh };
}

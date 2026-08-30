import { API_BASE as API } from "../config/api";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import axios from "axios";


export default function ProtectedRoute({ permissionKey, pageKey, children }) {
  const key = permissionKey || pageKey;
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!key) {
      setAllowed(true);
      setChecking(false);
      return;
    }

    setChecking(true);
    axios
      .get(`${API}/permissions/check.php?page_key=${encodeURIComponent(key)}`, {
        withCredentials: true,
      })
      .then((res) => setAllowed(Boolean(res.data.hasAccess)))
      .catch(() => setAllowed(false))
      .finally(() => setChecking(false));
  }, [key]);

  if (checking) return null;
  if (!allowed) return <Navigate to="/dashboard" replace />;

  return children;
}

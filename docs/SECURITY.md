# Security Controls

Implemented controls include PDO prepared statements, `password_hash`/`password_verify`, session ID regeneration at login, HttpOnly/SameSite cookies, Secure cookies when HTTPS is detected, origin allow-listing for state-changing requests, restricted CORS, security response headers, login attempt throttling, role and user-specific backend authorization, transaction-based stock changes and activity logging.

For production deployment also enable HTTPS, change demo credentials, use least-privilege DB credentials, set `BREWSMART_ALLOWED_ORIGINS`, disable PHP error display and keep backups/audit retention policies.

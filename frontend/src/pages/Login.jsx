import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./Login.css";
import bgImage from "../assets/tea-background.jpg";

export default function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await axios.post(
  "http://localhost/BrewSmart/backend/api/auth/login.php",
  { username, password },
  { withCredentials: true }
      );

      if (res.data.success) {
        navigate("/dashboard");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Check backend connection.");
    }
  };

  return (
    <div className="login-page">

      {/* Background overlay */}
      <div className="login-overlay"></div>

      {/* Tea decoration */}
      <div className="steam steam-one"></div>
      <div className="steam steam-two"></div>

      {/* Login content */}
      <div className="login-container">

        {/* Logo */}
        <div className="brand">
          <div className="leaf-logo">
            <svg viewBox="0 0 64 64">
              <path
                d="M49 8C29 10 15 20 15 36c0 9 6 16 15 16
                16 0 25-16 19-44Z"
              />
              <path d="M14 54C25 42 33 32 47 20" />
            </svg>
          </div>

          <h1>
            Brew<span>Smart</span>
          </h1>

          <p>Please enter your credentials to access the system</p>
        </div>

        {/* Login Card */}
        <div className="login-card">

          <form onSubmit={handleLogin}>

            {/* Username */}
            <div className="form-group">
              <label>USERNAME</label>

              <div className="input-wrapper active">
                <span className="input-icon">
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21c0-4.2 3.6-7 8-7s8 2.8 8 7" />
                  </svg>
                </span>

                <input
                  type="text"
                  placeholder="Enter your username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="form-group">
              <label>PASSWORD</label>

              <div className="input-wrapper">
                <span className="input-icon">
                  <svg viewBox="0 0 24 24">
                    <rect x="5" y="10" width="14" height="11" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                </span>

                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24">
                      <path d="M3 3l18 18" />
                      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                      <path d="M9.9 4.3A10.8 10.8 0 0 1 12 4c5 0 8.7 3.8 10 8-0.5 1.7-1.4 3.1-2.5 4.3" />
                      <path d="M6.2 6.2C4.6 7.3 3.4 9.1 2 12c1.3 4.2 5 8 10 8 1.3 0 2.5-.2 3.6-.7" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Options */}
            <div className="login-options">

              <label className="remember">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />

                <span className="custom-checkbox">
                  {rememberMe && "✓"}
                </span>

                <span>Remember me</span>
              </label>

              <button
                type="button"
                className="forgot-password"
              >
                Forgot password?
              </button>

            </div>

            {/* Error message */}
            {error && (
              <p style={{ color: "#ff6b6b", fontSize: "13px", marginTop: "-15px", marginBottom: "15px" }}>
                {error}
              </p>
            )}

            {/* Login button */}
            <button type="submit" className="login-button">
              LOGIN TO SYSTEM
            </button>

          </form>
        </div>

        {/* Footer */}
        <div className="login-footer">
          <span className="footer-icon">♟</span>

          <span>
            BrewSmart Tea Warehouse Management System
          </span>

          <span className="footer-divider">|</span>

          <span className="footer-green">
            Empowering Efficiency, Ensuring Quality
          </span>
        </div>

      </div>
    </div>
  );
}
import React, { useState } from "react";
import { authApi } from "./api";

interface LoginPageProps {
  onLoginSuccess: (token: string, username: string, remember: boolean) => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const { ok, data } = await authApi.login(username.trim(), password.trim());
      if (ok && data?.token) {
        onLoginSuccess(data.token, data.username || username.trim(), remember);
      } else {
        setError(data?.error || "Invalid username or password");
      }
    } catch (err: any) {
      setError(err?.message || "Connection failed. Please check network.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "radial-gradient(circle at 50% 20%, #172554 0%, #0b0f19 70%, #030712 100%)",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      color: "#f8fafc",
      padding: "20px",
      boxSizing: "border-box"
    }}>
      <div style={{
        width: "100%",
        maxWidth: "420px",
        background: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderRadius: "20px",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(37, 99, 235, 0.15)",
        overflow: "hidden"
      }}>
        {/* Brand Banner Header */}
        <div style={{
          padding: "32px 32px 24px",
          textAlign: "center",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          background: "linear-gradient(180deg, rgba(30, 58, 138, 0.25) 0%, rgba(15, 23, 42, 0) 100%)"
        }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "56px",
            height: "56px",
            borderRadius: "16px",
            background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
            boxShadow: "0 8px 16px rgba(37, 99, 235, 0.35)",
            marginBottom: "16px"
          }}>
            <span style={{ fontSize: "22px", fontWeight: 800, color: "#ffffff", letterSpacing: "1px" }}>NV</span>
          </div>

          <h1 style={{
            margin: "0 0 6px 0",
            fontSize: "20px",
            fontWeight: 700,
            letterSpacing: "-0.5px",
            color: "#ffffff"
          }}>
            AdBlue Fleet Management
          </h1>

          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            fontWeight: 500,
            color: "#38bdf8",
            background: "rgba(56, 189, 248, 0.1)",
            padding: "3px 10px",
            borderRadius: "20px",
            border: "1px solid rgba(56, 189, 248, 0.2)"
          }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#38bdf8", display: "inline-block" }}></span>
            KHARJ-01 · Intelligent Forecourt
          </div>
        </div>

        {/* Form Body */}
        <div style={{ padding: "28px 32px 32px" }}>
          {error && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "10px",
              padding: "10px 14px",
              marginBottom: "20px",
              color: "#fca5a5",
              fontSize: "13px"
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Username Field */}
            <div style={{ marginBottom: "18px" }}>
              <label style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: "8px"
              }}>
                Username
              </label>
              <div style={{ position: "relative" }}>
                <span style={{
                  position: "absolute",
                  left: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#64748b",
                  display: "flex"
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  autoFocus
                  required
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "12px 14px 12px 42px",
                    background: "rgba(15, 23, 42, 0.6)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    borderRadius: "10px",
                    color: "#ffffff",
                    fontSize: "14px",
                    outline: "none",
                    transition: "border-color 0.2s"
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#38bdf8")}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(255, 255, 255, 0.15)")}
                />
              </div>
            </div>

            {/* Password Field */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: "8px"
              }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <span style={{
                  position: "absolute",
                  left: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#64748b",
                  display: "flex"
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "12px 42px 12px 42px",
                    background: "rgba(15, 23, 42, 0.6)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    borderRadius: "10px",
                    color: "#ffffff",
                    fontSize: "14px",
                    outline: "none",
                    transition: "border-color 0.2s"
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#38bdf8")}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(255, 255, 255, 0.15)")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "#64748b",
                    cursor: "pointer",
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "24px",
              fontSize: "13px"
            }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", color: "#cbd5e1" }}>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  style={{ accentColor: "#2563eb", width: "16px", height: "16px", cursor: "pointer" }}
                />
                Remember this session
              </label>
              <span style={{ color: "#64748b", fontSize: "11px" }}>Auto-renews</span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "13px",
                background: loading ? "#1e3a8a" : "linear-gradient(135deg, #2563eb, #1d4ed8)",
                color: "#ffffff",
                border: "none",
                borderRadius: "10px",
                fontSize: "15px",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: "0 4px 12px rgba(37, 99, 235, 0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                transition: "all 0.2s"
              }}
            >
              {loading ? (
                <>
                  <div style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    border: "2px solid rgba(255, 255, 255, 0.3)",
                    borderTopColor: "#ffffff",
                    animation: "btn-spin 0.8s linear infinite"
                  }} />
                  Authenticating...
                </>
              ) : (
                <>
                  <span>Sign In to Console</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Security Badge Footer */}
        <div style={{
          padding: "16px 32px",
          background: "rgba(10, 15, 26, 0.6)",
          borderTop: "1px solid rgba(255, 255, 255, 0.05)",
          textAlign: "center",
          fontSize: "11px",
          color: "#64748b"
        }}>
          ISO 22241 / AUS 32 Compliant · Cryptographic Session Guard
        </div>
      </div>

      <style>{`
        @keyframes btn-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

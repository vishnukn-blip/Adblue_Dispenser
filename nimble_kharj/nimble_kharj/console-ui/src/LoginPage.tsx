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
      width: "100vw",
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      margin: 0,
      padding: "24px 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#070b14",
      backgroundImage: `
        radial-gradient(circle at 50% 10%, rgba(37, 99, 235, 0.22) 0%, transparent 60%),
        radial-gradient(circle at 10% 80%, rgba(14, 165, 233, 0.12) 0%, transparent 50%),
        radial-gradient(circle at 90% 90%, rgba(99, 102, 241, 0.12) 0%, transparent 50%),
        linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)
      `,
      backgroundSize: "100% 100%, 100% 100%, 100% 100%, 48px 48px, 48px 48px",
      fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      color: "#f8fafc",
      boxSizing: "border-box",
      overflowY: "auto",
      zIndex: 9999
    }}>
      {/* Background ambient lighting aura */}
      <div style={{
        position: "absolute",
        width: "500px",
        height: "500px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(37, 99, 235, 0.18) 0%, rgba(56, 189, 248, 0.05) 50%, transparent 70%)",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        filter: "blur(40px)"
      }} />

      {/* Main Container Card */}
      <div style={{
        position: "relative",
        width: "100%",
        maxWidth: "440px",
        background: "rgba(13, 20, 36, 0.88)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderRadius: "24px",
        border: "1px solid rgba(56, 189, 248, 0.18)",
        boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 40px rgba(37, 99, 235, 0.18)",
        overflow: "hidden"
      }}>
        {/* Top Glowing Cyan/Blue Line */}
        <div style={{
          height: "3px",
          width: "100%",
          background: "linear-gradient(90deg, #2563eb, #38bdf8, #60a5fa, #2563eb)",
          boxShadow: "0 0 12px rgba(56, 189, 248, 0.6)"
        }} />

        {/* Brand Banner Header */}
        <div style={{
          padding: "36px 32px 24px",
          textAlign: "center",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
          background: "linear-gradient(180deg, rgba(30, 58, 138, 0.22) 0%, rgba(13, 20, 36, 0) 100%)"
        }}>
          {/* Official Nimble Vision Logo Badge */}
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "10px 20px",
            background: "#ffffff",
            borderRadius: "16px",
            boxShadow: "0 10px 25px -4px rgba(0, 0, 0, 0.35), 0 0 25px rgba(56, 189, 248, 0.3)",
            marginBottom: "18px",
            border: "1px solid rgba(255, 255, 255, 0.9)"
          }}>
            <img
              src="/nimble_vision_logo.png"
              alt="Nimble Vision — Simplifying the way of life"
              style={{
                height: "48px",
                width: "auto",
                maxWidth: "210px",
                objectFit: "contain",
                display: "block"
              }}
            />
          </div>

          <h1 style={{
            margin: "0 0 8px 0",
            fontSize: "21px",
            fontWeight: 800,
            letterSpacing: "-0.5px",
            color: "#ffffff"
          }}>
            AdBlue Fleet Management
          </h1>

          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "12px",
            fontWeight: 600,
            color: "#38bdf8",
            background: "rgba(56, 189, 248, 0.1)",
            padding: "4px 14px",
            borderRadius: "20px",
            border: "1px solid rgba(56, 189, 248, 0.25)"
          }}>
            <span style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: "#10b981",
              boxShadow: "0 0 8px #10b981",
              display: "inline-block"
            }} />
            <span>KHARJ-01 · Intelligent Forecourt Console</span>
          </div>
        </div>

        {/* Form Body */}
        <div style={{ padding: "28px 32px 32px" }}>
          {error && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              background: "rgba(239, 68, 68, 0.14)",
              border: "1px solid rgba(239, 68, 68, 0.35)",
              borderRadius: "12px",
              padding: "12px 16px",
              marginBottom: "22px",
              color: "#fca5a5",
              fontSize: "13px",
              fontWeight: 500
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Username Field */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 700,
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: "0.6px",
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
                    padding: "13px 14px 13px 44px",
                    background: "rgba(15, 23, 42, 0.7)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: "12px",
                    color: "#ffffff",
                    fontSize: "14px",
                    fontWeight: 500,
                    outline: "none",
                    transition: "all 0.2s ease"
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#38bdf8";
                    e.target.style.boxShadow = "0 0 0 3px rgba(56, 189, 248, 0.2)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "rgba(255, 255, 255, 0.12)";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>
            </div>

            {/* Password Field */}
            <div style={{ marginBottom: "22px" }}>
              <label style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 700,
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: "0.6px",
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
                    padding: "13px 44px 13px 44px",
                    background: "rgba(15, 23, 42, 0.7)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: "12px",
                    color: "#ffffff",
                    fontSize: "14px",
                    fontWeight: 500,
                    outline: "none",
                    transition: "all 0.2s ease"
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#38bdf8";
                    e.target.style.boxShadow = "0 0 0 3px rgba(56, 189, 248, 0.2)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "rgba(255, 255, 255, 0.12)";
                    e.target.style.boxShadow = "none";
                  }}
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
                    padding: "6px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "6px"
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
              marginBottom: "26px",
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
              <span style={{ color: "#64748b", fontSize: "11px", fontWeight: 500 }}>Auto-renews 30d</span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "14px",
                background: loading
                  ? "#1e3a8a"
                  : "linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #1e40af 100%)",
                color: "#ffffff",
                border: "none",
                borderRadius: "12px",
                fontSize: "15px",
                fontWeight: 700,
                letterSpacing: "0.2px",
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: "0 6px 20px rgba(37, 99, 235, 0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                transition: "all 0.2s ease"
              }}
              onMouseOver={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 8px 25px rgba(37, 99, 235, 0.6)";
                }
              }}
              onMouseOut={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.boxShadow = "0 6px 20px rgba(37, 99, 235, 0.45)";
                }
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
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Console</span>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
          background: "rgba(9, 14, 26, 0.75)",
          borderTop: "1px solid rgba(255, 255, 255, 0.05)",
          textAlign: "center",
          fontSize: "11px",
          fontWeight: 500,
          color: "#64748b",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px"
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          <span>ISO 22241 / AUS 32 Compliant · 256-Bit Cryptographic Guard</span>
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

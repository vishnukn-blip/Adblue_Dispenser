import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import DispensingConsole from "./DispensingConsole";
import LoginPage from "./LoginPage";
import { authApi } from "./api";
import "./console.css";

const TOKEN_KEY = "adblue_auth_token";
const USER_KEY = "adblue_auth_user";

function App() {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  });
  const [currentUser, setCurrentUser] = useState<string>(() => {
    return localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY) || "admin";
  });
  const [isVerifying, setIsVerifying] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    const verifyCurrentSession = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
      if (!storedToken) {
        if (active) setIsVerifying(false);
        return;
      }
      const sess = await authApi.verify(storedToken);
      if (!active) return;
      if (sess && sess.valid) {
        setToken(storedToken);
        if (sess.username) setCurrentUser(sess.username);
      } else {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(USER_KEY);
        setToken(null);
      }
      setIsVerifying(false);
    };

    verifyCurrentSession();
    return () => {
      active = false;
    };
  }, []);

  const handleLoginSuccess = (newToken: string, username: string, remember: boolean) => {
    if (remember) {
      localStorage.setItem(TOKEN_KEY, newToken);
      localStorage.setItem(USER_KEY, username);
    } else {
      sessionStorage.setItem(TOKEN_KEY, newToken);
      sessionStorage.setItem(USER_KEY, username);
    }
    setToken(newToken);
    setCurrentUser(username);
  };

  const handleLogout = async () => {
    const currentToken = token || localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    if (currentToken) {
      await authApi.logout(currentToken);
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    setToken(null);
  };

  if (isVerifying) {
    return (
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#070b14",
        color: "#94a3b8",
        fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        zIndex: 9999
      }}>
        <div style={{
          width: "44px",
          height: "44px",
          borderRadius: "50%",
          border: "3px solid rgba(56, 189, 248, 0.2)",
          borderTopColor: "#38bdf8",
          animation: "auth-spin 0.8s linear infinite"
        }} />
        <p style={{ marginTop: "16px", fontSize: "13px", fontWeight: 500, letterSpacing: "0.5px", color: "#cbd5e1" }}>
          Verifying AdBlue Session...
        </p>
        <style>{`@keyframes auth-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!token) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return <DispensingConsole onLogout={handleLogout} currentUser={currentUser} />;
}

ReactDOM.createRoot(document.getElementById("kharj-root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

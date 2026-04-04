import { useState } from "react";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

  .auth-root {
    font-family: 'DM Sans', sans-serif;
    width: 100%; min-height: 100vh;
    display: flex; align-items: center; justify-content: center;
    background: #07090f; position: relative; overflow: hidden;
  }
  .auth-root::before {
    content:''; position:fixed; top:-200px; right:-200px;
    width:600px; height:600px;
    background:radial-gradient(circle,rgba(59,130,246,.08) 0%,transparent 70%);
    pointer-events:none;
  }
  .auth-root::after {
    content:''; position:fixed; bottom:-150px; left:-150px;
    width:500px; height:500px;
    background:radial-gradient(circle,rgba(14,165,233,.07) 0%,transparent 70%);
    pointer-events:none;
  }
  .auth-card {
    position:relative; z-index:1; width:100%; max-width:420px;
    background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.09);
    border-radius:24px; padding:40px 36px;
    display:flex; flex-direction:column; gap:20px;
    box-shadow:0 24px 80px rgba(0,0,0,.5); margin:20px;
  }
  .auth-eyebrow {
    font-family:'DM Mono',monospace; font-size:10px;
    letter-spacing:.18em; text-transform:uppercase; color:#3b82f6; text-align:center;
  }
  .auth-title {
    font-size:26px; font-weight:800; color:#fff;
    letter-spacing:-.02em; text-align:center; line-height:1.2;
  }
  .auth-title span {
    background:linear-gradient(135deg,#3b82f6,#0ea5e9);
    -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
  }
  .auth-tabs {
    display:grid; grid-template-columns:1fr 1fr;
    background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08);
    border-radius:12px; padding:4px; gap:4px;
  }
  .auth-tab {
    font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600;
    padding:10px; border-radius:9px; border:none; cursor:pointer;
    transition:all .2s; color:#64748b; background:transparent;
  }
  .auth-tab.active { background:linear-gradient(135deg,#2563eb,#0ea5e9); color:#fff; }
  .auth-form { display:flex; flex-direction:column; gap:12px; }
  .auth-field { display:flex; flex-direction:column; gap:5px; }
  .auth-label { font-size:12px; font-weight:600; color:#64748b; letter-spacing:.02em; }
  .auth-input {
    font-family:'DM Sans',sans-serif; font-size:14px;
    background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.09);
    border-radius:12px; padding:13px 16px; color:#e2e8f0; outline:none;
    transition:border-color .2s,background .2s; width:100%; box-sizing:border-box;
  }
  .auth-input::placeholder { color:#475569; }
  .auth-input:focus { border-color:rgba(59,130,246,.5); background:rgba(59,130,246,.05); }
  .auth-error {
    background:rgba(239,68,68,.1); border:1px solid rgba(239,68,68,.35);
    border-radius:10px; padding:11px 14px; font-size:13px; font-weight:500; color:#fca5a5;
  }
  .auth-success {
    background:rgba(16,185,129,.1); border:1px solid rgba(16,185,129,.35);
    border-radius:10px; padding:11px 14px; font-size:13px; font-weight:500; color:#6ee7b7;
  }
  .auth-btn {
    font-family:'DM Sans',sans-serif; font-size:14px; font-weight:700; width:100%;
    background:linear-gradient(135deg,#2563eb,#0ea5e9); color:#fff;
    border:none; border-radius:12px; padding:14px; cursor:pointer;
    transition:transform .2s,opacity .2s; margin-top:4px;
  }
  .auth-btn:hover { transform:translateY(-2px); }
  .auth-btn:disabled { opacity:.6; cursor:not-allowed; transform:none; }
  .auth-hint { text-align:center; font-size:12px; color:#475569; }
  .auth-hint button {
    background:none; border:none; color:#60a5fa; font-weight:600;
    cursor:pointer; padding:0; font-size:12px; font-family:'DM Sans',sans-serif;
  }
  .auth-hint button:hover { text-decoration:underline; }
  .auth-spinner {
    display:inline-block; width:14px; height:14px;
    border:2px solid rgba(255,255,255,.3); border-top-color:#fff;
    border-radius:50%; animation:aspin .7s linear infinite;
    margin-right:8px; vertical-align:middle;
  }
  @keyframes aspin { to { transform:rotate(360deg); } }
`;

const API = "http://127.0.0.1:5000";

/* Try login with form-encoded (FastAPI OAuth2 default), then JSON fallback */
async function attemptLogin(username, password) {
  // 1. Form-encoded (FastAPI's OAuth2PasswordRequestForm)
  const formBody = new URLSearchParams({ username, password }).toString();
  let res = await fetch(`${API}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody,
  });

  // 2. If server rejects form data, try JSON
  if (res.status === 422 || res.status === 415 || res.status === 405) {
    res = await fetch(`${API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
  }
  return res;
}

/* setActivePage is optional — falls back to reload if not passed */
export default function AuthPage({ setActivePage }) {
  const [isLogin, setIsLogin]     = useState(true);
  const [loading, setLoading]     = useState(false);
  const [form, setForm]           = useState({ username: "", email: "", password: "" });
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState("");

  const reset = () => { setError(""); setSuccess(""); };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    reset();
  };

  const switchMode = (toLogin) => {
    setIsLogin(toLogin);
    setForm({ username: "", email: "", password: "" });
    reset();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    reset();

    try {
      if (isLogin) {
        const res  = await attemptLogin(form.username, form.password);
        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          localStorage.setItem("user", form.username);
          setSuccess("✅ Login successful! Redirecting…");
          setTimeout(() => {
            if (setActivePage) {
              setActivePage("heatmap");   // ← redirect without page reload
            } else {
              window.location.reload();
            }
          }, 800);
        } else {
          setError(data.detail || data.message || "Invalid username or password.");
        }

      } else {
        // Register always uses JSON
        const res = await fetch(`${API}/register`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: form.username,
            email:    form.email,
            password: form.password,
          }),
        });
        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          setSuccess("✅ Account created! Switching to login…");
          setTimeout(() => switchMode(true), 1400);
        } else {
          setError(data.detail || data.message || "Registration failed.");
        }
      }
    } catch {
      setError("❌ Cannot reach the server. Make sure the backend is running on port 5000.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{styles}</style>
      <div className="auth-root">
        <div className="auth-card">

          <div>
            
            <div className="auth-title">
              {isLogin ? "Welcome" : "Create"}{" "}
              <span>{isLogin ? "Back" : "Account"}</span>
            </div>
          </div>

          <div className="auth-tabs">
            <button className={`auth-tab ${isLogin ? "active" : ""}`}  onClick={() => switchMode(true)}  type="button">Login</button>
            <button className={`auth-tab ${!isLogin ? "active" : ""}`} onClick={() => switchMode(false)} type="button">Register</button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label className="auth-label">Username</label>
              <input className="auth-input" name="username" placeholder="Your username"
                value={form.username} onChange={handleChange} required autoComplete="username" />
            </div>

            {!isLogin && (
              <div className="auth-field">
                <label className="auth-label">Email</label>
                <input className="auth-input" name="email" type="email" placeholder="Your email"
                  value={form.email} onChange={handleChange} required autoComplete="email" />
              </div>
            )}

            <div className="auth-field">
              <label className="auth-label">Password</label>
              <input className="auth-input" name="password" type="password" placeholder="Your password"
                value={form.password} onChange={handleChange} required
                autoComplete={isLogin ? "current-password" : "new-password"} />
            </div>

            {error   && <div className="auth-error">⚠️ {error}</div>}
            {success && <div className="auth-success">{success}</div>}

            <button className="auth-btn" type="submit" disabled={loading}>
              {loading && <span className="auth-spinner" />}
              {loading ? "Please wait…" : isLogin ? "Login" : "Create Account"}
            </button>
          </form>

          <div className="auth-hint">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button onClick={() => switchMode(!isLogin)} type="button">
              {isLogin ? "Register" : "Login"}
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
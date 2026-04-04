import React from "react";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

  .nav-root {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    height: 56px;
    font-family: 'DM Sans', sans-serif;
    position: sticky;
    top: 0;
    z-index: 1000;
    background: rgba(7, 9, 15, 0.92);
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    transition: background 0.3s ease, border-color 0.3s ease;
    box-sizing: border-box;
  }

  .nav-logo {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    user-select: none;
    flex-shrink: 0;
  }

  .nav-logo-icon {
    width: 30px; height: 30px;
    background: linear-gradient(135deg, #2563eb, #0ea5e9);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
  }

  .nav-logo-text {
    font-size: 15px;
    font-weight: 700;
    color: #fff;
    letter-spacing: -0.01em;
    white-space: nowrap;
  }

  .nav-links {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-wrap: nowrap;
  }

  .nav-link {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 500;
    padding: 6px 12px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: all 0.18s ease;
    color: #64748b;
    background: transparent;
    white-space: nowrap;
  }

  .nav-link:hover {
    color: #e2e8f0;
    background: rgba(255, 255, 255, 0.06);
  }

  .nav-link.active {
    color: #fff;
    background: rgba(37, 99, 235, 0.2);
    border: 1px solid rgba(37, 99, 235, 0.35);
  }

  .nav-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .nav-auth-btn {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 600;
    padding: 7px 14px;
    border-radius: 9px;
    cursor: pointer;
    transition: all 0.18s ease;
    white-space: nowrap;
  }

  .nav-login-btn {
    background: linear-gradient(135deg, #2563eb, #0ea5e9);
    color: #fff;
    border: none;
  }

  .nav-login-btn:hover { transform: translateY(-1px); opacity: 0.9; }

  .nav-logout-btn {
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.35);
    color: #f87171;
  }

  .nav-logout-btn:hover {
    background: rgba(239, 68, 68, 0.2);
    transform: translateY(-1px);
  }
`;

const PAGES = [
  { id: "heatmap",   label: "Crime Heatmap"    },
  { id: "route",     label: "Safe Route" },
  { id: "report",    label: "Report Incident"     },
  { id: "tips",      label: "Safety Tips"       },
  { id: "dashboard", label: "Women Safety-SOS"  },
];

export default function Navbar({ activePage, setActivePage }) {
  const user = localStorage.getItem("user");

  const handleLogout = () => {
    localStorage.removeItem("user");
    setActivePage("heatmap");
    window.location.reload();
  };

  return (
    <>
      <style>{styles}</style>
      <nav className="nav-root">

        {/* Logo */}
        <div className="nav-logo" onClick={() => setActivePage("heatmap")}>
          <div className="nav-logo-icon">🛡️</div>
          <span className="nav-logo-text">CrimeGuard</span>
        </div>

        {/* Nav Links */}
        <div className="nav-links">
          {PAGES.map((page) => (
            <button
              key={page.id}
              className={`nav-link ${activePage === page.id ? "active" : ""}`}
              onClick={() => setActivePage(page.id)}
            >
              {page.label}
            </button>
          ))}
        </div>

        {/* Right side */}
        <div className="nav-right">
          {!user ? (
            <button
              className="nav-auth-btn nav-login-btn"
              onClick={() => setActivePage("login")}
            >
              Login
            </button>
          ) : (
            <button
              className="nav-auth-btn nav-logout-btn"
              onClick={handleLogout}
            >
              Logout
            </button>
          )}
        </div>

      </nav>
    </>
  );
}
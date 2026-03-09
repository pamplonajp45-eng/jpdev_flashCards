import { useState } from "react";

// ── Nodemailer is server-side only.
// ── This component sends credentials to your own API endpoint: POST /api/login
// ── See the bottom of this file for the Express/Next.js API route you need.

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [shake, setShake] = useState(false);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setStatus("success");
        setTimeout(() => onLogin?.(data), 800);
      } else {
        setStatus("error");
        setErrorMsg(data.message || "Invalid credentials.");
        triggerShake();
        setTimeout(() => setStatus("idle"), 2000);
      }
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Please try again.");
      triggerShake();
      setTimeout(() => setStatus("idle"), 2000);
    }
  }

  return (
    <>
      <style>{CSS}</style>

      {/* Animated background blobs */}
      <div className="login-bg">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
      </div>

      <div className="login-root">
        <div className={`login-card ${shake ? "shake" : ""}`}>
          {/* Logo */}
          <div className="login-logo">
            <span className="logo-jp">JP</span>
            <span className="logo-deck">DECK</span>
          </div>

          <p className="login-sub">Sign in to your account</p>

          <form onSubmit={handleSubmit} className="login-form">
            {/* Email */}
            <div className="field-group">
              <label className="field-label" htmlFor="email">
                Email
              </label>
              <div className="field-wrap">
                <span className="field-icon">✉</span>
                <input
                  id="email"
                  type="email"
                  className="field-input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  disabled={status === "loading" || status === "success"}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="field-group">
              <label className="field-label" htmlFor="password">
                Password
              </label>
              <div className="field-wrap">
                <span className="field-icon">🔑</span>
                <input
                  id="password"
                  type={showPass ? "text" : "password"}
                  className="field-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={status === "loading" || status === "success"}
                  required
                />
                <button
                  type="button"
                  className="show-pass-btn"
                  onClick={() => setShowPass((s) => !s)}
                  tabIndex={-1}
                >
                  {showPass ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            {/* Error message */}
            {status === "error" && (
              <div className="error-msg">⚠ {errorMsg}</div>
            )}

            {/* Submit */}
            <button
              type="submit"
              className={`login-btn ${status}`}
              disabled={status === "loading" || status === "success"}
            >
              {status === "loading" && <span className="spinner" />}
              {status === "success" && "✓ Signed in!"}
              {status === "loading" && "Signing in…"}
              {(status === "idle" || status === "error") && "Sign In →"}
            </button>
          </form>

          <p className="login-footer">by-jpdev</p>
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────
   CSS — matches JPDeck dark aesthetic exactly
───────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=Inter:wght@400;500;600&display=swap');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#0b0b14;--surface:#131325;--surface2:#1a1a35;
  --border:#25254a;--accent:#a29bfe;--accent-glow:rgba(162,155,254,0.3);
  --text:#f0f0f7;--muted:#7c7c9c;--hard:#ff7675;--easy:#00d1a0;
  --font-brand:'Syne',sans-serif;
  --font-main:'Inter',sans-serif;
}
body{background:var(--bg);color:var(--text);font-family:var(--font-main);min-height:100dvh;}

/* Background blobs */
.login-bg{position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none;}
.blob{position:absolute;border-radius:50%;filter:blur(90px);opacity:0.25;}
.blob-1{width:500px;height:500px;background:radial-gradient(circle,#a29bfe,transparent);top:-100px;left:-100px;animation:drift1 18s ease-in-out infinite alternate;}
.blob-2{width:400px;height:400px;background:radial-gradient(circle,#6c5ce7,transparent);bottom:-80px;right:-80px;animation:drift2 22s ease-in-out infinite alternate;}
.blob-3{width:300px;height:300px;background:radial-gradient(circle,#00d1a0,transparent);top:50%;left:50%;transform:translate(-50%,-50%);animation:drift3 14s ease-in-out infinite alternate;}
@keyframes drift1{to{transform:translate(40px,60px);}}
@keyframes drift2{to{transform:translate(-50px,-40px);}}
@keyframes drift3{to{transform:translate(-50%,-50%) scale(1.3);}}

/* Layout */
.login-root{position:relative;z-index:1;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px;}

/* Card */
.login-card{
  width:100%;max-width:420px;
  background:rgba(19,19,37,0.85);
  backdrop-filter:blur(24px);
  border:1px solid var(--border);
  border-radius:28px;
  padding:44px 40px 36px;
  box-shadow:0 30px 80px rgba(0,0,0,0.5),0 0 0 1px rgba(162,155,254,0.08);
  animation:fadeUp .5s cubic-bezier(0.16,1,0.3,1) both;
}
@keyframes fadeUp{from{opacity:0;transform:translateY(28px);}to{opacity:1;transform:none;}}

/* Shake on error */
@keyframes shake{0%,100%{transform:translateX(0);}20%{transform:translateX(-8px);}40%{transform:translateX(8px);}60%{transform:translateX(-5px);}80%{transform:translateX(5px);}}
.shake{animation:shake 0.45s cubic-bezier(0.36,0.07,0.19,0.97) both;}

/* Logo */
.login-logo{display:flex;align-items:center;gap:6px;font-family:var(--font-brand);font-weight:900;font-size:30px;letter-spacing:-1px;margin-bottom:8px;}
.logo-jp{background:#fff;color:#000;padding:0 9px;border-radius:7px;line-height:1.15;display:inline-block;}
.logo-deck{color:var(--accent);font-style:italic;transform:skewX(-5deg);display:inline-block;}

.login-sub{font-size:13px;color:var(--muted);margin-bottom:32px;font-weight:500;letter-spacing:0.5px;}

/* Form */
.login-form{display:flex;flex-direction:column;gap:20px;}
.field-group{display:flex;flex-direction:column;gap:7px;}
.field-label{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1.5px;}
.field-wrap{position:relative;display:flex;align-items:center;}
.field-icon{position:absolute;left:16px;font-size:14px;pointer-events:none;opacity:0.5;}
.field-input{
  width:100%;padding:15px 44px 15px 44px;
  background:var(--surface2);border:1px solid var(--border);
  border-radius:14px;color:var(--text);
  font-family:var(--font-main);font-size:15px;
  outline:none;transition:border-color .2s,box-shadow .2s;
}
.field-input::placeholder{color:var(--muted);opacity:0.7;}
.field-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-glow);}
.field-input:disabled{opacity:0.5;cursor:not-allowed;}
.show-pass-btn{position:absolute;right:14px;background:transparent;border:none;cursor:pointer;font-size:15px;opacity:0.5;transition:opacity .2s;padding:4px;}
.show-pass-btn:hover{opacity:1;}

/* Error */
.error-msg{
  background:rgba(255,118,117,0.12);border:1px solid rgba(255,118,117,0.4);
  color:var(--hard);border-radius:12px;padding:12px 16px;
  font-size:13px;font-weight:600;
  animation:fadeUp .25s ease both;
}

/* Button */
.login-btn{
  display:flex;align-items:center;justify-content:center;gap:10px;
  padding:17px;border-radius:14px;border:none;
  background:var(--accent);color:#000;
  font-family:var(--font-brand);font-size:17px;font-weight:800;
  cursor:pointer;transition:all .2s cubic-bezier(0.175,0.885,0.32,1.275);
  margin-top:4px;letter-spacing:0.3px;
}
.login-btn:hover:not(:disabled){transform:scale(1.02);filter:brightness(1.1);box-shadow:0 8px 24px var(--accent-glow);}
.login-btn:active:not(:disabled){transform:scale(0.97);}
.login-btn:disabled{opacity:0.7;cursor:not-allowed;transform:none;}
.login-btn.success{background:var(--easy);pointer-events:none;}

/* Spinner */
.spinner{width:16px;height:16px;border:2px solid rgba(0,0,0,0.3);border-top-color:#000;border-radius:50%;animation:spin .6s linear infinite;flex-shrink:0;}
@keyframes spin{to{transform:rotate(360deg);}}

/* Footer */
.login-footer{text-align:center;font-size:10px;color:var(--muted);opacity:0.3;margin-top:28px;letter-spacing:1px;}

@media(max-width:480px){
  .login-card{padding:36px 24px 28px;}
}
`;

/* ─────────────────────────────────────────────────────────────────────────
   SERVER-SIDE API ROUTE  (Express or Next.js)
   
   Uses your Gmail credentials from .env:
     GMAIL_USER=you@gmail.com
     GMAIL_APP_PASS=xxxx xxxx xxxx xxxx
   
   ── Next.js:  pages/api/login.js  (or app/api/login/route.js)
   ── Express:  router.post('/api/login', handler)

   ─── pages/api/login.js (Next.js example) ──────────────────────────────

   import nodemailer from 'nodemailer';

   // Hard-code your allowed users, or look them up in Supabase
   const ALLOWED = [
     { email: 'alice@example.com', password: 'hunter2' },
   ];

   export default async function handler(req, res) {
     if (req.method !== 'POST') return res.status(405).end();

     const { email, password } = req.body;
     const user = ALLOWED.find(u => u.email === email && u.password === password);

     if (!user) {
       return res.status(401).json({ success: false, message: 'Invalid credentials.' });
     }

     // Send a welcome / notification email via Gmail
     const transporter = nodemailer.createTransport({
       service: 'gmail',
       auth: {
         user: process.env.GMAIL_USER,
         pass: process.env.GMAIL_APP_PASS,   // App Password (not account password)
       },
     });

     await transporter.sendMail({
       from: `"JPDeck" <${process.env.GMAIL_USER}>`,
       to: email,
       subject: '👋 You just signed in to JPDeck',
       text: `New login detected for ${email}`,
     });

     return res.status(200).json({ success: true, email });
   }

   ────────────────────────────────────────────────────────────────────── */

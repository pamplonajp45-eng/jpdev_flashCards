import { useState } from "react";
import { supabase } from "../../lib/supabase";

// ─────────────────────────────────────────────
//  Auth.jsx  — Login + Register (Supabase Auth)
//  Props:  onLogin(session) — called after login
// ─────────────────────────────────────────────

export default function Auth({ onLogin }) {
  const [mode, setMode] = useState("login"); // "login" | "register" | "verify"
  const [pendingEmail, setPendingEmail] = useState("");

  function handleRegistered(email) {
    setPendingEmail(email);
    setMode("verify");
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="login-bg">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
      </div>
      <div className="login-root">
        {mode === "login" && <LoginForm onSwitch={setMode} onLogin={onLogin} />}
        {mode === "register" && (
          <RegisterForm onSwitch={setMode} onRegistered={handleRegistered} />
        )}
        {mode === "verify" && (
          <VerifyScreen
            onSwitch={setMode}
            email={pendingEmail}
            onLogin={onLogin}
          />
        )}
      </div>
    </>
  );
}

// ─── LOGIN FORM ───────────────────────────────
function LoginForm({ onSwitch, onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [shake, setShake] = useState(false);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setStatus("error");
      setErrorMsg(
        error.message.includes("Email not confirmed")
          ? "Please verify your email first. Check your inbox."
          : error.message,
      );
      triggerShake();
      setTimeout(() => setStatus("idle"), 2500);
      return;
    }

    setStatus("success");
    setTimeout(() => onLogin?.(data.session), 700);
  }

  return (
    <div className={`login-card ${shake ? "shake" : ""}`}>
      <Logo />
      <p className="login-sub">Welcome back</p>

      <form onSubmit={handleSubmit} className="login-form">
        <Field
          label="Email"
          icon="✉"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={setEmail}
          disabled={status === "loading"}
        />

        <PasswordField
          label="Password"
          placeholder="••••••••"
          value={password}
          onChange={setPassword}
          show={showPass}
          onToggle={() => setShowPass((s) => !s)}
          disabled={status === "loading"}
        />

        {status === "error" && <ErrorBox msg={errorMsg} />}

        <SubmitBtn
          status={status}
          label="Sign In →"
          successLabel="✓ Signed in!"
        />
      </form>

      <div className="auth-switch">
        Don't have an account?{" "}
        <button className="switch-link" onClick={() => onSwitch("register")}>
          Create one
        </button>
      </div>

      <p className="login-footer">by-jpdev</p>
    </div>
  );
}

// ─── REGISTER FORM ────────────────────────────
function RegisterForm({ onSwitch, onRegistered }) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [shake, setShake] = useState(false);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  // Password strength
  const strength = (() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][strength];
  const strengthColor = ["", "#ff7675", "#ffcc66", "#a29bfe", "#00d1a0"][
    strength
  ];

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");

    if (password !== confirm) {
      setStatus("error");
      setErrorMsg("Passwords don't match.");
      triggerShake();
      setTimeout(() => setStatus("idle"), 2500);
      return;
    }
    if (password.length < 6) {
      setStatus("error");
      setErrorMsg("Password must be at least 6 characters.");
      triggerShake();
      setTimeout(() => setStatus("idle"), 2500);
      return;
    }

    setStatus("loading");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName.trim() },
        // Supabase sends the verification email automatically
      },
    });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
      triggerShake();
      setTimeout(() => setStatus("idle"), 2500);
      return;
    }

    // Success → show OTP verify screen
    onRegistered(email);
  }

  return (
    <div className={`login-card ${shake ? "shake" : ""}`}>
      <Logo />
      <p className="login-sub">Create your account</p>

      <form onSubmit={handleSubmit} className="login-form">
        <Field
          label="Display Name"
          icon="👤"
          type="text"
          placeholder="Tanaka Hiroshi"
          value={displayName}
          onChange={setDisplayName}
          disabled={status === "loading"}
          required
        />

        <Field
          label="Email"
          icon="✉"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={setEmail}
          disabled={status === "loading"}
          required
        />

        <div className="field-group">
          <PasswordField
            label="Password"
            placeholder="Min. 6 characters"
            value={password}
            onChange={setPassword}
            show={showPass}
            onToggle={() => setShowPass((s) => !s)}
            disabled={status === "loading"}
          />
          {password && (
            <div className="strength-row">
              <div className="strength-bars">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="strength-bar"
                    style={{
                      background:
                        i <= strength ? strengthColor : "var(--border)",
                    }}
                  />
                ))}
              </div>
              <span className="strength-label" style={{ color: strengthColor }}>
                {strengthLabel}
              </span>
            </div>
          )}
        </div>

        <PasswordField
          label="Confirm Password"
          placeholder="Repeat password"
          value={confirm}
          onChange={setConfirm}
          show={showPass}
          onToggle={() => setShowPass((s) => !s)}
          disabled={status === "loading"}
        />

        {status === "error" && <ErrorBox msg={errorMsg} />}

        <SubmitBtn
          status={status}
          label="Create Account →"
          successLabel="✓ Registered!"
        />
      </form>

      <div className="auth-switch">
        Already have an account?{" "}
        <button className="switch-link" onClick={() => onSwitch("login")}>
          Sign in
        </button>
      </div>

      <p className="login-footer">by-jpdev</p>
    </div>
  );
}

// ─── VERIFY / OTP SCREEN ─────────────────────
function VerifyScreen({ onSwitch, email, onLogin }) {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [shake, setShake] = useState(false);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  function handleChange(val) {
    // digits only, max 8
    const clean = val.replace(/\D/g, "").slice(0, 8);
    setToken(clean);
  }

  async function handleVerify(e) {
    e.preventDefault();
    if (token.length < 8) {
      setErrorMsg("Enter the full 8-digit code.");
      triggerShake();
      return;
    }

    setStatus("loading");
    setErrorMsg("");

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "signup",
    });

    if (error) {
      setStatus("error");
      setErrorMsg(
        error.message.includes("expired")
          ? "Code expired. Please register again."
          : "Invalid code. Double-check and try again.",
      );
      triggerShake();
      setTimeout(() => setStatus("idle"), 2500);
      return;
    }

    setStatus("success");

    // verifyOtp sometimes returns null session — fetch it explicitly
    const session =
      data?.session ?? (await supabase.auth.getSession()).data.session;
    setTimeout(() => onLogin?.(session), 700);
  }

  // split display: show typed digits in boxes, empty boxes for remainder
  const digits = token.split("");

  return (
    <div className={`login-card verify-card ${shake ? "shake" : ""}`}>
      <Logo />
      <div className="verify-icon">📬</div>
      <h2 className="verify-title">Check your inbox</h2>
      <p className="verify-body">
        We sent an 8-digit code to
        <br />
        <strong style={{ color: "var(--accent)" }}>{email}</strong>
      </p>

      <form onSubmit={handleVerify} className="login-form">
        {/* Decorative digit display */}
        <div className="otp-display" aria-hidden="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={`otp-box ${digits[i] ? "filled" : ""} ${i === digits.length ? "active" : ""}`}
            >
              {digits[i] || ""}
            </div>
          ))}
        </div>

        {/* Single hidden-style input that captures all typing & paste */}
        <input
          className="otp-real-input"
          type="text"
          inputMode="numeric"
          placeholder="Paste or type your 8-digit code"
          value={token}
          onChange={(e) => handleChange(e.target.value)}
          disabled={status === "loading" || status === "success"}
          autoFocus
          autoComplete="one-time-code"
        />

        {errorMsg && <ErrorBox msg={errorMsg} />}

        <SubmitBtn
          status={status}
          label="Verify Code →"
          successLabel="✓ Verified!"
        />
      </form>

      <div className="auth-switch">
        Wrong email?{" "}
        <button className="switch-link" onClick={() => onSwitch("register")}>
          Go back
        </button>
      </div>

      <p className="login-footer" style={{ marginTop: "24px" }}>
        by-jpdev
      </p>
    </div>
  );
}

// ─── SHARED SUB-COMPONENTS ────────────────────
function Logo() {
  return (
    <div className="login-logo">
      <span className="logo-jp">JP</span>
      <span className="logo-deck">DECK</span>
    </div>
  );
}

function Field({
  label,
  icon,
  type,
  placeholder,
  value,
  onChange,
  disabled,
  required,
}) {
  return (
    <div className="field-group">
      <label className="field-label">{label}</label>
      <div className="field-wrap">
        <span className="field-icon">{icon}</span>
        <input
          className="field-input"
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          required={required}
        />
      </div>
    </div>
  );
}

function PasswordField({
  label,
  placeholder,
  value,
  onChange,
  show,
  onToggle,
  disabled,
}) {
  return (
    <div className="field-group">
      <label className="field-label">{label}</label>
      <div className="field-wrap">
        <span className="field-icon">🔑</span>
        <input
          className="field-input"
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          required
          style={{ paddingRight: "48px" }}
        />
        <button
          type="button"
          className="show-pass-btn"
          onClick={onToggle}
          tabIndex={-1}
        >
          {show ? "🙈" : "👁"}
        </button>
      </div>
    </div>
  );
}

function ErrorBox({ msg }) {
  return <div className="error-msg">⚠ {msg}</div>;
}

function SubmitBtn({ status, label, successLabel }) {
  return (
    <button
      type="submit"
      className={`login-btn ${status}`}
      disabled={status === "loading" || status === "success"}
    >
      {status === "loading" && <span className="spinner" />}
      {status === "success"
        ? successLabel
        : status === "loading"
          ? "Please wait…"
          : label}
    </button>
  );
}

// ─── CSS ──────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=Inter:wght@400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#0b0b14;--surface:#131325;--surface2:#1a1a35;
  --border:#25254a;--accent:#a29bfe;--accent-glow:rgba(162,155,254,0.3);
  --text:#f0f0f7;--muted:#7c7c9c;--hard:#ff7675;--easy:#00d1a0;
  --font-brand:'Syne',sans-serif;--font-main:'Inter',sans-serif;
}
body{background:var(--bg);color:var(--text);font-family:var(--font-main);min-height:100dvh;}

.login-bg{position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none;}
.blob{position:absolute;border-radius:50%;filter:blur(90px);opacity:0.25;}
.blob-1{width:500px;height:500px;background:radial-gradient(circle,#a29bfe,transparent);top:-100px;left:-100px;animation:drift1 18s ease-in-out infinite alternate;}
.blob-2{width:400px;height:400px;background:radial-gradient(circle,#6c5ce7,transparent);bottom:-80px;right:-80px;animation:drift2 22s ease-in-out infinite alternate;}
.blob-3{width:300px;height:300px;background:radial-gradient(circle,#00d1a0,transparent);top:50%;left:50%;transform:translate(-50%,-50%);animation:drift3 14s ease-in-out infinite alternate;}
@keyframes drift1{to{transform:translate(40px,60px);}}
@keyframes drift2{to{transform:translate(-50px,-40px);}}
@keyframes drift3{to{transform:translate(-50%,-50%) scale(1.3);}}

.login-root{position:relative;z-index:1;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px;}

.login-card{
  width:100%;max-width:440px;
  background:rgba(19,19,37,0.88);
  backdrop-filter:blur(24px);
  border:1px solid var(--border);
  border-radius:28px;
  padding:44px 40px 36px;
  box-shadow:0 30px 80px rgba(0,0,0,0.5),0 0 0 1px rgba(162,155,254,0.08);
  animation:fadeUp .5s cubic-bezier(0.16,1,0.3,1) both;
}
@keyframes fadeUp{from{opacity:0;transform:translateY(28px);}to{opacity:1;transform:none;}}
@keyframes shake{0%,100%{transform:translateX(0);}20%{transform:translateX(-8px);}40%{transform:translateX(8px);}60%{transform:translateX(-5px);}80%{transform:translateX(5px);}}
.shake{animation:shake .45s cubic-bezier(0.36,0.07,0.19,0.97) both;}

.login-logo{display:flex;align-items:center;gap:6px;font-family:var(--font-brand);font-weight:900;font-size:30px;letter-spacing:-1px;margin-bottom:8px;}
.logo-jp{background:#fff;color:#000;padding:0 9px;border-radius:7px;line-height:1.15;display:inline-block;}
.logo-deck{color:var(--accent);font-style:italic;transform:skewX(-5deg);display:inline-block;}
.login-sub{font-size:13px;color:var(--muted);margin-bottom:28px;font-weight:500;letter-spacing:0.5px;}

.login-form{display:flex;flex-direction:column;gap:18px;}
.field-group{display:flex;flex-direction:column;gap:7px;}
.field-label{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1.5px;}
.field-wrap{position:relative;display:flex;align-items:center;}
.field-icon{position:absolute;left:16px;font-size:14px;pointer-events:none;opacity:0.5;}
.field-input{width:100%;padding:14px 44px;background:var(--surface2);border:1px solid var(--border);border-radius:14px;color:var(--text);font-family:var(--font-main);font-size:15px;outline:none;transition:border-color .2s,box-shadow .2s;}
.field-input::placeholder{color:var(--muted);opacity:0.7;}
.field-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-glow);}
.field-input:disabled{opacity:0.5;cursor:not-allowed;}
.show-pass-btn{position:absolute;right:14px;background:transparent;border:none;cursor:pointer;font-size:15px;opacity:0.5;transition:opacity .2s;padding:4px;}
.show-pass-btn:hover{opacity:1;}

/* Password strength */
.strength-row{display:flex;align-items:center;gap:10px;margin-top:8px;}
.strength-bars{display:flex;gap:5px;flex:1;}
.strength-bar{height:4px;flex:1;border-radius:99px;transition:background .3s;}
.strength-label{font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;min-width:44px;text-align:right;transition:color .3s;}

.error-msg{background:rgba(255,118,117,0.12);border:1px solid rgba(255,118,117,0.4);color:var(--hard);border-radius:12px;padding:12px 16px;font-size:13px;font-weight:600;animation:fadeUp .25s ease both;}

.login-btn{display:flex;align-items:center;justify-content:center;gap:10px;padding:17px;border-radius:14px;border:none;background:var(--accent);color:#000;font-family:var(--font-brand);font-size:17px;font-weight:800;cursor:pointer;transition:all .2s cubic-bezier(0.175,0.885,0.32,1.275);margin-top:4px;width:100%;}
.login-btn:hover:not(:disabled){transform:scale(1.02);filter:brightness(1.1);box-shadow:0 8px 24px var(--accent-glow);}
.login-btn:active:not(:disabled){transform:scale(0.97);}
.login-btn:disabled{opacity:0.7;cursor:not-allowed;transform:none;}
.login-btn.success{background:var(--easy);pointer-events:none;}

.spinner{width:16px;height:16px;border:2px solid rgba(0,0,0,0.3);border-top-color:#000;border-radius:50%;animation:spin .6s linear infinite;flex-shrink:0;}
@keyframes spin{to{transform:rotate(360deg);}}

/* Switch link */
.auth-switch{text-align:center;font-size:13px;color:var(--muted);margin-top:20px;}
.switch-link{background:transparent;border:none;color:var(--accent);font-family:var(--font-main);font-size:13px;font-weight:600;cursor:pointer;text-decoration:underline;text-underline-offset:3px;}
.switch-link:hover{opacity:0.8;}

/* OTP boxes */
.otp-display{display:flex;gap:8px;justify-content:center;margin:8px 0 4px;}
.otp-box{width:46px;height:58px;display:flex;align-items:center;justify-content:center;font-family:var(--font-brand);font-size:24px;font-weight:900;background:var(--surface2);border:2px solid var(--border);border-radius:14px;color:var(--text);transition:border-color .2s,box-shadow .2s;}
.otp-box.filled{border-color:var(--accent);color:var(--accent);}
.otp-box.active{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-glow);}
.otp-real-input{width:100%;padding:14px 18px;background:var(--surface2);border:1px solid var(--border);border-radius:14px;color:var(--text);font-family:var(--font-brand);font-size:22px;font-weight:900;letter-spacing:10px;text-align:center;outline:none;transition:border-color .2s,box-shadow .2s;}
.otp-real-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-glow);}
.otp-real-input::placeholder{font-size:13px;letter-spacing:0;font-family:var(--font-main);font-weight:400;opacity:0.4;}
.otp-real-input:disabled{opacity:0.5;}

/* Verify screen */
.verify-card{text-align:center;}
.verify-icon{font-size:56px;margin:20px 0 16px;animation:float 3s ease-in-out infinite;}
@keyframes float{0%,100%{transform:translateY(0);}50%{transform:translateY(-8px);}}
.verify-title{font-family:var(--font-brand);font-size:22px;font-weight:900;margin-bottom:12px;}
.verify-body{color:var(--muted);font-size:14px;line-height:1.7;margin-bottom:24px;}

.login-footer{text-align:center;font-size:10px;color:var(--muted);opacity:0.3;margin-top:28px;letter-spacing:1px;}

@media(max-width:480px){
  .login-card{padding:36px 24px 28px;}
}
`;

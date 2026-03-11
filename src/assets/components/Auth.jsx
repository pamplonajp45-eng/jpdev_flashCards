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

      <p className="login-footer">I heard you want to learn nihonggo. So then ya'll
        can use this web-app absolutely for free by-jpdev.</p>
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
body{background:var(--bg);color:var(--text);font-family:var(--font-main);min-height:100dvh;overflow-x:hidden;-webkit-tap-highlight-color:transparent;}

.login-bg{position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none;}
.blob{position:absolute;border-radius:50%;filter:blur(90px);opacity:0.2;}
.blob-1{width:500px;height:500px;background:radial-gradient(circle,#a29bfe,transparent);top:-100px;left:-100px;animation:drift1 18s ease-in-out infinite alternate;}
.blob-2{width:400px;height:400px;background:radial-gradient(circle,#6c5ce7,transparent);bottom:-80px;right:-80px;animation:drift2 22s ease-in-out infinite alternate;}
.blob-3{width:300px;height:300px;background:radial-gradient(circle,#00d1a0,transparent);top:50%;left:50%;transform:translate(-50%,-50%);animation:drift3 14s ease-in-out infinite alternate;}
@keyframes drift1{to{transform:translate(40px,60px);}}
@keyframes drift2{to{transform:translate(-50px,-40px);}}
@keyframes drift3{to{transform:translate(-50%,-50%) scale(1.3);}}

.login-root{position:relative;z-index:1;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:20px;}

.login-card{
  width:100%;max-width:440px;
  background:rgba(19,19,37,0.85);
  backdrop-filter:blur(24px);
  border:1px solid var(--border);
  border-radius:32px;
  padding:48px 40px;
  box-shadow:0 30px 80px rgba(0,0,0,0.5),0 0 0 1px rgba(162,155,254,0.1);
  animation:fadeUp .6s cubic-bezier(0.16,1,0.3,1) both;
}
@keyframes fadeUp{from{opacity:0;transform:translateY(30px);}to{opacity:1;transform:none;}}
@keyframes shake{0%,100%{transform:translateX(0);}20%{transform:translateX(-8px);}40%{transform:translateX(8px);}60%{transform:translateX(-5px);}80%{transform:translateX(5px);}}
.shake{animation:shake .45s cubic-bezier(0.36,0.07,0.19,0.97) both;}

.login-logo{display:flex;align-items:center;gap:6px;font-family:var(--font-brand);font-weight:900;font-size:32px;letter-spacing:-1.5px;margin-bottom:8px;}
.logo-jp{background:#fff;color:#000;padding:0 10px;border-radius:8px;line-height:1.1;display:inline-block;}
.logo-deck{color:var(--accent);font-style:italic;transform:skewX(-5deg);display:inline-block;}
.login-sub{font-size:14px;color:var(--muted);margin-bottom:32px;font-weight:600;letter-spacing:0.5px;opacity:0.8;}

.login-form{display:flex;flex-direction:column;gap:20px;}
.field-group{display:flex;flex-direction:column;gap:8px;}
.field-label{font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:1.5px;opacity:0.7;}
.field-wrap{position:relative;display:flex;align-items:center;}
.field-icon{position:absolute;left:18px;font-size:14px;pointer-events:none;opacity:0.4;}
.field-input{width:100%;padding:16px 48px;background:var(--surface2);border:1px solid var(--border);border-radius:16px;color:var(--text);font-family:var(--font-main);font-size:16px;outline:none;transition:all .2s ease;}
.field-input::placeholder{color:var(--muted);opacity:0.5;}
.field-input:focus{border-color:var(--accent);box-shadow:0 0 0 4px var(--accent-glow);}
.field-input:disabled{opacity:0.5;cursor:not-allowed;}
.show-pass-btn{position:absolute;right:16px;background:transparent;border:none;cursor:pointer;font-size:16px;opacity:0.4;transition:opacity .2s;padding:6px;-webkit-tap-highlight-color:transparent;}
.show-pass-btn:hover{opacity:1;}

.strength-row{display:flex;align-items:center;gap:12px;margin-top:4px;}
.strength-bars{display:flex;gap:6px;flex:1;}
.strength-bar{height:5px;flex:1;border-radius:99px;transition:background .3s;background:var(--border);}
.strength-label{font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;min-width:48px;text-align:right;}

.error-msg{background:rgba(255,118,117,0.1);border:1px solid rgba(255,118,117,0.3);color:var(--hard);border-radius:14px;padding:14px 18px;font-size:13px;font-weight:700;animation:fadeUp .3s ease both;line-height:1.4;}

.login-btn{display:flex;align-items:center;justify-content:center;gap:12px;padding:18px;border-radius:18px;border:none;background:var(--accent);color:#000;font-family:var(--font-brand);font-size:18px;font-weight:800;cursor:pointer;transition:all .25s cubic-bezier(0.175,0.885,0.32,1.275);margin-top:6px;width:100%;-webkit-user-select:none;user-select:none;}
.login-btn:hover:not(:disabled){transform:scale(1.02);filter:brightness(1.1);box-shadow:0 12px 30px var(--accent-glow);}
.login-btn:active:not(:disabled){transform:scale(0.97);}
.login-btn:disabled{opacity:0.6;cursor:not-allowed;}
.login-btn.success{background:var(--easy);pointer-events:none;}

.spinner{width:18px;height:18px;border:2px solid rgba(0,0,0,0.2);border-top-color:#000;border-radius:50%;animation:spin .6s linear infinite;flex-shrink:0;}
@keyframes spin{to{transform:rotate(360deg);}}

.auth-switch{text-align:center;font-size:14px;color:var(--muted);margin-top:24px;font-weight:500;}
.switch-link{background:transparent;border:none;color:var(--accent);font-family:var(--font-main);font-size:14px;font-weight:700;cursor:pointer;text-decoration:none;margin-left:4px;transition:opacity .2s;}
.switch-link:hover{opacity:0.8;text-decoration:underline;text-underline-offset:4px;}

.otp-display{display:flex;gap:8px;justify-content:center;margin:12px 0 8px;flex-wrap:nowrap;}
.otp-box{width:11%;aspect-ratio:4/5;max-width:44px;display:flex;align-items:center;justify-content:center;font-family:var(--font-brand);font-size:clamp(18px, 5vw, 24px);font-weight:900;background:var(--surface2);border:2px solid var(--border);border-radius:12px;color:var(--text);transition:all .2s;}
.otp-box.filled{border-color:var(--accent);color:var(--accent);box-shadow:0 0 15px rgba(162,155,254,0.15);}
.otp-box.active{border-color:var(--accent);box-shadow:0 0 0 4px var(--accent-glow);}

.otp-real-input{width:100%;padding:16px;background:var(--surface2);border:1px solid var(--border);border-radius:16px;color:var(--text);font-family:var(--font-brand);font-size:24px;font-weight:900;letter-spacing:clamp(8px, 4vw, 15px);text-align:center;outline:none;transition:all .2s;text-indent:clamp(4px, 2vw, 8px);}
.otp-real-input:focus{border-color:var(--accent);box-shadow:0 0 0 4px var(--accent-glow);}
.otp-real-input::placeholder{font-size:13px;letter-spacing:0;font-family:var(--font-main);font-weight:500;opacity:0.4;text-indent:0;}

.verify-card{text-align:center;}
.verify-icon{font-size:64px;margin:20px 0 16px;animation:float 3s ease-in-out infinite;}
@keyframes float{0%,100%{transform:translateY(0);}50%{transform:translateY(-10px);}}
.verify-title{font-family:var(--font-brand);font-size:26px;font-weight:900;margin-bottom:12px;}
.verify-body{color:var(--muted);font-size:15px;line-height:1.6;margin-bottom:28px;}

.login-footer{text-align:center;font-size:11px;color:var(--muted);opacity:0.6;margin-top:32px;letter-spacing:0.5px;max-width:280px;margin-left:auto;margin-right:auto;line-height:1.6;}

@media(max-width:480px){
  .login-card{padding:40px 24px 32px;border-radius:28px;}
  .login-logo{font-size:28px;}
  .login-btn{padding:16px;}
  .field-input{padding:14px 44px;font-size:15px;}
  .otp-box{border-radius:10px;border-width:1.5px;}
}

@media(max-width:360px){
  .otp-display{gap:6px;}
  .otp-box{border-radius:8px;}
}
\`;
`;

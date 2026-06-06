import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import styles from "./UserLogin.module.css";

export default function UserLogin() {
  const [tab, setTab] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (tab === "register" && form.password !== confirmPassword) {
      return setError("Passwords do not match.");
    }

    setLoading(true);
    try {
      if (tab === "login") {
        await login(form.email, form.password);
      } else {
        await register(form.name, form.email, form.password, form.phone);
      }
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (t) => {
    setTab(t);
    setError("");
    setForm({ name: "", email: "", password: "", phone: "" });
    setConfirmPassword("");
  };

  return (
    <div className={styles.page}>
      <div className={styles.glow1} />
      <div className={styles.glow2} />

      <div className={styles.card}>

        {/* Logo */}
        <div className={styles.logoWrap}>
          <div className={styles.logoIcon}>
            <i className="bi bi-brightness-low-fill"></i>
          </div>
          <div>
            <div className={styles.logoText}>Ardour Green Energy</div>
            <div className={styles.logoSub}>Clean Energy Solutions</div>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === "login" ? styles.tabActive : ""}`}
            onClick={() => switchTab("login")}
          >
            Sign In
          </button>
          <button
            className={`${styles.tab} ${tab === "register" ? styles.tabActive : ""}`}
            onClick={() => switchTab("register")}
          >
            Create Account
          </button>
        </div>

        <div className={styles.tabTitle}>
          {tab === "login" ? "Welcome back" : "Join Ardour Green Energy"}
        </div>
        <div className={styles.tabSub}>
          {tab === "login"
            ? "Sign in to track your orders & quotations"
            : "Create an account to manage your solar journey"}
        </div>

        {error && (
          <div className={styles.errorBox}>
            <span>⚠️</span> {error}
          </div>
        )}

        {/* autoComplete="off" on form prevents browser autofill */}
        <form onSubmit={handleSubmit} className={styles.form} autoComplete="off">

          {tab === "register" && (
            <div className={styles.field}>
              <label>Full Name</label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}>
                  <i className="bi bi-person-circle"></i>
                </span>
                <input
                  name="name"
                  placeholder="Your full name"
                  value={form.name}
                  onChange={update}
                  required
                  autoComplete="off"
                />
              </div>
            </div>
          )}

          <div className={styles.field}>
            <label>Email Address</label>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}>
                <i className="bi bi-envelope-at"></i>
              </span>
              <input
                name="email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={update}
                required
                autoComplete="off"
              />
            </div>
          </div>

          {tab === "register" && (
            <div className={styles.field}>
              <label>Phone Number <span className={styles.optional}>(optional)</span></label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}>📱</span>
                <input
                  name="phone"
                  type="tel"
                  placeholder="10-digit mobile number"
                  value={form.phone}
                  onChange={update}
                  autoComplete="off"
                />
              </div>
            </div>
          )}

          <div className={styles.field}>
            <label>Password</label>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}>
                <i className="bi bi-lock-fill"></i>
              </span>
              <input
                name="password"
                type={showPass ? "text" : "password"}
                placeholder={tab === "register" ? "Min. 6 characters" : "Enter your password"}
                value={form.password}
                onChange={update}
                required
                autoComplete="new-password"
              />
              <button type="button" className={styles.eyeBtn} onClick={() => setShowPass(!showPass)}>
                {showPass
                  ? <i className="bi bi-eye-slash"></i>
                  : <i className="bi bi-eye-fill"></i>
                }
              </button>
            </div>
          </div>

          {tab === "register" && (
            <div className={styles.field}>
              <label>Confirm Password</label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}><i class="bi bi-lock-fill"></i></span>
                <input
                  type={showPass ? "text" : "password"}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
            </div>
          )}

          <button className={styles.submitBtn} type="submit" disabled={loading}>
            {loading
              ? <><span className={styles.spinner} /> {tab === "login" ? "Signing in…" : "Creating account…"}</>
              : tab === "login"
                ? 
                <>
                Sign In <i class="bi bi-brightness-low-fill"></i>
                </>
                : "Create Account →"
            }
          </button>

        </form>

        <div className={styles.footer}>
          {tab === "login" ? (
            <span>New here? <button className={styles.switchBtn} onClick={() => switchTab("register")}>Create an account</button></span>
          ) : (
            <span>Already have an account? <button className={styles.switchBtn} onClick={() => switchTab("login")}>Sign in</button></span>
          )}
        </div>

      </div>
    </div>
  );
}
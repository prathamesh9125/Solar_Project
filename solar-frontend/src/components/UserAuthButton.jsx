import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import styles from "./UserAuthButton.module.css";

export default function UserAuthButton() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!user) {
    return (
      <button className={styles.loginBtn} onClick={() => navigate("/user-login")}>
        Sign In
      </button>
    );
  }

  const initials = user.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className={styles.wrap} ref={ref}>
      <button className={styles.avatar} onClick={() => setOpen(!open)} title={user.name}>
        {initials}
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.userInfo}>
            <div className={styles.userName}>{user.name}</div>
            <div className={styles.userEmail}>{user.email}</div>
          </div>
          <hr className={styles.sep} />
          <button className={styles.item} onClick={() => { setOpen(false); navigate("/profile"); }}>
            👤 My Profile
          </button>
          <button className={styles.item} onClick={() => { setOpen(false); navigate("/place-order"); }}>
            📦 My Orders
          </button>
          <hr className={styles.sep} />
          <button className={`${styles.item} ${styles.logoutItem}`} onClick={() => { logout(); setOpen(false); navigate("/"); }}>
            🚪 Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
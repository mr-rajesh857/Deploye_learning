"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";
import { api } from "@/services/api";
import {
  Layers,
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  Database,
  ExternalLink,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const adminerUrl =
    process.env.NEXT_PUBLIC_ADMINER_URL ||
    "http://localhost:8080/?pgsql=postgres&username=postgres&db=Leave_management&ns=public";

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await api.login(email, password);
      if (res.access_token) {
        localStorage.setItem("zenith_token", res.access_token);
        if (res.user?.id) {
          localStorage.setItem("zenith_user_id", res.user.id);
        }
        router.push("/");
      }
    } catch (err) {
      setError(err.message || "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fillAndLogin = async (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError("");

    try {
      setLoading(true);
      const res = await api.login(demoEmail, demoPassword);
      if (res.access_token) {
        localStorage.setItem("zenith_token", res.access_token);
        if (res.user?.id) {
          localStorage.setItem("zenith_user_id", res.user.id);
        }
        router.push("/");
      }
    } catch (err) {
      setError(err.message || "Failed to log in with demo account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginCard}>
        {/* Brand Header */}
        <div className={styles.cardHeader}>
          <div className={styles.logoIcon}>
            <Layers size={26} />
          </div>
          <h1 className={styles.title}>Zenith Leave Hub</h1>
          <p className={styles.subtitle}>Sign in to manage leaves, balances & approvals</p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className={styles.errorBanner}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className={styles.form}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Work Email</label>
            <div className={styles.inputWrapper}>
              <Mail size={16} className={styles.inputIcon} />
              <input
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.input}
                required
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Password</label>
            <div className={styles.inputWrapper}>
              <Lock size={16} className={styles.inputIcon} />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
                required
              />
              <button
                type="button"
                className={styles.togglePassword}
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            <LogIn size={18} />
            <span>{loading ? "Authenticating..." : "Sign In to Workspace"}</span>
          </button>
        </form>

        {/* Quick Demo Logins Section */}
        <div className={styles.demoSection}>
          <div className={styles.demoTitle}>
            <Sparkles size={12} style={{ display: "inline", marginRight: "4px" }} />
            One-Click Demo Logins
          </div>

          <div className={styles.demoChips}>
            <div
              className={styles.demoChip}
              onClick={() => fillAndLogin("employee@company.com", "employee123")}
            >
              <div>
                <strong>John Doe</strong>
                <div style={{ fontSize: "0.72rem", color: "#64748B" }}>employee@company.com</div>
              </div>
              <span className={`${styles.demoRole} ${styles.roleEmployee}`}>Employee</span>
            </div>

            <div
              className={styles.demoChip}
              onClick={() => fillAndLogin("manager@company.com", "manager123")}
            >
              <div>
                <strong>Sarah Connor</strong>
                <div style={{ fontSize: "0.72rem", color: "#64748B" }}>manager@company.com</div>
              </div>
              <span className={`${styles.demoRole} ${styles.roleManager}`}>Manager</span>
            </div>

            <div
              className={styles.demoChip}
              onClick={() => fillAndLogin("admin@company.com", "admin123")}
            >
              <div>
                <strong>Alex Rivera</strong>
                <div style={{ fontSize: "0.72rem", color: "#64748B" }}>admin@company.com</div>
              </div>
              <span className={`${styles.demoRole} ${styles.roleAdmin}`}>HR Admin</span>
            </div>
          </div>
        </div>

        {/* Database direct link */}
        <a
          href={adminerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.footerDbLink}
        >
          <Database size={13} />
          <span>PostgreSQL: Leave_management</span>
          <ExternalLink size={11} />
        </a>
      </div>
    </div>
  );
}

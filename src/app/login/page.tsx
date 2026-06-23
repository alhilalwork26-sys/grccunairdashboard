"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  Eye, EyeOff, ArrowRight, Loader2,
  CheckSquare, CalendarDays, BarChart3,
  Users, FileText, TrendingUp, Bell, Shield,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

/* ── Floating bubble config ── */
const BUBBLES = [
  { icon: CheckSquare,  color: "#10b981", bg: "#d1fae5", size: 64,  x: "18%",  y: "14%",  dur: 7,   delay: 0 },
  { icon: CalendarDays, color: "#3b82f6", bg: "#dbeafe", size: 56,  x: "68%",  y: "10%",  dur: 9,   delay: 1.2 },
  { icon: BarChart3,    color: "#f59e0b", bg: "#fef3c7", size: 60,  x: "80%",  y: "42%",  dur: 6.5, delay: 0.5 },
  { icon: Users,        color: "#8b5cf6", bg: "#ede9fe", size: 52,  x: "12%",  y: "58%",  dur: 8,   delay: 2 },
  { icon: FileText,     color: "#06b6d4", bg: "#cffafe", size: 50,  x: "55%",  y: "65%",  dur: 7.5, delay: 0.8 },
  { icon: TrendingUp,   color: "#10b981", bg: "#d1fae5", size: 46,  x: "38%",  y: "22%",  dur: 10,  delay: 1.8 },
  { icon: Bell,         color: "#ec4899", bg: "#fce7f3", size: 44,  x: "72%",  y: "75%",  dur: 8.5, delay: 0.3 },
  { icon: Shield,       color: "#6366f1", bg: "#e0e7ff", size: 48,  x: "28%",  y: "80%",  dur: 9.5, delay: 1.5 },
];

const DOTS = [
  { x: "45%", y: "18%", size: 8,  color: "#10b981", dur: 5,   delay: 0 },
  { x: "62%", y: "32%", size: 6,  color: "#3b82f6", dur: 7,   delay: 1 },
  { x: "20%", y: "38%", size: 10, color: "#f59e0b", dur: 6,   delay: 0.5 },
  { x: "85%", y: "22%", size: 7,  color: "#8b5cf6", dur: 8,   delay: 2 },
  { x: "50%", y: "85%", size: 8,  color: "#ec4899", dur: 5.5, delay: 1.2 },
  { x: "15%", y: "72%", size: 5,  color: "#06b6d4", dur: 9,   delay: 0.8 },
  { x: "88%", y: "60%", size: 9,  color: "#10b981", dur: 6.5, delay: 1.7 },
];

/* Unique float animation per bubble */
function floatVariants(dur: number, delay: number): Variants {
  return {
    animate: {
      y: [0, -18, 4, -10, 0],
      x: [0, 6, -4, 8, 0],
      rotate: [0, 3, -2, 4, 0],
      transition: {
        duration: dur,
        delay,
        repeat: Infinity,
        ease: "easeInOut" as const,
      },
    },
  };
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const passwordRef = useRef<HTMLInputElement>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError("Email atau password salah.");
      setLoading(false);
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#ffffff" }}>

      {/* ══ LEFT — Form ══ */}
      <div
        style={{
          width: "40%",
          minWidth: 380,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "40px 52px",
          borderRight: "1px solid #f3f4f6",
          background: "#ffffff",
        }}
      >
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ display: "flex", alignItems: "center", gap: 10 }}
        >
          <div
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: "linear-gradient(145deg, #10b981, #047857)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(16,185,129,0.35)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M13 6.5C12.1 5.5 10.9 4.8 9.5 4.8C7.07 4.8 5.1 6.77 5.1 9.2C5.1 11.63 7.07 13.6 9.5 13.6C10.9 13.6 12.1 12.9 13 11.9" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
              <circle cx="9.5" cy="9.2" r="1.6" fill="white"/>
            </svg>
          </div>
          <span style={{ fontSize: 17, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" }}>GRCC</span>
        </motion.div>

        {/* Form section */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1 style={{ fontSize: 32, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em", marginBottom: 8 }}>
            Masuk
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 36 }}>
            Selamat datang kembali. Silakan masuk ke akun GRCC kamu.
          </p>

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Email */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
            >
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 7 }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@grcc.id"
                required
                autoComplete="email"
                className="clean-input"
                onKeyDown={(e) => e.key === "Enter" && passwordRef.current?.focus()}
              />
            </motion.div>

            {/* Password */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.38, duration: 0.4 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Password</label>
                <button type="button" style={{ fontSize: 12, color: "#10b981", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>
                  Lupa password?
                </button>
              </div>
              <div style={{ position: "relative" }}>
                <input
                  ref={passwordRef}
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="clean-input"
                  style={{ paddingRight: 46 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", background: "none", border: "none", cursor: "pointer", display: "flex" }}
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </motion.div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -6, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ fontSize: 13, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "9px 13px" }}
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Submit */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.46, duration: 0.4 }}
              style={{ paddingTop: 4 }}
            >
              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: loading ? 1 : 1.02 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
                style={{
                  width: "100%",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "14px 0",
                  borderRadius: 12,
                  fontSize: 15, fontWeight: 700, color: "white",
                  border: "none",
                  cursor: loading ? "not-allowed" : "pointer",
                  background: loading ? "#6ee7b7" : "#111827",
                  boxShadow: loading ? "none" : "0 4px 14px rgba(0,0,0,0.15)",
                  transition: "background 0.2s, box-shadow 0.2s",
                  letterSpacing: "-0.01em",
                }}
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <>Masuk ke Dashboard <ArrowRight size={16} /></>}
              </motion.button>
            </motion.div>
          </form>

          {/* Divider hint */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            style={{ marginTop: 28, padding: "16px", borderRadius: 12, background: "#f9fafb", border: "1px solid #f3f4f6" }}
          >
            <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
              Akun Awal
            </p>
            <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>
              Masuk sebagai <strong style={{ color: "#111827" }}>Super Admin</strong>, lalu buat akun tim dari menu{" "}
              <span style={{ color: "#10b981", fontWeight: 600 }}>Pengaturan</span>.
            </p>
          </motion.div>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          style={{ fontSize: 11, color: "#d1d5db", fontFamily: "monospace" }}
        >
          © 2026 GRCC · Universitas Airlangga · v2.1.0
        </motion.p>
      </div>

      {/* ══ RIGHT — Animated bubbles ══ */}
      <div
        style={{
          flex: 1,
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 30%, #eff6ff 60%, #f5f3ff 100%)",
        }}
      >
        {/* Subtle grid */}
        <div
          style={{
            position: "absolute", inset: 0,
            backgroundImage: "radial-gradient(circle, #d1d5db 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            opacity: 0.35,
          }}
        />

        {/* Soft center glow */}
        <div style={{ position: "absolute", top: "30%", left: "40%", transform: "translate(-50%, -50%)", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)" }} />

        {/* Floating icon bubbles */}
        {BUBBLES.map((b, i) => {
          const Icon = b.icon;
          const v = floatVariants(b.dur, b.delay);
          return (
            <motion.div
              key={i}
              variants={v}
              animate="animate"
              style={{
                position: "absolute",
                left: b.x, top: b.y,
                width: b.size, height: b.size,
                borderRadius: "50%",
                background: b.bg,
                border: `1.5px solid ${b.color}22`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 8px 24px ${b.color}30`,
                cursor: "default",
              }}
            >
              <Icon size={b.size * 0.42} color={b.color} strokeWidth={1.8} />
            </motion.div>
          );
        })}

        {/* Floating dots */}
        {DOTS.map((d, i) => (
          <motion.div
            key={i}
            animate={{
              y: [0, -12, 6, -8, 0],
              x: [0, 5, -3, 7, 0],
              opacity: [0.5, 1, 0.6, 1, 0.5],
            }}
            transition={{ duration: d.dur, delay: d.delay, repeat: Infinity, ease: "easeInOut" }}
            style={{
              position: "absolute",
              left: d.x, top: d.y,
              width: d.size, height: d.size,
              borderRadius: "50%",
              background: d.color,
              opacity: 0.6,
            }}
          />
        ))}

        {/* Center label */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: "absolute",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
            pointerEvents: "none",
          }}
        >
          <motion.div
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            style={{
              width: 88, height: 88,
              borderRadius: 24,
              background: "linear-gradient(145deg, #10b981, #047857)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px",
              boxShadow: "0 16px 48px rgba(16,185,129,0.4), 0 0 0 1px rgba(16,185,129,0.2)",
            }}
          >
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
              <circle cx="22" cy="22" r="14" stroke="rgba(255,255,255,0.25)" strokeWidth="1" fill="none"/>
              <path d="M30 16.5C28 14.2 25.2 12.8 22 12.8C15.9 12.8 11 17.7 11 23.8C11 29.9 15.9 34.8 22 34.8C25.2 34.8 28 33.4 30 31.1" stroke="white" strokeWidth="2.4" strokeLinecap="round" fill="none"/>
              <circle cx="22" cy="23.8" r="3.2" fill="white"/>
            </svg>
          </motion.div>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" }}>GRCC UNAIR</p>
          <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Internal Dashboard</p>
        </motion.div>
      </div>

    </div>
  );
}

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, LogOut, Clock } from "lucide-react";
import Sidebar from "./Sidebar";
import type { UserProfile } from "@/types";
import { useTheme } from "@/context/ThemeContext";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PushNotificationManager from "@/components/PushNotificationManager";

const IDLE_MS   = 30 * 60 * 1000; // 30 minutes
const WARN_MS   = 28 * 60 * 1000; // warn at 28 min (2 min before logout)

export default function DashboardShell({
  user,
  children,
}: {
  user: UserProfile | null;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile]       = useState(false);
  const [navProgress, setNavProgress] = useState(0);
  const [navVisible, setNavVisible]   = useState(false);
  const [idleWarn, setIdleWarn]       = useState(false);
  const { isDark } = useTheme();
  const pathname   = usePathname();
  const router     = useRouter();
  const prevPath   = useRef(pathname);
  const warnRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep Supabase session alive: browser client refreshes tokens automatically
  // and writes updated cookies so server actions can always read a fresh session.
  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.push("/login");
      } else if (event === "TOKEN_REFRESHED") {
        console.log("[DashboardShell] token refreshed");
      }
    });
    return () => subscription.unsubscribe();
  }, [router]);

  // Idle timeout: auto-logout after 30 min of no activity
  const resetIdleTimer = useCallback(() => {
    if (warnRef.current) clearTimeout(warnRef.current);
    if (idleRef.current) clearTimeout(idleRef.current);
    setIdleWarn(false);

    warnRef.current = setTimeout(() => setIdleWarn(true), WARN_MS);
    idleRef.current = setTimeout(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      // SIGNED_OUT event → router.push("/login")
    }, IDLE_MS);
  }, []);

  useEffect(() => {
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];
    events.forEach(e => window.addEventListener(e, resetIdleTimer, { passive: true }));
    resetIdleTimer(); // start timer immediately
    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdleTimer));
      if (warnRef.current) clearTimeout(warnRef.current);
      if (idleRef.current) clearTimeout(idleRef.current);
    };
  }, [resetIdleTimer]);

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768); }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Close mobile sidebar on navigate
  useEffect(() => {
    const timer = window.setTimeout(() => setSidebarOpen(false), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  // Top progress bar: animate on route change
  useEffect(() => {
    if (pathname === prevPath.current) return;
    prevPath.current = pathname;

    setNavProgress(0);
    setNavVisible(true);

    // Quick rise to ~80%, then complete on next tick
    const t1 = setTimeout(() => setNavProgress(75), 50);
    const t2 = setTimeout(() => setNavProgress(100), 200);
    const t3 = setTimeout(() => setNavVisible(false), 500);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [pathname]);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: isDark ? "#0f172a" : "#f9fafb" }}>

      {/* ── Idle warning toast ─────────────────────────────────────── */}
      <AnimatePresence>
        {idleWarn && (
          <motion.div
            key="idle-warn"
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
              zIndex: 9999, background: "#1e293b",
              borderRadius: 14, boxShadow: "0 12px 36px rgba(0,0,0,0.3)",
              padding: "14px 20px", display: "flex", alignItems: "center", gap: 12,
              border: "1px solid #f59e0b", minWidth: 300, maxWidth: "90vw",
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: "rgba(245,158,11,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Clock size={18} color="#f59e0b" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>Sesi hampir berakhir</p>
              <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Otomatis logout dalam 2 menit. Gerakkan mouse untuk tetap aktif.</p>
            </div>
            <button
              onClick={resetIdleTimer}
              style={{
                background: "#f59e0b", border: "none", borderRadius: 8,
                padding: "6px 12px", fontSize: 12, fontWeight: 700,
                color: "#1e293b", cursor: "pointer", flexShrink: 0,
                display: "flex", alignItems: "center", gap: 5,
              }}
            >
              <LogOut size={12} /> Tetap aktif
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Navigation progress bar ─────────────────────────────────── */}
      <AnimatePresence>
        {navVisible && (
          <motion.div
            key="nav-bar"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ position: "fixed", top: 0, left: 0, right: 0, height: 2, zIndex: 9999, pointerEvents: "none" }}
          >
            <motion.div
              animate={{ width: `${navProgress}%` }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              style={{ height: "100%", background: "linear-gradient(90deg, #10b981, #34d399)", borderRadius: 1, boxShadow: "0 0 8px rgba(16,185,129,0.6)" }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop sidebar — always visible */}
      {!isMobile && <Sidebar user={user} />}

      {/* Mobile sidebar — drawer overlay */}
      {isMobile && (
        <>
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setSidebarOpen(false)}
                style={{
                  position: "fixed", inset: 0, zIndex: 29,
                  background: "rgba(0,0,0,0.35)",
                  backdropFilter: "blur(3px)",
                }}
              />
            )}
          </AnimatePresence>

          <motion.div
            initial={false}
            animate={{ x: sidebarOpen ? 0 : -260 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            style={{ position: "fixed", top: 0, left: 0, height: "100vh", zIndex: 30 }}
          >
            <Sidebar user={user} onClose={() => setSidebarOpen(false)} />
          </motion.div>

          {/* Hamburger */}
          <AnimatePresence>
            {!sidebarOpen && (
              <motion.button
                key="hamburger"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => setSidebarOpen(true)}
                style={{
                  position: "fixed", top: 13, left: 14, zIndex: 25,
                  width: 36, height: 36, borderRadius: 10,
                  background: isDark ? "#1e293b" : "#fff",
                  border: `1px solid ${isDark ? "#334155" : "#e5e7eb"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
                }}
              >
                <Menu size={17} color={isDark ? "#94a3b8" : "#374151"} />
              </motion.button>
            )}
          </AnimatePresence>
        </>
      )}

      <PushNotificationManager />

      {/* ── Main content with page transition ──────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          style={{ flex: 1, display: "flex", flexDirection: "column" }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}

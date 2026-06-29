"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";
import type { UserProfile } from "@/types";
import { useTheme } from "@/context/ThemeContext";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
  const { isDark } = useTheme();
  const pathname   = usePathname();
  const router     = useRouter();
  const prevPath   = useRef(pathname);

  // Keep Supabase session alive: browser client refreshes tokens automatically
  // and writes updated cookies so server actions can always read a fresh session.
  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.push("/login");
      } else if (event === "TOKEN_REFRESHED") {
        // Token was refreshed — server actions will now read fresh cookie
        console.log("[DashboardShell] token refreshed");
      }
    });
    return () => subscription.unsubscribe();
  }, [router]);

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

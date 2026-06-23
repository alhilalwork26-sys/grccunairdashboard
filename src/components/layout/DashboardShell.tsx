"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";
import type { UserProfile } from "@/types";

export default function DashboardShell({
  user,
  children,
}: {
  user: UserProfile | null;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768); }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, []);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f9fafb" }}>

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
            style={{
              position: "fixed", top: 0, left: 0,
              height: "100vh", zIndex: 30,
            }}
          >
            <Sidebar user={user} onClose={() => setSidebarOpen(false)} />
          </motion.div>

          {/* Hamburger button */}
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
                  background: "#fff", border: "1px solid #e5e7eb",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
                }}
              >
                <Menu size={17} color="#374151" />
              </motion.button>
            )}
          </AnimatePresence>
        </>
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}

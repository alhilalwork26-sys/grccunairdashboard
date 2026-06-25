"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, CheckSquare, Megaphone, FolderOpen, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface SearchResult {
  id: string;
  label: string;
  sub: string;
  href: string;
  type: "task" | "announce" | "doc";
}

const TYPE_CFG = {
  task:     { label: "Task",        Icon: CheckSquare, color: "#10b981", bg: "#f0fdf4" },
  announce: { label: "Pengumuman",  Icon: Megaphone,   color: "#f59e0b", bg: "#fffbeb" },
  doc:      { label: "Dokumen",     Icon: FolderOpen,  color: "#3b82f6", bg: "#eff6ff" },
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SearchModal({ open, onClose }: Props) {
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      const resetTimer = window.setTimeout(() => {
        setQuery("");
        setResults([]);
        setFocused(-1);
      }, 0);
      const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 60);
      return () => {
        window.clearTimeout(resetTimer);
        window.clearTimeout(focusTimer);
      };
    }
  }, [open]);

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    const supabase = createClient();
    const like = `%${q}%`;

    const [{ data: tasks }, { data: announces }, { data: docs }] = await Promise.all([
      supabase.from("tasks").select("id, title, status").ilike("title", like).limit(4),
      supabase.from("announcements").select("id, title, type").ilike("title", like).limit(3),
      supabase.from("documents").select("id, title, category").ilike("title", like).limit(3),
    ]);

    const out: SearchResult[] = [
      ...(tasks ?? []).map(t => ({
        id: `t-${t.id}`, label: t.title, sub: t.status?.replace("_", " ") ?? "",
        href: "/dashboard/task-management", type: "task" as const,
      })),
      ...(announces ?? []).map(a => ({
        id: `a-${a.id}`, label: a.title, sub: a.type ?? "",
        href: "/dashboard/announce", type: "announce" as const,
      })),
      ...(docs ?? []).map(d => ({
        id: `d-${d.id}`, label: d.title, sub: d.category ?? "",
        href: "/dashboard/docs", type: "doc" as const,
      })),
    ];
    setResults(out);
    setFocused(-1);
    setLoading(false);
  }, []);

  function handleChange(val: string) {
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(val), 300);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setFocused(f => Math.min(f + 1, results.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setFocused(f => Math.max(f - 1, -1)); }
    if (e.key === "Enter" && focused >= 0 && results[focused]) {
      window.location.href = results[focused].href;
      onClose();
    }
  }

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {});

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 200, backdropFilter: "blur(2px)" }}
          />
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)",
              width: 560, maxWidth: "calc(100vw - 32px)",
              background: "#ffffff", borderRadius: 16,
              border: "1px solid #e5e7eb",
              boxShadow: "0 24px 64px rgba(0,0,0,0.15)",
              zIndex: 201, overflow: "hidden",
            }}
          >
            {/* Search input */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: "1px solid #f3f4f6" }}>
              <Search size={18} style={{ color: "#9ca3af", flexShrink: 0 }} />
              <input
                ref={inputRef}
                value={query}
                onChange={e => handleChange(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Cari task, pengumuman, dokumen..."
                style={{
                  flex: 1, border: "none", outline: "none",
                  fontSize: 15, color: "#111827", background: "transparent",
                }}
              />
              {query && (
                <button onClick={() => { setQuery(""); setResults([]); inputRef.current?.focus(); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", display: "flex" }}>
                  <X size={16} />
                </button>
              )}
              <kbd style={{ fontSize: 10, color: "#9ca3af", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 5, padding: "2px 6px" }}>
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div style={{ maxHeight: 400, overflowY: "auto" }}>
              {loading ? (
                <div style={{ padding: "24px", textAlign: "center" }}>
                  <div className="spin" style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid #e5e7eb", borderTopColor: "#10b981", margin: "0 auto" }} />
                </div>
              ) : !query ? (
                <div style={{ padding: "28px 20px", textAlign: "center" }}>
                  <Search size={28} style={{ color: "#e5e7eb", margin: "0 auto 8px", display: "block" }} />
                  <p style={{ fontSize: 13, color: "#9ca3af" }}>Ketik untuk mencari task, pengumuman, atau dokumen</p>
                  <p style={{ fontSize: 11, color: "#d1d5db", marginTop: 4 }}>Gunakan ⌘K atau Ctrl+K untuk membuka cepat</p>
                </div>
              ) : results.length === 0 ? (
                <div style={{ padding: "28px", textAlign: "center" }}>
                  <p style={{ fontSize: 13, color: "#9ca3af" }}>Tidak ada hasil untuk &ldquo;{query}&rdquo;</p>
                </div>
              ) : (
                Object.entries(grouped).map(([type, items]) => {
                  const cfg = TYPE_CFG[type as keyof typeof TYPE_CFG];
                  return (
                    <div key={type}>
                      <div style={{ padding: "8px 16px 4px", fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.07em", textTransform: "uppercase" }}>
                        {cfg.label}
                      </div>
                      {items.map((r) => {
                        const globalIdx = results.indexOf(r);
                        const isActive = focused === globalIdx;
                        return (
                          <Link key={r.id} href={r.href} style={{ textDecoration: "none" }} onClick={onClose}>
                            <div style={{
                              display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
                              background: isActive ? "#f9fafb" : "transparent",
                              cursor: "pointer", transition: "background 0.1s",
                            }}
                              onMouseEnter={() => setFocused(globalIdx)}
                            >
                              <div style={{ width: 28, height: 28, borderRadius: 7, background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <cfg.Icon size={13} color={cfg.color} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: 13, fontWeight: 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</p>
                                <p style={{ fontSize: 11, color: "#9ca3af", textTransform: "capitalize" }}>{r.sub}</p>
                              </div>
                              {isActive && <ArrowRight size={13} style={{ color: "#10b981" }} />}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>

            {results.length > 0 && (
              <div style={{ padding: "8px 16px", borderTop: "1px solid #f3f4f6", display: "flex", gap: 12, fontSize: 10, color: "#9ca3af" }}>
                <span>↑↓ navigasi</span><span>↵ buka</span><span>ESC tutup</span>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

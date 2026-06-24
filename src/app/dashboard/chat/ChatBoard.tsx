"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Send, Hash, Loader2, MessageSquare } from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import type { UserProfile } from "@/types";
import { createClient } from "@/lib/supabase/client";

const GLOBAL_ROOM_ID = "00000000-0000-0000-0000-000000000001";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: { full_name: string; role: string } | null;
}

interface DmRoom {
  room_id: string;
  other_user: UserProfile;
}

interface Props {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  dmRooms: DmRoom[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PALETTE = [
  "#6366f1","#8b5cf6","#ec4899","#ef4444","#f59e0b",
  "#10b981","#0ea5e9","#14b8a6","#f97316","#84cc16",
];
function userColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}
function initials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0] ?? "").join("").toUpperCase() || "?";
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}
function fmtDateSep(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Hari ini";
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Kemarin";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

type MsgItem =
  | { type: "sep"; label: string }
  | { type: "msg"; msg: ChatMessage; isFirst: boolean; isOwn: boolean };

function buildGroups(msgs: ChatMessage[], myId: string): MsgItem[] {
  const out: MsgItem[] = [];
  let lastDate = "", lastSender = "", lastTs = 0;
  for (const msg of msgs) {
    const sep = fmtDateSep(msg.created_at);
    if (sep !== lastDate) {
      out.push({ type: "sep", label: sep });
      lastDate = sep; lastSender = ""; lastTs = 0;
    }
    const ts = new Date(msg.created_at).getTime();
    const isFirst = msg.sender_id !== lastSender || ts - lastTs > 5 * 60 * 1000;
    out.push({ type: "msg", msg, isFirst, isOwn: msg.sender_id === myId });
    lastSender = msg.sender_id; lastTs = ts;
  }
  return out;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, userId, size = 32 }: { name: string; userId: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: userColor(userId),
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: Math.round(size * 0.36), fontWeight: 700, color: "#fff", flexShrink: 0,
      userSelect: "none",
    }}>
      {initials(name)}
    </div>
  );
}

// ─── Sidebar room button ──────────────────────────────────────────────────────
function ChannelBtn({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <motion.button onClick={onClick} whileTap={{ scale: 0.97 }}
      style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 9, border: "none", cursor: "pointer", textAlign: "left", marginBottom: 3, backgroundColor: active ? "rgba(99,102,241,0.28)" : "transparent", transition: "background-color 0.15s" }}
    >
      <Hash size={15} color={active ? "#a5b4fc" : "rgba(255,255,255,0.38)"} strokeWidth={2} />
      <span style={{ fontSize: 13, color: active ? "#fff" : "rgba(255,255,255,0.65)", fontWeight: active ? 600 : 400 }}>grcc-team</span>
      {active && <motion.div layoutId="ch-active" style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 3, height: 18, borderRadius: 2, background: "#818cf8" }} />}
    </motion.button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ChatBoard({ currentUser, allUsers, dmRooms: initDms }: Props) {
  const supabase = createClient();

  const [roomId, setRoomId]       = useState(GLOBAL_ROOM_ID);
  const [messages, setMessages]   = useState<ChatMessage[]>([]);
  const [dmRooms, setDmRooms]     = useState<DmRoom[]>(initDms);
  const [input, setInput]         = useState("");
  const [sending, setSending]     = useState(false);
  const [loading, setLoading]     = useState(true);
  const [creatingDm, setCreatingDm] = useState<string | null>(null);
  const [focused, setFocused]     = useState(false);

  const endRef      = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Derived ────────────────────────────────────────────────────────────────
  const isGlobal  = roomId === GLOBAL_ROOM_ID;
  const currentDm = dmRooms.find(d => d.room_id === roomId);
  const roomName  = isGlobal ? "GRCC Team" : (currentDm?.other_user.full_name ?? "DM");
  const roomSub   = isGlobal
    ? `${allUsers.length + 1} anggota`
    : (currentDm?.other_user.role?.replace(/_/g, " ") ?? "");

  const grouped = useMemo(() => buildGroups(messages, currentUser.id), [messages, currentUser.id]);

  // ── Load + realtime ────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    setLoading(true);
    setMessages([]);

    supabase
      .from("chat_messages")
      .select("*, sender:profiles(id, full_name, role)")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })
      .limit(150)
      .then(({ data }) => {
        if (active) { setMessages((data as ChatMessage[]) ?? []); setLoading(false); }
      });

    const ch = supabase
      .channel(`chat:${roomId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "chat_messages",
        filter: `room_id=eq.${roomId}`,
      }, async (payload) => {
        if (!active) return;
        const { data } = await supabase
          .from("chat_messages")
          .select("*, sender:profiles(id, full_name, role)")
          .eq("id", (payload.new as { id: string }).id)
          .single();
        if (data && active) {
          setMessages(prev => prev.some(m => m.id === (data as ChatMessage).id) ? prev : [...prev, data as ChatMessage]);
        }
      })
      .subscribe();

    return () => { active = false; supabase.removeChannel(ch); };
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send ───────────────────────────────────────────────────────────────────
  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    await supabase.from("chat_messages").insert({
      room_id: roomId, sender_id: currentUser.id, content: text,
    });
    setSending(false);
    textareaRef.current?.focus();
  }

  // ── Open / create DM ──────────────────────────────────────────────────────
  async function openDM(u: UserProfile) {
    const ex = dmRooms.find(d => d.other_user.id === u.id);
    if (ex) { setRoomId(ex.room_id); return; }
    setCreatingDm(u.id);
    const { data: room } = await supabase
      .from("chat_rooms").insert({ type: "direct" }).select().single();
    if (!room) { setCreatingDm(null); return; }
    await supabase.from("chat_room_members").insert([
      { room_id: room.id, user_id: currentUser.id },
      { room_id: room.id, user_id: u.id },
    ]);
    setDmRooms(prev => [...prev, { room_id: room.id, other_user: u }]);
    setRoomId(room.id);
    setCreatingDm(null);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="board-root" style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f9fafb" }}>
      <Topbar user={currentUser} title="Chat" />

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── Dark Left Sidebar ────────────────────────────────────────── */}
        <motion.div
          initial={{ x: -16, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          style={{
            width: 252, flexShrink: 0, overflow: "hidden",
            background: "linear-gradient(180deg, #1e1b4b 0%, #13111f 100%)",
            display: "flex", flexDirection: "column",
          }}
        >
          {/* Sidebar header */}
          <div style={{ padding: "16px 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <motion.div
                animate={{ boxShadow: ["0 0 12px rgba(99,102,241,0.4)", "0 0 20px rgba(139,92,246,0.5)", "0 0 12px rgba(99,102,241,0.4)"] }}
                transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                style={{ width: 30, height: 30, borderRadius: 9, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
              >
                <MessageCircle size={15} color="#fff" />
              </motion.div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1 }}>Internal Chat</p>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>GRCC UNAIR</p>
              </div>
            </div>
          </div>

          {/* Scrollable list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 8px 8px" }}>

            {/* Channels */}
            <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.09em", padding: "0 10px", marginBottom: 6 }}>
              Channel
            </p>
            <div style={{ position: "relative", marginBottom: 20 }}>
              <ChannelBtn active={isGlobal} onClick={() => setRoomId(GLOBAL_ROOM_ID)} />
            </div>

            {/* Direct Messages */}
            <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.09em", padding: "0 10px", marginBottom: 6 }}>
              Pesan Langsung
            </p>
            <AnimatePresence>
              {allUsers.map((u, i) => {
                const dm = dmRooms.find(d => d.other_user.id === u.id);
                const isActive = dm?.room_id === roomId;
                return (
                  <motion.button key={u.id}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.025, duration: 0.2 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => openDM(u)}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "7px 10px", borderRadius: 9, border: "none", cursor: "pointer", textAlign: "left", marginBottom: 2, backgroundColor: isActive ? "rgba(99,102,241,0.28)" : "transparent", transition: "background-color 0.15s" }}
                  >
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <div style={{ width: 26, height: 26, borderRadius: "50%", background: userColor(u.id), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff" }}>
                        {initials(u.full_name)}
                      </div>
                      <div style={{ position: "absolute", bottom: 0, right: 0, width: 7, height: 7, borderRadius: "50%", background: "#10b981", border: "1.5px solid #1e1b4b" }} />
                    </div>
                    <span style={{ fontSize: 13, color: isActive ? "#fff" : "rgba(255,255,255,0.65)", fontWeight: isActive ? 600 : 400, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {u.full_name}
                    </span>
                    {creatingDm === u.id && (
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}>
                        <Loader2 size={12} color="rgba(255,255,255,0.4)" />
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Current user footer */}
          <div style={{ padding: "10px 12px 12px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <Avatar name={currentUser.full_name} userId={currentUser.id} size={28} />
                <div style={{ position: "absolute", bottom: 0, right: 0, width: 8, height: 8, borderRadius: "50%", background: "#10b981", border: "2px solid #13111f" }} />
              </div>
              <div style={{ overflow: "hidden" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentUser.full_name}</p>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>{currentUser.role?.replace(/_/g, " ")}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Right Chat Area ───────────────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f9fafb" }}>

          {/* Chat header */}
          <motion.div
            key={roomId}
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            style={{ padding: "12px 24px", background: "#fff", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {isGlobal ? (
                <div style={{ width: 38, height: 38, borderRadius: 11, background: "linear-gradient(135deg, #6366f1, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Hash size={17} color="#fff" strokeWidth={2.2} />
                </div>
              ) : (
                <Avatar name={currentDm?.other_user.full_name ?? "?"} userId={currentDm?.other_user.id ?? ""} size={38} />
              )}
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#111827", lineHeight: 1 }}>{roomName}</p>
                <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 3 }}>{roomSub}</p>
              </div>
            </div>

            {/* Stacked avatars (global only) */}
            {isGlobal && (
              <div style={{ display: "flex", alignItems: "center" }}>
                {[currentUser, ...allUsers].slice(0, 5).map((u, i) => (
                  <motion.div key={u.id}
                    initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    style={{ marginLeft: i === 0 ? 0 : -8, zIndex: 5 - i }}
                    title={u.full_name}
                  >
                    <Avatar name={u.full_name} userId={u.id} size={28} />
                  </motion.div>
                ))}
                {allUsers.length >= 5 && (
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#6b7280", marginLeft: -8, zIndex: 0 }}>
                    +{allUsers.length - 4}
                  </div>
                )}
              </div>
            )}
          </motion.div>

          {/* Messages area */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 12px", display: "flex", flexDirection: "column" }}>

            {loading ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}>
                  <Loader2 size={26} color="#c7d2fe" />
                </motion.div>
              </div>
            ) : messages.length === 0 ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
                <motion.div
                  animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                  style={{ width: 60, height: 60, borderRadius: 18, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(99,102,241,0.28)" }}
                >
                  <MessageSquare size={26} color="#fff" />
                </motion.div>
                <p style={{ fontSize: 16, fontWeight: 700, color: "#374151" }}>Belum ada pesan</p>
                <p style={{ fontSize: 13, color: "#9ca3af" }}>
                  {isGlobal ? "Mulai diskusi tim di sini!" : `Kirim pesan pertama ke ${roomName} 👋`}
                </p>
              </motion.div>
            ) : (
              <AnimatePresence initial={false}>
                {grouped.map((item, idx) => {
                  if (item.type === "sep") {
                    return (
                      <motion.div key={`sep-${item.label}-${idx}`}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0 14px" }}
                      >
                        <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", whiteSpace: "nowrap", padding: "3px 10px", background: "#f3f4f6", borderRadius: 20 }}>{item.label}</span>
                        <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
                      </motion.div>
                    );
                  }

                  const { msg, isFirst, isOwn } = item;
                  const senderName = msg.sender?.full_name ?? "Unknown";

                  return (
                    <motion.div key={msg.id}
                      layout
                      initial={{ opacity: 0, y: 14, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: "spring", stiffness: 480, damping: 28 }}
                      style={{ display: "flex", flexDirection: isOwn ? "row-reverse" : "row", alignItems: "flex-end", gap: 8, marginTop: isFirst ? 14 : 3 }}
                    >
                      {/* Avatar slot (others only) */}
                      {!isOwn && (
                        <div style={{ width: 30, flexShrink: 0 }}>
                          {isFirst && <Avatar name={senderName} userId={msg.sender_id} size={30} />}
                        </div>
                      )}

                      {/* Bubble + meta */}
                      <div style={{ maxWidth: "62%", display: "flex", flexDirection: "column", alignItems: isOwn ? "flex-end" : "flex-start" }}>
                        {isFirst && !isOwn && (
                          <span style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4, marginLeft: 2 }}>{senderName}</span>
                        )}
                        <div style={{
                          padding: "9px 14px",
                          background: isOwn
                            ? "linear-gradient(135deg, #6366f1, #4f46e5)"
                            : "#fff",
                          borderRadius: isOwn
                            ? (isFirst ? "18px 18px 4px 18px" : "18px 4px 4px 18px")
                            : (isFirst ? "4px 18px 18px 18px" : "4px 18px 18px 4px"),
                          boxShadow: isOwn
                            ? "0 3px 14px rgba(99,102,241,0.28)"
                            : "0 1px 5px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)",
                          color: isOwn ? "#fff" : "#111827",
                          fontSize: 14, lineHeight: 1.55,
                          whiteSpace: "pre-wrap", wordBreak: "break-word",
                        }}>
                          {msg.content}
                        </div>
                        <span style={{ fontSize: 10, color: "#9ca3af", marginTop: 4, [isOwn ? "marginRight" : "marginLeft"]: 4 }}>
                          {fmtTime(msg.created_at)}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
            <div ref={endRef} />
          </div>

          {/* Input area */}
          <div style={{ padding: "12px 24px 18px", background: "#fff", borderTop: "1px solid #f3f4f6", flexShrink: 0 }}>
            <motion.div
              animate={{
                borderColor: focused ? "#a5b4fc" : "#e5e7eb",
                boxShadow: focused ? "0 0 0 3px rgba(165,180,252,0.18)" : "0 0 0 0px transparent",
              }}
              transition={{ duration: 0.15 }}
              style={{ display: "flex", alignItems: "flex-end", gap: 10, background: focused ? "#fff" : "#f9fafb", borderRadius: 14, border: "1.5px solid #e5e7eb", padding: "8px 10px 8px 16px" }}
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                }}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder={`Pesan ke ${isGlobal ? "#grcc-team" : roomName}…`}
                rows={1}
                style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 14, color: "#111827", resize: "none", fontFamily: "inherit", lineHeight: 1.55, maxHeight: 120, overflowY: "auto", paddingTop: 2 }}
              />
              <motion.button
                whileHover={input.trim() ? { scale: 1.06 } : {}}
                whileTap={input.trim() ? { scale: 0.93 } : {}}
                onClick={send}
                disabled={!input.trim() || sending}
                style={{ width: 36, height: 36, borderRadius: 10, border: "none", flexShrink: 0, cursor: input.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", background: input.trim() ? "linear-gradient(135deg, #6366f1, #4f46e5)" : "#f3f4f6", transition: "background 0.15s" }}
              >
                {sending ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}>
                    <Loader2 size={15} color={input.trim() ? "#fff" : "#9ca3af"} />
                  </motion.div>
                ) : (
                  <Send size={15} color={input.trim() ? "#fff" : "#9ca3af"} strokeWidth={2.2} style={{ transform: "translateX(1px)" }} />
                )}
              </motion.button>
            </motion.div>
            <p style={{ fontSize: 11, color: "#c4c9d4", marginTop: 7, textAlign: "right" }}>
              <kbd style={{ fontFamily: "inherit", fontWeight: 600 }}>Enter</kbd> kirim ·{" "}
              <kbd style={{ fontFamily: "inherit", fontWeight: 600 }}>Shift+Enter</kbd> baris baru
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}

"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PresenceStatus, UserProfile } from "@/types";

interface PresenceEntry { status: PresenceStatus; }

interface PresenceCtx {
  myStatus: PresenceStatus;
  setMyStatus: (s: PresenceStatus) => Promise<void>;
  statusOf: (userId: string) => PresenceStatus | null;
}

const Ctx = createContext<PresenceCtx>({
  myStatus: "available",
  setMyStatus: async () => {},
  statusOf: () => null,
});

export function usePresence() { return useContext(Ctx); }

export function PresenceProvider({ user, children }: { user: UserProfile | null; children: React.ReactNode }) {
  const supabase = createClient();
  const [myStatus, _setMyStatus] = useState<PresenceStatus>(
    (user?.presence_status as PresenceStatus) ?? "available"
  );
  const [presenceMap, setPresenceMap] = useState<Record<string, PresenceStatus>>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const myStatusRef = useRef<PresenceStatus>(myStatus);

  useEffect(() => { myStatusRef.current = myStatus; }, [myStatus]);

  useEffect(() => {
    if (!user) return;

    const ch = supabase.channel("presence:dashboard", {
      config: { presence: { key: user.id } },
    });

    function sync() {
      const raw = ch.presenceState() as Record<string, PresenceEntry[]>;
      const map: Record<string, PresenceStatus> = {};
      for (const [uid, entries] of Object.entries(raw)) {
        if (entries[0]?.status) map[uid] = entries[0].status;
      }
      setPresenceMap(map);
    }

    ch
      .on("presence", { event: "sync" }, sync)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await ch.track({ status: myStatusRef.current });
        }
      });

    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]); // eslint-disable-line

  const setMyStatus = useCallback(async (s: PresenceStatus) => {
    _setMyStatus(s);
    myStatusRef.current = s;
    if (!user) return;
    await Promise.all([
      supabase.from("profiles").update({ presence_status: s }).eq("id", user.id),
      channelRef.current?.track({ status: s }),
    ]);
  }, [user, supabase]);

  const statusOf = useCallback((uid: string): PresenceStatus | null => {
    return presenceMap[uid] ?? null;
  }, [presenceMap]);

  return (
    <Ctx.Provider value={{ myStatus, setMyStatus, statusOf }}>
      {children}
    </Ctx.Provider>
  );
}

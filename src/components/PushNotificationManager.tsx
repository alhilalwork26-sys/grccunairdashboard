"use client";

import { useEffect, useState } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const DISMISSED_KEY = "ios_install_banner_dismissed";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
  return isIos && isSafari;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

export default function PushNotificationManager() {
  const [showIosBanner, setShowIosBanner] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Show iOS install guide if: iOS Safari + not installed to homescreen + not dismissed
    if (isIosSafari() && !isStandalone()) {
      const dismissed = sessionStorage.getItem(DISMISSED_KEY);
      if (!dismissed) setShowIosBanner(true);
      return; // Push setup requires standalone on iOS
    }

    // Android / Desktop / iOS standalone — run normal push setup
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    async function setup() {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          });
        }

        const json = sub.toJSON();
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
        });
      } catch (err) {
        console.warn("[Push] Setup failed:", err);
      }
    }

    setup();
  }, []);

  function dismiss() {
    sessionStorage.setItem(DISMISSED_KEY, "1");
    setShowIosBanner(false);
  }

  if (!showIosBanner) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9998,
        background: "#1e293b",
        borderTop: "1px solid #334155",
        padding: "14px 16px 20px",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        boxShadow: "0 -4px 24px rgba(0,0,0,0.35)",
      }}
    >
      {/* Share icon hint */}
      <div
        style={{
          flexShrink: 0,
          width: 40,
          height: 40,
          borderRadius: 10,
          background: "rgba(30,64,175,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 2,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
          <polyline points="16 6 12 2 8 6"/>
          <line x1="12" y1="2" x2="12" y2="15"/>
        </svg>
      </div>

      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>
          Install App untuk Notifikasi
        </p>
        <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 4, lineHeight: 1.5 }}>
          Tap <strong style={{ color: "#60a5fa" }}>Share</strong>{" "}
          <span style={{ fontSize: 14 }}>⎋</span> lalu pilih{" "}
          <strong style={{ color: "#60a5fa" }}>&ldquo;Add to Home Screen&rdquo;</strong>{" "}
          untuk mengaktifkan notifikasi push.
        </p>
      </div>

      <button
        onClick={dismiss}
        style={{
          flexShrink: 0,
          background: "transparent",
          border: "1px solid #475569",
          borderRadius: 8,
          padding: "5px 10px",
          fontSize: 12,
          color: "#94a3b8",
          cursor: "pointer",
          marginTop: 2,
        }}
      >
        Tutup
      </button>
    </div>
  );
}

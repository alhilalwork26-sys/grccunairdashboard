"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface ThemeCtx { isDark: boolean; toggle: () => void; }
const Ctx = createContext<ThemeCtx>({ isDark: false, toggle: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("theme");
    return stored === "dark" ||
      (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  function toggle() {
    setIsDark(d => {
      const next = !d;
      localStorage.setItem("theme", next ? "dark" : "light");
      document.documentElement.classList.toggle("dark", next);
      return next;
    });
  }

  return <Ctx.Provider value={{ isDark, toggle }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);

"use client";

import { useEffect, useState } from "react";
import { getUserPreference, setUserPreference } from "../lib/apiClient";

const STORAGE_KEY = "ui_theme_mode";
const PREFERENCE_KEY = "ui_theme_mode";

type ThemeMode = "dark" | "light";

function applyTheme(theme: ThemeMode): void {
  document.documentElement.setAttribute("data-theme", theme);
}

function parseTheme(value: unknown): ThemeMode {
  return value === "light" ? "light" : "dark";
}

export function ThemeToggle(): JSX.Element {
  const [theme, setTheme] = useState<ThemeMode>("dark");

  useEffect(() => {
    const local = localStorage.getItem(STORAGE_KEY);
    const localTheme = parseTheme(local);
    setTheme(localTheme);
    applyTheme(localTheme);

    void (async () => {
      const remote = await getUserPreference(PREFERENCE_KEY);
      const remoteTheme = parseTheme(remote);
      setTheme(remoteTheme);
      applyTheme(remoteTheme);
      localStorage.setItem(STORAGE_KEY, remoteTheme);
    })();
  }, []);

  const toggle = (): void => {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    void setUserPreference(PREFERENCE_KEY, next);
  };

  return (
    <button
      onClick={toggle}
      className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold"
      aria-label="Alternar tema"
    >
      {theme === "dark" ? "🌙 Escuro" : "☀️ Claro"}
    </button>
  );
}

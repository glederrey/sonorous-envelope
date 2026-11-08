"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "dark" | "light";

function current(): Theme {
  const set = document.documentElement.dataset.theme;
  if (set === "dark" || set === "light") return set;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

// Shows the theme you are on: a moon on dark, a sun on light. Click to switch.
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);
  useEffect(() => setTheme(current()), []);

  function toggle() {
    const next: Theme = current() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("se-theme", next);
    } catch {
      // Storage blocked: the choice lasts for this page only.
    }
    setTheme(next);
  }

  return (
    <button
      type="button"
      className="se-btn se-btn-icon"
      onClick={toggle}
      aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
    >
      {theme === "dark" ? <Moon size={20} aria-hidden /> : theme === "light" ? <Sun size={20} aria-hidden /> : null}
      <span className="se-theme-label">{theme === "light" ? "Dark theme" : "Light theme"}</span>
    </button>
  );
}

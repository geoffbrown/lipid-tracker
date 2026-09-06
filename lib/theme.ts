import { THEME_KEY, getThemeScript } from "./theme-script.js";

export { getThemeScript };

export type ThemeChoice = "auto" | "light" | "dark";

export function getTheme(): ThemeChoice {
  if (typeof window === "undefined") return "auto";
  try {
    return (window.localStorage.getItem(THEME_KEY) as ThemeChoice) || "auto";
  } catch {
    return "auto";
  }
}

export function setTheme(choice: ThemeChoice): void {
  try {
    window.localStorage.setItem(THEME_KEY, choice);
  } catch {
    /* per-viewer convenience only; failing to persist changes nothing important */
  }
  const dark =
    choice === "dark" ||
    (choice === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

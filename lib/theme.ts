const KEY = "lipidlog.theme";

/** Runs before first paint so the correct theme is already on <html> — the
 *  React-context approach it replaces flashed the wrong theme on every load. */
export function getThemeScript() {
  return `(function(){try{var t=localStorage.getItem('${KEY}')||'auto';var d=t==='dark'||(t==='auto'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;
}

export type ThemeChoice = "auto" | "light" | "dark";

export function getTheme(): ThemeChoice {
  if (typeof window === "undefined") return "auto";
  try {
    return (window.localStorage.getItem(KEY) as ThemeChoice) || "auto";
  } catch {
    return "auto";
  }
}

export function setTheme(choice: ThemeChoice): void {
  try {
    window.localStorage.setItem(KEY, choice);
  } catch {
    /* per-viewer convenience only; a failure here changes nothing that matters */
  }
  const dark =
    choice === "dark" ||
    (choice === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

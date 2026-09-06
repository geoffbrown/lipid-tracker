/* Plain ESM so both the Next layout and the single-file preview build can use
   the identical script — a duplicated copy would drift, and this one has to run
   before first paint in both. */
export const THEME_KEY = "lipidlog.theme";

export function getThemeScript() {
  return `(function(){try{var t=localStorage.getItem('${THEME_KEY}')||'auto';var d=t==='dark'||(t==='auto'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;
}

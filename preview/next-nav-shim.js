/* Stands in for next/navigation in the single-file preview build. The ported
   pages only ever call router.push / router.replace, so a hash router covers
   them exactly — no behaviour is faked, the destination is just written to the
   URL fragment instead of being handled by the Next router. */
const go = (path, replace) => {
  const target = `#${path}`;
  if (replace) window.location.replace(target);
  else window.location.hash = path;
};

export function useRouter() {
  return {
    push: (path) => go(path, false),
    replace: (path) => go(path, true),
    back: () => window.history.back(),
    refresh: () => {},
    prefetch: () => {},
  };
}

export function usePathname() {
  return window.location.hash.slice(1) || "/";
}

export function useSearchParams() {
  return new URLSearchParams();
}

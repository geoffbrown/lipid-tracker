"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart2, List, Moon, Settings, Sun, SunMoon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getTheme, setTheme, type ThemeChoice } from "@/lib/theme";

/**
 * Both halves of the app's navigation, because they are the same navigation.
 *
 * A phone gets the bottom tab bar it expects; from `sm` up that bar is replaced
 * by a top bar, which is what a pointer-and-keyboard window expects. Keeping
 * them in one component means the route list is declared once and the two can
 * never disagree about which tab is current.
 */
const NAV = [
  { href: "/", label: "Dashboard", Icon: BarChart2 },
  { href: "/history", label: "History", Icon: List },
  { href: "/settings", label: "Settings", Icon: Settings },
] as const;

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <path
          d="M1.5 13.5 L6 8 L10 10.5 L16.5 3"
          fill="none"
          stroke="var(--color-bm-ldl)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-[15px] font-bold tracking-[-0.01em]">LipidLog</span>
    </Link>
  );
}

/** Cycles auto → light → dark. The same three choices Settings offers, reachable
 *  in one click on a desktop window where there is room for it. */
const THEME_ORDER: ThemeChoice[] = ["auto", "light", "dark"];
const THEME_ICON = { auto: SunMoon, light: Sun, dark: Moon } as const;

function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>("auto");
  useEffect(() => setChoice(getTheme()), []);

  const Icon = THEME_ICON[choice];
  return (
    <button
      onClick={() => {
        const next = THEME_ORDER[(THEME_ORDER.indexOf(choice) + 1) % THEME_ORDER.length];
        setChoice(next);
        setTheme(next);
      }}
      aria-label={`Theme: ${choice}. Change.`}
      title={`Theme: ${choice}`}
      className="pressable grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors hover:bg-paper-2"
    >
      <Icon size={17} aria-hidden />
    </button>
  );
}

export default function Header() {
  const configured = isSupabaseConfigured();
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) return;
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
  }, [configured]);

  const isOn = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      {/* Top bar — from sm up. */}
      <header className="sticky top-0 z-20 hidden border-b border-line bg-canvas/95 backdrop-blur sm:block">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-7">
            <Wordmark />
            <nav aria-label="Main" className="flex items-center gap-1">
              {NAV.map(({ href, label }) => {
                const on = isOn(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={on ? "page" : undefined}
                    className={`rounded-full px-3 py-1.5 transition-colors duration-[var(--dur-fast)] ${
                      on
                        ? "bg-paper-2 font-semibold text-ink"
                        : "text-ink-soft hover:text-ink"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex min-w-0 items-center gap-2 text-ink-soft">
            {configured ? (
              email && <span className="hidden truncate md:inline">{email}</span>
            ) : (
              <span className="rounded-full border border-line px-2.5 py-1">
                This device only
              </span>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Bottom tabs — phone only. */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-canvas/95 backdrop-blur sm:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-[600px]">
          {NAV.map(({ href, label, Icon }) => {
            const on = isOn(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={on ? "page" : undefined}
                className={`flex flex-1 flex-col items-center gap-1 py-2.5 transition-colors duration-[var(--dur-fast)] ${
                  on ? "font-bold text-ink" : "text-ink-soft"
                }`}
              >
                <Icon
                  size={19}
                  strokeWidth={on ? 2.4 : 2}
                  aria-hidden
                  className="transition-transform duration-[var(--dur-fast)] ease-[var(--ease-standard)]"
                  style={{ transform: on ? "translateY(-1px) scale(1.06)" : "none" }}
                />
                <span className="text-[13px]">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

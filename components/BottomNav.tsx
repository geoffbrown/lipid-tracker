"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart2, List, Settings } from "lucide-react";

const TABS = [
  { href: "/", label: "Dashboard", Icon: BarChart2 },
  { href: "/history", label: "History", Icon: List },
  { href: "/settings", label: "Settings", Icon: Settings },
] as const;

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-canvas/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-[600px]">
        {TABS.map(({ href, label, Icon }) => {
          const on = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={on ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 ${
                on ? "font-bold text-ink" : "text-ink-soft"
              }`}
            >
              <Icon size={19} strokeWidth={on ? 2.4 : 2} aria-hidden />
              <span className="text-[13px]">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

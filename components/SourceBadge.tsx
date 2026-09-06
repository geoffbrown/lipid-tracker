import type { Source } from "@/lib/types";

/* The tint is the source identity; the label takes a separately solved variant
   of the same hue, because a colour on a tint of itself never reaches 4.5:1. */
export default function SourceBadge({ source }: { source: Source }) {
  const lab = source === "Lab";
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 font-bold ${
        lab ? "bg-src-lab/12 text-src-lab-ink" : "bg-src-home/12 text-src-home-ink"
      }`}
    >
      {lab ? "Lab" : "Home"}
    </span>
  );
}

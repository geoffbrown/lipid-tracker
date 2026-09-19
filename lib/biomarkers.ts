export interface Biomarker {
  key: string;
  label: string;
  unit: string;
  color: string;
  lowerBetter: boolean;
  /** Domain for the reference rail, and the thresholds marked on it. */
  scale: [number, number];
  marks: number[];
  /** One name per band the marks divide the scale into: marks.length + 1. */
  zones: string[];
}

export type ZoneStatus = "good" | "mid" | "bad";

export const ZONE_COLOR: Record<ZoneStatus, string> = {
  good: "var(--color-success)",
  mid: "var(--color-warn)",
  bad: "var(--color-danger)",
};

/**
 * Which reference band a value falls in. Bands are half-open on the marks
 * (`< 100`, `≥ 160`), matching the reference text the app prints. The first
 * band is the favourable one for lower-is-better analytes; for HDL it is the
 * last.
 */
export function zoneOf(bm: Biomarker, v: number): { index: number; label: string; status: ZoneStatus } {
  const index = bm.marks.filter((m) => v >= m).length;
  const last = bm.zones.length - 1;
  const goodIdx = bm.lowerBetter ? 0 : last;
  const badIdx = bm.lowerBetter ? last : 0;
  const status: ZoneStatus = index === goodIdx ? "good" : index === badIdx ? "bad" : "mid";
  return { index, label: bm.zones[index], status };
}

/* Scales and marks come from the reference ranges the app already displays
   (ATP III-style, informational only). */
export const BMS: Biomarker[] = [
  { key: "ldl",   label: "LDL",    unit: "mg/dL", color: "var(--color-bm-ldl)",
    lowerBetter: true,  scale: [0, 220], marks: [100, 160],
    zones: ["Optimal", "Above optimal", "High"] },
  { key: "hdl",   label: "HDL",    unit: "mg/dL", color: "var(--color-bm-hdl)",
    lowerBetter: false, scale: [0, 100], marks: [40, 60],
    zones: ["Low", "Acceptable", "Protective"] },
  { key: "tc",    label: "TC",     unit: "mg/dL", color: "var(--color-bm-tc)",
    lowerBetter: true,  scale: [0, 320], marks: [200, 240],
    zones: ["Desirable", "Borderline", "High"] },
  { key: "tg",    label: "TG",     unit: "mg/dL", color: "var(--color-bm-tg)",
    lowerBetter: true,  scale: [0, 300], marks: [150, 200],
    zones: ["Normal", "Borderline", "High"] },
  /* Marks mirror the LDL marks at 100/160 plus the conventional +30 offset,
     which is how the guidelines derive a non-HDL target from an LDL one. */
  { key: "nonHDL", label: "Non-HDL", unit: "mg/dL", color: "var(--color-bm-nonhdl)",
    lowerBetter: true,  scale: [0, 250], marks: [130, 190],
    zones: ["Optimal", "Above optimal", "High"] },
  { key: "apob",  label: "ApoB",   unit: "mg/dL", color: "var(--color-bm-apob)",
    lowerBetter: true,  scale: [0, 180], marks: [90, 130],
    zones: ["Optimal", "Borderline", "High"] },
  { key: "tcHdl", label: "TC/HDL", unit: "",      color: "var(--color-bm-tchdl)",
    lowerBetter: true,  scale: [0, 7],   marks: [3.5],
    zones: ["At goal", "Above goal"] },
  { key: "tgHdl", label: "TG/HDL", unit: "",      color: "var(--color-bm-tghdl)",
    lowerBetter: true,  scale: [0, 5],   marks: [2],
    zones: ["At goal", "Above goal"] },
];

export const BM = (k: string): Biomarker | undefined => BMS.find((b) => b.key === k);

export const RANGES = ["30d", "90d", "1y", "All"] as const;
export type Range = (typeof RANGES)[number];

export interface Biomarker {
  key: string;
  label: string;
  unit: string;
  color: string;
  lowerBetter: boolean;
  /** Domain for the reference rail, and the thresholds marked on it. */
  scale: [number, number];
  marks: number[];
}

/* Scales and marks come from the reference ranges the app already displays
   (ATP III-style, informational only). */
export const BMS: Biomarker[] = [
  { key: "ldl",   label: "LDL",    unit: "mg/dL", color: "var(--color-bm-ldl)",
    lowerBetter: true,  scale: [0, 220], marks: [100, 160] },
  { key: "hdl",   label: "HDL",    unit: "mg/dL", color: "var(--color-bm-hdl)",
    lowerBetter: false, scale: [0, 100], marks: [40, 60] },
  { key: "tc",    label: "TC",     unit: "mg/dL", color: "var(--color-bm-tc)",
    lowerBetter: true,  scale: [0, 320], marks: [200, 240] },
  { key: "tg",    label: "TG",     unit: "mg/dL", color: "var(--color-bm-tg)",
    lowerBetter: true,  scale: [0, 300], marks: [150, 200] },
  /* Marks mirror the LDL marks at 100/160 plus the conventional +30 offset,
     which is how the guidelines derive a non-HDL target from an LDL one. */
  { key: "nonHDL", label: "Non-HDL", unit: "mg/dL", color: "var(--color-bm-nonhdl)",
    lowerBetter: true,  scale: [0, 250], marks: [130, 190] },
  { key: "apob",  label: "ApoB",   unit: "mg/dL", color: "var(--color-bm-apob)",
    lowerBetter: true,  scale: [0, 180], marks: [90, 130] },
  { key: "tcHdl", label: "TC/HDL", unit: "",      color: "var(--color-bm-tchdl)",
    lowerBetter: true,  scale: [0, 7],   marks: [3.5] },
  { key: "tgHdl", label: "TG/HDL", unit: "",      color: "var(--color-bm-tghdl)",
    lowerBetter: true,  scale: [0, 5],   marks: [2] },
];

export const BM = (k: string): Biomarker | undefined => BMS.find((b) => b.key === k);

export const RANGES = ["30d", "90d", "1y", "All"] as const;
export type Range = (typeof RANGES)[number];

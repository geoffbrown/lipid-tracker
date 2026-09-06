/** A stored reading: raw inputs only. Everything derived is computed at read
 *  time by lib/calc.js, so a change of method reprices history for free. */
export type Source = "POC" | "Lab";

export interface Reading {
  id: string;
  timestamp: string;        // ISO 8601, minute precision
  source: Source;
  sourceName: string;
  tc: number | null;
  hdl: number | null;
  ldl: number | null;       // device- or lab-reported; canonical, never overwritten
  tg: number | null;
  apobMeasured: number | null;   // lab sources only
  notes: string;
}

export type LdlMethod = "none" | "friedewald" | "martin-hopkins";
export type ApobMethod = "interheart" | "aggressive";
export type LpaUnit = "mg/dL" | "nmol/L";

/** Account-level settings — these follow the user, not the device. */
export interface Profile {
  ldlMethod: LdlMethod;
  apobMethod: ApobMethod;
  lpa: number | null;
  lpaUnit: LpaUnit;
  defaultSource: Source;
  defaultDevice: string | null;
  defaultLabSource: string | null;
  homeDevices: string[];
  labSources: string[];
  cards: string[];
  onboardedAt: string | null;
}

export const SEED_HOME = ["CURO L7/L5", "CardioChek", "Accutrend Plus", "Other Device"];
export const SEED_LAB = ["LabCorp", "Quest Diagnostics", "Doctor's Office", "Other Lab"];

export const DEFAULT_PROFILE: Profile = {
  ldlMethod: "martin-hopkins",
  apobMethod: "interheart",
  lpa: null,
  lpaUnit: "mg/dL",
  defaultSource: "POC",
  defaultDevice: SEED_HOME[0],
  defaultLabSource: SEED_LAB[0],
  homeDevices: SEED_HOME,
  labSources: SEED_LAB,
  cards: ["ldl", "hdl", "apob"],
  onboardedAt: null,
};

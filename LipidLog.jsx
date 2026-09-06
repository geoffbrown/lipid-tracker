import { useState, useEffect, useMemo, useCallback, useRef, createContext, useContext } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ReferenceLine } from "recharts";
import { BarChart2, List, Settings, Plus, ChevronRight, ChevronUp, ChevronDown, X,
  Trash2, Download, Check, Sun, Moon, Activity, FileText, Pencil, Delete } from "lucide-react";
import { calcDerived, getDispLDL, metricValue, TG_CALC_MAX } from "./src/calc.js";
import { downsample, fitTrend, fmtSpan } from "./src/chart.js";

/* ════════════════════════════════════════════════════════════════════════════
   THEME. Swiss-neutral. Chrome is monochrome (ink / paper); data carries colour.
   ════════════════════════════════════════════════════════════════════════════ */
const THEMES = {
  light: {
    isDark:false, bg:"#F4F4F5", card:"#FFFFFF", cardHi:"#FAFAFA",
    border:"#E4E4E7", borderHi:"#D4D4D8", grid:"#ECECEE",
    text:"#18181B", sec:"#71717A", muted:"#A1A1AA",
    accent:"#18181B", accentText:"#FFFFFF",
    overlay:"rgba(24,24,27,0.32)", danger:"#D92D20", dangerBg:"#FEF3F2",
    success:"#067647", warnBg:"#FFFAEB", warn:"#B54708",
  },
  dark: {
    isDark:true, bg:"#0C0C0D", card:"#161618", cardHi:"#1F1F22",
    border:"rgba(255,255,255,0.08)", borderHi:"rgba(255,255,255,0.15)",
    grid:"rgba(255,255,255,0.05)",
    text:"#FAFAFA", sec:"#8A8A93", muted:"#56565C",
    accent:"#FAFAFA", accentText:"#0C0C0D",
    overlay:"rgba(0,0,0,0.62)", danger:"#F97066", dangerBg:"rgba(249,112,102,0.12)",
    success:"#3CCB7F", warnBg:"rgba(247,144,9,0.1)", warn:"#F79009",
  },
};
const ThemeCtx = createContext(THEMES.dark);
const useT = () => useContext(ThemeCtx);

const FONT = "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'DM Mono', 'SF Mono', ui-monospace, monospace";

/* Source categories */
const SRC_HOME = { color:"#1B9E5A", label:"Home" };
const SRC_LAB  = { color:"#2E6FE0", label:"Lab"  };
const srcMeta  = s => (s === "Lab" ? SRC_LAB : SRC_HOME);

/* Biomarker palette: mid-tone, legible on both light and dark. */
const BMS = [
  { key:"ldl",   label:"LDL",     unit:"mg/dL", color:"#DF3F2E", lowerBetter:true  },
  { key:"hdl",   label:"HDL",     unit:"mg/dL", color:"#1B9E5A", lowerBetter:false },
  { key:"tc",    label:"TC",      unit:"mg/dL", color:"#2E6FE0", lowerBetter:true  },
  { key:"tg",    label:"TG",      unit:"mg/dL", color:"#DC8A1E", lowerBetter:true  },
  { key:"apob",  label:"ApoB",    unit:"mg/dL", color:"#7B4FD4", lowerBetter:true  },
  { key:"tcHdl", label:"TC/HDL",  unit:"",      color:"#128591", lowerBetter:true  },
  { key:"tgHdl", label:"TG/HDL",  unit:"",      color:"#C2417E", lowerBetter:true  },
];
const BM = k => BMS.find(b => b.key === k);

/* General, non-diagnostic reference ranges (ATP III-style). Informational only. */
const REF_RANGES = {
  ldl:"Optimal < 100 · High ≥ 160", hdl:"Low < 40 · Protective ≥ 60",
  tc:"Desirable < 200 · High ≥ 240", tg:"Normal < 150 · High ≥ 200",
  nonHDL:"Optimal < 130 · High ≥ 190", apob:"Optimal < 90 · High ≥ 130",
  tcHdl:"Goal < 3.5 · lower is better", tgHdl:"Goal < 2.0 (insulin-sensitivity proxy)",
};

const LDL_OPTS = [
  { value:"none",           label:"Off",            sub:"Use the device-reported LDL as-is" },
  { value:"friedewald",     label:"Friedewald",     sub:"TC − HDL − TG/5, the classic estimate" },
  { value:"martin-hopkins", label:"Martin-Hopkins", sub:"Adjustable divisor, more accurate at normal TG" },
];
const APOB_OPTS = [
  { value:"interheart", label:"INTERHEART", sub:"Conservative, validated regression estimate" },
  { value:"aggressive", label:"Aggressive", sub:"Risk-weighted, yields a higher estimate" },
];
const THEME_OPTS = [
  { value:"system", label:"System", sub:"Match your device appearance" },
  { value:"light",  label:"Light",  sub:"Always light" },
  { value:"dark",   label:"Dark",   sub:"Always dark" },
];


/* ════════════════════════════════════════════════════════════════════════════
   CONSTANTS & HELPERS
   ════════════════════════════════════════════════════════════════════════════ */
const RANGES = ["30d","90d","1y","All"];
const SRC_MODES = [
  { value:"all",  label:"All" },
  { value:"home", label:"Home" },
  { value:"lab",  label:"Lab" },
];
const SEED_HOME = ["CURO L7/L5","CardioChek","Accutrend Plus","Other Device"];
const SEED_LAB  = ["LabCorp","Quest Diagnostics","Doctor's Office","Other Lab"];
const DEF_SETTINGS = {
  ldlMethod:"martin-hopkins", apobMethod:"interheart",
  lpa:"", lpaUnit:"mg/dL", defaultSource:"POC",
  defaultDevice:"CURO L7/L5", defaultLabSource:"LabCorp",
  homeDevices:SEED_HOME, labSources:SEED_LAB, theme:"system",
  cards:["ldl","hdl","apob"],
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const fmtDate  = iso => new Date(iso).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
const fmtShort = iso => new Date(iso).toLocaleDateString("en-US",{month:"short",day:"numeric"});
const fmtMonth = iso => new Date(iso).toLocaleDateString("en-US",{month:"long",year:"numeric"});
const fmtTime  = iso => new Date(iso).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});
const parseNum = v => { if (v===""||v==null) return null; const n=parseFloat(v); return isFinite(n)?n:null; };

function rangeFilter(arr, range) {
  if (range === "All") return arr;
  const cut = Date.now() - {"30d":30,"90d":90,"1y":365}[range] * 86400000;
  return arr.filter(r => new Date(r.timestamp).getTime() >= cut);
}
function sourceFilter(arr, mode) {
  if (mode === "home") return arr.filter(r => r.source !== "Lab");
  if (mode === "lab")  return arr.filter(r => r.source === "Lab");
  return arr;
}
function biomarkerStats(rows, key, ldlMethod) {
  const vals = rows.map(r => metricValue(r,key,ldlMethod)).filter(v => v != null);
  if (!vals.length) return null;
  const desc = [...rows].sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));
  let latest = null;
  for (const r of desc) { const v = metricValue(r,key,ldlMethod); if (v!=null){ latest=v; break; } }
  const sum = vals.reduce((a,b)=>a+b,0);
  return { n:vals.length, latest, avg:+(sum/vals.length).toFixed(1),
    min:Math.min(...vals), max:Math.max(...vals) };
}

/* ── Persistence boundary: the ONLY code that touches storage. ──────────────── */
async function loadStorage() {
  let readings = [], settings = null;
  try { const r = await window.storage.get("lipidlog_readings", false); if (r) readings = JSON.parse(r.value); } catch {}
  try { const s = await window.storage.get("lipidlog_settings", false); if (s) settings = JSON.parse(s.value); } catch {}
  return { readings, settings };
}
/* window.storage is rate-limited and fails transiently, so it is treated as a
   best-effort mirror of in-memory state, never the source of truth. Every
   change funnels into one scheduler: it coalesces rapid edits (only the latest
   value per key is kept), writes keys one at a time with a gap between them,
   and on failure backs off with a long, growing delay instead of retrying
   immediately. That way a brief rate-limit can never escalate into a storm of
   failing requests, and the latest value is still written once storage frees
   up. flushPersistNow() forces an immediate write when the app is closing. */
const _pending = {};
let _flushTimer = null, _flushing = false, _backoff = 0, _onStuck = () => {};

async function _writeKey(key, val) {
  try {
    const r = await window.storage.set(key, JSON.stringify(val), false);
    // The storage API returns a result object on success and null/false on a
    // real failure. Anything else (e.g. undefined) is treated as success: a
    // call that resolved without throwing has almost certainly persisted, and
    // misreading success as failure is what previously wedged the scheduler
    // into an endless retry/back-off loop.
    return r !== null && r !== false;
  } catch { return false; }
}
async function _flush() {
  _flushTimer = null;
  if (_flushing) { _flushTimer = setTimeout(_flush, 300); return; }
  _flushing = true;
  try {
    for (const key of Object.keys(_pending)) {
      const val = _pending[key];
      const ok = await _writeKey(key, val);
      if (ok && _pending[key] === val) delete _pending[key];   // keep if a newer write queued meanwhile
      await new Promise(r => setTimeout(r, 140));               // space requests so bursts stay under the limit
    }
  } finally { _flushing = false; }
  if (Object.keys(_pending).length) {                          // still unsaved -> wait longer, then retry
    _backoff = Math.min(_backoff ? _backoff * 2 : 2500, 30000);
    _flushTimer = setTimeout(_flush, _backoff);
    if (_backoff >= 10000) _onStuck();                          // only escalate after sustained failure
  } else {
    _backoff = 0;
  }
}
function schedulePersist(key, val) {
  _pending[key] = val;
  if (!_flushTimer && !_flushing) _flushTimer = setTimeout(_flush, 600);
}
function flushPersistNow() {
  if (_flushTimer) { clearTimeout(_flushTimer); _flushTimer = null; }
  _flush();
}
function setPersistStuckHandler(fn) { _onStuck = fn; }
/* ──────────────────────────────────────────────────────────────────────────── */

/* Every field goes through this. Device names, notes and localised dates all
   contain commas in normal use, and an unquoted one silently shifts every
   later column — the file still opens, the numbers are just wrong. RFC 4180:
   quote when the value contains a comma, quote, CR or LF, and double any
   embedded quote. */
function csvCell(v) {
  if (v == null) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCSV(readings, settings) {
  const hdr = ["Timestamp","Source","Device","TC","HDL","LDL (Device)","LDL (MH)","LDL (Fried)",
    "TG","Non-HDL","ApoB","ApoB Label","TC/HDL","TG/HDL","Notes"];
  const rows = [...readings].sort((a,b)=>new Date(a.timestamp)-new Date(b.timestamp)).map(r=>{
    const d = calcDerived(r, settings.apobMethod);
    /* ISO 8601 rather than a display date: readings are stored to minute
       precision, and the old export discarded the time of day entirely. */
    return [r.timestamp, srcMeta(r.source).label, r.sourceName, r.tc, r.hdl,
      r.ldl, d.ldlMH, d.ldlFried, r.tg, d.nonHDL, d.apob, d.apobLabel,
      d.tcHdl, d.tgHdl, r.notes].map(csvCell).join(",");
  });
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([[hdr.join(","),...rows].join("\r\n")],
      {type:"text/csv;charset=utf-8"})),
    download: "lipidlog_export.csv",
  });
  a.click();
}

/* ════════════════════════════════════════════════════════════════════════════
   PRIMITIVES
   ════════════════════════════════════════════════════════════════════════════ */
function Sheet({ onClose, children, zIndex = 200 }) {
  const t = useT();
  const sheetRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const guard = useRef(false);
  const drag = useRef({ active:false, startY:0, y:0 });
  const restTimer = useRef(null);

  // Once the sheet has finished sliding in, clear its transform. A CSS
  // transform on an ancestor traps position:fixed descendants (it becomes
  // their containing block) — which would pin the number keypad to the
  // sheet instead of the screen. At rest the sheet keeps its place via
  // normal flow, so no transform is needed and fixed children anchor to
  // the viewport correctly.
  const settle = () => {
    clearTimeout(restTimer.current);
    restTimer.current = setTimeout(()=>{
      const el = sheetRef.current;
      if (el && !drag.current.active && !guard.current) el.style.transform = "none";
    }, 380);
  };

  useEffect(()=>{
    const r = requestAnimationFrame(()=>{ setMounted(true); settle(); });
    return ()=>{ cancelAnimationFrame(r); clearTimeout(restTimer.current); };
  },[]);

  const close = useCallback(()=>{
    if (guard.current) return;
    guard.current = true;
    clearTimeout(restTimer.current);
    const el = sheetRef.current;
    if (el) { el.style.transition="transform .3s cubic-bezier(.32,.72,0,1)"; el.style.transform="translateY(100%)"; }
    setMounted(false);
    setTimeout(onClose, 300);
  },[onClose]);

  const onDown = e => {
    drag.current = { active:true, startY:e.clientY, y:0 };
    clearTimeout(restTimer.current);
    const el = sheetRef.current;
    if (el) { el.style.transition="none"; el.style.transform="translateY(0)"; }
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = e => {
    if (!drag.current.active) return;
    const dy = Math.max(0, e.clientY - drag.current.startY);
    drag.current.y = dy;
    const el = sheetRef.current; if (el) el.style.transform=`translateY(${dy}px)`;
  };
  const onUp = () => {
    if (!drag.current.active) return;
    drag.current.active = false;
    if (drag.current.y > 110) { close(); return; }
    const el = sheetRef.current;
    if (el) { el.style.transition="transform .25s cubic-bezier(.32,.72,0,1)"; el.style.transform="translateY(0)"; }
    settle();
  };

  return (
    <div onClick={e => e.target===e.currentTarget && close()}
      style={{position:"fixed",inset:0,zIndex,background:t.overlay,display:"flex",
        alignItems:"flex-end",opacity:mounted?1:0,transition:"opacity .3s ease"}}>
      <div ref={sheetRef} style={{background:t.card,borderRadius:"24px 24px 0 0",width:"100%",
        maxWidth:600,maxHeight:"92vh",overflow:"auto",margin:"0 auto",
        border:`1px solid ${t.border}`,borderBottom:"none",
        transform:mounted?"translateY(0)":"translateY(100%)",
        transition:"transform .34s cubic-bezier(.32,.72,0,1)",
        paddingBottom:"env(safe-area-inset-bottom)"}}>
        <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          style={{display:"flex",justifyContent:"center",padding:"12px 0 6px",
            cursor:"grab",touchAction:"none"}}>
          <div style={{width:38,height:5,borderRadius:3,background:t.muted,opacity:.45}} />
        </div>
        {children(close)}
      </div>
    </div>
  );
}

function ConfirmDialog({ title, message, confirmLabel="Confirm", danger, onConfirm, onCancel }) {
  const t = useT();
  return (
    <div onClick={e=>e.target===e.currentTarget&&onCancel()}
      style={{position:"fixed",inset:0,zIndex:320,background:t.overlay,display:"flex",
        alignItems:"center",justifyContent:"center",padding:24,animation:"llFadeIn .18s ease forwards"}}>
      <div style={{background:t.card,borderRadius:16,padding:"22px 22px 18px",maxWidth:340,
        width:"100%",border:`1px solid ${t.border}`,animation:"llPopIn .2s cubic-bezier(.32,.72,0,1) forwards"}}>
        <div style={{fontSize:18,fontWeight:700,color:t.text,marginBottom:6}}>{title}</div>
        <div style={{fontSize:16,color:t.sec,lineHeight:1.5,marginBottom:20}}>{message}</div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onCancel} style={{flex:1,padding:"11px",borderRadius:10,
            border:`1px solid ${t.border}`,background:"transparent",color:t.text,
            fontWeight:600,fontSize:16,cursor:"pointer",fontFamily:FONT}}>Cancel</button>
          <button onClick={onConfirm} style={{flex:1,padding:"11px",borderRadius:10,border:"none",
            background:danger?t.danger:t.accent,color:danger?"#fff":t.accentText,
            fontWeight:700,fontSize:16,cursor:"pointer",fontFamily:FONT}}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function InputDialog({ title, placeholder, initial="", confirmLabel="Save", validate, onConfirm, onCancel }) {
  const t = useT();
  const [val, setVal] = useState(initial);
  const [err, setErr] = useState("");
  const submit = () => {
    const e = validate ? validate(val.trim()) : null;
    if (e) { setErr(e); return; }
    onConfirm(val.trim());
  };
  return (
    <div onClick={e=>e.target===e.currentTarget&&onCancel()}
      style={{position:"fixed",inset:0,zIndex:320,background:t.overlay,display:"flex",
        alignItems:"center",justifyContent:"center",padding:24,animation:"llFadeIn .18s ease forwards"}}>
      <div style={{background:t.card,borderRadius:16,padding:"22px",maxWidth:340,width:"100%",
        border:`1px solid ${t.border}`,animation:"llPopIn .2s cubic-bezier(.32,.72,0,1) forwards"}}>
        <div style={{fontSize:18,fontWeight:700,color:t.text,marginBottom:14}}>{title}</div>
        <input autoFocus value={val} placeholder={placeholder}
          onChange={e=>{setVal(e.target.value);setErr("");}}
          onKeyDown={e=>e.key==="Enter"&&submit()}
          style={{width:"100%",padding:"11px 13px",borderRadius:9,fontSize:17,boxSizing:"border-box",
            border:`1px solid ${err?t.danger:t.border}`,background:t.bg,color:t.text,
            outline:"none",fontFamily:FONT,marginBottom:err?6:16}} />
        {err && <div style={{fontSize:14,color:t.danger,marginBottom:14}}>{err}</div>}
        <div style={{display:"flex",gap:10}}>
          <button onClick={onCancel} style={{flex:1,padding:"11px",borderRadius:10,
            border:`1px solid ${t.border}`,background:"transparent",color:t.text,
            fontWeight:600,fontSize:16,cursor:"pointer",fontFamily:FONT}}>Cancel</button>
          <button onClick={submit} style={{flex:1,padding:"11px",borderRadius:10,border:"none",
            background:t.accent,color:t.accentText,fontWeight:700,fontSize:16,
            cursor:"pointer",fontFamily:FONT}}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function Toast({ message }) {
  const t = useT();
  return (
    <div style={{position:"fixed",bottom:96,left:"50%",transform:"translateX(-50%)",zIndex:400,
      background:t.isDark?"#FAFAFA":"#18181B",color:t.isDark?"#18181B":"#FAFAFA",
      padding:"10px 18px",borderRadius:10,fontSize:15.5,fontWeight:600,fontFamily:FONT,
      boxShadow:"0 8px 28px rgba(0,0,0,0.35)",animation:"llFadeIn .2s ease forwards",
      maxWidth:"calc(100% - 32px)",textAlign:"center"}}>{message}</div>
  );
}

/* Source badge: coloured Home / Lab tag. */
function SourceBadge({ source }) {
  const m = srcMeta(source);
  return (
    <span style={{background:`${m.color}1F`,color:m.color,borderRadius:5,padding:"2px 7px",
      fontSize:13,fontWeight:700,letterSpacing:"0.3px"}}>{m.label}</span>
  );
}

function Pill({ label, active, color, onClick, sm, disabled }) {
  const t = useT();
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: sm ? "5px 11px" : "6px 13px", borderRadius:7,
      border: `1px solid ${active ? (sm?color:t.accent) : t.border}`,
      background: active ? (sm ? `${color}1F` : t.accent) : "transparent",
      color: active ? (sm ? color : t.accentText) : t.sec,
      fontSize: sm ? 11.5 : 12.5, fontWeight: active ? 600 : 500,
      cursor: disabled ? "default" : "pointer", fontFamily:FONT,
      opacity: disabled ? 0.28 : 1, transition:"all .12s",
    }}>{label}</button>
  );
}
/* Compact segmented control (source filter, range). */
function Segmented({ options, value, onChange }) {
  const t = useT();
  return (
    <div style={{display:"inline-flex",border:`1px solid ${t.border}`,borderRadius:8,
      overflow:"hidden",background:t.bg}}>
      {options.map((o,i)=>{
        const v = typeof o==="string"?o:o.value;
        const lbl = typeof o==="string"?o:o.label;
        const on = v===value;
        return (
          <button key={v} onClick={()=>onChange(v)} style={{padding:"5px 10px",border:"none",
            cursor:"pointer",fontFamily:FONT,fontSize:13.5,fontWeight:on?700:500,
            background:on?t.accent:"transparent",color:on?t.accentText:t.sec,
            borderLeft:i>0?`1px solid ${t.border}`:"none"}}>{lbl}</button>
        );
      })}
    </div>
  );
}

function Divider() { const t = useT(); return <div style={{height:1,background:t.border,margin:"0 16px"}} />; }

function SheetHeader({ title, onClose }) {
  const t = useT();
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0 16px"}}>
      <h2 style={{fontSize:19,fontWeight:700,margin:0,color:t.text}}>{title}</h2>
      <button onClick={onClose} aria-label="Close" style={{background:t.cardHi,
        border:`1px solid ${t.border}`,borderRadius:18,width:30,height:30,display:"flex",
        alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
        <X size={15} color={t.sec} />
      </button>
    </div>
  );
}
function SectionLabel({ children }) {
  const t = useT();
  return <div style={{fontSize:13,fontWeight:600,color:t.sec,textTransform:"uppercase",
    letterSpacing:"0.6px",margin:"22px 4px 8px"}}>{children}</div>;
}

/* ── Custom date & time picker (replaces the native control) ────────────────── */
const DOW = ["S","M","T","W","T","F","S"];
const parseDT = s => {
  const dt = new Date();
  if (s && s.includes("T")) {
    const [d,tm] = s.split("T");
    const [y,mo,da] = d.split("-").map(Number);
    const [h,mi] = tm.split(":").map(Number);
    if (y) dt.setFullYear(y,(mo||1)-1,da||1);
    if (h!=null) { dt.setHours(h); dt.setMinutes(mi||0); }
  }
  dt.setSeconds(0,0);
  return dt;
};
const fmtDT = dt => { const p=n=>String(n).padStart(2,"0");
  return `${dt.getFullYear()}-${p(dt.getMonth()+1)}-${p(dt.getDate())}T${p(dt.getHours())}:${p(dt.getMinutes())}`; };

function Stepper({ value, onUp, onDown }) {
  const t = useT();
  const btn = { background:t.cardHi,border:`1px solid ${t.border}`,cursor:"pointer",padding:0,
    width:26,height:30,display:"flex",alignItems:"center",justifyContent:"center",color:t.sec };
  return (
    <div style={{display:"flex",alignItems:"center"}}>
      <button onClick={onDown} aria-label="Decrease" style={{...btn,borderRadius:"7px 0 0 7px"}}>
        <ChevronRight size={13} style={{transform:"rotate(180deg)"}} /></button>
      <div style={{fontSize:17,fontWeight:600,fontFamily:MONO,color:t.text,minWidth:36,height:30,
        display:"flex",alignItems:"center",justifyContent:"center",
        borderTop:`1px solid ${t.border}`,borderBottom:`1px solid ${t.border}`}}>{value}</div>
      <button onClick={onUp} aria-label="Increase" style={{...btn,borderRadius:"0 7px 7px 0"}}>
        <ChevronRight size={13} /></button>
    </div>
  );
}

function DateTimePicker({ value, onChange }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const dt = parseDT(value);
  const [view, setView] = useState({ y:dt.getFullYear(), m:dt.getMonth() });

  const apply = nd => { nd.setSeconds(0,0); onChange(fmtDT(nd)); };
  const pickDay = d => { const nd=new Date(dt); nd.setFullYear(view.y,view.m,d); apply(nd); };
  const shiftMonth = delta => setView(v=>{ const d=new Date(v.y,v.m+delta,1); return {y:d.getFullYear(),m:d.getMonth()}; });
  const stepHour = delta => { const nd=new Date(dt); nd.setHours((nd.getHours()+delta+24)%24); apply(nd); };
  const stepMin  = delta => { const nd=new Date(dt); nd.setMinutes((nd.getMinutes()+delta+60)%60); apply(nd); };
  const setAmPm = pm => { const nd=new Date(dt); const h=nd.getHours();
    if (pm && h<12) nd.setHours(h+12); if (!pm && h>=12) nd.setHours(h-12); apply(nd); };

  const startDow = new Date(view.y,view.m,1).getDay();
  const dayCount = new Date(view.y,view.m+1,0).getDate();
  const cells = [...Array(startDow).fill(null), ...Array.from({length:dayCount},(_,i)=>i+1)];
  const isToday = d => { const n=new Date();
    return n.getFullYear()===view.y && n.getMonth()===view.m && n.getDate()===d; };
  const isSel = d => dt.getFullYear()===view.y && dt.getMonth()===view.m && dt.getDate()===d;
  const h12 = ((dt.getHours()+11)%12)+1;
  const pm = dt.getHours()>=12;

  const field = { width:"100%",padding:"10px 12px",borderRadius:8,boxSizing:"border-box",
    border:`1px solid ${open?t.accent:t.border}`,background:t.bg,fontSize:17,
    fontFamily:FONT,color:t.text,cursor:"pointer",display:"flex",transition:"border-color .2s",
    justifyContent:"space-between",alignItems:"center" };
  const navBtn = { background:t.cardHi,border:`1px solid ${t.border}`,borderRadius:7,
    width:26,height:26,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" };

  return (
    <div>
      <div onClick={()=>setOpen(o=>!o)} style={field}>
        <span>{fmtDate(dt.toISOString())} · {fmtTime(dt.toISOString())}</span>
        <ChevronDown size={15} color={t.sec}
          style={{transform:open?"rotate(180deg)":"none",transition:"transform .2s"}} />
      </div>
      <div style={{display:"grid",gridTemplateRows:open?"1fr":"0fr",
        transition:"grid-template-rows .24s cubic-bezier(.32,.72,0,1)"}}>
        <div style={{overflow:"hidden",minHeight:0}}>
          <div style={{marginTop:8,border:`1px solid ${t.border}`,borderRadius:13,
            background:t.card,padding:"10px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <button onClick={()=>shiftMonth(-1)} aria-label="Previous month" style={navBtn}>
                <ChevronRight size={13} color={t.sec} style={{transform:"rotate(180deg)"}} />
              </button>
              <span style={{fontSize:15,fontWeight:700,color:t.text}}>
                {new Date(view.y,view.m,1).toLocaleDateString("en-US",{month:"long",year:"numeric"})}</span>
              <button onClick={()=>shiftMonth(1)} aria-label="Next month" style={navBtn}>
                <ChevronRight size={13} color={t.sec} />
              </button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
              {DOW.map((d,i)=>(
                <div key={i} style={{textAlign:"center",fontSize:12,fontWeight:600,color:t.muted,
                  padding:"0 0 3px"}}>{d}</div>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
              {cells.map((d,i)=>(
                <div key={i} style={{height:28}}>
                  {d && (
                    <button onClick={()=>pickDay(d)} style={{width:"100%",height:"100%",border:"none",
                      cursor:"pointer",fontFamily:MONO,fontSize:14,borderRadius:6,
                      background:isSel(d)?t.accent:"transparent",
                      color:isSel(d)?t.accentText:t.text,
                      fontWeight:isSel(d)||isToday(d)?700:400,
                      outline:isToday(d)&&!isSel(d)?`1px solid ${t.borderHi}`:"none",
                      outlineOffset:"-1px"}}>{d}</button>
                  )}
                </div>
              ))}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginTop:10,paddingTop:10,
              borderTop:`1px solid ${t.border}`,justifyContent:"center"}}>
              <Stepper value={h12} onUp={()=>stepHour(1)} onDown={()=>stepHour(-1)} />
              <span style={{fontSize:17,fontWeight:700,color:t.muted}}>:</span>
              <Stepper value={String(dt.getMinutes()).padStart(2,"0")}
                onUp={()=>stepMin(1)} onDown={()=>stepMin(-1)} />
              <div style={{display:"flex",border:`1px solid ${t.border}`,borderRadius:7,overflow:"hidden"}}>
                {["AM","PM"].map(x=>{
                  const on=(x==="PM")===pm;
                  return (
                    <button key={x} onClick={()=>setAmPm(x==="PM")} style={{padding:"7px 10px",border:"none",
                      cursor:"pointer",fontFamily:FONT,fontSize:13.5,fontWeight:on?700:500,
                      background:on?t.accent:"transparent",color:on?t.accentText:t.sec}}>{x}</button>
                  );
                })}
              </div>
            </div>
            <div style={{display:"flex",gap:8,marginTop:10}}>
              <button onClick={()=>{ apply(new Date()); setView({y:new Date().getFullYear(),m:new Date().getMonth()}); }}
                style={{flex:1,padding:"7px",borderRadius:8,border:`1px solid ${t.border}`,
                  background:"transparent",color:t.text,fontWeight:600,fontSize:14.5,
                  cursor:"pointer",fontFamily:FONT}}>Now</button>
              <button onClick={()=>setOpen(false)}
                style={{flex:1,padding:"7px",borderRadius:8,border:"none",background:t.accent,
                  color:t.accentText,fontWeight:700,fontSize:14.5,cursor:"pointer",fontFamily:FONT}}>Done</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Chart tooltip ──────────────────────────────────────────────────────────── */
function ChartTooltip({ active, payload, label, bmA, bmB }) {
  const t = useT();
  if (!active || !payload?.length) return null;
  const a = BM(bmA), b = BM(bmB);
  const av = payload.find(p=>p.dataKey===bmA), bv = payload.find(p=>p.dataKey===bmB);
  const src = payload[0]?.payload?.source;
  return (
    <div style={{background:t.card,border:`1px solid ${t.borderHi}`,borderRadius:9,
      padding:"8px 11px",boxShadow:"0 6px 24px rgba(0,0,0,0.35)",fontFamily:FONT,pointerEvents:"none"}}>
      <div style={{fontSize:12.5,color:t.sec,textTransform:"uppercase",letterSpacing:".4px",
        marginBottom:6}}>
        {fmtDate(label)}
        {src && <span> · {src === "mixed" ? "Averaged" : srcMeta(src).label}</span>}
      </div>
      {av?.value!=null && (
        <div style={{display:"flex",alignItems:"baseline",gap:4,marginBottom:bv?4:0}}>
          <span style={{fontSize:19,fontWeight:600,color:a?.color,fontFamily:MONO}}>{av.value}</span>
          <span style={{fontSize:13,color:t.sec}}>{a?.label}</span>
        </div>
      )}
      {bv?.value!=null && (
        <div style={{display:"flex",alignItems:"baseline",gap:4}}>
          <span style={{fontSize:19,fontWeight:600,color:b?.color,fontFamily:MONO}}>{bv.value}</span>
          <span style={{fontSize:13,color:t.sec}}>{b?.label}</span>
        </div>
      )}
    </div>
  );
}

/* ── Reading row (typography pass; consistent metric weights) ───────────────── */
const ReadingRow = function ReadingRow({ reading, ldlMethod, onSelect }) {
  const t = useT();
  const ldl = getDispLDL(reading, reading.d, ldlMethod);
  const Metric = ({ label, value }) => (
    <span style={{display:"inline-flex",alignItems:"baseline",gap:5}}>
      <span style={{fontSize:12.5,fontWeight:600,color:t.muted,letterSpacing:"0.4px"}}>{label}</span>
      <span style={{fontSize:17,fontWeight:600,color:t.text,fontFamily:MONO,
        fontVariantNumeric:"tabular-nums"}}>{value}</span>
    </span>
  );
  return (
    <div onClick={() => onSelect(reading)}
      onMouseEnter={e=>e.currentTarget.style.background=t.cardHi}
      onMouseLeave={e=>e.currentTarget.style.background="transparent"}
      style={{padding:"14px 16px",cursor:"pointer",display:"flex",alignItems:"center",
        justifyContent:"space-between",gap:10,transition:"background .1s"}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
          <SourceBadge source={reading.source} />
          <span style={{fontSize:14.5,color:t.sec}}>{fmtDate(reading.timestamp)}</span>
          {reading.sourceName && (
            <span style={{fontSize:13.5,color:t.muted,overflow:"hidden",whiteSpace:"nowrap",
              textOverflow:"ellipsis"}}>· {reading.sourceName}</span>
          )}
        </div>
        <div style={{display:"flex",gap:18,flexWrap:"wrap",alignItems:"baseline"}}>
          {ldl && <Metric label="LDL" value={ldl.value} />}
          {reading.hdl!=null && <Metric label="HDL" value={reading.hdl} />}
          {reading.tc!=null && <Metric label="TC" value={reading.tc} />}
          {reading.d.apob!=null && <Metric label="ApoB" value={reading.d.apob} />}
        </div>
        {reading.notes && (
          <div style={{fontSize:13.5,color:t.muted,marginTop:7,overflow:"hidden",
            whiteSpace:"nowrap",textOverflow:"ellipsis",maxWidth:280}}>{reading.notes}</div>
        )}
      </div>
      <ChevronRight size={15} color={t.muted} strokeWidth={2} style={{flexShrink:0}} />
    </div>
  );
};

/* ── Reading detail (sheet content) ─────────────────────────────────────────── */
function ReadingDetail({ reading, settings, onClose, onEdit, onDelete }) {
  const t = useT();
  const [confirm, setConfirm] = useState(false);
  const d = reading.d;
  const ldl = getDispLDL(reading, d, settings.ldlMethod);
  const metrics = [
    ldl && { key:"ldl", label:`LDL-C (${ldl.label})`, value:ldl.value, unit:"mg/dL", color:"#DF3F2E" },
    reading.ldl!=null && settings.ldlMethod!=="none" && !ldl?.blocked && {
      label:"LDL-C (Device Reported)", value:reading.ldl, unit:"mg/dL", color:t.sec, sm:true },
    d.ldlDelta!=null && settings.ldlMethod==="martin-hopkins" && {
      label:"Martin-Hopkins − Device", value:(d.ldlDelta>=0?"+":"")+d.ldlDelta, unit:"mg/dL", color:t.sec, sm:true },
    reading.hdl!=null && { key:"hdl", label:"HDL-C", value:reading.hdl, unit:"mg/dL", color:"#1B9E5A" },
    reading.tc !=null && { key:"tc",  label:"Total Cholesterol", value:reading.tc, unit:"mg/dL", color:"#2E6FE0" },
    reading.tg !=null && { key:"tg",  label:"Triglycerides", value:reading.tg, unit:"mg/dL", color:"#DC8A1E" },
    d.nonHDL   !=null && { key:"nonHDL", label:"Non-HDL Cholesterol", value:d.nonHDL, unit:"mg/dL", color:t.text },
    d.apob     !=null && { key:"apob", label:`ApoB (${d.apobLabel})`, value:d.apob, unit:"mg/dL", color:"#7B4FD4" },
    d.tcHdl    !=null && { key:"tcHdl", label:"TC/HDL Ratio", value:d.tcHdl, unit:"", color:"#128591" },
    d.tgHdl    !=null && { key:"tgHdl", label:"TG/HDL Ratio", value:d.tgHdl, unit:"", color:"#C2417E" },
  ].filter(Boolean);
  return (
    <div style={{padding:"4px 20px 28px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"8px 0 16px"}}>
        <div>
          <div style={{fontSize:19,fontWeight:700,color:t.text}}>{fmtDate(reading.timestamp)}</div>
          <div style={{fontSize:14.5,color:t.sec,marginTop:4,display:"flex",alignItems:"center",gap:7}}>
            <SourceBadge source={reading.source} />{reading.sourceName} · {fmtTime(reading.timestamp)}
          </div>
        </div>
        <button onClick={onClose} aria-label="Close" style={{background:t.cardHi,
          border:`1px solid ${t.border}`,borderRadius:18,width:30,height:30,display:"flex",
          alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
          <X size={15} color={t.sec} />
        </button>
      </div>
      <div style={{borderRadius:13,overflow:"hidden",border:`1px solid ${t.border}`}}>
        {metrics.map((m,i)=>(
          <div key={i} style={{padding:m.sm?"8px 14px":"11px 14px",
            borderBottom:i<metrics.length-1?`1px solid ${t.border}`:"none",
            display:"flex",justifyContent:"space-between",alignItems:m.sm?"center":"flex-start",
            gap:12,background:m.sm?t.bg:t.card}}>
            <span style={{fontSize:m.sm?11.5:13.5,color:m.sm?t.sec:t.text,paddingTop:m.sm?0:1}}>{m.label}</span>
            <div style={{textAlign:"right",flexShrink:0}}>
              <span style={{fontSize:m.sm?13:16,fontWeight:600,color:m.color,fontFamily:MONO,
                fontVariantNumeric:"tabular-nums"}}>{m.value}{m.unit?` ${m.unit}`:""}</span>
              {!m.sm && m.key && REF_RANGES[m.key] && (
                <div style={{fontSize:13,color:t.muted,marginTop:2,fontFamily:FONT}}>{REF_RANGES[m.key]}</div>
              )}
            </div>
          </div>
        ))}
      </div>
      {ldl?.blocked && (
        <div style={{marginTop:10,padding:"10px 13px",background:t.bg,borderRadius:11,
          border:`1px dashed ${t.border}`,fontSize:13.5,color:t.sec,lineHeight:1.5}}>
          {ldl.blockedReason}
        </div>
      )}
      <div style={{fontSize:13,color:t.muted,margin:"7px 4px 0"}}>
        Reference values are general guidance, not a diagnosis.
      </div>
      {settings.lpa && (
        <div style={{marginTop:12,padding:"11px 14px",background:t.bg,borderRadius:13,
          border:`1px dashed ${t.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:14.5,color:t.text}}>Lp(a)</div>
            <div style={{fontSize:13,color:t.muted,marginTop:1}}>Genetic baseline · persistent</div>
          </div>
          <span style={{fontSize:17,fontWeight:600,color:t.text,fontFamily:MONO}}>
            {settings.lpa} {settings.lpaUnit}</span>
        </div>
      )}
      {reading.notes && (
        <div style={{marginTop:12,padding:"11px 14px",background:t.bg,borderRadius:13,border:`1px solid ${t.border}`}}>
          <div style={{fontSize:13,fontWeight:600,color:t.sec,letterSpacing:".4px",
            textTransform:"uppercase",marginBottom:5}}>Notes</div>
          <div style={{fontSize:15.5,color:t.text,lineHeight:1.55}}>{reading.notes}</div>
        </div>
      )}
      <div style={{display:"flex",gap:10,marginTop:16}}>
        <button onClick={onEdit} style={{flex:1,padding:"12px",borderRadius:10,border:"none",
          cursor:"pointer",background:t.accent,color:t.accentText,fontWeight:700,fontSize:17,fontFamily:FONT}}>
          Edit</button>
        <button onClick={()=>setConfirm(true)} style={{flex:1,padding:"12px",borderRadius:10,fontFamily:FONT,
          cursor:"pointer",background:t.dangerBg,color:t.danger,border:`1px solid ${t.danger}33`,
          fontWeight:600,fontSize:17,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
          <Trash2 size={14} /> Delete</button>
      </div>
      {confirm && (
        <ConfirmDialog title="Delete this reading?"
          message={`The reading from ${fmtDate(reading.timestamp)} will be permanently removed.`}
          confirmLabel="Delete" danger
          onConfirm={()=>{ setConfirm(false); onDelete(); }}
          onCancel={()=>setConfirm(false)} />
      )}
    </div>
  );
}

/* ── Select sheet (drill-in picker) ─────────────────────────────────────────── */
function SelectSheet({ title, options, current, onSelect, onClose, footer }) {
  const t = useT();
  return (
    <div style={{padding:"4px 20px 28px"}}>
      <SheetHeader title={title} onClose={onClose} />
      <div style={{borderRadius:13,overflow:"hidden",border:`1px solid ${t.border}`}}>
        {options.map((o,i)=>(
          <div key={o.value} onClick={()=>onSelect(o.value)}
            onMouseEnter={e=>e.currentTarget.style.background=t.cardHi}
            onMouseLeave={e=>e.currentTarget.style.background=t.card}
            style={{padding:"13px 15px",cursor:"pointer",display:"flex",justifyContent:"space-between",
              alignItems:"center",gap:12,background:t.card,transition:"background .1s",
              borderBottom:i<options.length-1?`1px solid ${t.border}`:"none"}}>
            <div>
              <div style={{fontSize:16.5,color:t.text,fontWeight:o.value===current?700:500}}>{o.label}</div>
              {o.sub && <div style={{fontSize:13.5,color:t.sec,marginTop:2}}>{o.sub}</div>}
            </div>
            {o.value===current && <Check size={17} color={t.text} style={{flexShrink:0}} />}
          </div>
        ))}
      </div>
      {footer && (
        <div style={{marginTop:14,padding:"12px 14px",background:t.bg,borderRadius:10,
          border:`1px solid ${t.border}`}}>
          <div style={{fontSize:13,fontWeight:600,color:t.sec,letterSpacing:".4px",
            textTransform:"uppercase",marginBottom:6}}>How these work</div>
          <div style={{fontSize:14,color:t.sec,lineHeight:1.6}}>{footer}</div>
        </div>
      )}
    </div>
  );
}

/* ── In-app numeric keypad (replaces the native mobile keyboard) ────────────── */
function NumberPadSheet({ fields, values, activeKey, setActiveKey, onInput, onClose }) {
  const t = useT();
  const [mounted, setMounted] = useState(false);
  useEffect(()=>{ const r=requestAnimationFrame(()=>setMounted(true)); return ()=>cancelAnimationFrame(r); },[]);

  const idx = Math.max(0, fields.findIndex(f=>f.key===activeKey));
  const field = fields[idx];
  const val = String(values[field.key] ?? "");

  const close = () => { setMounted(false); setTimeout(onClose, 240); };
  const press = key => {
    let v = String(values[field.key] ?? "");
    if (key==="del") v = v.slice(0,-1);
    else if (key===".") { if (!v.includes(".")) v = v===""?"0.":v+"."; }
    else { if (v.replace(".","").length>=6) return; v = v + key; }
    onInput(field.key, v);
  };
  const goNext = () => idx<fields.length-1 ? setActiveKey(fields[idx+1].key) : close();
  const goPrev = () => { if (idx>0) setActiveKey(fields[idx-1].key); };

  /* On desktop the on-screen keypad still shows, but a physical keyboard
     should drive it directly. The handler is kept in a ref so the window
     listener (attached once) always runs against the current field. */
  const keyHandler = useRef();
  keyHandler.current = e => {
    const k = e.key;
    if (/^[0-9]$/.test(k))            { e.preventDefault(); press(k); }
    else if (k==="." || k===",")      { e.preventDefault(); press("."); }
    else if (k==="Backspace"||k==="Delete") { e.preventDefault(); press("del"); }
    else if (k==="Enter")             { e.preventDefault(); goNext(); }
    else if (k==="Tab")               { e.preventDefault(); e.shiftKey ? goPrev() : goNext(); }
    else if (k==="Escape")            { e.preventDefault(); close(); }
  };
  useEffect(()=>{
    const onKey = e => keyHandler.current?.(e);
    window.addEventListener("keydown", onKey);
    return ()=>window.removeEventListener("keydown", onKey);
  },[]);

  const KEYS = ["1","2","3","4","5","6","7","8","9",".","0","del"];
  const keyBtn = { border:`1px solid ${t.border}`,background:t.bg,borderRadius:11,height:52,
    fontSize:23,fontWeight:600,fontFamily:MONO,color:t.text,cursor:"pointer",
    display:"flex",alignItems:"center",justifyContent:"center" };

  return (
    <div onClick={e=>e.target===e.currentTarget&&close()}
      style={{position:"fixed",inset:0,zIndex:230,display:"flex",
        alignItems:"flex-end",justifyContent:"center",background:"transparent"}}>
      <div style={{width:"100%",maxWidth:600,background:t.card,borderRadius:"22px 22px 0 0",
        border:`1px solid ${t.border}`,borderBottom:"none",
        boxShadow:"0 -14px 44px rgba(0,0,0,0.32)",
        padding:"14px 16px calc(14px + env(safe-area-inset-bottom))",
        transform:mounted?"translateY(0)":"translateY(100%)",
        transition:"transform .3s cubic-bezier(.32,.72,0,1)"}}>
        <div style={{position:"relative",marginBottom:14}}>
          <button onClick={close} style={{position:"absolute",top:0,right:0,padding:"6px 10px",
            borderRadius:8,border:"none",background:"transparent",color:t.sec,fontWeight:600,
            fontSize:15,cursor:"pointer",fontFamily:FONT}}>Done</button>
          <div style={{textAlign:"center",paddingTop:4}}>
            <div style={{fontSize:13.5,color:t.sec,fontWeight:600,letterSpacing:".3px"}}>{field.label}</div>
            <div style={{fontSize:44,fontWeight:700,fontFamily:MONO,color:t.text,lineHeight:1.1,
              marginTop:3}}>
              {val===""?<span style={{color:t.muted}}>0</span>:val}
              <span style={{fontSize:16,color:t.muted,marginLeft:7,fontFamily:FONT,fontWeight:500}}>mg/dL</span>
            </div>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:7,marginBottom:9}}>
          {KEYS.map(k=>(
            <button key={k} onClick={()=>press(k)} style={keyBtn} aria-label={k==="del"?"Delete":k}>
              {k==="del" ? <Delete size={20} color={t.sec} /> : k}
            </button>
          ))}
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={goPrev} disabled={idx<=0}
            style={{flex:1,padding:"11px",borderRadius:10,border:`1px solid ${t.border}`,
              background:"transparent",color:t.text,fontWeight:600,fontSize:15.5,fontFamily:FONT,
              cursor:idx<=0?"default":"pointer",opacity:idx<=0?.35:1}}>‹ Previous</button>
          <button onClick={goNext}
            style={{flex:1,padding:"11px",borderRadius:10,border:"none",background:t.accent,
              color:t.accentText,fontWeight:700,fontSize:15.5,fontFamily:FONT,cursor:"pointer"}}>
            {idx<fields.length-1 ? "Next ›" : "Done"}</button>
        </div>
      </div>
    </div>
  );
}

/* ── Add / edit (sheet content) ─────────────────────────────────────────────── */
function AddEditModal({ reading, settings, onSave, onClose }) {
  const t = useT();
  const localNow = fmtDT(new Date());
  const homeDevices = settings.homeDevices?.length ? settings.homeDevices : SEED_HOME;
  const labSources  = settings.labSources?.length  ? settings.labSources  : SEED_LAB;
  const poolFor    = src => src==="POC" ? homeDevices : labSources;
  const defaultFor = src => src==="POC" ? settings.defaultDevice : settings.defaultLabSource;
  /* Resolve the source name for a given type: keep it only if it belongs to
     that type's pool, otherwise fall back to that pool's default. A home
     device must never end up labelling a lab reading, or vice versa. */
  const nameFor = (src, want) => {
    const pool = poolFor(src);
    if (want && pool.includes(want)) return want;
    const def = defaultFor(src);
    return pool.includes(def) ? def : pool[0];
  };
  const initSource = reading?.source ?? settings.defaultSource ?? "POC";
  const [f, setF] = useState({
    timestamp: reading ? fmtDT(new Date(reading.timestamp)) : localNow,
    source: initSource,
    sourceName: nameFor(initSource, reading?.sourceName),
    tc:reading?.tc??"", hdl:reading?.hdl??"", ldl:reading?.ldl??"", tg:reading?.tg??"",
    apobMeasured:reading?.apobMeasured??"", notes:reading?.notes??"",
  });
  const [errors,setErrors] = useState([]);
  const [warnings,setWarnings] = useState([]);
  const [devicePicker,setDevicePicker] = useState(false);
  const [padField,setPadField] = useState(null);
  const [pendingSave,setPendingSave] = useState(null);
  const set = (k,v) => setF(p=>({...p,[k]:v}));
  /* Switching source type re-points the name field at the matching pool. */
  const setSource = src => setF(p=> p.source===src ? p
    : ({...p, source:src, sourceName:nameFor(src, p.sourceName)}));
  const numFields = [
    {key:"tc",label:"Total Cholesterol"},
    {key:"hdl",label:"HDL"},
    {key:"ldl",label:"LDL (Device Reported)"},
    {key:"tg",label:"Triglycerides"},
    ...(f.source==="Lab" ? [{key:"apobMeasured",label:"ApoB (Lab Measured)"}] : []),
  ];

  const preview = useMemo(()=>{
    const r = {...f, tc:parseNum(f.tc), hdl:parseNum(f.hdl), ldl:parseNum(f.ldl),
      tg:parseNum(f.tg), apobMeasured:parseNum(f.apobMeasured)};
    const d = calcDerived(r, settings.apobMethod);
    return { d, ldl:getDispLDL(r,d,settings.ldlMethod) };
  },[f,settings]);

  const buildPayload = () => ({
    timestamp:new Date(f.timestamp).toISOString(), source:f.source, sourceName:f.sourceName,
    tc:parseNum(f.tc), hdl:parseNum(f.hdl), ldl:parseNum(f.ldl), tg:parseNum(f.tg),
    apobMeasured:f.source==="Lab"?parseNum(f.apobMeasured):null, notes:f.notes.trim().slice(0,300),
  });

  const handleSave = () => {
    const errs=[], warns=[];
    const vals = [parseNum(f.tc),parseNum(f.hdl),parseNum(f.ldl),parseNum(f.tg)];
    if (vals.every(v=>v==null)) errs.push("Enter at least one lipid value (TC, HDL, LDL, or TG).");
    vals.forEach((v,i)=>{ if (v!==null && v<0) errs.push(`${["TC","HDL","LDL","TG"][i]} cannot be negative.`); });
    if (parseNum(f.hdl)===0) errs.push("HDL cannot be 0.");
    if (new Date(f.timestamp).getTime() > Date.now()+60000) warns.push("The date and time are in the future.");
    /* Lab-measured ApoB is only collected for Lab sources, so it is only
       range-checked there. */
    [["tc","TC",80,500],["hdl","HDL",10,150],["ldl","LDL",20,400],["tg","TG",20,1000],
     ...(f.source==="Lab" ? [["apobMeasured","ApoB",20,250]] : [])].forEach(([k,label,lo,hi])=>{
      const v = parseNum(f[k]);
      if (v!==null && (v<lo||v>hi)) warns.push(`${label} of ${v} is ${v<lo?"below":"above"} the typical range (${lo}-${hi} mg/dL).`);
    });
    const tcv = parseNum(f.tc), hdlv = parseNum(f.hdl);
    if (tcv!=null && hdlv!=null && hdlv >= tcv)
      warns.push("HDL is at or above total cholesterol, which isn't physiologically possible. Non-HDL cholesterol and estimated ApoB can't be derived from this reading.");
    // Neither LDL estimate is valid this high, so say so at entry rather than
    // letting the reading land and silently show a device value instead.
    const tgv = parseNum(f.tg);
    if (tgv!=null && tgv >= TG_CALC_MAX)
      warns.push(`Triglycerides of ${tgv} mg/dL are at or above ${TG_CALC_MAX} mg/dL. Neither Friedewald nor Martin-Hopkins is valid there, so this reading will show the reported LDL rather than a calculated one.`);
    setErrors(errs); setWarnings(warns);
    if (errs.length) return;
    // Out-of-range values are allowed, but confirmed first: a stray digit
    // (e.g. 1111 instead of 111) is caught before it lands in the record.
    if (warns.length) { setPendingSave(buildPayload()); return; }
    onSave(buildPayload());
  };

  const iS = { width:"100%",padding:"11px 13px",borderRadius:9,border:`1px solid ${t.border}`,
    background:t.bg,fontSize:17,outline:"none",boxSizing:"border-box",fontFamily:FONT,color:t.text };
  const lS = { fontSize:14.5,fontWeight:500,color:t.sec,display:"block",marginBottom:6 };
  const noWheel = e => e.currentTarget.blur();

  return (
    <div>
      <div style={{padding:"4px 22px 0"}}>
        <SheetHeader title={reading?"Edit Reading":"New Reading"} onClose={onClose} />
        {errors.length>0 && (
          <div style={{background:t.dangerBg,border:`1px solid ${t.danger}44`,borderRadius:9,
            padding:"10px 14px",marginBottom:14}}>
            {errors.map((e,i)=><div key={i} style={{fontSize:14.5,color:t.danger}}>{e}</div>)}
          </div>
        )}
        {warnings.length>0 && (
          <div style={{background:t.warnBg,border:`1px solid ${t.warn}44`,borderRadius:9,
            padding:"10px 14px",marginBottom:14}}>
            <div style={{fontSize:13.5,fontWeight:600,color:t.warn,marginBottom:3}}>Heads up: you can still save</div>
            {warnings.map((w,i)=><div key={i} style={{fontSize:14.5,color:t.warn}}>{w}</div>)}
          </div>
        )}
        <div style={{display:"flex",flexDirection:"column",gap:15}}>
          <div>
            <label style={lS}>Date &amp; Time</label>
            <DateTimePicker value={f.timestamp} onChange={v=>set("timestamp",v)} />
          </div>
          <div>
            <label style={lS}>Source</label>
            <div style={{display:"flex",gap:8}}>
              {[["POC","Home Test"],["Lab","Lab Test"]].map(([v,lbl])=>(
                <button key={v} onClick={()=>setSource(v)} style={{flex:1,padding:"11px",borderRadius:9,
                  fontFamily:FONT,fontWeight:600,fontSize:16,cursor:"pointer",
                  border:`1px solid ${f.source===v?t.accent:t.border}`,
                  background:f.source===v?t.accent:t.bg,
                  color:f.source===v?t.accentText:t.sec}}>{lbl}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={lS}>{f.source==="POC" ? "Device" : "Lab / Provider"}</label>
            <div onClick={()=>setDevicePicker(true)} style={{...iS,cursor:"pointer",display:"flex",
              justifyContent:"space-between",alignItems:"center"}}>
              <span>{f.sourceName}</span>
              <ChevronRight size={15} color={t.sec} />
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {[["tc","Total Cholesterol"],["hdl","HDL"],["ldl","LDL (Device Reported)"],["tg","Triglycerides"]].map(([k,lbl])=>(
              <div key={k}>
                <label style={lS}>{lbl}</label>
                <div onClick={()=>setPadField(k)} style={{padding:"11px 13px",borderRadius:9,
                  border:`1px solid ${padField===k?t.accent:t.border}`,background:t.bg,fontSize:17,
                  fontFamily:FONT,cursor:"pointer",minHeight:43,display:"flex",alignItems:"center",
                  color:(f[k]!==""&&f[k]!=null)?t.text:t.muted}}>
                  {(f[k]!==""&&f[k]!=null) ? f[k] : "mg/dL"}
                </div>
              </div>
            ))}
          </div>
          {f.source==="Lab" && (
            <div>
              <label style={lS}>ApoB (Lab Measured, optional)</label>
              <div onClick={()=>setPadField("apobMeasured")} style={{padding:"11px 13px",borderRadius:9,
                border:`1px solid ${padField==="apobMeasured"?t.accent:t.border}`,background:t.bg,
                fontSize:17,fontFamily:FONT,cursor:"pointer",minHeight:43,display:"flex",
                alignItems:"center",color:(f.apobMeasured!==""&&f.apobMeasured!=null)?t.text:t.muted}}>
                {(f.apobMeasured!==""&&f.apobMeasured!=null) ? f.apobMeasured : "mg/dL"}
              </div>
            </div>
          )}
          {(()=>{
            const rows = [
              preview.ldl && { name:"LDL-C", method:preview.ldl.label, value:preview.ldl.value, unit:"mg/dL", color:"#DF3F2E" },
              preview.d.nonHDL!=null && { name:"Non-HDL", method:null, value:preview.d.nonHDL, unit:"mg/dL", color:t.text },
              preview.d.apob!=null && { name:"ApoB", method:preview.d.apobLabel, value:preview.d.apob, unit:"mg/dL", color:"#7B4FD4" },
              preview.d.tcHdl!=null && { name:"TC / HDL", method:null, value:preview.d.tcHdl, unit:null, color:"#128591" },
              preview.d.tgHdl!=null && { name:"TG / HDL", method:null, value:preview.d.tgHdl, unit:null, color:"#C2417E" },
            ].filter(Boolean);
            if (!rows.length) return null;
            return (
              <div style={{background:t.bg,borderRadius:10,border:`1px solid ${t.border}`,padding:"0 14px 7px"}}>
                <div style={{fontSize:13,fontWeight:600,color:t.sec,letterSpacing:".5px",
                  textTransform:"uppercase",padding:"13px 0 5px"}}>Calculated Preview</div>
                {rows.map((x,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",
                    gap:14,padding:"10px 0",borderTop:`1px solid ${t.border}`}}>
                    <div style={{fontSize:14.5,minWidth:0}}>
                      <span style={{color:t.text,fontWeight:600}}>{x.name}</span>
                      {x.method && <span style={{color:t.muted}}> · {x.method}</span>}
                    </div>
                    <div style={{flexShrink:0,display:"flex",alignItems:"baseline",gap:4}}>
                      <span style={{fontSize:20,fontWeight:700,fontFamily:MONO,color:x.color}}>{x.value}</span>
                      {x.unit && <span style={{fontSize:13,fontWeight:600,color:t.muted}}>{x.unit}</span>}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
          <div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <label htmlFor="ll-notes" style={lS}>Notes</label>
              <span style={{fontSize:13.5,color:t.muted}}>{f.notes.length}/300</span>
            </div>
            <textarea id="ll-notes" value={f.notes} onChange={e=>set("notes",e.target.value.slice(0,300))}
              rows={3} placeholder="Optional: medication changes, fasting status, context…"
              style={{...iS,resize:"none"}} />
          </div>
        </div>
      </div>
      <div style={{position:"sticky",bottom:0,background:t.card,marginTop:20,
        padding:"12px 22px 14px",borderTop:`1px solid ${t.border}`}}>
        <button onClick={handleSave} style={{width:"100%",padding:"14px",borderRadius:12,
          border:"none",cursor:"pointer",background:t.accent,color:t.accentText,
          fontWeight:700,fontSize:17.5,fontFamily:FONT}}>
          {reading?"Save Changes":"Save Reading"}</button>
      </div>
      {devicePicker && (
        <Sheet onClose={()=>setDevicePicker(false)} zIndex={210}>{close=>(
          <SelectSheet title={f.source==="POC" ? "Device" : "Lab / Provider"} current={f.sourceName}
            options={poolFor(f.source).map(dn=>({ value:dn, label:dn,
              sub:dn===defaultFor(f.source)?"Default":undefined }))}
            onSelect={v=>{ set("sourceName",v); close(); }} onClose={close} />
        )}</Sheet>
      )}
      {padField && (
        <NumberPadSheet fields={numFields} values={f} activeKey={padField}
          setActiveKey={setPadField} onInput={(k,v)=>set(k,v)}
          onClose={()=>setPadField(null)} />
      )}
      {pendingSave && (
        <ConfirmDialog title="Double-check this reading"
          message={
            <span>
              <span style={{display:"block",marginBottom:9}}>
                Some values look unusual, worth a second look before saving:
              </span>
              {warnings.map((w,i)=>(
                <span key={i} style={{display:"block",color:t.text,marginBottom:6}}>· {w}</span>
              ))}
              <span style={{display:"block",marginTop:9}}>Save this reading anyway?</span>
            </span>
          }
          confirmLabel="Save Anyway"
          onConfirm={()=>{ onSave(pendingSave); setPendingSave(null); }}
          onCancel={()=>setPendingSave(null)} />
      )}
    </div>
  );
}

/* ── Stat card (consistent provenance sub-line) ─────────────────────────────── */
function StatCard({ label, value, unit, provenance, color, trend, lowerBetter, onPress }) {
  const t = useT();
  let trendEl = null;
  if (trend && trend.delta !== 0) {
    const up = trend.delta > 0;
    const favorable = up !== lowerBetter;
    /* A delta spanning two different source types is not evidence of movement,
       so it is never coloured as improvement. The caption below names the other
       source, which is what actually explains the number. */
    const col = trend.crossSource ? t.sec : (favorable ? t.success : t.sec);
    trendEl = (
      <span style={{fontSize:12,fontWeight:600,fontFamily:MONO,color:col,
        whiteSpace:"nowrap",flexShrink:0}}>
        {up?"▲":"▼"}{Math.abs(trend.delta)}
      </span>
    );
  }
  /* "since Aug 12" turns an unqualified number into a measured claim: a 7-day
     delta and an 8-month delta previously rendered identically. */
  const since = trend
    ? (trend.crossSource ? `vs ${trend.prevSource} · ${fmtShort(trend.since)}` : `since ${fmtShort(trend.since)}`)
    : null;
  return (
    <button onClick={onPress} aria-label={`${label}: choose which metric to show here`}
      onMouseEnter={e=>e.currentTarget.style.background=t.cardHi}
      onMouseLeave={e=>e.currentTarget.style.background=t.card}
      style={{background:t.card,borderRadius:13,padding:"13px 9px",minWidth:0,textAlign:"left",
        fontFamily:FONT,cursor:"pointer",transition:"background .1s",
        border:`1px solid ${t.border}`,borderTop:`2px solid ${color}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
        gap:4,marginBottom:7}}>
        <span style={{display:"flex",alignItems:"center",gap:1,minWidth:0,flex:"1 1 auto"}}>
          <span style={{fontSize:12,color:t.sec,fontWeight:700,letterSpacing:"0.1px",
            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{label}</span>
          <ChevronDown size={10} color={t.muted} style={{flexShrink:0,marginTop:1}} />
        </span>
        {trendEl}
      </div>
      <div style={{fontSize:28,fontWeight:800,color:value==null?t.muted:t.text,fontFamily:MONO,
        fontVariantNumeric:"tabular-nums",lineHeight:1,overflow:"hidden",
        textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{value==null ? "—" : value}</div>
      {/* Two lines, not one: at three-across on a phone there is no room to
          run the method and the comparison together, and the comparison is the
          half that stops the delta above from being an unqualified number. */}
      <div style={{fontSize:12.5,color:t.sec,marginTop:5,overflow:"hidden",
        textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{provenance}</div>
      {since && (
        <div style={{fontSize:12.5,color:t.sec,marginTop:1,overflow:"hidden",
          textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{since}</div>
      )}
    </button>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   DASHBOARD
   ════════════════════════════════════════════════════════════════════════════ */
function DashboardView({ enriched, settings, onUpdateSettings, onSelect, onAdd, onViewAll }) {
  const t = useT();
  const [bmA, setBmA] = useState("ldl");
  const [bmB, setBmB] = useState(null);
  const [range, setRange] = useState("All");
  const [srcMode, setSrcMode] = useState("all");
  const a = BM(bmA), b = BM(bmB);

  const [metricPicker, setMetricPicker] = useState(null); // 'primary' | 'compare'
  const pickPrimary = key => { if (key===bmB) setBmB(null); setBmA(key); };
  const pickCompare = key => { setBmB(key==="__off" ? null : key); };

  const DropField = ({ caption, value, onClick }) => (
    <button onClick={onClick} style={{flex:1,minWidth:0,display:"flex",alignItems:"center",
      justifyContent:"space-between",gap:8,padding:"8px 13px",borderRadius:10,
      border:`1px solid ${t.border}`,background:t.bg,cursor:"pointer",fontFamily:FONT}}>
      <span style={{display:"flex",flexDirection:"column",alignItems:"flex-start",minWidth:0}}>
        <span style={{fontSize:11.5,color:t.muted,fontWeight:700,letterSpacing:".5px"}}>{caption}</span>
        <span style={{fontSize:16.5,fontWeight:700,color:t.text,overflow:"hidden",
          textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"100%"}}>{value}</span>
      </span>
      <ChevronDown size={15} color={t.sec} style={{flexShrink:0}} />
    </button>
  );

  /* Home and Lab carry the same marks the chart draws, so this control doubles
     as the legend for them: it teaches the encoding and filters by it in one
     element, instead of a legend above the chart and a filter below it. */
  const srcOptions = [
    { value:"all", label:"All" },
    { value:"home", label:(
      <span style={{display:"inline-flex",alignItems:"center",gap:5}}>
        <svg width="8" height="8"><circle cx="4" cy="4" r="3.4" fill="currentColor" /></svg>
        Home
      </span>) },
    { value:"lab", label:(
      <span style={{display:"inline-flex",alignItems:"center",gap:5}}>
        <svg width="8" height="8"><circle cx="4" cy="4" r="2.9" fill="none"
          stroke="currentColor" strokeWidth="1.6" /></svg>
        Lab
      </span>) },
  ];

  const ascending = useMemo(()=>
    [...enriched].sort((x,y)=>new Date(x.timestamp)-new Date(y.timestamp)), [enriched]);

  const { data:chartData, bucketed, original } = useMemo(()=>{
    const scoped = sourceFilter(rangeFilter(ascending, range), srcMode);
    const rows = scoped.map(r=>({
      /* A real timestamp, not a formatted label. As a category axis every gap
         rendered the same width, so four weekly readings and a seven-month
         silence looked alike and slope carried no meaning. */
      t: new Date(r.timestamp).getTime(),
      source: r.source === "Lab" ? "Lab" : "POC",
      ldl:metricValue(r,"ldl",settings.ldlMethod), hdl:r.hdl??null, tc:r.tc??null, tg:r.tg??null,
      apob:r.d.apob??null, tcHdl:r.d.tcHdl??null, tgHdl:r.d.tgHdl??null,
    }));
    return downsample(rows);
  },[ascending,range,srcMode,settings.ldlMethod]);

  const fit = useMemo(()=>fitTrend(
    chartData.filter(r=>r[bmA]!=null).map(r=>({x:r.t, y:r[bmA]}))
  ), [chartData,bmA]);

  /* Source lives in the mark itself: filled for a home device, ringed for a lab
     draw. The two disagree systematically, so a step in the line that coincides
     with a change of mark is method rather than biology — visible at a glance
     instead of only to a reader who already suspected it. An averaged bucket
     spans both and claims neither. */
  const seriesDot = color => ({ cx, cy, payload }) => {
    if (cx == null || cy == null) return null;
    if (payload?.source === "Lab")
      return <circle cx={cx} cy={cy} r={3.6} fill={t.card} stroke={color} strokeWidth={1.8} />;
    if (payload?.source === "POC")
      return <circle cx={cx} cy={cy} r={3.5} fill={color} />;
    return <circle cx={cx} cy={cy} r={3.2} fill={color} fillOpacity={0.45} />;
  };

  const recent = useMemo(()=>
    [...enriched].sort((x,y)=>new Date(y.timestamp)-new Date(x.timestamp)).slice(0,5), [enriched]);
  const descending = useMemo(()=>
    [...enriched].sort((x,y)=>new Date(y.timestamp)-new Date(x.timestamp)), [enriched]);

  /* The last two readings carrying this metric, and what separates them. A
     delta across a source change is mostly method bias — device LDL
     under-reports Martin-Hopkins by roughly the size of a real change between
     tests — so the card has to be able to say which kind of delta it is. */
  const trendFor = key => {
    const rs=[];
    for (const r of descending) {
      if (metricValue(r,key,settings.ldlMethod)!=null) { rs.push(r); if (rs.length===2) break; }
    }
    if (rs.length!==2) return null;
    const [now,prev] = rs;
    const isLab = r => r.source==="Lab";
    return {
      delta: +(metricValue(now,key,settings.ldlMethod) - metricValue(prev,key,settings.ldlMethod)).toFixed(1),
      since: prev.timestamp,
      crossSource: isLab(now)!==isLab(prev),
      prevSource: srcMeta(prev.source).label,
    };
  };

  const cardKeys = (Array.isArray(settings.cards) && settings.cards.length===3)
    ? settings.cards : DEF_SETTINGS.cards;
  const [cardPicker, setCardPicker] = useState(null);   // index of the card being changed

  const pickCard = (idx, key) => {
    const next = [...cardKeys];
    const held = next.indexOf(key);
    if (held !== -1 && held !== idx) next[held] = next[idx];   // already shown: swap the two
    next[idx] = key;
    onUpdateSettings({ ...settings, cards: next });
  };

  const latestFor = key => {
    for (const r of descending) {
      const v = metricValue(r, key, settings.ldlMethod);
      if (v != null) return { value:v, reading:r };
    }
    return null;
  };

  /* Where a number came from is the point of this app, so every card says it —
     the LDL method, whether ApoB was measured or estimated, or that a ratio was
     derived rather than read off a device. */
  const provenanceFor = (key, r) => {
    if (key === "ldl")  return getDispLDL(r, r.d, settings.ldlMethod)?.label ?? "Reported";
    if (key === "apob") return r.d.apobLabel ?? "Estimated";
    if (key === "tcHdl" || key === "tgHdl") return "Derived";
    return "Measured";
  };
  const seriesPts = chartData.filter(r=>r[bmA]!=null).length;
  const enoughForChart = seriesPts >= 2;

  return (
    <div style={{paddingBottom:16}}>
      {enriched.length>0 && (
        <div style={{marginTop:16,display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
          {cardKeys.map((key,idx)=>{
            const bm = BM(key), found = latestFor(key);
            return (
              <StatCard key={idx} label={bm?.label ?? key}
                value={found?.value ?? null}
                provenance={found ? provenanceFor(key, found.reading) : "No readings yet"}
                color={bm?.color} trend={found ? trendFor(key) : null}
                lowerBetter={bm?.lowerBetter} onPress={()=>setCardPicker(idx)} />
            );
          })}
        </div>
      )}

      <div style={{background:t.card,borderRadius:14,padding:"16px",marginTop:12,border:`1px solid ${t.border}`}}>
        <div style={{display:"flex",gap:8,marginBottom:14}}>
          <DropField caption="METRIC" value={a?.label} onClick={()=>setMetricPicker("primary")} />
          <DropField caption="COMPARE" value={bmB?b?.label:"Off"} onClick={()=>setMetricPicker("compare")} />
        </div>
        <div style={{marginBottom:bmB?10:12}}>
          <Segmented options={srcOptions} value={srcMode} onChange={setSrcMode} />
        </div>
        {bmB && (
          <div style={{display:"flex",gap:16,marginBottom:10,alignItems:"center",
            flexWrap:"wrap",rowGap:6}}>
            <div style={{display:"flex",alignItems:"center",gap:5}}>
              <div style={{width:18,height:2,background:a?.color,borderRadius:1}} />
              <span style={{fontSize:13,color:t.sec}}>{a?.label} (left)</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:5}}>
              <svg width="18" height="2"><line x1="0" y1="1" x2="18" y2="1"
                stroke={b?.color} strokeWidth="2" strokeDasharray="4 2"/></svg>
              <span style={{fontSize:13,color:t.sec}}>{b?.label} (right)</span>
            </div>
          </div>
        )}

        {!enoughForChart ? (
          <div style={{height:216,display:"flex",flexDirection:"column",alignItems:"center",
            justifyContent:"center",color:t.muted,gap:8}}>
            <Activity size={26} strokeWidth={1.5} />
            <div style={{fontSize:15.5,color:t.sec,textAlign:"center",padding:"0 20px"}}>
              {enriched.length===0 ? "Add 2+ readings to see a trend"
                : `Not enough ${a?.label} data for this range and filter`}
            </div>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={216}>
              <LineChart data={chartData} margin={{top:14,right:10,bottom:6,left:4}}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
                <XAxis dataKey="t" type="number" scale="time" domain={["dataMin","dataMax"]}
                  tickFormatter={fmtShort} tick={{fontSize:12.5,fill:t.sec,fontFamily:FONT}}
                  tickLine={false} axisLine={false} interval="preserveStartEnd"
                  minTickGap={34} tickMargin={10} />
                <YAxis yAxisId="left" tick={{fontSize:12.5,fill:bmB?(a?.color):t.sec,fontFamily:FONT}}
                  tickLine={false} axisLine={false} domain={["auto","auto"]}
                  width={40} tickMargin={6} padding={{top:6,bottom:6}} />
                {bmB && (
                  <YAxis yAxisId="right" orientation="right" domain={["auto","auto"]} width={36}
                    tick={{fontSize:12.5,fill:b?.color,fontFamily:FONT}} tickLine={false}
                    axisLine={false} tickMargin={6} padding={{top:6,bottom:6}} />
                )}
                <Tooltip content={<ChartTooltip bmA={bmA} bmB={bmB} />}
                  allowEscapeViewBox={{x:false,y:false}} wrapperStyle={{zIndex:5}} />
                {/* Drawn before the series so the data sits on top of its own fit. */}
                {fit && (
                  <ReferenceLine yAxisId="left" ifOverflow="extendDomain"
                    segment={[{x:fit.x1,y:fit.y1},{x:fit.x2,y:fit.y2}]}
                    stroke={a?.color} strokeOpacity={0.4} strokeWidth={1.5}
                    strokeDasharray="5 4" />
                )}
                {/* Straight segments between readings. A spline would draw
                    curvature through values that were never measured. */}
                <Line yAxisId="left" type="linear" dataKey={bmA} stroke={a?.color} strokeWidth={2.4}
                  dot={seriesDot(a?.color)} activeDot={{r:6}}
                  connectNulls={false} isAnimationActive={false} />
                {bmB && (
                  <Line yAxisId="right" type="linear" dataKey={bmB} stroke={b?.color} strokeWidth={1.5}
                    strokeDasharray="6 3" dot={{r:2.5,fill:b?.color,strokeWidth:0}} activeDot={{r:5}}
                    connectNulls={false} isAnimationActive={false} />
                )}
              </LineChart>
            </ResponsiveContainer>
            {(fit || bucketed) && (
              <div style={{fontSize:13,color:t.sec,textAlign:"center",marginTop:4,lineHeight:1.5}}>
                {fit && `Trend ${fit.change >= 0 ? "+" : "−"}${Math.abs(fit.change)}${a?.unit ? ` ${a.unit}` : ""} over ${fmtSpan(fit.days)}`}
                {fit && bucketed && " · "}
                {bucketed && `${original} readings averaged`}
              </div>
            )}
          </>
        )}

        <div style={{display:"flex",justifyContent:"center",marginTop:12}}>
          <Segmented options={RANGES} value={range} onChange={setRange} />
        </div>
      </div>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"22px 4px 8px"}}>
        <span style={{fontSize:13,fontWeight:600,color:t.sec,textTransform:"uppercase",letterSpacing:".6px"}}>
          Recent Readings</span>
        {enriched.length>0 && (
          <button onClick={onViewAll} style={{background:"none",border:"none",cursor:"pointer",
            color:t.text,fontSize:14,fontWeight:600,fontFamily:FONT,display:"flex",alignItems:"center",gap:1}}>
            View All <ChevronRight size={13} /></button>
        )}
      </div>
      {recent.length===0 ? (
        <div style={{background:t.card,borderRadius:14,padding:"36px 24px",textAlign:"center",
          border:`1px solid ${t.border}`}}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:12}}>
            <Activity size={30} strokeWidth={1.5} color={t.muted} />
          </div>
          <div style={{fontSize:17.5,fontWeight:600,color:t.text,marginBottom:6}}>No readings yet</div>
          <div style={{fontSize:15.5,color:t.sec,marginBottom:20}}>
            Add your first cholesterol reading to get started</div>
          <button onClick={onAdd} style={{padding:"11px 22px",borderRadius:9,border:"none",
            background:t.accent,color:t.accentText,fontWeight:700,fontSize:16.5,cursor:"pointer",fontFamily:FONT}}>
            Add First Reading</button>
        </div>
      ) : (
        <div style={{background:t.card,borderRadius:14,overflow:"hidden",border:`1px solid ${t.border}`}}>
          {recent.map((r,i)=>(
            <div key={r.id}>
              <ReadingRow reading={r} ldlMethod={settings.ldlMethod} onSelect={onSelect} />
              {i<recent.length-1 && <Divider />}
            </div>
          ))}
        </div>
      )}

      {cardPicker!==null && (
        <Sheet onClose={()=>setCardPicker(null)}>{close=>(
          <SelectSheet title="Show Which Metric" current={cardKeys[cardPicker]}
            options={BMS.map(x=>({value:x.key,label:x.label,sub:REF_RANGES[x.key]}))}
            onSelect={v=>{ pickCard(cardPicker, v); close(); }} onClose={close}
            footer="Picking a metric already shown in another card swaps the two." />
        )}</Sheet>
      )}
      {metricPicker==="primary" && (
        <Sheet onClose={()=>setMetricPicker(null)}>{close=>(
          <SelectSheet title="Chart Metric" current={bmA}
            options={BMS.map(x=>({value:x.key,label:x.label}))}
            onSelect={v=>{ pickPrimary(v); close(); }} onClose={close} />
        )}</Sheet>
      )}
      {metricPicker==="compare" && (
        <Sheet onClose={()=>setMetricPicker(null)}>{close=>(
          <SelectSheet title="Compare With" current={bmB||"__off"}
            options={[{value:"__off",label:"Off",sub:"Show a single metric"},
              ...BMS.filter(x=>x.key!==bmA).map(x=>({value:x.key,label:x.label}))]}
            onSelect={v=>{ pickCompare(v); close(); }} onClose={close} />
        )}</Sheet>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   HISTORY
   ════════════════════════════════════════════════════════════════════════════ */
function HistoryView({ enriched, settings, onSelect }) {
  const t = useT();
  const [srcMode, setSrcMode] = useState("all");
  const scoped = useMemo(()=>sourceFilter(enriched, srcMode), [enriched, srcMode]);
  const groups = useMemo(()=>{
    const sorted = [...scoped].sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));
    const map = new Map();
    sorted.forEach(r=>{ const k=fmtMonth(r.timestamp); if(!map.has(k)) map.set(k,[]); map.get(k).push(r); });
    return [...map.entries()];
  },[scoped]);
  const [toggled, setToggled] = useState(()=>new Set());
  const isCollapsed = (key,idx) => toggled.has(key) ? !(idx>=2) : (idx>=2);
  const toggle = key => setToggled(s=>{ const n=new Set(s); n.has(key)?n.delete(key):n.add(key); return n; });

  return (
    <div style={{paddingBottom:16}}>
      <SectionLabel>All Readings ({scoped.length})</SectionLabel>
      <div style={{margin:"0 0 12px"}}>
        <Segmented options={SRC_MODES} value={srcMode} onChange={setSrcMode} />
      </div>
      {groups.length===0 ? (
        <div style={{background:t.card,borderRadius:13,padding:"30px 20px",textAlign:"center",
          color:t.sec,fontSize:15.5,border:`1px solid ${t.border}`}}>
          {enriched.length===0 ? "No readings recorded yet"
            : srcMode==="home" ? "No home-test readings"
            : "No lab readings"}
        </div>
      ) : groups.map(([month,rows],i)=>{
        const collapsed = isCollapsed(month,i);
        return (
          <div key={month} style={{marginBottom:8}}>
            <div onClick={()=>toggle(month)} style={{display:"flex",alignItems:"center",gap:8,
              padding:"12px 14px",background:t.card,cursor:"pointer",border:`1px solid ${t.border}`,
              borderRadius:collapsed?11:"11px 11px 0 0",borderBottom:collapsed?`1px solid ${t.border}`:"none"}}>
              <ChevronRight size={14} color={t.sec} strokeWidth={2.5}
                style={{transform:collapsed?"none":"rotate(90deg)",transition:"transform .15s"}} />
              <span style={{fontSize:15.5,fontWeight:600,color:t.text,flex:1}}>{month}</span>
              <span style={{fontSize:13.5,color:t.sec,fontFamily:MONO}}>{rows.length}</span>
            </div>
            {!collapsed && (
              <div style={{background:t.card,borderRadius:"0 0 11px 11px",overflow:"hidden",
                border:`1px solid ${t.border}`,borderTop:"none"}}>
                {rows.map((r,j)=>(
                  <div key={r.id}>
                    <ReadingRow reading={r} ldlMethod={settings.ldlMethod} onSelect={onSelect} />
                    {j<rows.length-1 && <Divider />}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   REPORT  (always rendered in a light, print-friendly palette)
   ════════════════════════════════════════════════════════════════════════════ */
const REPORT_BMS = ["ldl","hdl","tc","tg","nonHDL","apob","tcHdl","tgHdl"];
const REPORT_BM_LABEL = { ldl:"LDL-C", hdl:"HDL-C", tc:"Total Cholesterol", tg:"Triglycerides",
  nonHDL:"Non-HDL", apob:"ApoB", tcHdl:"TC/HDL", tgHdl:"TG/HDL" };

function ReportView({ enriched, settings, onClose }) {
  const L = THEMES.light;
  const [range, setRange] = useState("90d");
  const [srcMode, setSrcMode] = useState("all");
  const [chartBm, setChartBm] = useState("ldl");

  const scoped = useMemo(()=>{
    const s = sourceFilter(rangeFilter(enriched, range), srcMode);
    return [...s].sort((a,b)=>new Date(a.timestamp)-new Date(b.timestamp));
  },[enriched,range,srcMode]);

  const chartData = useMemo(()=> scoped.map(r=>({
    date:fmtShort(r.timestamp), v:metricValue(r,chartBm,settings.ldlMethod),
  })).filter(p=>p.v!=null), [scoped,chartBm,settings.ldlMethod]);

  const rangeLabel = {"30d":"Last 30 days","90d":"Last 90 days","1y":"Last year","All":"All time"}[range];
  const srcLabel = {all:"All sources",home:"Home tests only",lab:"Lab tests only"}[srcMode];
  const bmInfo = BM(chartBm);

  const tableCell = { padding:"6px 8px",fontSize:13,borderBottom:`1px solid ${L.border}`,
    fontFamily:MONO,color:L.text,textAlign:"right" };
  const tableHd = { padding:"6px 8px",fontSize:12,fontWeight:700,textTransform:"uppercase",
    letterSpacing:"0.4px",color:L.sec,textAlign:"right",borderBottom:`1.5px solid ${L.borderHi}` };
  const ctrlBtn = (on)=>({ padding:"5px 11px",border:`1px solid ${on?"#18181B":"rgba(255,255,255,0.25)"}`,
    borderRadius:7,cursor:"pointer",fontFamily:FONT,fontSize:14,fontWeight:on?700:500,
    background:on?"#18181B":"transparent",color:on?"#fff":"#C7C7CC" });

  return (
    <div style={{position:"fixed",inset:0,zIndex:260,background:"#26262A",
      overflow:"auto",animation:"llFadeIn .2s ease forwards"}}>
      {/* Toolbar: not printed */}
      <div className="ll-noprint" style={{position:"sticky",top:0,zIndex:2,background:"#1A1A1D",
        borderBottom:"1px solid rgba(255,255,255,0.1)",padding:"12px 16px",
        display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <button onClick={onClose} style={{background:"transparent",border:"1px solid rgba(255,255,255,0.2)",
          borderRadius:18,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",
          cursor:"pointer",color:"#C7C7CC"}}><X size={15} /></button>
        <span style={{fontSize:16,fontWeight:700,color:"#FAFAFA",marginRight:4}}>Report</span>
        <div style={{display:"flex",gap:4}}>
          {RANGES.map(r=><button key={r} onClick={()=>setRange(r)} style={ctrlBtn(range===r)}>{r}</button>)}
        </div>
        <div style={{display:"flex",gap:4}}>
          {SRC_MODES.map(s=><button key={s.value} onClick={()=>setSrcMode(s.value)}
            style={ctrlBtn(srcMode===s.value)}>{s.label}</button>)}
        </div>
        <button onClick={()=>window.print()} style={{marginLeft:"auto",padding:"7px 16px",
          borderRadius:8,border:"none",background:"#FAFAFA",color:"#18181B",fontWeight:700,
          fontSize:15,cursor:"pointer",fontFamily:FONT,display:"flex",alignItems:"center",gap:6}}>
          <Download size={14} /> Save as PDF</button>
      </div>
      <div style={{textAlign:"center",fontSize:13,color:"#8A8A93",padding:"8px 16px 0"}}
        className="ll-noprint">
        "Save as PDF" opens your browser's print dialog. Choose "Save as PDF" as the destination.
      </div>

      {/* The document */}
      <div style={{display:"flex",justifyContent:"center",padding:"20px 16px 60px"}}>
        <div className="ll-report" style={{background:"#FFFFFF",width:720,maxWidth:"100%",
          padding:"40px 44px",color:L.text,fontFamily:FONT,
          boxShadow:"0 4px 40px rgba(0,0,0,0.4)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",
            borderBottom:`2px solid ${L.text}`,paddingBottom:14,marginBottom:20}}>
            <div>
              <div style={{fontSize:24,fontWeight:800,letterSpacing:"-0.5px"}}>Lipid Report</div>
              <div style={{fontSize:14,color:L.sec,marginTop:3}}>{rangeLabel} · {srcLabel}</div>
            </div>
            <div style={{textAlign:"right",fontSize:13,color:L.sec}}>
              <div>Generated</div>
              <div style={{fontWeight:600,color:L.text}}>{fmtDate(new Date().toISOString())}</div>
            </div>
          </div>

          {scoped.length===0 ? (
            <div style={{padding:"40px 0",textAlign:"center",color:L.sec,fontSize:15}}>
              No readings fall within this range and filter.
            </div>
          ) : (
            <>
              <div style={{fontSize:13,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px",
                color:L.sec,marginBottom:8}}>Summary · {scoped.length} reading{scoped.length>1?"s":""}</div>
              <table style={{width:"100%",borderCollapse:"collapse",marginBottom:24}}>
                <thead><tr>
                  <th style={{...tableHd,textAlign:"left"}}>Biomarker</th>
                  <th style={tableHd}>Latest</th><th style={tableHd}>Average</th>
                  <th style={tableHd}>Min</th><th style={tableHd}>Max</th><th style={tableHd}>n</th>
                </tr></thead>
                <tbody>
                  {REPORT_BMS.map(key=>{
                    const s = biomarkerStats(scoped,key,settings.ldlMethod);
                    if (!s) return null;
                    return (
                      <tr key={key}>
                        <td style={{...tableCell,textAlign:"left",fontFamily:FONT,fontWeight:600}}>
                          {REPORT_BM_LABEL[key]}</td>
                        <td style={{...tableCell,fontWeight:700}}>{s.latest}</td>
                        <td style={tableCell}>{s.avg}</td>
                        <td style={tableCell}>{s.min}</td>
                        <td style={tableCell}>{s.max}</td>
                        <td style={{...tableCell,color:L.sec}}>{s.n}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {chartData.length>=2 && (
                <>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                    <div style={{fontSize:13,fontWeight:700,textTransform:"uppercase",
                      letterSpacing:"0.5px",color:L.sec}}>{REPORT_BM_LABEL[chartBm]} Trend</div>
                    <select value={chartBm} onChange={e=>setChartBm(e.target.value)}
                      className="ll-noprint" style={{fontSize:13,padding:"3px 6px",borderRadius:6,
                        border:`1px solid ${L.border}`,fontFamily:FONT}}>
                      {REPORT_BMS.map(k=><option key={k} value={k}>{REPORT_BM_LABEL[k]}</option>)}
                    </select>
                  </div>
                  <div style={{marginBottom:24}}>
                    <LineChart width={632} height={220} data={chartData}
                      margin={{top:10,right:14,bottom:6,left:6}}>
                      <CartesianGrid strokeDasharray="3 3" stroke={L.grid} />
                      <XAxis dataKey="date" tick={{fontSize:11.5,fill:L.sec,fontFamily:FONT}}
                        tickLine={false} axisLine={{stroke:L.border}} interval="preserveStartEnd"
                        minTickGap={40} tickMargin={8} />
                      <YAxis tick={{fontSize:11.5,fill:L.sec,fontFamily:FONT}} tickLine={false}
                        axisLine={{stroke:L.border}} width={42} tickMargin={6}
                        domain={["auto","auto"]} padding={{top:6,bottom:6}} />
                      <Line type="monotone" dataKey="v" stroke={bmInfo?.color} strokeWidth={2}
                        dot={{r:3,fill:bmInfo?.color,strokeWidth:0}} isAnimationActive={false} />
                    </LineChart>
                  </div>
                </>
              )}

              <div style={{fontSize:13,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px",
                color:L.sec,marginBottom:8}}>Readings</div>
              <table style={{width:"100%",borderCollapse:"collapse",marginBottom:24}}>
                <thead><tr>
                  <th style={{...tableHd,textAlign:"left"}}>Date</th>
                  <th style={{...tableHd,textAlign:"left"}}>Source</th>
                  <th style={tableHd}>TC</th><th style={tableHd}>HDL</th><th style={tableHd}>LDL</th>
                  <th style={tableHd}>TG</th><th style={tableHd}>ApoB</th>
                </tr></thead>
                <tbody>
                  {[...scoped].reverse().map(r=>{
                    const ldl = getDispLDL(r,r.d,settings.ldlMethod);
                    return (
                      <tr key={r.id}>
                        <td style={{...tableCell,textAlign:"left",fontFamily:FONT}}>{fmtDate(r.timestamp)}</td>
                        <td style={{...tableCell,textAlign:"left",fontFamily:FONT,color:L.sec}}>
                          {srcMeta(r.source).label} · {r.sourceName}</td>
                        <td style={tableCell}>{r.tc??"-"}</td>
                        <td style={tableCell}>{r.hdl??"-"}</td>
                        <td style={tableCell}>{ldl?ldl.value:"-"}</td>
                        <td style={tableCell}>{r.tg??"-"}</td>
                        <td style={tableCell}>{r.d.apob??"-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}

          <div style={{borderTop:`1px solid ${L.border}`,paddingTop:12,fontSize:12,
            color:L.muted,lineHeight:1.5}}>
            Generated by LipidLog. For informational purposes only. Not a diagnosis and not a
            substitute for professional medical advice. LDL-C shown using the
            {" "}{settings.ldlMethod==="none"?"device-reported":settings.ldlMethod==="friedewald"?"Friedewald":"Martin-Hopkins"}
            {" "}method; estimated ApoB uses the {settings.apobMethod==="aggressive"?"Aggressive":"INTERHEART"} model.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   SETTINGS
   ════════════════════════════════════════════════════════════════════════════ */
function SettingsView({ settings, onUpdate, enriched, onClearAll, onOpenReport,
  onRenameSource, onDeleteSource }) {
  const t = useT();
  const [lpa, setLpa] = useState(settings.lpa||"");
  const [lpaSaved, setLpaSaved] = useState(false);
  const [picker, setPicker] = useState(null);          // "ldl" | "apob" | "theme"
  const [confirmClear, setConfirmClear] = useState(false);
  const [deviceDialog, setDeviceDialog] = useState(null); // {mode,pool,name?}
  const [apobPending, setApobPending] = useState(null);   // method awaiting confirmation
  const [confirmDevice, setConfirmDevice] = useState(null); // {pool,name}

  const homeDevices = settings.homeDevices?.length ? settings.homeDevices : SEED_HOME;
  const labSources  = settings.labSources?.length  ? settings.labSources  : SEED_LAB;
  const poolList   = pool => pool==="lab" ? labSources : homeDevices;
  const poolKey    = pool => pool==="lab" ? "labSources" : "homeDevices";
  const poolDefKey = pool => pool==="lab" ? "defaultLabSource" : "defaultDevice";
  const poolNoun   = pool => pool==="lab" ? "lab source" : "device";

  const validateName = (pool, name, excludeName) => {
    if (!name) return `Enter a ${poolNoun(pool)} name.`;
    if (name.length > 40) return "Keep the name under 40 characters.";
    const clash = poolList(pool).some(d => d.toLowerCase()===name.toLowerCase() && d!==excludeName);
    if (clash) return `That ${poolNoun(pool)} already exists.`;
    return null;
  };
  const addName = (pool, name) => {
    onUpdate({ ...settings, [poolKey(pool)]:[...poolList(pool), name] });
    setDeviceDialog(null);
  };
  const renameName = (pool, oldName, newName) => {
    onRenameSource(pool, oldName, newName);
    setDeviceDialog(null);
  };
  const deleteName = (pool, name) => {
    onDeleteSource(pool, name);
    setConfirmDevice(null);
  };
  const readingsUsing = name => enriched.filter(r => r.sourceName===name).length;

  const Row = ({ label, value, sub, onPress, danger }) => (
    <div onClick={onPress}
      onMouseEnter={e=>onPress&&(e.currentTarget.style.background=t.cardHi)}
      onMouseLeave={e=>(e.currentTarget.style.background="transparent")}
      style={{padding:"13px 15px",display:"flex",justifyContent:"space-between",alignItems:"center",
        cursor:onPress?"pointer":"default",transition:"background .1s"}}>
      <div>
        <div style={{fontSize:16.5,color:danger?t.danger:t.text}}>{label}</div>
        {sub && <div style={{fontSize:13.5,color:t.sec,marginTop:2}}>{sub}</div>}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:5}}>
        {value && <span style={{fontSize:15.5,color:t.sec,fontWeight:600}}>{value}</span>}
        {onPress && <ChevronRight size={13} color={t.muted} />}
      </div>
    </div>
  );
  const card = { background:t.card,borderRadius:13,overflow:"hidden",border:`1px solid ${t.border}` };
  const iS = { padding:"10px 12px",borderRadius:8,border:`1px solid ${t.border}`,
    background:t.bg,fontSize:17,outline:"none",fontFamily:FONT,color:t.text };
  const ldlL={none:"Off",friedewald:"Friedewald","martin-hopkins":"Martin-Hopkins"};
  const apobL={interheart:"INTERHEART",aggressive:"Aggressive"};
  const themeL={system:"System",light:"Light",dark:"Dark"};

  return (
    <>
      <div style={{paddingBottom:16}}>
        <SectionLabel>Appearance</SectionLabel>
        <div style={card}>
          <Row label="Theme" value={themeL[settings.theme]} sub="System, Light, or Dark"
            onPress={()=>setPicker("theme")} />
        </div>

        <SectionLabel>Calculations</SectionLabel>
        <div style={card}>
          <Row label="LDL Calculation" value={ldlL[settings.ldlMethod]}
            sub="Method used for calculated LDL-C" onPress={()=>setPicker("ldl")} />
          <Divider />
          <Row label="ApoB Method" value={apobL[settings.apobMethod]}
            sub="Estimation used when ApoB isn't lab-measured" onPress={()=>setPicker("apob")} />
        </div>

        {[
          {pool:"home", title:"Home Devices",
           blurb:"Point-of-care devices you test with at home. Tap one to make it the default for new home readings. Renaming updates it on every reading."},
          {pool:"lab", title:"Lab Sources",
           blurb:"Where your lab results come from, such as LabCorp, Quest, or a doctor's office. These are kept separate from home devices and are never used for home readings."},
        ].map(({pool,title,blurb})=>{
          const list = poolList(pool);
          const defName = settings[poolDefKey(pool)];
          return (
            <div key={pool}>
              <SectionLabel>{title}</SectionLabel>
              <div style={{fontSize:13.5,color:t.sec,margin:"0 4px 8px",lineHeight:1.5}}>{blurb}</div>
              <div style={card}>
                {list.map((dn,i)=>{
                  const isDefault = defName===dn;
                  const canDelete = list.length > 1;
                  return (
                    <div key={dn}>
                      <div onClick={()=>onUpdate({...settings,[poolDefKey(pool)]:dn})}
                        onMouseEnter={e=>e.currentTarget.style.background=t.cardHi}
                        onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                        style={{padding:"12px 15px",display:"flex",alignItems:"center",gap:10,
                          cursor:"pointer",transition:"background .1s"}}>
                        <div style={{width:16,height:16,borderRadius:9,flexShrink:0,
                          border:`1.5px solid ${isDefault?t.accent:t.muted}`,display:"flex",
                          alignItems:"center",justifyContent:"center"}}>
                          {isDefault && <div style={{width:8,height:8,borderRadius:5,background:t.accent}} />}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:16.5,color:t.text}}>{dn}</div>
                          {isDefault && <div style={{fontSize:13,color:t.sec,marginTop:1}}>Default</div>}
                        </div>
                        <div style={{display:"flex",gap:4}}>
                          <button onClick={e=>{e.stopPropagation();setDeviceDialog({mode:"edit",pool,name:dn});}}
                            aria-label="Rename"
                            onMouseEnter={e=>e.currentTarget.style.background=t.cardHi}
                            onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                            style={{background:"transparent",border:"none",borderRadius:8,
                              width:34,height:34,cursor:"pointer",display:"flex",
                              alignItems:"center",justifyContent:"center",transition:"background .1s"}}>
                            <Pencil size={15} color={t.sec} /></button>
                          {canDelete && (
                            <button onClick={e=>{e.stopPropagation();setConfirmDevice({pool,name:dn});}}
                              aria-label="Delete"
                              onMouseEnter={e=>e.currentTarget.style.background=t.cardHi}
                              onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                              style={{background:"transparent",border:"none",borderRadius:8,
                                width:34,height:34,cursor:"pointer",display:"flex",
                                alignItems:"center",justifyContent:"center",transition:"background .1s"}}>
                              <Trash2 size={15} color={t.sec} /></button>
                          )}
                        </div>
                      </div>
                      {i<list.length-1 && <Divider />}
                    </div>
                  );
                })}
                <Divider />
                <div onClick={()=>setDeviceDialog({mode:"add",pool})}
                  onMouseEnter={e=>e.currentTarget.style.background=t.cardHi}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                  style={{padding:"13px 15px",display:"flex",alignItems:"center",gap:8,
                    cursor:"pointer",transition:"background .1s"}}>
                  <Plus size={15} color={t.text} strokeWidth={2.5} />
                  <span style={{fontSize:16.5,color:t.text,fontWeight:600}}>
                    Add {pool==="lab"?"Lab Source":"Device"}</span>
                </div>
              </div>
            </div>
          );
        })}

        <SectionLabel>Lp(a) Persistent Value</SectionLabel>
        <div style={{...card,padding:"14px 15px"}}>
          <div style={{fontSize:13.5,color:t.sec,marginBottom:10,lineHeight:1.55}}>
            Lp(a) is genetic and stable over time, so it's stored once here rather than per
            reading. It appears as context on every reading.
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <input type="number" inputMode="decimal" value={lpa}
              onChange={e=>{setLpa(e.target.value);setLpaSaved(false);}}
              onWheel={e=>e.currentTarget.blur()} placeholder="e.g. 30"
              style={{...iS,flex:"1 1 auto",minWidth:0,width:"100%"}} />
            <div style={{display:"flex",flexShrink:0,border:`1px solid ${t.border}`,
              borderRadius:8,overflow:"hidden"}}>
              {["mg/dL","nmol/L"].map(u=>(
                <button key={u} onClick={()=>onUpdate({...settings,lpaUnit:u})}
                  style={{padding:"9px 10px",border:"none",cursor:"pointer",fontFamily:FONT,
                    fontSize:14,fontWeight:settings.lpaUnit===u?700:500,whiteSpace:"nowrap",
                    background:settings.lpaUnit===u?t.cardHi:"transparent",
                    color:settings.lpaUnit===u?t.text:t.sec}}>{u}</button>
              ))}
            </div>
            <button onClick={()=>{onUpdate({...settings,lpa});setLpaSaved(true);}}
              style={{padding:"10px 14px",borderRadius:8,border:"none",cursor:"pointer",
                flexShrink:0,fontFamily:FONT,fontWeight:700,fontSize:15.5,
                background:t.accent,color:t.accentText}}>
              Save</button>
          </div>
          {settings.lpa && (
            <div style={{fontSize:14.5,color:lpaSaved?t.success:t.sec,marginTop:8}}>
              {lpaSaved?"Saved · ":"Stored · "}{settings.lpa} {settings.lpaUnit}
            </div>
          )}
        </div>

        <SectionLabel>Export</SectionLabel>
        <div style={card}>
          <div onClick={onOpenReport}
            onMouseEnter={e=>e.currentTarget.style.background=t.cardHi}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}
            style={{padding:"13px 15px",display:"flex",justifyContent:"space-between",
              alignItems:"center",cursor:"pointer",transition:"background .1s"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <FileText size={15} color={t.text} />
              <span style={{fontSize:16.5,color:t.text}}>PDF Report</span>
            </div>
            <ChevronRight size={13} color={t.muted} />
          </div>
          <Divider />
          <div onClick={()=>enriched.length && exportCSV(enriched,settings)}
            onMouseEnter={e=>enriched.length&&(e.currentTarget.style.background=t.cardHi)}
            onMouseLeave={e=>(e.currentTarget.style.background="transparent")}
            style={{padding:"13px 15px",display:"flex",justifyContent:"space-between",alignItems:"center",
              cursor:enriched.length?"pointer":"default",opacity:enriched.length?1:0.5,transition:"background .1s"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <Download size={15} color={t.text} />
              <span style={{fontSize:16.5,color:t.text}}>Export CSV</span>
            </div>
            <span style={{fontSize:14.5,color:t.sec}}>{enriched.length} readings</span>
          </div>
        </div>

        <SectionLabel>Data</SectionLabel>
        <div style={card}>
          <Row label="Clear All Data" sub="Permanently delete every reading" danger
            onPress={()=>enriched.length && setConfirmClear(true)} />
        </div>

        <SectionLabel>Legal</SectionLabel>
        <div style={{...card,padding:"13px 15px"}}>
          <div style={{fontSize:14.5,color:t.sec,lineHeight:1.6}}>
            For informational purposes only. Does not replace professional medical advice.
            Always consult a qualified healthcare provider regarding your cardiovascular health.
          </div>
        </div>
      </div>

      {picker==="ldl" && (
        <Sheet onClose={()=>setPicker(null)}>{close=>(
          <SelectSheet title="LDL Calculation" options={LDL_OPTS} current={settings.ldlMethod}
            onSelect={v=>{onUpdate({...settings,ldlMethod:v});close();}} onClose={close}
            footer={"Friedewald uses a fixed divisor (TG ÷ 5) and tends to under-report LDL when triglycerides are low. Martin-Hopkins uses an adjustable divisor based on your TG and non-HDL levels, which is more accurate across most ranges. \u201cOff\u201d keeps the device-reported value exactly as entered."} />
        )}</Sheet>
      )}
      {picker==="apob" && (
        <Sheet onClose={()=>setPicker(null)}>{close=>(
          <SelectSheet title="ApoB Method" options={APOB_OPTS} current={settings.apobMethod}
            onSelect={v=>{ if (v!==settings.apobMethod) setApobPending(v); close(); }} onClose={close}
            footer={"ApoB reflects the number of atherogenic particles in your blood. When it isn\u2019t lab-measured, LipidLog estimates it from non-HDL cholesterol. INTERHEART is a conservative, validated regression; Aggressive applies a higher coefficient for a more risk-weighted estimate. A lab-measured ApoB always takes priority over either estimate."} />
        )}</Sheet>
      )}
      {picker==="theme" && (
        <Sheet onClose={()=>setPicker(null)}>{close=>(
          <SelectSheet title="Theme" options={THEME_OPTS} current={settings.theme}
            onSelect={v=>{onUpdate({...settings,theme:v});close();}} onClose={close} />
        )}</Sheet>
      )}
      {apobPending && (()=>{
        const nameOf = v => APOB_OPTS.find(o=>o.value===v)?.label ?? v;
        return (
          <ConfirmDialog title="Change ApoB method?"
            message={`Changing from ${nameOf(settings.apobMethod)} to ${nameOf(apobPending)} will recalculate all derived values. Measured values will remain unchanged.`}
            confirmLabel="Continue"
            onConfirm={()=>{ onUpdate({...settings,apobMethod:apobPending}); setApobPending(null); }}
            onCancel={()=>setApobPending(null)} />
        );
      })()}
      {deviceDialog?.mode==="add" && (
        <InputDialog title={deviceDialog.pool==="lab"?"Add Lab Source":"Add Device"}
          placeholder={deviceDialog.pool==="lab"?"e.g. LabCorp, Dr. Smith":"e.g. Curo L7 (kitchen)"}
          confirmLabel="Add"
          validate={n=>validateName(deviceDialog.pool,n)}
          onConfirm={n=>addName(deviceDialog.pool,n)} onCancel={()=>setDeviceDialog(null)} />
      )}
      {deviceDialog?.mode==="edit" && (
        <InputDialog title={deviceDialog.pool==="lab"?"Rename Lab Source":"Rename Device"}
          placeholder="Name" initial={deviceDialog.name} confirmLabel="Save"
          validate={n=>validateName(deviceDialog.pool,n,deviceDialog.name)}
          onConfirm={n=>renameName(deviceDialog.pool,deviceDialog.name,n)}
          onCancel={()=>setDeviceDialog(null)} />
      )}
      {confirmDevice && (()=>{
        const used = readingsUsing(confirmDevice.name);
        const noun = poolNoun(confirmDevice.pool);
        return (
          <ConfirmDialog title={`Delete this ${noun}?`}
            message={used>0
              ? `"${confirmDevice.name}" will be removed from your ${noun} list. Your ${used} reading${used>1?"s":""} using it will stay in your history and keep this label.`
              : `"${confirmDevice.name}" will be removed from your ${noun} list.`}
            confirmLabel="Delete" danger
            onConfirm={()=>deleteName(confirmDevice.pool,confirmDevice.name)}
            onCancel={()=>setConfirmDevice(null)} />
        );
      })()}
      {confirmClear && (
        <ConfirmDialog title="Clear all data?"
          message={`All ${enriched.length} readings will be permanently deleted. This cannot be undone.`}
          confirmLabel="Delete All" danger
          onConfirm={()=>{ setConfirmClear(false); onClearAll(); }}
          onCancel={()=>setConfirmClear(false)} />
      )}
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   ROOT
   ════════════════════════════════════════════════════════════════════════════ */
function useResolvedTheme(themeSetting) {
  const [sysDark, setSysDark] = useState(()=>
    typeof window!=="undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  useEffect(()=>{
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const fn = e => setSysDark(e.matches);
    mq.addEventListener?.("change", fn);
    return ()=>mq.removeEventListener?.("change", fn);
  },[]);
  const eff = themeSetting==="system" ? (sysDark?"dark":"light") : themeSetting;
  return THEMES[eff] || THEMES.dark;
}

export default function App() {
  const [readings, setReadings] = useState([]);
  const [settings, setSettings] = useState(DEF_SETTINGS);
  const [loaded, setLoaded]     = useState(false);
  const [view, setView]         = useState("dashboard");
  const [modal, setModal]       = useState(null);
  const [detail, setDetail]     = useState(null);
  const [toast, setToast]       = useState(null);
  const [report, setReport]     = useState(false);

  const t = useResolvedTheme(settings.theme);

  useEffect(()=>{
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap";
    document.head.appendChild(link);
    (async()=>{
      const { readings:r, settings:s } = await loadStorage();
      setReadings(Array.isArray(r)?r:[]);
      if (s) {
        // Migrate older shapes: a single `devices` list (and the even older
        // `customDevices`) becomes the home-device pool; lab sources are a new,
        // separate pool that must never contain a home device.
        if (!s.homeDevices || !s.homeDevices.length)
          s.homeDevices = (s.devices && s.devices.length)
            ? s.devices
            : [...SEED_HOME, ...(s.customDevices||[])];
        if (!s.labSources || !s.labSources.length) s.labSources = SEED_LAB;
        if (!s.defaultLabSource || !s.labSources.includes(s.defaultLabSource))
          s.defaultLabSource = s.labSources[0];
        if (!s.homeDevices.includes(s.defaultDevice))
          s.defaultDevice = s.homeDevices[0];
        // Settings saved before the stat cards were selectable have no card list.
        if (!Array.isArray(s.cards) || s.cards.length !== 3 || s.cards.some(k => !BM(k)))
          s.cards = DEF_SETTINGS.cards;
        delete s.devices; delete s.customDevices;
        setSettings(p=>({...p,...s}));
      }
      setLoaded(true);
    })();
    return ()=>{ try{document.head.removeChild(link);}catch{} };
  },[]);

  useEffect(()=>{
    document.documentElement.style.colorScheme = t.isDark ? "dark" : "light";
    document.body.style.background = t.bg;
  },[t]);

  const showToast = useCallback(msg=>{ setToast(msg); setTimeout(()=>setToast(null),3200); },[]);
  const updateReadings = useCallback(r=>{
    setReadings(r);
    schedulePersist("lipidlog_readings", r);
  },[]);

  /* Settings and readings both write through the shared scheduler, which
     debounces and coalesces. The UI updates immediately regardless of storage.
     A failure only surfaces after storage has been unreachable for a sustained
     stretch, and even then at most once a minute, since the scheduler keeps
     retrying on its own and the latest value persists once storage recovers. */
  const updateSettings = useCallback(s=>{
    setSettings(s);
    schedulePersist("lipidlog_settings", s);
  },[]);
  useEffect(()=>{
    let lastWarn = 0;
    setPersistStuckHandler(()=>{
      const now = Date.now();
      if (now - lastWarn > 60000) {
        lastWarn = now;
        showToast("Storage is busy — changes will save automatically once it frees up.");
      }
    });
  },[showToast]);
  useEffect(()=>{
    const onHide = ()=>{ if (document.visibilityState==="hidden") flushPersistNow(); };
    window.addEventListener("pagehide", flushPersistNow);
    document.addEventListener("visibilitychange", onHide);
    return ()=>{ window.removeEventListener("pagehide", flushPersistNow);
      document.removeEventListener("visibilitychange", onHide); };
  },[]);

  /* Source entries live in two independent pools: homeDevices and labSources.
     Rename propagates to that pool, its default pointer, and every reading that
     used the name. Delete keeps historical readings labelled as recorded. */
  const poolKey = pool => pool==="lab" ? "labSources" : "homeDevices";
  const defKey  = pool => pool==="lab" ? "defaultLabSource" : "defaultDevice";
  const renameSource = (pool, oldN, newN) => {
    const pk = poolKey(pool), dk = defKey(pool);
    const list = (settings[pk]||[]);
    updateSettings({ ...settings,
      [pk]: list.map(d=>d===oldN?newN:d),
      [dk]: settings[dk]===oldN ? newN : settings[dk] });
    if (readings.some(r=>r.sourceName===oldN))
      updateReadings(readings.map(r=>r.sourceName===oldN?{...r,sourceName:newN}:r));
  };
  const deleteSource = (pool, name) => {
    const pk = poolKey(pool), dk = defKey(pool);
    const remaining = (settings[pk]||[]).filter(d=>d!==name);
    if (!remaining.length) return;
    updateSettings({ ...settings, [pk]:remaining,
      [dk]: settings[dk]===name ? remaining[0] : settings[dk] });
  };

  const enriched = useMemo(()=>
    readings.map(r=>({...r, d:calcDerived(r,settings.apobMethod)})), [readings,settings.apobMethod]);

  const persistReading = useCallback((data,editId)=>{
    if (editId) updateReadings(readings.map(r=>r.id===editId?{...r,...data}:r));
    else updateReadings([...readings,{id:uid(),...data}]
      .sort((a,b)=>new Date(a.timestamp)-new Date(b.timestamp)));
  },[readings,updateReadings]);
  const handleDelete = useCallback(id=>updateReadings(readings.filter(r=>r.id!==id)),[readings,updateReadings]);

  const TABS = [
    {key:"dashboard",label:"Dashboard",Icon:BarChart2},
    {key:"history",  label:"History",  Icon:List},
    {key:"settings", label:"Settings", Icon:Settings},
  ];

  if (!loaded) return (
    <div style={{display:"flex",height:"100vh",alignItems:"center",justifyContent:"center",
      background:t.bg,fontFamily:FONT,color:t.sec,fontSize:17}}>Loading…</div>
  );

  /* No auth gate. The prototype stores readings locally via window.storage,
     so there is no account to sign in to and nothing a client-side gate could
     protect. Real Supabase magic-link auth plugs in here in the web port,
     once single-user vs multi-user is settled — see LipidLog-CC-handoff.md. */

  return (
    <ThemeCtx.Provider value={t}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        html{overflow-y:scroll;}
        @keyframes llFadeIn{from{opacity:0}to{opacity:1}}
        @keyframes llFadeOut{from{opacity:1}to{opacity:0}}
        @keyframes llSheetIn{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes llSheetOut{from{transform:translateY(0)}to{transform:translateY(100%)}}
        @keyframes llPopIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
        input[type=number]{-moz-appearance:textfield;}
        :focus-visible{outline:2px solid ${t.accent};outline-offset:2px;border-radius:5px;}
        ::-webkit-scrollbar{width:5px;height:5px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:${t.muted};border-radius:3px;}
        textarea::placeholder,input::placeholder{color:${t.muted};}
        @media print{
          body *{visibility:hidden !important;}
          .ll-report,.ll-report *{visibility:visible !important;}
          .ll-report{position:absolute !important;left:0;top:0;width:100% !important;
            box-shadow:none !important;}
          .ll-noprint{display:none !important;}
          @page{margin:14mm;}
        }
      `}</style>
      <div style={{minHeight:"100vh",background:t.bg,fontFamily:FONT,color:t.text,
        paddingBottom:"calc(72px + env(safe-area-inset-bottom))"}}>
        <header style={{background:`${t.bg}E8`,backdropFilter:"blur(20px)",
          WebkitBackdropFilter:"blur(20px)",borderBottom:`1px solid ${t.border}`,
          padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",
          position:"sticky",top:0,zIndex:100}}>
          <div style={{fontSize:18.5,fontWeight:800,letterSpacing:"-0.4px"}}>LipidLog</div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <button onClick={()=>updateSettings({...settings,theme:t.isDark?"light":"dark"})}
              aria-label="Toggle theme" style={{background:"transparent",border:`1px solid ${t.border}`,
              borderRadius:18,width:32,height:32,display:"flex",alignItems:"center",
              justifyContent:"center",cursor:"pointer",color:t.sec}}>
              {t.isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            {view!=="settings" && (
              <button onClick={()=>setModal("add")} style={{background:t.accent,color:t.accentText,
                border:"none",borderRadius:18,padding:"6px 13px 6px 9px",fontSize:15.5,fontWeight:700,
                cursor:"pointer",fontFamily:FONT,display:"flex",alignItems:"center",gap:4}}>
                <Plus size={15} strokeWidth={2.6} /> Add
              </button>
            )}
          </div>
        </header>

        <main style={{maxWidth:600,margin:"0 auto",padding:"0 20px"}}>
          {view==="dashboard" && <DashboardView enriched={enriched} settings={settings}
            onUpdateSettings={updateSettings}
            onSelect={setDetail} onAdd={()=>setModal("add")} onViewAll={()=>setView("history")} />}
          {view==="history"   && <HistoryView enriched={enriched} settings={settings} onSelect={setDetail} />}
          {view==="settings"  && <SettingsView settings={settings} onUpdate={updateSettings}
            enriched={enriched} onClearAll={()=>updateReadings([])} onOpenReport={()=>setReport(true)}
            onRenameSource={renameSource} onDeleteSource={deleteSource} />}
        </main>

        <nav style={{position:"fixed",bottom:0,left:0,right:0,background:`${t.card}F2`,
          backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",
          borderTop:`1px solid ${t.border}`,display:"flex",justifyContent:"space-around",
          padding:"8px 0 calc(8px + env(safe-area-inset-bottom))",zIndex:100}}>
          {TABS.map(({key,label,Icon})=>(
            <button key={key} onClick={()=>setView(key)} style={{background:"none",border:"none",
              cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,
              padding:"0 20px",fontFamily:FONT,color:view===key?t.text:t.muted,transition:"color .15s"}}>
              <Icon size={21} strokeWidth={view===key?2.4:1.8} />
              <span style={{fontSize:12.5,fontWeight:view===key?700:500}}>{label}</span>
            </button>
          ))}
        </nav>

        {modal && (
          <Sheet onClose={()=>setModal(null)}>{close=>(
            <AddEditModal reading={modal!=="add"?modal:null} settings={settings} onClose={close}
              onSave={data=>{ persistReading(data, modal!=="add"?modal.id:null); close(); }} />
          )}</Sheet>
        )}
        {detail && (
          <Sheet onClose={()=>setDetail(null)}>{close=>(
            <ReadingDetail reading={enriched.find(r=>r.id===detail.id)||detail} settings={settings}
              onClose={close}
              onEdit={()=>{ const r=detail; close(); setTimeout(()=>setModal(r),250); }}
              onDelete={()=>{ const id=detail.id; close(); setTimeout(()=>handleDelete(id),250); }} />
          )}</Sheet>
        )}
        {report && <ReportView enriched={enriched} settings={settings} onClose={()=>setReport(false)} />}
        {toast && <Toast message={toast} />}
      </div>
    </ThemeCtx.Provider>
  );
}

/* Single-file preview of the ported Next.js app. Same components, same store,
   same stylesheet — only the routing is stood in for, so this shows the real
   thing rather than a mock of it. */
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import DashboardPage from "../app/page";
import OnboardingPage from "../app/onboarding/page";
import LoginPage from "../app/login/page";
import { SAMPLE_READINGS } from "./sample-readings.js";

/* Seed once, so the dashboard has something to show. Invented data, and the
   newest reading says so in the app. */
function seedIfEmpty() {
  if (localStorage.getItem("lipidlog.readings.v1")) return;
  localStorage.setItem(
    "lipidlog.readings.v1",
    JSON.stringify(
      SAMPLE_READINGS.map((r, i) => ({
        id: `sample-${i}`,
        timestamp: new Date(r.ts).toISOString(),
        source: r.src,
        sourceName: r.name,
        tc: r.tc, hdl: r.hdl, ldl: r.ldl, tg: r.tg,
        apobMeasured: r.apob ?? null,
        notes: r.note ?? "",
      })),
    ),
  );
}

function App() {
  const [path, setPath] = useState(() => window.location.hash.slice(1) || "/");
  useEffect(() => {
    const onHash = () => setPath(window.location.hash.slice(1) || "/");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  if (path.startsWith("/onboarding")) return <OnboardingPage />;
  if (path.startsWith("/login")) return <LoginPage />;
  return <DashboardPage />;
}

seedIfEmpty();
createRoot(document.getElementById("root")!).render(<App />);

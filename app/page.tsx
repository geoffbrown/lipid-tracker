"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardScreen from "@/components/DashboardScreen";
import BottomNav from "@/components/BottomNav";
import { useAppData } from "@/lib/use-app-data";

export default function DashboardPage() {
  const router = useRouter();
  const data = useAppData();

  // First run: nothing saved and nothing recorded. Anyone with data already
  // goes straight to it — a wizard should never stand in front of it.
  useEffect(() => {
    if (data.needsOnboarding) router.replace("/onboarding");
  }, [data.needsOnboarding, router]);

  if (data.loading) {
    return <main className="grid min-h-screen place-items-center text-ink-soft">Loading…</main>;
  }

  return (
    <>
      <DashboardScreen data={data} />
      <BottomNav />
    </>
  );
}

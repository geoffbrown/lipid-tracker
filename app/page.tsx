"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardScreen from "@/components/DashboardScreen";
import Header from "@/components/Header";
import { useAppData } from "@/lib/use-app-data";
import ScreenState from "@/components/ScreenState";

export default function DashboardPage() {
  const router = useRouter();
  const data = useAppData();

  // First run: nothing saved and nothing recorded. Anyone with data already
  // goes straight to it — a wizard should never stand in front of it.
  useEffect(() => {
    if (data.needsOnboarding) router.replace("/onboarding");
  }, [data.needsOnboarding, router]);

  if (data.loading || data.error) return <ScreenState error={data.error} />;

  return (
    <>
      <Header />
      <DashboardScreen data={data} />
    </>
  );
}

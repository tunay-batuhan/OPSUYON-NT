import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { DemoNotice } from "@/components/demo-notice";
import { PatrolScanner, type ScanEntry } from "@/components/patrol-scanner";
import { requireAccess } from "@/lib/modules";
import { createClient } from "@/lib/supabase/server";
import { dayRange, istanbulDay } from "@/lib/patrol";

export const metadata: Metadata = { title: "Barkod Okut" };

/** Devriye görevlisinin telefonu: noktadaki barkodu okutur. Altta kişinin bugünkü okutmaları listelenir. */
export default async function PatrolScanPage() {
  const user = await requireAccess("devriye", "patrol.scan");
  const supabase = await createClient();
  const { from, to } = dayRange(istanbulDay(new Date()));

  const { data } = await supabase
    .from("patrol_scans")
    .select("scanned_at, patrol_points(name), projects(name)")
    .eq("scanned_by", user.id)
    .gte("scanned_at", from)
    .lt("scanned_at", to)
    .order("scanned_at", { ascending: false })
    .limit(20);

  const recent: ScanEntry[] = ((data ?? []) as unknown as { scanned_at: string; patrol_points: { name: string } | null; projects: { name: string } | null }[]).map((r) => ({
    point: r.patrol_points?.name ?? "—",
    project: r.projects?.name ?? "—",
    at: r.scanned_at,
  }));

  return (
    <>
      <PageHeader title="Barkod Okut" description="Devriyede her noktada barkodu okutun; rapor otomatik oluşur." />
      <DemoNotice />
      <PatrolScanner recent={recent} />
    </>
  );
}

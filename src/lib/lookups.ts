import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getServiceLines } from "@/lib/lines";

export type ProjectLite = { id: string; name: string; service_line: string; status: string; organizations: { name: string } | null };

/** Projects the caller may see (RLS), for filter dropdowns and aggregated pages. */
export const getAccessibleProjects = cache(async (): Promise<ProjectLite[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("id, name, service_line, status, organizations(name)")
    .order("name")
    .limit(500);
  return (data ?? []) as unknown as ProjectLite[];
});

export const str1 = (v: string | string[] | undefined): string | undefined => (typeof v === "string" && v !== "" ? v : undefined);
export const isUuid = (v: string | undefined): v is string => Boolean(v && /^[0-9a-f-]{36}$/i.test(v));

/** "Hizmet" filtresi: Güvenlik / Temizlik / Danışma / Teknik Personel… Müşteri yalnızca kendi hizmet alanlarını görür. */
export const getHatOptions = cache(async (): Promise<{ value: string; label: string }[]> => {
  const [lines, projects, user] = await Promise.all([getServiceLines(), getAccessibleProjects(), getCurrentUser()]);
  const present = new Set(projects.map((p) => p.service_line));
  return lines.filter((l) => user?.kind === "staff" || present.has(l.code)).map((l) => ({ value: l.code, label: l.name }));
});

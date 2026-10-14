import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { Dashboard } from "@/components/dashboard";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ana Sayfa" };

export default async function PanelPage() {
  const user = await requireCustomer();
  const supabase = await createClient();
  const { data: org } = user.organization_id
    ? await supabase.from("organizations").select("name").eq("id", user.organization_id).maybeSingle()
    : { data: null };

  return (
    <>
      <PageHeader eyebrow={org?.name} title="Ana Sayfa" description="Projeleriniz ve operasyonunuzun anlık özeti." />
      <Dashboard user={user} />
    </>
  );
}

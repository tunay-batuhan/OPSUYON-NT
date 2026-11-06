import Link from "next/link";
import type { Metadata } from "next";
import { Card, CardHeader, Notice } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { isUuid, str1 } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";
import { PersonnelDocForm, type DocCategory, type DocPerson } from "./personnel-doc-form";

export const metadata: Metadata = { title: "Personel evrakı ekle" };

type ActiveAssignment = { personnel_id: string; project_id: string; personnel: { full_name: string } | null; projects: { name: string } | null };

/** Personel evrakı yükleme: belge, personelin AKTİF atamasının projesine bağlanır (bir personel aynı anda tek projede). */
export default async function AddPersonnelDocPage({ searchParams }: PageProps<"/merkez/personel/evrak-ekle">) {
  await requireStaff("documents.manage");
  const sp = await searchParams;
  const wanted = isUuid(str1(sp.personel)) ? str1(sp.personel) : undefined;
  const supabase = await createClient();

  const [{ data: rows }, { data: cats }, wantedRow] = await Promise.all([
    supabase.from("personnel_assignments").select("personnel_id, project_id, personnel(full_name), projects(name)").is("end_date", null).limit(5000),
    supabase.from("document_categories").select("code, name, requires_period").eq("scope", "personnel").eq("is_active", true).order("sort_order"),
    wanted ? supabase.from("personnel").select("id, full_name").eq("id", wanted).maybeSingle() : null,
  ]);
  const people: DocPerson[] = ((rows ?? []) as unknown as ActiveAssignment[])
    .filter((a) => a.personnel)
    .map((a) => ({ id: a.personnel_id, label: `${a.personnel!.full_name} — ${a.projects?.name ?? "Proje"}`, projectId: a.project_id }))
    .sort((a, b) => a.label.localeCompare(b.label, "tr"));
  const categories = (cats ?? []) as DocCategory[];
  const wantedPerson = wantedRow?.data as { id: string; full_name: string } | null | undefined;
  const wantedUnassigned = wantedPerson && !people.some((p) => p.id === wantedPerson.id);

  return (
    <>
      <Card>
        <CardHeader title="Evrak ekle" description="Yüklenen evrak personel kartındaki Evraklar bölümünde ve ilgili evrak sayfalarında görünür." />
        <div className="space-y-3 px-5 pt-5">
          {wantedUnassigned && (
            <Notice tone="danger">
              <strong>{wantedPerson.full_name}</strong> için aktif proje ataması yok; evrak bir projeye bağlanarak saklandığı için önce personeli bir projeye atayın.{" "}
              <Link href={`/merkez/personel/${wantedPerson.id}`} className="font-medium underline">Personel kartına dön</Link>
            </Notice>
          )}
          <Notice>
            Listede yalnızca <strong>aktif proje ataması olan</strong> personel çıkar. Projeye atanmamış personele evrak eklemek için önce proje sayfasından atama yapın.
          </Notice>
        </div>
        {people.length === 0 || categories.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">
            {people.length === 0 ? "Aktif proje ataması olan personel yok." : "Tanımlı personel evrakı kategorisi yok."}
          </p>
        ) : (
          <PersonnelDocForm people={people} categories={categories} defaultPerson={wantedUnassigned ? undefined : wantedPerson?.id} />
        )}
      </Card>
    </>
  );
}

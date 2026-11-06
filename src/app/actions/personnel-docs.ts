"use server";

import { revalidatePath } from "next/cache";
import { assertStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { guard, validate } from "@/lib/form";
import { personnelDocumentSchema, type PersonnelDocumentValues } from "@/lib/schemas-personnel";
import type { ActionState } from "@/lib/action-types";
import { registerDocument } from "@/app/actions/documents";

/**
 * Merkez > Personel > Evrak ekle. Belge, personelin AKTİF atamasının projesine bağlanır
 * (documents.project_id zorunlu; müşteri bu projeden görür). Dosya önceden prepareUpload ile yüklenir.
 */
export async function registerPersonnelDocument(values: PersonnelDocumentValues): Promise<ActionState> {
  return guard(async () => {
    await assertStaff("documents.manage");
    const v = validate(personnelDocumentSchema, values);
    if (!v.ok) return v.state;
    const d = v.data;

    const supabase = await createClient();
    const [{ data: assignment }, { data: cat }] = await Promise.all([
      supabase.from("personnel_assignments").select("project_id").eq("personnel_id", d.personnel_id).is("end_date", null).maybeSingle(),
      supabase.from("document_categories").select("scope, requires_period, is_active").eq("code", d.category_code).maybeSingle(),
    ]);
    if (!assignment) {
      return { error: "Bu personelin aktif proje ataması yok; evrak eklemek için önce bir projeye atayın.", fieldErrors: { personnel_id: "Aktif proje ataması yok" } };
    }
    if (assignment.project_id !== d.project_id) {
      return { error: "Personelin projesi değişmiş. Sayfayı yenileyip dosyayı yeniden seçin." };
    }
    if (!cat || cat.scope !== "personnel" || !cat.is_active) {
      return { error: "Lütfen işaretli alanları düzeltin.", fieldErrors: { category_code: "Geçerli bir personel evrakı kategorisi seçin" } };
    }

    const res = await registerDocument({
      ...d,
      // dönem yalnızca aylık belge türlerinde tutulur
      period_month: cat.requires_period ? d.period_month : "",
      period_year: cat.requires_period ? d.period_year : "",
      inspection_date: "",
      inspection_shift: "",
    });
    if (res?.ok) revalidatePath(`/merkez/personel/${d.personnel_id}`, "layout");
    return res;
  });
}

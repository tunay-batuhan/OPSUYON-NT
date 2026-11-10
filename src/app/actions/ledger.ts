"use server";

import { revalidatePath } from "next/cache";
import { assertStaff, getCurrentUser, hasPermission } from "@/lib/auth";
import { deleteDocument } from "@/app/actions/documents";
import { createClient } from "@/lib/supabase/server";
import { str } from "@/lib/form";

/**
 * Cari Excel ekstresini siler (satırları da silinir). Silinen güncel ekstreyse projenin bir önceki ekstresi
 * güncel olur; önceki yoksa projenin bakiyesi boşalır. Yüklenen Excel dosyası "Veri aktarımı" geçmişinde kalır.
 */
export async function deleteLedgerStatement(fd: FormData): Promise<void> {
  await assertStaff("finance.manage");
  await removeStatement(str(fd, "id"));
}

/**
 * Cari Hesap listesindeki satırın "Sil"i: satırda görünen ekstrenin tamamı silinir — son PDF ekstre (belge
 * yöneticisi) ve güncel Excel ekstresi (finans yöneticisi). Yetkisi olmayan kısım silinmez.
 */
export async function deleteLedgerRow(fd: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.kind !== "staff") throw new Error("Bu işlem için yetkiniz yok.");
  const docId = str(fd, "id");
  const stmtId = str(fd, "stmt");
  if (docId && hasPermission(user, "documents.manage")) {
    const d = new FormData();
    d.set("id", docId);
    d.set("back", "/cari-hesap");
    await deleteDocument(d);
  }
  if (stmtId && hasPermission(user, "finance.manage")) await removeStatement(stmtId);
  revalidatePath("/cari-hesap");
}

async function removeStatement(id: string | null): Promise<void> {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return;
  const supabase = await createClient();
  const { data: st } = await supabase.from("ledger_statements").select("project_id, is_current").eq("id", id).maybeSingle();
  if (!st) return;
  const { error } = await supabase.from("ledger_statements").delete().eq("id", id);
  if (error) return;

  if (st.is_current) {
    const { data: prev } = await supabase
      .from("ledger_statements")
      .select("id")
      .eq("project_id", st.project_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prev) await supabase.from("ledger_statements").update({ is_current: true }).eq("id", prev.id);
  }
  revalidatePath(`/projeler/${st.project_id}/finans`);
  revalidatePath("/cari-hesap");
}

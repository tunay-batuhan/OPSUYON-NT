"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { guard, nul, pgMessage, validate } from "@/lib/form";
import { formatDate, isoDayInTurkey } from "@/lib/format";
import { normalizeIban, toNumber } from "@/lib/parse";
import { legalAnnualLeaveDays } from "@/lib/leave-law";
import {
  assignSchema, leaveSchema, timesheetSchema,
  type AssignValues, type LeaveValues, type TimesheetValues,
} from "@/lib/schemas";
import { personnelCreateSchema, personnelEditSchema, type PersonnelCreateValues, type PersonnelEditValues } from "@/lib/schemas-personnel";
import type { ActionState } from "@/lib/action-types";

/** Personel kartının ortak kolonları (firma ve durum hariç). Sicil no arayüzden kalktığı için yazılmaz. */
function cardColumns(d: PersonnelCreateValues) {
  return {
    first_name: d.first_name,
    last_name: d.last_name,
    title: nul(d.title),
    service_line: nul(d.service_line),
    phone: nul(d.phone),
    email: nul(d.email),
    hire_date: nul(d.hire_date),
    birth_date: nul(d.birth_date),
    birth_place: nul(d.birth_place),
    hometown: nul(d.hometown),
    address: nul(d.address),
    marital_status: nul(d.marital_status),
    height_cm: toNumber(d.height_cm),
    weight_kg: toNumber(d.weight_kg),
    pants_size: nul(d.pants_size),
    shirt_size: nul(d.shirt_size),
    coat_size: nul(d.coat_size),
    shoe_size: nul(d.shoe_size),
    emergency_phone: nul(d.emergency_phone),
    emergency_contact_name: nul(d.emergency_contact_name),
  };
}

export async function createPersonnel(values: PersonnelCreateValues): Promise<ActionState> {
  return guard(async () => {
    const actor = await assertStaff("personnel.manage");
    const v = validate(personnelCreateSchema, values);
    if (!v.ok) return v.state;
    const d = v.data;
    const hasPrivate = Boolean(d.national_id || d.iban);
    if (hasPrivate && !(actor.roleCode === "super_admin" || actor.permissions.includes("personnel.sensitive.read"))) {
      return { error: "TC kimlik / IBAN girmek için yetkiniz yok.", fieldErrors: { national_id: "Bu alan için yetkiniz yok" } };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("personnel")
      .insert({ ...cardColumns(d), organization_id: nul(d.organization_id) })
      .select("id")
      .single();
    if (error) return { error: pgMessage(error) };

    // İşe giriş tarihi varsa bu yılın yasal yıllık izin hakkı bakiyeye yazılır.
    // Yetki (leaves.manage) yoksa ya da hata olursa sessizce geçilir; personel kaydı yine başarılı sayılır.
    if (d.hire_date) {
      try {
        const { days } = legalAnnualLeaveDays(d.hire_date, nul(d.birth_date));
        await supabase
          .from("leave_balances")
          .upsert({ personnel_id: data.id, year: new Date().getFullYear(), entitled_days: days }, { onConflict: "personnel_id,year" });
      } catch {
        /* izin bakiyesi isteğe bağlı */
      }
    }

    if (hasPrivate) {
      const { error: pErr } = await supabase
        .from("personnel_private")
        .insert({ personnel_id: data.id, national_id: nul(d.national_id), iban: d.iban ? normalizeIban(d.iban) : null });
      if (pErr) return { error: pgMessage(pErr) };
    }
    revalidatePath("/merkez/personel");
    return { ok: true, message: "Personel eklendi." };
  });
}

export async function assignPersonnel(values: AssignValues): Promise<ActionState> {
  return guard(async () => {
    await assertStaff("personnel.manage");
    const v = validate(assignSchema, values);
    if (!v.ok) return v.state;
    const d = v.data;

    const supabase = await createClient();
    const { error } = await supabase.from("personnel_assignments").insert({
      project_id: d.project_id,
      personnel_id: d.personnel_id,
      position: nul(d.position),
      // "Boşsa bugün": Türkiye günü (sunucu UTC; gece 00:00–03:00 arası bir önceki gün yazılıyordu)
      start_date: nul(d.start_date) ?? isoDayInTurkey(),
    });
    if (error) return { error: pgMessage(error) };
    revalidateAssignmentViews();
    return { ok: true, message: "Personel projeye atandı." };
  });
}

/**
 * Atama durumu (aktif/ayrıldı) gösteren tüm ekranlar: her projenin Personel sekmesi (aday listesi ve "başka projede
 * görevli" listesi diğer projelere de bağlı), merkez personel listesi/detayı (Proje görevlendirmeleri), Personel modülü,
 * izinler, vardiya ve paneller.
 */
function revalidateAssignmentViews() {
  revalidatePath("/projeler/[id]", "layout");
  revalidatePath("/merkez/personel", "layout");
  revalidatePath("/personel", "layout");
  revalidatePath("/izinler", "layout");
  revalidatePath("/vardiya", "layout");
  revalidatePath("/merkez");
  revalidatePath("/panel");
}

/**
 * "Görevden al": aktif atamayı sonlandırır. Bitiş tarihi Türkiye saatine göre bugündür. Görev henüz başlamamışsa
 * (başlangıç ileri bir tarih) bitiş başlangıçtan önce olamayacağı için atama kaydı silinir (iptal). Hata ya da
 * etkilenen satır olmaması kullanıcıya bildirilir; sessiz kalmaz.
 */
export async function endAssignment(input: { id: string }): Promise<ActionState> {
  return guard(async () => {
    await assertStaff("personnel.manage");
    const id = input?.id;
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return { error: "Geçersiz atama." };
    const supabase = await createClient();

    const { data: a, error: readErr } = await supabase
      .from("personnel_assignments")
      .select("id, start_date, end_date, personnel(full_name)")
      .eq("id", id)
      .maybeSingle();
    if (readErr) return { error: pgMessage(readErr) };
    if (!a) return { error: "Atama bulunamadı ya da bu atamayı görme yetkiniz yok. Sayfayı yenileyip tekrar deneyin." };
    const name = (a.personnel as unknown as { full_name: string } | null)?.full_name ?? "Personel";

    if (a.end_date) {
      revalidateAssignmentViews();
      return { error: `${name} bu projeden zaten ${formatDate(a.end_date)} tarihinde görevden alınmış. Liste yenilendi.` };
    }

    const today = isoDayInTurkey();
    const notStarted = a.start_date > today;
    const { data: rows, error } = notStarted
      ? await supabase.from("personnel_assignments").delete().eq("id", id).is("end_date", null).select("id")
      : await supabase.from("personnel_assignments").update({ end_date: today }).eq("id", id).is("end_date", null).select("id");
    if (error) return { error: `Görevden alınamadı: ${pgMessage(error)}` };
    if (!rows || rows.length === 0) {
      return { error: "Görevden alınamadı: kayıt değiştirilemedi (yetkiniz olmayabilir ya da kayıt başka biri tarafından değiştirilmiş olabilir). Sayfayı yenileyip tekrar deneyin." };
    }

    revalidateAssignmentViews();
    return {
      ok: true,
      message: notStarted
        ? `${name} için ${formatDate(a.start_date)} tarihinde başlayacak görev iptal edildi. Kendi firmasının başka bir projesine atanabilir.`
        : `${name} ${formatDate(today)} itibarıyla görevden alındı. Kendi firmasının başka bir projesine atanabilir.`,
    };
  });
}

export async function upsertTimesheet(values: TimesheetValues): Promise<ActionState> {
  return guard(async () => {
    await assertStaff("timesheets.manage");
    const v = validate(timesheetSchema, values);
    if (!v.ok) return v.state;
    const d = v.data;

    const supabase = await createClient();
    const { error } = await supabase.from("timesheets").upsert(
      {
        project_id: d.project_id,
        personnel_id: d.personnel_id,
        period_year: toNumber(d.period_year),
        period_month: toNumber(d.period_month),
        worked_days: toNumber(d.worked_days) ?? 0,
        leave_days: toNumber(d.leave_days) ?? 0,
        absence_days: toNumber(d.absence_days) ?? 0,
        overtime_hours: toNumber(d.overtime_hours) ?? 0,
        note: nul(d.note),
      },
      { onConflict: "project_id,personnel_id,period_year,period_month" },
    );
    if (error) return { error: pgMessage(error) };
    revalidatePath(`/projeler/${d.project_id}/puantaj`);
    return { ok: true, message: "Puantaj kaydedildi." };
  });
}

export async function upsertLeaveBalance(values: LeaveValues): Promise<ActionState> {
  return guard(async () => {
    await assertStaff("leaves.manage");
    const v = validate(leaveSchema, values);
    if (!v.ok) return v.state;
    const d = v.data;

    const supabase = await createClient();
    const { error } = await supabase.from("leave_balances").upsert(
      {
        personnel_id: d.personnel_id,
        year: toNumber(d.year),
        entitled_days: toNumber(d.entitled_days) ?? 0,
        carried_days: toNumber(d.carried_days) ?? 0,
        used_days: toNumber(d.used_days) ?? 0,
      },
      { onConflict: "personnel_id,year" },
    );
    if (error) return { error: pgMessage(error) };
    revalidatePath(`/projeler/${d.project_id}/izinler`);
    return { ok: true, message: "İzin bakiyesi kaydedildi." };
  });
}

export async function updatePersonnel(values: PersonnelEditValues): Promise<ActionState> {
  return guard(async () => {
    const actor = await assertStaff("personnel.manage");
    const v = validate(personnelEditSchema, values);
    if (!v.ok) return v.state;
    const d = v.data;
    const canSensitive = actor.roleCode === "super_admin" || actor.permissions.includes("personnel.sensitive.read");

    const supabase = await createClient();
    // Firma değişikliği (personelin başka firmaya geçmesi):
    //  - aktif görevi varsa olmaz: önce görevden alınır
    //  - daha önce projede çalışmışsa yalnızca Süper Yönetici değiştirir (kadro bütünlüğü; geçmiş kayıtlar eski firmada kalır)
    //  - hiç ataması yoksa personel yöneticisi değiştirebilir
    const newOrg = nul(d.organization_id);
    const { data: cur } = await supabase.from("personnel").select("organization_id, termination_date").eq("id", d.id).maybeSingle();
    if (cur && (cur.organization_id ?? null) !== newOrg) {
      const { data: asg } = await supabase.from("personnel_assignments").select("end_date").eq("personnel_id", d.id);
      const rows = asg ?? [];
      if (rows.some((a) => !a.end_date)) {
        return { error: "Personelin aktif bir görevi var. Firmayı değiştirmek için önce görevden alın.", fieldErrors: { organization_id: "Önce aktif görevden alın" } };
      }
      if (rows.length > 0 && actor.roleCode !== "super_admin") {
        return {
          error: "Daha önce projede çalışmış personelin firmasını yalnızca Süper Yönetici değiştirebilir.",
          fieldErrors: { organization_id: "Yalnızca Süper Yönetici değiştirebilir" },
        };
      }
    }
    // Sicil no (employee_no) arayüzden kalktı: mevcut değer korunur, güncellenmez.
    const { error } = await supabase
      .from("personnel")
      .update({
        ...cardColumns(d),
        organization_id: newOrg,
        status: d.status,
        // Ayrılış tarihi yalnızca durum ilk kez "Ayrıldı" yapıldığında yazılır; sonraki kayıtlarda korunur
        termination_date: d.status === "terminated" ? (cur?.termination_date ?? isoDayInTurkey()) : null,
      })
      .eq("id", d.id);
    if (error) return { error: pgMessage(error) };

    if (canSensitive) {
      const { error: pErr } = await supabase.from("personnel_private").upsert(
        { personnel_id: d.id, national_id: nul(d.national_id), iban: d.iban ? normalizeIban(d.iban) : null },
        { onConflict: "personnel_id" },
      );
      if (pErr) return { error: pgMessage(pErr) };
    }
    revalidatePath("/merkez/personel");
    revalidatePath(`/merkez/personel/${d.id}`, "layout");
    return { ok: true, message: "Personel kartı güncellendi." };
  });
}

/** Islem kaydi (atama, puantaj, izin, vardiya, belge) olan personel silinemez; durumu "Ayrildi" yapilir. */
export async function deletePersonnel(input: { id: string }): Promise<ActionState> {
  return guard(async () => {
    await assertStaff("personnel.manage");
    const id = input?.id;
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return { error: "Geçersiz personel." };
    const supabase = await createClient();

    const head = { count: "exact", head: true } as const;
    const counts = await Promise.all([
      supabase.from("personnel_assignments").select("id", head).eq("personnel_id", id),
      supabase.from("timesheets").select("id", head).eq("personnel_id", id),
      supabase.from("leave_balances").select("id", head).eq("personnel_id", id),
      supabase.from("leave_records").select("id", head).eq("personnel_id", id),
      supabase.from("shift_assignments").select("personnel_id", head).eq("personnel_id", id),
      supabase.from("documents").select("id", head).eq("personnel_id", id),
    ]);
    const labels = ["proje ataması", "puantaj", "izin bakiyesi", "izin kaydı", "vardiya", "belge"];
    const used = counts.map((c, i) => ((c.count ?? 0) > 0 ? `${c.count} ${labels[i]}` : null)).filter(Boolean);
    if (used.length) {
      return { error: `Bu personelin işlem kayıtları var (${used.join(", ")}); silinemez. Kartı düzenleyip durumunu "Ayrıldı" yapabilirsiniz.` };
    }

    const { error } = await supabase.from("personnel").delete().eq("id", id);
    if (error) return { error: pgMessage(error) };
    revalidatePath("/merkez/personel");
    redirect("/merkez/personel");
  });
}

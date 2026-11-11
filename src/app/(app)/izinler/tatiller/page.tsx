import type { Metadata } from "next";
import { Badge, Card, CardHeader, EmptyState, Notice, Table, td } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { DeleteDocButton } from "@/components/delete-doc-button";
import { HolidayForm } from "@/components/forms/holiday-form";
import { requireStaff } from "@/lib/auth";
import { str1 } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { deleteHoliday } from "@/app/actions/leaves";

export const metadata: Metadata = { title: "Resmi tatiller" };

type Row = { id: string; day: string; name: string; half: boolean };

const weekdayOf = (iso: string) => new Intl.DateTimeFormat("tr-TR", { weekday: "long", timeZone: "UTC" }).format(new Date(iso + "T00:00:00Z"));

/**
 * Resmi tatiller: yıllık izin günü önerisinde bu günler izinden sayılmaz (yarım günler 0,5 sayılır).
 * Sabit tatiller 2030'a kadar hazır gelir; dini bayramlar her yıl değiştiği için açıklanınca buradan eklenir.
 */
export default async function HolidaysPage({ searchParams }: PageProps<"/izinler/tatiller">) {
  await requireStaff("leaves.manage");
  const sp = await searchParams;
  const thisYear = new Date().getFullYear();
  const year = Math.min(2100, Math.max(2000, Number(str1(sp.yil)) || thisYear));
  const supabase = await createClient();
  const { data } = await supabase.from("public_holidays").select("id, day, name, half").gte("day", `${year}-01-01`).lte("day", `${year}-12-31`).order("day");
  const rows = (data ?? []) as Row[];
  const hasReligious = rows.some((r) => /bayramı/i.test(r.name) && /ramazan|kurban/i.test(r.name));
  const years = Array.from({ length: 7 }, (_, i) => thisYear - 1 + i).map((y) => ({ value: String(y), label: String(y) }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Resmi tatil ekle" description="Eklenen gün, yıllık izin günü önerisinde izinden sayılmaz. Daha önce kaydedilmiş izinler değişmez." />
        <HolidayForm />
      </Card>

      <div>
        <FilterBar action="/izinler/tatiller" fields={[{ name: "yil", label: "Yıl", value: String(year), options: years }]} />
        {!hasReligious && (
          <div className="mb-5">
            <Notice tone="warning">
              <strong className="font-semibold">{year} için Ramazan ve Kurban Bayramı günleri listede yok.</strong> Tarihler açıklanınca (arife yarım gün olarak) yukarıdan ekleyin;
              eklenmezse o günler izinden düşülür.
            </Notice>
          </div>
        )}
        <Card>
          <CardHeader title={`${year} resmi tatilleri`} description={`${rows.length} gün · hafta tatiline denk gelen tatil ayrıca sayılmaz`} />
          {rows.length === 0 ? (
            <EmptyState title="Bu yıl için tatil girilmemiş" description="Yukarıdaki formdan ekleyin." />
          ) : (
            <Table head={["Tarih", "Gün", "Tatil", "Süre", ""]}>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className={td + " whitespace-nowrap font-medium"}>{formatDate(r.day)}</td>
                  <td className={td}>{weekdayOf(r.day)}</td>
                  <td className={td}>{r.name}</td>
                  <td className={td}><Badge tone={r.half ? "warning" : "neutral"}>{r.half ? "Yarım gün" : "Tam gün"}</Badge></td>
                  <td className={td + " text-right"}>
                    <DeleteDocButton
                      id={r.id}
                      title={`${formatDate(r.day)} ${r.name}`}
                      back="/izinler/tatiller"
                      action={deleteHoliday}
                      confirm={{ description: "Bu gün artık resmi tatil sayılmaz; yeni izin önerilerinde izinden düşülür. Kayıtlı izinler değişmez." }}
                    />
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import { SectionHeader } from "@/components/section-header";
import { getCurrentUser } from "@/lib/auth";
import { payrollPages } from "@/lib/menu";

/**
 * Bordrolar: sabit başlık + sekmeler (maaş bordrosu, avanslar, ücret tanımları; merkezde bordro şablonu).
 * Sekmeler yetkiye göre (lib/menu.ts → payrollPages); sekme değişince yalnızca içerik yüklenir.
 */
export default async function PayrollLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const customer = user?.kind === "customer";
  const tabs = user ? payrollPages(user) : [];
  return (
    <>
      <SectionHeader
        title="Bordrolar"
        description="Aylık maaş bordroları, avanslar ve ücret tanımları."
        descriptions={{
          "/bordrolar/maas": customer
            ? "Proje ve ayı seçin. Bordro, merkez onaylayıp kilitledikten sonra burada görünür; PDF ve Excel olarak indirebilirsiniz."
            : "Proje ve ayı seçin; değerleri girip “Kaydet ve hesapla”ya basın. Her hücre elle değiştirilebilir. Onaylanan bordro kilitlenir ve site yönetimine açılır.",
          "/bordrolar/avans": "Ay içinde personele verilen avansları girin; o ayın bordrosunda avans sütununa gelir.",
          "/bordrolar/ucretler": customer
            ? "Personelin aylık net tutarları. Ücret tanımlarını merkez girer."
            : "Personel başına aylık net tutarlar: maaş, yol, destek, ticket, fazla mesai, ek ödeme, BES. Bordro formülleri bu değerleri kullanır.",
          "/bordrolar/sablon": "Maaş tablosunun sütunları ve formülleri. Varsayılan şablon tüm projelerde geçerlidir; projeye özel şablon da tanımlanabilir.",
        }}
        tabs={tabs}
      />
      {children}
    </>
  );
}

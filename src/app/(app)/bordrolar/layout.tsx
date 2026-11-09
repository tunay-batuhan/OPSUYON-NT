import type { ReactNode } from "react";
import { SectionHeader } from "@/components/section-header";
import { getCurrentUser, hasPermission } from "@/lib/auth";

/** Bordrolar: sabit başlık + sekmeler (Bordrolar / Bordro ekle); sekme değişince yalnızca içerik yüklenir. */
export default async function PayrollLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const customer = user?.kind === "customer";
  const manage = Boolean(user && user.kind === "staff" && hasPermission(user, "documents.manage"));
  return (
    <>
      <SectionHeader
        title="Bordrolar"
        description={
          customer
            ? "Bordrolar hizmet bazında toplu olarak yüklenir. Hizmet, ay ve yılı seçin; bordroyu PDF olarak indirin veya altta görüntüleyin."
            : "Tüm projelerin aylık bordroları. İndirebilir, Görüntüle ile açabilir veya silebilirsiniz."
        }
        descriptions={{ "/bordrolar/ekle": "Proje, ay ve yıl seçip bordro dosyasını ekleyin; işaretliyse müşteri Bordrolar ekranında görür." }}
        tabs={manage ? [{ href: "/bordrolar", label: "Bordrolar", exact: true }, { href: "/bordrolar/ekle", label: "Bordro ekle" }] : []}
      />
      {children}
    </>
  );
}

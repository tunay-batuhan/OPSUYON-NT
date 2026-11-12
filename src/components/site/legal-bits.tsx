import Link from "next/link";
import { CompanyAddress, Fact } from "@/components/site/parts";
import { COMPANY, KVKK, isPlaceholder, mailHref } from "@/lib/site";

/** Yasal metinlerde "Şirket" tanımı: unvan (yer tutucuysa işaretli). */
export function CompanyRef() {
  return (
    <>
      <Fact value={COMPANY.legalName} /> (“Şirket”)
    </>
  );
}

/** Veri sorumlusu kimlik bilgileri (Aydınlatma Tebliği m.5: unvan, adres; ayrıca MERSİS, KEP, e-posta). */
export function ControllerIdentity() {
  const rows: [string, React.ReactNode][] = [
    ["Unvan", <Fact key="u" value={COMPANY.legalName} />],
    ["Adres", <CompanyAddress key="a" />],
    ["MERSİS no", <Fact key="m" value={COMPANY.mersis} />],
    ["KEP adresi", <Fact key="k" value={COMPANY.kep} />],
    ["KVKK başvuru e-postası", <Fact key="e" value={KVKK.email} href={mailHref(KVKK.email)} />],
    ["Genel e-posta", <Fact key="g" value={COMPANY.email} href={mailHref()} />],
  ];
  if (!isPlaceholder(KVKK.verbis)) rows.push(["VERBİS kayıt no", <Fact key="v" value={KVKK.verbis} />]);
  return (
    <div className="table-wrap">
      <table>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <th scope="row" className="w-48">{k}</th>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Başvuru kanalları: Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ m.5. */
export function ApplicationChannels() {
  return (
    <ul>
      <li>
        Islak imzalı dilekçeyle, şahsen ya da posta / noter aracılığıyla şu adrese: <CompanyAddress />.
      </li>
      <li>
        Güvenli elektronik imza veya mobil imza ile imzalanmış olarak kayıtlı elektronik posta (KEP) adresimize: <Fact value={COMPANY.kep} />.
      </li>
      <li>
        Daha önce bize bildirdiğiniz ve sistemimizde kayıtlı olan e-posta adresinizden şu adrese:{" "}
        <Fact value={KVKK.email} href={mailHref(KVKK.email, "KVKK başvurusu")} />.
      </li>
    </ul>
  );
}

/** Yasal metinler arasında bağlantı. */
export function LegalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href}>{children}</Link>;
}

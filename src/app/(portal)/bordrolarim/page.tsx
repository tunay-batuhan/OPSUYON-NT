import { redirect } from "next/navigation";

/** Personel bordrosunu görmez (18 Kasım, müşteri isteği). Eski bağlantı Görevlerim'e döner. */
export default function MyPayslipsPage() {
  redirect("/gorevlerim");
}

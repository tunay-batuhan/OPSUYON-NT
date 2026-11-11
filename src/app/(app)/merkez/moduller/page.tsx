import { redirect } from "next/navigation";

/** Eski adres: Müşteri modülleri artık Roller ve yetkiler › Müşteri ekranları sekmesinde. */
export default function ModulesRedirect() {
  redirect("/merkez/yetkiler/musteri-ekranlari");
}

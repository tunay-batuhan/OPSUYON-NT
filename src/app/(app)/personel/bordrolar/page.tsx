import { redirect } from "next/navigation";

/** Bordrolar artık Personel altında değil, üst menüde ayrı sekme (Puantaj gibi). */
export default function PayrollMovedPage() {
  redirect("/bordrolar");
}

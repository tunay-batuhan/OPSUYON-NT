import { redirect } from "next/navigation";

/** Proje PIN'leri artık her projenin "Noktalar ve PIN" ekranında yönetilir. */
export default function PatrolPinsMovedPage() {
  redirect("/devriye/noktalar");
}

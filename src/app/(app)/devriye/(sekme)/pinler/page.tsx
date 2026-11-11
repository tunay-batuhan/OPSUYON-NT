import { redirect } from "next/navigation";

/**
 * Proje PIN'leri artık her projenin "Noktalar ve PIN" ekranında, "Devriye başlat / bitir" etiketinin yanında yönetilir
 * (PIN yalnızca devriye başlatılırken sorulur; noktalarda sorulmaz).
 */
export default function PatrolPinsMovedPage() {
  redirect("/devriye/noktalar");
}

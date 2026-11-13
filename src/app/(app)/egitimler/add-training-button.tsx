import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import { btn } from "@/components/ui";
import { hasPermission, type CurrentUser } from "@/lib/auth";

/**
 * Merkez: "Eğitim ekle" → personel evrakı ekleme ekranı, kategori "Eğitim" seçili (personel verilirse o da seçili).
 * Müşteride ya da evrak yükleme yetkisi olmayan merkez kullanıcısında hiç görünmez.
 */
export function AddTrainingButton({ user, personnelId, variant = "primary" }: { user: CurrentUser; personnelId?: string; variant?: "primary" | "secondary" }) {
  if (user.kind === "customer" || !hasPermission(user, "documents.manage")) return null;
  const q = new URLSearchParams({ kategori: "egitim" });
  if (personnelId) q.set("personel", personnelId);
  return (
    <Link href={`/merkez/personel/evrak-ekle?${q}`} className={btn(variant, "sm")}>
      <FilePlus2 className="size-4" aria-hidden /> Eğitim ekle
    </Link>
  );
}

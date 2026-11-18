import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { homePathFor, requireUser } from "@/lib/auth";

// Personel ekranları da arama motoruna girmez.
export const metadata: Metadata = { robots: { index: false, follow: false, googleBot: { index: false, follow: false } } };

/**
 * Personel hesabının ekranları (telefon için): Görevlerim · Hesabım (personel bordro görmez).
 * Merkez ve müşteri hesapları buraya girmez; kendi ana sayfalarına döner.
 */
export default async function PortalLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  if (user.kind !== "personnel") redirect(homePathFor(user));
  return <PortalShell fullName={user.full_name} locked={user.must_change_password}>{children}</PortalShell>;
}

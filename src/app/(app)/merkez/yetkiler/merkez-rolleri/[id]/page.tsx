import type { Metadata } from "next";
import { RoleEditPage } from "../../role-pages";

export const metadata: Metadata = { title: "Rol" };

/** Rol düzenleme; id "yeni" ise yeni rol formu. */
export default async function Page({ params }: PageProps<"/merkez/yetkiler/merkez-rolleri/[id]">) {
  const { id } = await params;
  return <RoleEditPage scope="staff" id={id} />;
}

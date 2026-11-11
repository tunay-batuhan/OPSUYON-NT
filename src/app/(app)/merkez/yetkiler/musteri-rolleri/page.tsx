import type { Metadata } from "next";
import { RoleListPage } from "../role-pages";

export const metadata: Metadata = { title: "Müşteri rolleri" };

export default function Page() {
  return <RoleListPage scope="customer" />;
}

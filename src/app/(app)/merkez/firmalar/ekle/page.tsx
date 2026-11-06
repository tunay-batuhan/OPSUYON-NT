import type { Metadata } from "next";
import { Card, CardHeader } from "@/components/ui";
import { OrganizationForm } from "@/components/forms/admin-forms";
import { requireStaff } from "@/lib/auth";
import { OrganizationsHeader } from "../tabs";

export const metadata: Metadata = { title: "Yeni firma ekle" };

export default async function OrganizationAddPage() {
  const user = await requireStaff("organizations.manage");
  return (
    <>
      <OrganizationsHeader user={user} />
      <Card>
        <CardHeader title="Yeni firma" description="Firmayı ekledikten sonra proje tanımlayın ve müşteri için hesap açın." />
        <OrganizationForm />
      </Card>
    </>
  );
}

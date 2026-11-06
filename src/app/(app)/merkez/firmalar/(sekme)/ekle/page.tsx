import type { Metadata } from "next";
import { Card, CardHeader } from "@/components/ui";
import { OrganizationForm } from "@/components/forms/admin-forms";
import { requireStaff } from "@/lib/auth";

export const metadata: Metadata = { title: "Yeni firma ekle" };

export default async function OrganizationAddPage() {
  await requireStaff("organizations.manage");
  return (
    <>
      <Card>
        <CardHeader title="Yeni firma" description="Firmayı ekledikten sonra proje tanımlayın ve müşteri için hesap açın." />
        <OrganizationForm />
      </Card>
    </>
  );
}

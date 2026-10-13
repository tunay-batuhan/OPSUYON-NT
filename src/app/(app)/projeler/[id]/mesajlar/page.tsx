import { redirect } from "next/navigation";

export default async function ProjectMessages({ params }: PageProps<"/projeler/[id]/mesajlar">) {
  const { id } = await params;
  redirect(`/mesajlar?proje=${id}`);
}

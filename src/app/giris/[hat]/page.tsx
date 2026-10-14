import { redirect } from "next/navigation";

// Eski bağlantılar (/giris/guvenlik, /giris/merkez …) tek girişe yönlenir.
export default function LegacyLogin() {
  redirect("/giris");
}

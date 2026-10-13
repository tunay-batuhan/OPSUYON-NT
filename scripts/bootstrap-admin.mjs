// Creates the FIRST super admin (merkez) account.
//
//   node --env-file=.env scripts/bootstrap-admin.mjs --username=admin --name="Ad Soyad" [--password=...]
//
// Safe to re-run: it refuses to create a second super admin unless --force is passed.
import { randomInt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    return [k, v.length ? v.join("=") : true];
  }),
);

const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error("SUPABASE_URL ve SUPABASE_SECRET_KEY .env içinde tanımlı olmalı.");
  process.exit(1);
}

const username = String(args.username ?? "admin").toLowerCase();
const fullName = String(args.name ?? "Sistem Yöneticisi");
if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
  console.error("Geçersiz kullanıcı adı (3-32 karakter; harf, rakam, . _ -).");
  process.exit(1);
}

const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const password = String(args.password ?? Array.from({ length: 14 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(""));

const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: role, error: roleErr } = await admin.from("roles").select("id").eq("code", "super_admin").single();
if (roleErr) {
  console.error("Rol okunamadı — migration'lar uygulandı mı?", roleErr.message);
  process.exit(1);
}

const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("staff_role_id", role.id);
if (count && !args.force) {
  console.error(`Zaten ${count} süper yönetici var. Yine de eklemek için --force kullanın.`);
  process.exit(1);
}

const { data: created, error: authErr } = await admin.auth.admin.createUser({
  email: `${username}@portal.opsuyon.com`,
  password,
  email_confirm: true,
  user_metadata: { username, full_name: fullName },
});
if (authErr) {
  console.error("Kullanıcı oluşturulamadı:", authErr.message);
  process.exit(1);
}

const { error: profErr } = await admin.from("profiles").insert({
  id: created.user.id,
  username,
  full_name: fullName,
  kind: "staff",
  staff_role_id: role.id,
});
if (profErr) {
  await admin.auth.admin.deleteUser(created.user.id);
  console.error("Profil oluşturulamadı:", profErr.message);
  process.exit(1);
}

console.log("\nSüper yönetici oluşturuldu");
console.log("  Giriş sayfası : /giris/merkez");
console.log(`  Kullanıcı adı : ${username}`);
console.log(`  Parola        : ${password}`);
console.log("\nBu parola bir daha gösterilmez; ilk girişte Kullanıcılar sayfasından değiştirin.\n");

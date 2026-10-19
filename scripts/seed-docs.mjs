// Müşteri çalışmasındaki ekranlar için EK demo veri (seed-demo.mjs'e dokunmadan, yalnızca ekler).
//
//   node --env-file=.env scripts/seed-docs.mjs
//
// Gerekli: önce seed-demo.mjs çalışmış olmalı. Tekrar çalıştırmak güvenlidir (zaten olanı atlar).
// Eklenenler: Teknik Personel projesi, denetim raporları (gece/gündüz), kıyafet / savunma / yıllık izin
// formları (docs/ içindeki gerçek örnek PDF'ler), toplu bordro, puantaj PDF, cari ekstre PDF, risk analizi.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) { console.error("SUPABASE_URL ve SUPABASE_SECRET_KEY gerekli (.env)."); process.exit(1); }
const sb = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

const ORG_A = "Demo Plaza Yönetimi A.Ş.";
const ORG_B = "Test Site Yönetimi";

const iso = (d = 0) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
const today = new Date();
const Y = today.getFullYear();
const M = today.getMonth() + 1;
const pad = (n) => String(n).padStart(2, "0");
const prevMonth = (back) => { const d = new Date(Y, M - 1 - back, 1); return { y: d.getFullYear(), m: d.getMonth() + 1 }; };
const ascii = (s) => s.replace(/ğ/g, "g").replace(/Ğ/g, "G").replace(/ü/g, "u").replace(/Ü/g, "U").replace(/ş/g, "s").replace(/Ş/g, "S").replace(/ı/g, "i").replace(/İ/g, "I").replace(/ö/g, "o").replace(/Ö/g, "O").replace(/ç/g, "c").replace(/Ç/g, "C");
const must = (r, what) => { if (r.error) { console.error(`✖ ${what}:`, r.error.message); process.exit(1); } return r.data; };

function pdf(title, lines = []) {
  const text = [title, "", ...lines].map(ascii);
  const content = ["BT /F1 16 Tf 56 780 Td 20 TL", ...text.map((l, i) => `${i === 0 ? "" : "T* "}(${l.replace(/[()\\]/g, "")}) Tj`), "ET"].join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

async function upload(projectId, category, name, bytes) {
  const path = `${projectId}/${category}/${randomUUID()}-${ascii(name).replace(/[^a-zA-Z0-9._-]+/g, "-")}`;
  const { error } = await sb.storage.from("documents").upload(path, bytes, { contentType: "application/pdf" });
  if (error) { console.error("✖ yükleme:", error.message); process.exit(1); }
  return path;
}

const { data: admin } = await sb.from("profiles").select("id").eq("username", "admin").maybeSingle();
const adminId = admin?.id ?? null;

async function addDoc(project, category, title, bytes, extra = {}) {
  const fileName = `${ascii(title).replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}.pdf`;
  const path = await upload(project.id, category, fileName, bytes);
  must(await sb.from("documents").insert({
    project_id: project.id, category_code: category, title, storage_path: path, file_name: fileName,
    mime_type: "application/pdf", size_bytes: bytes.length, customer_visible: true, uploaded_by: adminId, ...extra,
  }), `belge (${category})`);
}

const has = async (project, category) =>
  ((await sb.from("documents").select("id", { count: "exact", head: true }).eq("project_id", project.id).eq("category_code", category)).count ?? 0) > 0;

/* ------------------------------ örnek PDF'ler (docs/) ------------------------------ */
const sample = (name) => readFileSync(new URL(`../docs/${name}`, import.meta.url));
const FORMS = {
  kiyafet: sample("Kıyafet Teslim Tutanağı.pdf"),
  savunma: sample("Savunma Tutanağı.pdf"),
  izin1: sample("Yıllık İzin 1 - İzin Talep Formu.pdf"),
  izin2: sample("Yıllık İzin 2 - İzin Kullanım Formu.pdf"),
  izin3: sample("Yıllık İzin 3 - İzin Ücreti  Talep Formu.pdf"),
};

/* ------------------------------ mevcut demo veri ------------------------------ */
const orgA = (await sb.from("organizations").select("id").eq("name", ORG_A).maybeSingle()).data;
const orgB = (await sb.from("organizations").select("id").eq("name", ORG_B).maybeSingle()).data;
if (!orgA || !orgB) { console.error("Önce `node --env-file=.env scripts/seed-demo.mjs` çalıştırın."); process.exit(1); }
const projectsOf = async (org) => must(await sb.from("projects").select("id, name, service_line").eq("organization_id", org.id).order("name"), "projeler");
let projA = await projectsOf(orgA);
const projB = await projectsOf(orgB);

/* ------------------------------ Teknik Personel projesi ------------------------------ */
if (!projA.some((p) => p.service_line === "teknik_personel")) {
  const prj = must(await sb.from("projects").insert({
    organization_id: orgA.id, name: "Demo Plaza Teknik Personel", service_line: "teknik_personel", code: "DPTP-01",
    address: "Demo Adres Cd. No:1", start_date: iso(-200), end_date: iso(400),
  }).select("id, name, service_line").single(), "teknik proje");
  const techs = [["Serkan", "Yıldız", "Elektrik Teknisyeni"], ["Volkan", "Özdemir", "Mekanik Teknisyen"], ["Gökhan", "Taş", "Bakım Sorumlusu"]];
  for (const [i, [fn, ln, title]] of techs.entries()) {
    const p = must(await sb.from("personnel").insert({
      first_name: fn, last_name: ln, employee_no: `D-${2001 + i}`, title, hire_date: iso(-180 - i * 20),
      phone: `0533 555 ${pad(30 + i)} ${pad(40 + i)}`, service_line: "teknik_personel", organization_id: orgA.id,
    }).select("id").single(), "teknik personel");
    must(await sb.from("personnel_assignments").insert({ personnel_id: p.id, project_id: prj.id, position: title, start_date: iso(-150) }), "teknik atama");
    must(await sb.from("leave_balances").upsert({ personnel_id: p.id, year: Y, entitled_days: 14, carried_days: 0, used_days: i * 3 }, { onConflict: "personnel_id,year" }), "izin bakiyesi");
  }
  const roles = Object.fromEntries(must(await sb.from("roles").select("id, code"), "roller").map((r) => [r.code, r.id]));
  for (const username of ["demo.yonetici", "demo.muhasebe"]) {
    const u = (await sb.from("profiles").select("id").eq("username", username).maybeSingle()).data;
    if (u) must(await sb.from("project_members").insert({ project_id: prj.id, user_id: u.id, role_id: roles[username === "demo.yonetici" ? "customer_manager" : "customer_finance"] }), "üyelik");
  }
  console.log("• Teknik Personel projesi eklendi.");
  projA = await projectsOf(orgA);
}
const allProjects = [...projA, ...projB];

/* ------------------------------ proje bazlı belgeler ------------------------------ */
const prev1 = prevMonth(1);
const prev2 = prevMonth(2);
let added = 0;

for (const prj of allProjects) {
  // Toplu bordro (hizmet/proje + ay)
  if ((await sb.from("documents").select("id", { count: "exact", head: true }).eq("project_id", prj.id).eq("category_code", "bordro").is("personnel_id", null)).count === 0) {
    for (const { y, m } of [prev1, prev2]) {
      await addDoc(prj, "bordro", `Toplu Bordro ${pad(m)}/${y} - ${prj.name}`, pdf(`TOPLU BORDRO ${pad(m)}/${y}`, [`Proje: ${prj.name}`, "Tum personel bordrolari bu dosyadadir.", "Bu belge test amaclidir."]), { period_year: y, period_month: m });
      added++;
    }
  }
  // Puantaj PDF
  if (!(await has(prj, "puantaj"))) {
    for (const { y, m } of [{ y: Y, m: M }, prev1]) {
      await addDoc(prj, "puantaj", `Puantaj ${pad(m)}/${y} - ${prj.name}`, pdf(`PUANTAJ ${pad(m)}/${y}`, [`Proje: ${prj.name}`, "Gun bazli devam cizelgesi.", "Bu belge test amaclidir."]), { period_year: y, period_month: m });
      added++;
    }
  }
  // Cari ekstre PDF
  if (!(await has(prj, "cari_ekstre"))) {
    await addDoc(prj, "cari_ekstre", `Cari Hesap Ekstresi - ${prj.name}`, pdf("CARI HESAP EKSTRESI", [`Proje: ${prj.name}`, `Tarih: ${iso()}`, "Yonetim hizmet bedeli faturalari ve tahsilatlar.", "Bu belge test amaclidir."]), { period_year: Y, period_month: M });
    added++;
  }
  // Risk analizi raporu (yalnızca güvenlik / tesis projeleri)
  if (["guvenlik", "danisma_tesis"].includes(prj.service_line) && !(await has(prj, "risk_analizi"))) {
    await addDoc(prj, "risk_analizi", `Risk Analizi Raporu - ${prj.name}`, pdf("RISK ANALIZI RAPORU", [`Proje: ${prj.name}`, "Tehdit ve zafiyet degerlendirmesi, onerilen onlemler.", "Bu belge test amaclidir."]));
    added++;
  }
  // Denetim raporları: gece / gündüz, bu ay + geçen ay
  if (!(await has(prj, "denetim")) && ["guvenlik", "danisma_tesis", "temizlik"].includes(prj.service_line)) {
    const dates = [{ y: Y, m: M, d: 2, s: "gunduz" }, { y: Y, m: M, d: 5, s: "gece" }, { y: Y, m: M, d: 9, s: "gunduz" }, { y: prev1.y, m: prev1.m, d: 14, s: "gece" }, { y: prev1.y, m: prev1.m, d: 21, s: "gunduz" }];
    for (const { y, m, d, s } of dates) {
      const date = `${y}-${pad(m)}-${pad(d)}`;
      await addDoc(prj, "denetim", `Denetim Raporu ${date} ${s === "gece" ? "Gece" : "Gündüz"} - ${prj.name}`,
        pdf("DENETIM RAPORU", [`Proje: ${prj.name}`, `Tarih: ${date}`, `Vardiya: ${s === "gece" ? "Gece" : "Gunduz"}`, "Denetim sonucu: Uygun", "Bu belge test amaclidir."]),
        { period_year: y, period_month: m, metadata: { inspection_date: date, inspection_shift: s } });
      added++;
    }
  }
}

/* ------------------------------ kişi bazlı belgeler (gerçek örnek formlar) ------------------------------ */
const assignments = must(await sb.from("personnel_assignments").select("personnel_id, project_id, personnel(first_name, last_name), projects(id, name, service_line)").is("end_date", null).in("project_id", allProjects.map((p) => p.id)), "atamalar");
const perPerson = new Map();
for (const a of assignments) if (!perPerson.has(a.personnel_id)) perPerson.set(a.personnel_id, a);
const people = [...perPerson.values()];

async function personDocs(category, title, bytes, pick) {
  for (const [i, a] of people.entries()) {
    if (!pick(i)) continue;
    const exists = (await sb.from("documents").select("id", { count: "exact", head: true }).eq("category_code", category).eq("personnel_id", a.personnel_id).eq("title", title)).count;
    if (exists) continue;
    await addDoc({ id: a.project_id }, category, title, bytes, { personnel_id: a.personnel_id });
    added++;
  }
}
await personDocs("kiyafet_ekipman", "Kıyafet ve Ekipman Teslim Tutanağı", FORMS.kiyafet, (i) => i % 2 === 0);
await personDocs("savunma", "Personel Savunma Tutanağı", FORMS.savunma, (i) => i % 5 === 0);
await personDocs("yillik_izin", "Yıllık İzin Talep Formu", FORMS.izin1, (i) => i % 3 === 0);
await personDocs("yillik_izin", "Yıllık İzin Kullanım Formu", FORMS.izin2, (i) => i % 4 === 0);
await personDocs("yillik_izin", "Yıllık İzin Ücreti Talep Formu", FORMS.izin3, (i) => i % 6 === 0);

console.log(`\n✔ Ek demo veri hazır (${added} belge eklendi).`);

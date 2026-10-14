// Müşteri testi için DEMO veri ve test hesapları kurar.
//
//   node --env-file=.env scripts/seed-demo.mjs            → yoksa kurar, varsa bilgi verir
//   node --env-file=.env scripts/seed-demo.mjs --reset    → demo verisini silip yeniden kurar
//
// Kurulan firmalar "Demo " / "Test " ile başlar; gerçek verilere dokunmaz.
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) { console.error("SUPABASE_URL ve SUPABASE_SECRET_KEY gerekli (.env)."); process.exit(1); }
const sb = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const reset = process.argv.includes("--reset");

const PASSWORD = "Opsuyon2026!";
const DOMAIN = "portal.opsuyon.com";
const ORG_A = "Demo Plaza Yönetimi A.Ş.";
const ORG_B = "Test Site Yönetimi";

/* ------------------------------ helpers ------------------------------ */
const iso = (d = 0) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
const today = new Date();
const Y = today.getFullYear();
const M = today.getMonth() + 1;
const prevMonth = (back) => { const d = new Date(Y, M - 1 - back, 1); return { y: d.getFullYear(), m: d.getMonth() + 1 }; };
const pad = (n) => String(n).padStart(2, "0");
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

/* ------------------------------ reset ------------------------------ */
async function wipe() {
  const { data: orgs } = await sb.from("organizations").select("id").in("name", [ORG_A, ORG_B]);
  for (const o of orgs ?? []) {
    const { data: prjs } = await sb.from("projects").select("id").eq("organization_id", o.id);
    const ids = (prjs ?? []).map((p) => p.id);
    if (ids.length) {
      const { data: docs } = await sb.from("documents").select("storage_path").in("project_id", ids);
      const { data: sts } = await sb.from("ledger_statements").select("storage_path").in("project_id", ids);
      const paths = [...(docs ?? []), ...(sts ?? [])].map((d) => d.storage_path).filter(Boolean);
      for (let i = 0; i < paths.length; i += 100) await sb.storage.from("documents").remove(paths.slice(i, i + 100));
      for (const t of ["threads", "shift_assignments", "timesheets", "leave_records", "ledger_statements", "documents", "imports", "project_members", "personnel_assignments", "invoices", "payments"]) {
        await sb.from(t).delete().in("project_id", ids);
      }
      await sb.from("projects").delete().in("id", ids);
    }
    const { data: users } = await sb.from("profiles").select("id").eq("organization_id", o.id);
    for (const u of users ?? []) await sb.auth.admin.deleteUser(u.id);
    await sb.from("organizations").delete().eq("id", o.id);
  }
  const { data: pp } = await sb.from("personnel").select("id").like("employee_no", "D-%");
  for (const p of pp ?? []) {
    await sb.from("leave_balances").delete().eq("personnel_id", p.id);
    await sb.from("leave_records").delete().eq("personnel_id", p.id);
    await sb.from("personnel").delete().eq("id", p.id);
  }
}

const existing = await sb.from("organizations").select("id").eq("name", ORG_A).maybeSingle();
if (existing.data && !reset) {
  console.log("Demo veri zaten kurulu. Yeniden kurmak için --reset kullanın.");
  printAccounts();
  process.exit(0);
}
if (reset) { console.log("Demo verisi siliniyor…"); await wipe(); }

/* ------------------------------ roles & lines ------------------------------ */
const roles = Object.fromEntries(must(await sb.from("roles").select("id, code"), "roller").map((r) => [r.code, r.id]));
const { data: admin } = await sb.from("profiles").select("id").eq("username", "admin").maybeSingle();
const adminId = admin?.id ?? null;

/* ------------------------------ organizations & projects ------------------------------ */
const mkOrg = async (o) => must(await sb.from("organizations").insert(o).select().single(), "firma");
const orgA = await mkOrg({ name: ORG_A, legal_name: "Demo Plaza Yönetimi Anonim Şirketi", tax_office: "Kadıköy", tax_no: "3201234567", address: "Caferağa Mah. Moda Cad. No:12 Kadıköy/İstanbul", phone: "0216 555 01 01", email: "info@demoplaza.example" });
const orgB = await mkOrg({ name: ORG_B, legal_name: "Test Site Yönetimi", tax_office: "Çankaya", tax_no: "4302345678", address: "Kızılay Mah. Atatürk Blv. No:5 Çankaya/Ankara", phone: "0312 555 02 02", email: "yonetim@testsite.example" });

const mkProject = async (org, name, line, code, endIn) =>
  must(await sb.from("projects").insert({ organization_id: org.id, name, service_line: line, code, address: "Demo Adres Cd. No:1", start_date: iso(-300), end_date: iso(endIn) }).select().single(), "proje");
const pGuv = await mkProject(orgA, "Demo Plaza Güvenlik", "guvenlik", "DPG-01", 400);
const pTem = await mkProject(orgA, "Demo Plaza Temizlik", "temizlik", "DPT-01", 400);
const pDan = await mkProject(orgA, "Demo Plaza Danışma ve Tesis", "danisma_tesis", "DPD-01", 400);
const pTed = await mkProject(orgA, "Demo Plaza Ek Bina Tedarik", "kurumsal_tedarik", "DPK-01", 35); // yaklaşan sözleşme
const pSite = await mkProject(orgB, "Test Site Güvenlik", "guvenlik", "TSG-01", 500);
const projects = [pGuv, pTem, pDan, pTed, pSite];

/* ------------------------------ personnel ------------------------------ */
const people = [
  ["Ahmet", "Yılmaz", "Güvenlik Görevlisi", pGuv], ["Mehmet", "Kaya", "Güvenlik Görevlisi", pGuv], ["Mustafa", "Demir", "Güvenlik Amiri", pGuv],
  ["Hasan", "Çelik", "Güvenlik Görevlisi", pGuv], ["İbrahim", "Şahin", "Güvenlik Görevlisi", pGuv], ["Osman", "Aydın", "Gece Güvenlik", pGuv],
  ["Ayşe", "Öztürk", "Temizlik Görevlisi", pTem], ["Fatma", "Arslan", "Temizlik Görevlisi", pTem], ["Hatice", "Doğan", "Temizlik Şefi", pTem], ["Zeynep", "Kılıç", "Temizlik Görevlisi", pTem],
  ["Elif", "Koç", "Resepsiyon Görevlisi", pDan], ["Burak", "Çetin", "Tesis Teknisyeni", pDan],
  ["Emre", "Polat", "Ofis Destek", pTed], ["Selin", "Aksoy", "Ofis Destek", pTed], ["Murat", "Erdem", "Şoför", pTed],
  ["Kemal", "Güneş", "Güvenlik Görevlisi", pSite], ["Yusuf", "Bulut", "Güvenlik Görevlisi", pSite], ["Cemal", "Tekin", "Güvenlik Amiri", pSite],
];
const staffRows = [];
for (const [i, [fn, ln, title, prj]] of people.entries()) {
  const p = must(await sb.from("personnel").insert({
    first_name: fn, last_name: ln, employee_no: `D-${1001 + i}`, title, hire_date: iso(-120 - i * 17),
    phone: `0532 555 ${pad(10 + i)} ${pad(20 + i)}`, service_line: prj.service_line,
  }).select().single(), "personel");
  must(await sb.from("personnel_assignments").insert({ personnel_id: p.id, project_id: prj.id, position: title, start_date: iso(-100 - i * 5) }), "atama");
  staffRows.push({ ...p, project: prj });
}

/* ------------------------------ timesheets, leave, shifts ------------------------------ */
for (const [i, s] of staffRows.entries()) {
  for (const back of [0, 1, 2]) {
    const { y, m } = prevMonth(back);
    must(await sb.from("timesheets").upsert({
      project_id: s.project.id, personnel_id: s.id, period_year: y, period_month: m,
      worked_days: 22 + ((i + back) % 5), leave_days: (i + back) % 3 === 0 ? 2 : 0, absence_days: (i + back) % 7 === 0 ? 1 : 0, overtime_hours: (i * 3 + back * 2) % 14,
    }, { onConflict: "project_id,personnel_id,period_year,period_month" }), "puantaj");
  }
  must(await sb.from("leave_balances").upsert({ personnel_id: s.id, year: Y, entitled_days: 14 + (i % 3) * 2, carried_days: i % 4 === 0 ? 3 : 0, used_days: (i % 5) * 2 }, { onConflict: "personnel_id,year" }), "izin bakiyesi");
}
// izin kayıtları (evraklı ve evraksız)
const leaveSamples = [
  [0, "yillik", -40, 7], [1, "yillik", -25, 5], [2, "raporlu", -12, 3], [6, "yillik", -33, 10], [7, "mazeret", -8, 1], [10, "yillik", -50, 7], [15, "yillik", -20, 5], [3, "evlilik", -70, 3],
];
for (const [idx, type, startOffset, days] of leaveSamples) {
  const s = staffRows[idx];
  const start = iso(startOffset), end = iso(startOffset + days - 1), ret = iso(startOffset + days);
  let documentId = null;
  if (idx % 2 === 0) {
    const path = await upload(s.project.id, "yillik_izin", `izin-formu-${s.employee_no}.pdf`, pdf("IZIN TALEP FORMU", [`Personel: ${s.first_name} ${s.last_name}`, `Sicil: ${s.employee_no}`, `Izin turu: ${type}`, `Baslangic: ${start}`, `Son tarih: ${end}`, `Ise baslama: ${ret}`, `Toplam: ${days} gun`]));
    const doc = must(await sb.from("documents").insert({ project_id: s.project.id, personnel_id: s.id, category_code: "yillik_izin", title: `İzin evrakı (${start})`, storage_path: path, file_name: `izin-formu-${s.employee_no}.pdf`, mime_type: "application/pdf", size_bytes: 900, customer_visible: true, uploaded_by: adminId }).select("id").single(), "izin evrakı");
    documentId = doc.id;
  }
  must(await sb.from("leave_records").insert({ personnel_id: s.id, project_id: s.project.id, leave_type: type, start_date: start, end_date: end, return_date: ret, days, document_id: documentId, created_by: adminId }), "izin kaydı");
}
// vardiya planı: bu ay, güvenlik projeleri (G / A / N dönüşümü + haftalık izin)
const dim = new Date(Y, M, 0).getDate();
const rosterCodes = ["G", "G", "A", "A", "N", "N", "H"];
const shiftRows = [];
for (const [i, s] of staffRows.entries()) {
  if (!["guvenlik", "danisma_tesis"].includes(s.project.service_line)) continue;
  for (let d = 1; d <= dim; d++) shiftRows.push({ project_id: s.project.id, personnel_id: s.id, work_date: `${Y}-${pad(M)}-${pad(d)}`, shift_code: rosterCodes[(d + i) % rosterCodes.length] });
}
for (let i = 0; i < shiftRows.length; i += 400) must(await sb.from("shift_assignments").insert(shiftRows.slice(i, i + 400)), "vardiya");

/* ------------------------------ documents ------------------------------ */
const prev1 = prevMonth(1);
for (const s of staffRows) {
  const jobs = [
    ["sozlesme", `Hizmet Sözleşmesi - ${s.first_name} ${s.last_name}`, "sozlesme", null, null],
    ["bordro", `Bordro ${pad(prev1.m)}/${prev1.y} - ${s.first_name} ${s.last_name}`, "bordro", prev1.y, prev1.m],
    ["ozluk", `Özlük Dosyası - ${s.first_name} ${s.last_name}`, "ozluk", null, null],
  ];
  for (const [cat, title, fileBase, py, pm] of jobs) {
    const path = await upload(s.project.id, cat, `${fileBase}-${s.employee_no}.pdf`, pdf(title.toUpperCase(), [`Sicil: ${s.employee_no}`, `Proje: ${s.project.name}`, "Bu belge test amaclidir."]));
    must(await sb.from("documents").insert({
      project_id: s.project.id, personnel_id: s.id, category_code: cat, title, storage_path: path, file_name: `${fileBase}-${s.employee_no}.pdf`,
      mime_type: "application/pdf", size_bytes: 1200, period_year: py, period_month: pm, customer_visible: true, uploaded_by: adminId,
    }), "belge");
  }
}
for (const prj of projects) {
  for (const back of [1, 2]) {
    const { y, m } = prevMonth(back);
    const path = await upload(prj.id, "fatura", `fatura-${y}-${pad(m)}.pdf`, pdf(`FATURA ${pad(m)}/${y}`, [`Proje: ${prj.name}`, "Hizmet bedeli", "Bu belge test amaclidir."]));
    must(await sb.from("documents").insert({ project_id: prj.id, category_code: "fatura", title: `Fatura ${pad(m)}/${y}`, storage_path: path, file_name: `fatura-${y}-${pad(m)}.pdf`, mime_type: "application/pdf", size_bytes: 1100, period_year: y, period_month: m, customer_visible: true, uploaded_by: adminId }), "fatura");
  }
}

/* ------------------------------ ledger (cari ekstre) ------------------------------ */
for (const [pi, prj] of projects.entries()) {
  const base = 18000 + pi * 2500;
  const rows = [];
  let bal = 0;
  const push = (date, ref, desc, debit, credit) => { bal = Math.round((bal + debit - credit) * 100) / 100; rows.push({ row_no: rows.length + 1, entry_date: date, ref_no: ref, description: desc, debit, credit, balance: bal }); };
  push(iso(-200), "DEVİR", "Devir bakiye", 4200, 0);
  for (let k = 5; k >= 1; k--) {
    const { y, m } = prevMonth(k);
    push(`${y}-${pad(m)}-28`, `FTR-${y}${pad(m)}-${pi + 1}`, `${pad(m)}/${y} hizmet bedeli`, base, 0);
    if (k > 1) push(`${y}-${pad(m)}-28`.replace(/-28$/, "-28"), `ODM-${y}${pad(m)}-${pi + 1}`, `${pad(m)}/${y} tahsilat (havale)`, 0, base - (k % 2 ? 1000 : 0));
  }
  const st = must(await sb.from("ledger_statements").insert({ project_id: prj.id, file_name: "cari-ekstre-demo.xlsx", row_count: rows.length, closing_balance: bal, as_of_date: rows.at(-1).entry_date, is_current: true, created_by: adminId }).select("id").single(), "ekstre");
  must(await sb.from("ledger_entries").insert(rows.map((r) => ({ ...r, statement_id: st.id, project_id: prj.id }))), "ekstre satırları");
}

/* ------------------------------ users ------------------------------ */
async function mkUser(username, fullName, org, roleCode, prjs) {
  const created = await sb.auth.admin.createUser({ email: `${username}@${DOMAIN}`, password: PASSWORD, email_confirm: true, user_metadata: { username, full_name: fullName } });
  if (created.error) { console.error(`✖ ${username}:`, created.error.message); process.exit(1); }
  must(await sb.from("profiles").insert({ id: created.data.user.id, username, full_name: fullName, kind: "customer", organization_id: org.id, phone: "0532 000 00 00" }), "profil");
  must(await sb.from("project_members").insert(prjs.map((p) => ({ project_id: p.id, user_id: created.data.user.id, role_id: roles[roleCode] }))), "üyelik");
  return created.data.user.id;
}
const idYon = await mkUser("demo.yonetici", "Demo Yönetici", orgA, "customer_manager", [pGuv, pTem, pDan, pTed]);
await mkUser("demo.ik", "Demo İK Sorumlusu", orgA, "customer_hr", [pGuv, pTem]);
await mkUser("demo.muhasebe", "Demo Muhasebe", orgA, "customer_finance", [pGuv, pTem, pDan, pTed]);
await mkUser("demo.izleyici", "Demo İzleyici", orgA, "customer_viewer", [pGuv]);
await mkUser("demo.site", "Test Site Yöneticisi", orgB, "customer_manager", [pSite]);

/* ------------------------------ messages ------------------------------ */
if (adminId) {
  const t1 = must(await sb.from("threads").insert({ project_id: pGuv.id, subject: "Eylül vardiya planı", created_by: idYon }).select("id").single(), "konu");
  await sb.from("messages").insert([
    { thread_id: t1.id, sender_id: idYon, body: "Merhaba, bu ayki vardiya planını paylaşabilir misiniz?" },
    { thread_id: t1.id, sender_id: adminId, body: "Merhaba, plan sisteme yüklendi. Vardiya Planı menüsünden görebilirsiniz." },
  ]);
  const t2 = must(await sb.from("threads").insert({ project_id: pTem.id, subject: "Ek personel talebi", created_by: idYon }).select("id").single(), "konu");
  await sb.from("messages").insert([
    { thread_id: t2.id, sender_id: idYon, body: "Hafta sonu için 2 ek temizlik personeline ihtiyacımız var." },
    { thread_id: t2.id, sender_id: adminId, body: "Talebinizi aldık; yarın dönüş yapacağız." },
  ]);
}

console.log("\n✔ Demo veri kuruldu.");
printAccounts();

function printAccounts() {
  console.log(`
TEST HESAPLARI  (giriş: https://opsuyon-nt.vercel.app/giris)   Parola (hepsi): ${PASSWORD}

  Kullanıcı adı     Firma                      Yetki düzeyi       Projeler
  demo.yonetici     ${ORG_A}   Firma Yöneticisi   Güvenlik, Temizlik, Danışma ve Tesis, Tedarik
  demo.ik           ${ORG_A}   Firma İK           Güvenlik, Temizlik
  demo.muhasebe     ${ORG_A}   Firma Muhasebe     4 proje (fatura / cari hesap odaklı)
  demo.izleyici     ${ORG_A}   Görüntüleyici      Güvenlik
  demo.site         ${ORG_B}            Firma Yöneticisi   Yalnız Güvenlik (tek hizmet alanı)
`);
}

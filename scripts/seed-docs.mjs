// Müşteri çalışmasındaki ekranlar için EK demo veri (seed-demo.mjs'e dokunmadan, yalnızca ekler).
//
//   node --env-file=.env scripts/seed-docs.mjs
//
// Gerekli: önce seed-demo.mjs çalışmış olmalı. Tekrar çalıştırmak güvenlidir (zaten olanı atlar).
// Eklenenler: Teknik Personel projesi, denetim raporları (gece/gündüz), kıyafet / savunma / yıllık izin
// formları, form şablonları (Formlar ekranı; docs/ içindeki gerçek örnek PDF'ler), tablo biçimli toplu bordro,
// puantaj PDF, cari ekstre PDF, risk analizi.
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


/** Müşterinin örnek "Maaş Bordrosu" tablosuna benzer, yatay A4 toplu bordro (kurgusal kişi ve tutarlarla). */
function bordroPdf(projectName, y, m, names) {
  const MONTH = ["OCAK", "SUBAT", "MART", "NISAN", "MAYIS", "HAZIRAN", "TEMMUZ", "AGUSTOS", "EYLUL", "EKIM", "KASIM", "ARALIK"][m - 1];
  const money = (n) => (n === 0 ? "" : n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const cols = [
    ["ADI SOYADI", 100, "l"], ["MAASI", 46, "r"], ["GUN", 22, "r"], ["NORMAL KAZANC", 50, "r"], ["EMEKLI G. VERGISI", 48, "r"],
    ["TICKET ODEME", 44, "r"], ["NAKTI DESTEK", 44, "r"], ["MESAI ODEME", 44, "r"], ["EK KAZANC TOPLAMI", 50, "r"],
    ["KAZANCLAR TOPLAMI", 52, "r"], ["AVANS", 34, "r"], ["BES", 34, "r"], ["DIGER KESINTI", 34, "r"], ["KESINTILER TOPLAMI", 46, "r"],
    ["BANKADAN ODENEN", 52, "r"], ["NET ODENEN", 52, "r"], ["IMZA", 36, "l"],
  ];
  const rows = names.map((name, i) => {
    const maas = 22000 + ((i * 377) % 2600) + 0.67;
    const gun = i === 4 ? 27 : 30;
    const normal = Math.round((maas * gun / 30) * 100) / 100;
    const egv = i === 0 ? 0 : 1200;
    const ticket = Math.round((4380 * gun / 30) * 100) / 100;
    const nakti = Math.round((2748 * gun / 30) * 100) / 100;
    const mesai = Math.round((1959.13 * gun / 30) * 100) / 100;
    const ek = egv + ticket + nakti + mesai;
    const bes = i === 0 ? 780.16 : 0;
    const kes = bes;
    const banka = normal + egv + mesai - kes;
    return { name, v: [maas, gun, normal, egv, ticket, nakti, mesai, ek, normal + ek, 0, bes, 0, kes, banka, banka + nakti + ticket] };
  });
  const tot = Array.from({ length: 15 }, (_, k) => rows.reduce((a, r) => a + (k === 0 || k === 1 ? 0 : r.v[k]), 0));
  tot[1] = rows.reduce((a, r) => a + r.v[1], 0);

  const X0 = 20;
  const ops = [];
  const text = (str, x, yy, size, bold = false) => ops.push(`0 g BT /${bold ? "F2" : "F1"} ${size} Tf ${x.toFixed(1)} ${yy.toFixed(1)} Td (${ascii(String(str)).replace(/[()\\]/g, "")}) Tj ET`);
  const w = (str, size) => String(str).length * size * 0.54;
  // baslik bandi
  ops.push("1 0.93 0 rg 20 540 802 38 re f 0 G 0.6 w 20 540 802 38 re S");
  const title1 = ascii(projectName).toUpperCase() + " " + MONTH + "/" + y;
  text(title1, 421 - w(title1, 12) / 2, 562, 12, true);
  text("MAAS BORDROSU", 421 - w("MAAS BORDROSU", 12) / 2, 548, 12, true);
  // tablo basligi
  const headY = 500, headH = 36, rowH = 20;
  let x = X0;
  cols.forEach(([label, cw]) => {
    ops.push(`0.97 0.97 0.9 rg ${x} ${headY} ${cw} ${headH} re f 0.4 w 0 G ${x} ${headY} ${cw} ${headH} re S`);
    const words = label.split(" ");
    const lines = words.length > 1 && label.length > 9 ? [words.slice(0, Math.ceil(words.length / 2)).join(" "), words.slice(Math.ceil(words.length / 2)).join(" ")] : [label];
    lines.forEach((ln, li) => text(ln, x + cw / 2 - w(ln, 5.5) / 2, headY + headH - 13 - li * 8, 5.5, true));
    x += cw;
  });
  const drawRow = (yy, cells, bold, fill) => {
    let cx = X0;
    cols.forEach(([, cw, align], ci) => {
      if (fill && (ci === 0 || ci >= 14)) ops.push(`1 0.93 0 rg ${cx} ${yy} ${cw} ${rowH} re f`);
      ops.push(`0.4 w 0 G ${cx} ${yy} ${cw} ${rowH} re S`);
      const val = cells[ci] ?? "";
      if (val !== "") text(val, align === "r" ? cx + cw - 3 - w(val, 6) : cx + 3, yy + 7, 6, bold);
      cx += cw;
    });
  };
  rows.forEach((r, ri) => {
    const cells = [r.name.toUpperCase(), money(r.v[0]), String(r.v[1]), ...r.v.slice(2).map((n) => (n === 0 ? "" : money(n)))];
    drawRow(headY - rowH * (ri + 1), cells, false, true);
  });
  const totalCells = ["TOPLAM", "", String(tot[1]), ...tot.slice(2).map((n) => (n === 0 ? "" : money(n)))];
  drawRow(headY - rowH * (rows.length + 1), totalCells, true, false);
  text("Bu belge test amaclidir; isimler ve tutarlar kurgusaldir.", X0, 30, 6);

  const content = ops.join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
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
  // Bordro artık hizmet/proje bazlı toplu: kişi bazlı eski demo bordrolar kaldırılır
  const legacyBordro = (await sb.from("documents").select("id, storage_path").eq("project_id", prj.id).eq("category_code", "bordro").not("personnel_id", "is", null)).data ?? [];
  for (const d of legacyBordro) {
    await sb.storage.from("documents").remove([d.storage_path]);
    await sb.from("documents").delete().eq("id", d.id);
  }
  // Toplu bordro (hizmet/proje + ay): müşterinin örnek bordrosu gibi tablo; eski düz metin bordroların yerini alır
  const bordroQ = () => sb.from("documents").select("id, storage_path, metadata").eq("project_id", prj.id).eq("category_code", "bordro").is("personnel_id", null);
  const existingBordro = (await bordroQ()).data ?? [];
  if (!existingBordro.some((d) => d.metadata?.format === "tablo-v2")) {
    for (const d of existingBordro) {
      await sb.storage.from("documents").remove([d.storage_path]);
      await sb.from("documents").delete().eq("id", d.id);
    }
    const crew = ((await sb.from("personnel_assignments").select("personnel(full_name)").eq("project_id", prj.id).is("end_date", null)).data ?? [])
      .map((a) => a.personnel?.full_name).filter(Boolean);
    const names = crew.length ? crew : ["Ornek Personel"];
    for (const { y, m } of [prev1, prev2]) {
      await addDoc(prj, "bordro", `Toplu Bordro ${pad(m)}/${y} - ${prj.name}`, bordroPdf(prj.name, y, m, names), { period_year: y, period_month: m, metadata: { format: "tablo-v2" } });
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

/* ------------------------------ Özlük Evrakları (sıralı evrak türleri), Eğitimler, İhtarlar ------------------------------ */
{
  const FILE_DOCS = [
    ["isg_evraklari", "İSG Evrakları", "Is sagligi ve guvenligi evrak seti"],
    ["nufus_kimlik", "Nüfus Cüzdanı / Güvenlik Kimliği", "Nufus cuzdani fotokopisi / guvenlik kimligi"],
    ["ikametgah", "İkametgah Belgesi", "Ikametgah belgesi"],
    ["adli_sicil", "Adli Sicil Kaydı", "Adli sicil kaydi"],
    ["saglik_raporu", "Sağlık Raporu", "Saglik raporu"],
    ["fazla_calisma_muvaffakat", "Fazla Çalışma Muvaffakatnamesi", "Fazla calisma muvaffakatnamesi"],
    ["gece_calisma_muvaffakat", "Gece Çalışma Muvaffakatnamesi", "Gece calisma muvaffakatnamesi"],
    ["yillik_izin_muvaffakat", "Yıllık İzin Muvaffakatnamesi", "Yillik izin muvaffakatnamesi"],
    ["transfer_muvaffakat", "Transfer Muvaffakatnamesi", "Transfer muvaffakatnamesi"],
  ];
  const TRAININGS = ["İlkyardım Eğitimi Sertifikası", "Yangın Güvenliği Eğitimi", "İş Sağlığı ve Güvenliği Eğitimi", "Özel Güvenlik Temel Eğitimi"];
  const cats = [...FILE_DOCS.map((d) => d[0]), "egitim", "ihtar"];
  const personIds = people.map((a) => a.personnel_id);
  const have = new Set();
  for (let i = 0; i < personIds.length; i += 100) {
    const rows = (await sb.from("documents").select("personnel_id, category_code").in("category_code", cats).in("personnel_id", personIds.slice(i, i + 100))).data ?? [];
    for (const r of rows) have.add(`${r.personnel_id}|${r.category_code}`);
  }
  let made = 0;
  for (const [i, a] of people.entries()) {
    const person = `${a.personnel.first_name} ${a.personnel.last_name}`;
    const proj = { id: a.project_id };
    const make = async (category, title, line) => {
      if (have.has(`${a.personnel_id}|${category}`)) return;
      await addDoc(proj, category, title, pdf(title.toUpperCase(), [`Personel: ${person}`, line, "Bu belge test amaclidir."]), { personnel_id: a.personnel_id });
      have.add(`${a.personnel_id}|${category}`);
      made++;
    };
    for (const [k, [category, title, line]] of FILE_DOCS.entries()) {
      if ((i + k) % 7 === 0) continue;                       // bazıları bilerek eksik: "Yüklenmemiş" satırı görünsün
      if (category === "transfer_muvaffakat" && i % 3 !== 0) continue;
      await make(category, title, line);
    }
    // eğitimler: her personelde birkaç tane (aynı türden birden çok belge)
    if (!have.has(`${a.personnel_id}|egitim`)) {
      const n = 2 + (i % 3);
      for (let t = 0; t < n; t++) {
        const title = TRAININGS[(i + t) % TRAININGS.length];
        await addDoc(proj, "egitim", title, pdf(title.toUpperCase(), [`Katilimci: ${person}`, `Egitim tarihi: ${iso(-30 - t * 45)}`, "Bu belge test amaclidir."]), { personnel_id: a.personnel_id });
        made++;
      }
      have.add(`${a.personnel_id}|egitim`);
    }
    if (i % 4 === 1) await make("ihtar", "Yazılı İhtar", "Yazili ihtar tutanagi");
  }
  added += made;
  console.log(`• Özlük evrakları / eğitimler / ihtarlar: ${made} belge eklendi.`);
}

/* ------------------------------ Formlar ekranı: form şablonları ------------------------------ */
const { count: formCount } = await sb.from("form_templates").select("id", { count: "exact", head: true });
if (!formCount) {
  const templates = [
    ["Yıllık İzin Talep Formu", "Personelin izin talebi", "Yıllık İzin 1 - İzin Talep Formu.pdf", FORMS.izin1],
    ["Yıllık İzin Kullanım Formu", "İzin kullanımının kaydı", "Yıllık İzin 2 - İzin Kullanım Formu.pdf", FORMS.izin2],
    ["Yıllık İzin Ücreti Talep Formu", "İzin ücreti talebi", "Yıllık İzin 3 - İzin Ücreti  Talep Formu.pdf", FORMS.izin3],
    ["Kıyafet ve Ekipman Teslim Tutanağı", "Teslim edilen kıyafet ve ekipmanlar", "Kıyafet Teslim Tutanağı.pdf", FORMS.kiyafet],
    ["Savunma Tutanağı", "Personelden savunma alınması", "Savunma Tutanağı.pdf", FORMS.savunma],
  ];
  for (const [i, [title, description, fileName, bytes]] of templates.entries()) {
    const path = `forms/${randomUUID()}-${ascii(fileName).replace(/[^a-zA-Z0-9._-]+/g, "-")}`;
    const up = await sb.storage.from("documents").upload(path, bytes, { contentType: "application/pdf" });
    if (up.error) { console.error("✖ form yükleme:", up.error.message); process.exit(1); }
    must(await sb.from("form_templates").insert({ title, description, storage_path: path, file_name: fileName, mime_type: "application/pdf", size_bytes: bytes.length, sort_order: 10 + i * 10, uploaded_by: adminId }), "form şablonu");
    added++;
  }
}

/* ------------------------------ Devriye Sistemi: görevli hesapları, noktalar, okutmalar ------------------------------ */
const PASSWORD = "Opsuyon2026!";
const roleIds = Object.fromEntries(must(await sb.from("roles").select("id, code"), "roller").map((r) => [r.code, r.id]));
const newCode = () => "DVR-" + Array.from({ length: 8 }, () => "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"[Math.floor(Math.random() * 32)]).join("");
const istDay = (offset) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + offset * 86400000));

const guards = [
  { username: "demo.devriye", fullName: "Demo Devriye Görevlisi", org: orgB, project: projB.find((p) => p.service_line === "guvenlik") },
  { username: "demo.devriye2", fullName: "Demo Plaza Devriye Görevlisi", org: orgA, project: projA.find((p) => p.service_line === "guvenlik") },
];
for (const g of guards) {
  if (!g.project) continue;
  let uid = (await sb.from("profiles").select("id").eq("username", g.username).maybeSingle()).data?.id;
  if (!uid) {
    const created = await sb.auth.admin.createUser({ email: `${g.username}@portal.opsuyon.com`, password: PASSWORD, email_confirm: true, user_metadata: { username: g.username, full_name: g.fullName } });
    if (created.error) { console.error(`✖ ${g.username}:`, created.error.message); process.exit(1); }
    uid = created.data.user.id;
    must(await sb.from("profiles").insert({ id: uid, username: g.username, full_name: g.fullName, kind: "customer", organization_id: g.org.id, phone: "0532 000 00 00" }), "profil");
    must(await sb.from("project_members").insert({ project_id: g.project.id, user_id: uid, role_id: roleIds.customer_patrol }), "üyelik");
    console.log(`• ${g.username} hesabı eklendi (${g.project.name}).`);
  }
  g.userId = uid;

  const havePoints = ((await sb.from("patrol_points").select("id", { count: "exact", head: true }).eq("project_id", g.project.id)).count ?? 0) > 0;
  if (!havePoints) {
    const names = ["Ana Giriş", "Otopark", "Arka Bahçe", "Teknik Oda", "Çatı Katı"];
    const pts = must(await sb.from("patrol_points").insert(names.map((name, i) => ({ project_id: g.project.id, name, code: newCode(), sort_order: (i + 1) * 10 }))).select("id, sort_order"), "devriye noktaları");
    pts.sort((a, b) => a.sort_order - b.sort_order);
    const scans = [];
    const at = (day, hh, mm, plus) => new Date(Date.parse(`${day}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+03:00`) + plus * 60000).toISOString();
    for (let back = 5; back >= 1; back--) {
      const day = istDay(-back);
      pts.forEach((p, i) => scans.push({ project_id: g.project.id, point_id: p.id, scanned_by: uid, scanned_at: at(day, 22, 0, i * 6 + (i % 2)) }));
      // ikinci tur: bir gün bir nokta atlanır (rapordaki "Okutulmayan nokta")
      pts.forEach((p, i) => { if (!(back === 2 && i === 4)) scans.push({ project_id: g.project.id, point_id: p.id, scanned_by: uid, scanned_at: at(day, 2, 30, i * 5 + 1) }); });
    }
    // bugün: iki tur, şu andan önce
    const now = Date.now();
    pts.forEach((p, i) => scans.push({ project_id: g.project.id, point_id: p.id, scanned_by: uid, scanned_at: new Date(now - 3 * 3600000 + i * 6 * 60000).toISOString() }));
    pts.slice(0, 4).forEach((p, i) => scans.push({ project_id: g.project.id, point_id: p.id, scanned_by: uid, scanned_at: new Date(now - 1 * 3600000 + i * 5 * 60000).toISOString() }));
    must(await sb.from("patrol_scans").insert(scans), "devriye okutmaları");
    added += scans.length;
  }
}

console.log(`\n✔ Ek demo veri hazır (${added} kayıt/belge eklendi).`);
console.log("Devriye test hesapları (parola Opsuyon2026!): demo.devriye (Test Site) · demo.devriye2 (Demo Plaza)");

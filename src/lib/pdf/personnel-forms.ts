import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { ROBOTO_MEDIUM_B64, ROBOTO_REGULAR_B64 } from "@/lib/pdf/roboto";
import type { OrgBranding } from "@/lib/org-logo";

/**
 * Personele basılan formlar (A4 dikey): sol üstte personelin kadrosundaki firmanın logosu, sağda firma bilgileri.
 *  - Yemek kartı teslim formu (müşterinin verdiği şablon)
 *  - Sağlık raporu / güvenlik kimlik kartı geçerlilik süresi bildirimi (tebliğ-tebellüğ)
 */

const INK = rgb(0.09, 0.11, 0.15);
const MUTED = rgb(0.4, 0.45, 0.53);
const LINE = rgb(0.75, 0.78, 0.83);
const W = 595.28;
const H = 841.89;
const M = 56;

const fmtDay = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
};
const todayIso = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });
const upper = (s: string) => s.toLocaleUpperCase("tr-TR");

async function setup(title: string) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(title);
  doc.setProducer("OPSUYON");
  const regular = await doc.embedFont(Buffer.from(ROBOTO_REGULAR_B64, "base64"), { subset: true });
  const bold = await doc.embedFont(Buffer.from(ROBOTO_MEDIUM_B64, "base64"), { subset: true });
  const page = doc.addPage([W, H]);
  return { doc, page, regular, bold };
}

function fit(text: string, max: number, size: number, font: PDFFont) {
  if (font.widthOfTextAtSize(text, size) <= max) return text;
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(t + "…", size) > max) t = t.slice(0, -1);
  return t + "…";
}

/** Kelime kelime satırlara böler. */
function wrap(text: string, max: number, size: number, font: PDFFont): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= max || !line) line = next;
      else {
        out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

/**
 * Başlık: sol üstte logo (en fazla 150×72 pt kutuya oranı korunarak sığar), sağda firma unvanı, adres, telefon,
 * vergi bilgisi. Logo yoksa unvan solda büyük yazılır. Altına ince çizgi. Dönen değer: içeriğin başlayacağı y.
 */
async function drawOrgHeader(doc: PDFDocument, page: PDFPage, org: OrgBranding | null, regular: PDFFont, bold: PDFFont): Promise<number> {
  const top = H - 40;
  let logoW = 0;
  let logoH = 0;
  if (org?.logo) {
    try {
      const img = org.logo.mime === "image/png" ? await doc.embedPng(org.logo.bytes) : await doc.embedJpg(org.logo.bytes);
      const scale = Math.min(150 / img.width, 72 / img.height);
      logoW = img.width * scale;
      logoH = img.height * scale;
      page.drawImage(img, { x: M, y: top - logoH, width: logoW, height: logoH });
    } catch {
      logoW = 0;
      logoH = 0;
    }
  }

  const name = org ? org.legal_name || org.name : "";
  const lines = org
    ? [
        org.address,
        [org.phone && `Tel: ${org.phone}`, org.email].filter(Boolean).join(" · "),
        [org.tax_office && `${org.tax_office} V.D.`, org.tax_no && `${org.tax_no}`].filter(Boolean).join(" "),
      ].filter((l): l is string => Boolean(l))
    : [];

  let bottom: number;
  if (logoW > 0) {
    // sağ blok: sağa yaslı
    const maxW = W - 2 * M - logoW - 24;
    let y = top - 11;
    if (name) {
      const t = fit(name, maxW, 11, bold);
      page.drawText(t, { x: W - M - bold.widthOfTextAtSize(t, 11), y, size: 11, font: bold, color: INK });
      y -= 14;
    }
    for (const l of lines) {
      for (const part of wrap(l, maxW, 8.5, regular).slice(0, 2)) {
        page.drawText(part, { x: W - M - regular.widthOfTextAtSize(part, 8.5), y, size: 8.5, font: regular, color: MUTED });
        y -= 11;
      }
    }
    bottom = Math.min(top - logoH, y + 4);
  } else {
    let y = top - 14;
    if (name) {
      page.drawText(fit(name, W - 2 * M, 15, bold), { x: M, y, size: 15, font: bold, color: INK });
      y -= 17;
    }
    for (const l of lines) {
      page.drawText(fit(l, W - 2 * M, 8.5, regular), { x: M, y, size: 8.5, font: regular, color: MUTED });
      y -= 11;
    }
    bottom = y + 4;
  }
  const lineY = bottom - 10;
  page.drawLine({ start: { x: M, y: lineY }, end: { x: W - M, y: lineY }, thickness: 0.8, color: LINE });
  return lineY - 34;
}

/** İki sütunlu kutulu tablo; satır yüksekliği sabit. Dönen değer: tablonun altı. */
function drawTable(page: PDFPage, rows: [string, string][], y: number, regular: PDFFont, bold: PDFFont): number {
  const rowH = 44;
  const c1 = 190;
  const x0 = M;
  const x2 = W - M;
  rows.forEach(([k, v], i) => {
    const yt = y - i * rowH;
    page.drawRectangle({ x: x0, y: yt - rowH, width: x2 - x0, height: rowH, borderColor: INK, borderWidth: 1 });
    page.drawLine({ start: { x: x0 + c1, y: yt }, end: { x: x0 + c1, y: yt - rowH }, thickness: 1, color: INK });
    page.drawText(k, { x: x0 + 10, y: yt - rowH / 2 - 4, size: 11, font: bold, color: INK });
    if (v) page.drawText(fit(v, x2 - x0 - c1 - 20, 12, regular), { x: x0 + c1 + 12, y: yt - rowH / 2 - 4.5, size: 12, font: regular, color: INK });
  });
  return y - rows.length * rowH;
}

/** Ortalanmış imza bloğu: başlık, ad soyad, alt satır (görev) ve imza çizgisi. */
function signature(page: PDFPage, cx: number, y: number, head: string, name: string, sub: string, regular: PDFFont, bold: PDFFont) {
  const center = (t: string, yy: number, size: number, font: PDFFont, color = INK) =>
    page.drawText(t, { x: cx - font.widthOfTextAtSize(t, size) / 2, y: yy, size, font, color });
  center(head, y, 11, bold);
  if (name) center(fit(upper(name), 220, 10.5, regular), y - 18, 10.5, regular);
  if (sub) center(fit(sub, 220, 10.5, regular), y - 34, 10.5, regular, MUTED);
  page.drawLine({ start: { x: cx - 80, y: y - 84 }, end: { x: cx + 80, y: y - 84 }, thickness: 0.6, color: LINE });
  center("İmza", y - 96, 8.5, regular, MUTED);
}

function footer(page: PDFPage, regular: PDFFont) {
  const t = `Bu form ${fmtDay(todayIso())} tarihinde OPSUYON ile oluşturulmuştur.`;
  page.drawText(t, { x: M, y: 30, size: 7.5, font: regular, color: MUTED });
}

export type MealCardFormInput = {
  org: OrgBranding | null;
  person: { full_name: string; title: string | null };
  cardNo: string;
  /** Formu basan merkez kullanıcısı ("Teslim alan") */
  receiver: string;
};

/** Yemek kartı teslim formu (müşterinin şablonu: teslim eden personel, teslim alan yetkili; teslim tarihi elle yazılır). */
export async function buildMealCardFormPdf(input: MealCardFormInput): Promise<Uint8Array> {
  const { doc, page, regular, bold } = await setup(`Yemek Kartı Teslim Formu — ${input.person.full_name}`);
  let y = await drawOrgHeader(doc, page, input.org, regular, bold);
  page.drawText("YEMEK KARTI TESLİM FORMU", { x: M, y, size: 15, font: bold, color: INK });
  y -= 28;
  y = drawTable(page, [["PERSONEL ADI SOYADI", upper(input.person.full_name)], ["YEMEK KARTI NO", input.cardNo], ["TESLİM TARİHİ", ""]], y, regular, bold);
  y -= 56;
  signature(page, M + (W - 2 * M) / 4, y, "TESLİM EDEN", input.person.full_name, input.person.title || "Personel", regular, bold);
  signature(page, W - M - (W - 2 * M) / 4, y, "TESLİM ALAN", input.receiver, "", regular, bold);
  footer(page, regular);
  return doc.save();
}

export type ExpiryKind = "health_report" | "security_card";
export const EXPIRY_LABEL: Record<ExpiryKind, string> = {
  health_report: "Sağlık raporu",
  security_card: "Güvenlik kimlik kartı",
};

export type ExpiryNoticeInput = {
  org: OrgBranding | null;
  person: { full_name: string; title: string | null };
  kind: ExpiryKind;
  /** Geçerlilik bitişi (YYYY-AA-GG) */
  until: string;
  /** Bildirimi basan merkez kullanıcısı */
  issuer: string;
};

/** Belge süresi bildirimi: personele tebliğ edilir, personel "tebellüğ eden" olarak imzalar. */
export async function buildExpiryNoticePdf(input: ExpiryNoticeInput): Promise<Uint8Array> {
  const label = EXPIRY_LABEL[input.kind];
  const { doc, page, regular, bold } = await setup(`${label} Süre Bildirimi — ${input.person.full_name}`);
  let y = await drawOrgHeader(doc, page, input.org, regular, bold);

  const date = `Tarih: ${fmtDay(todayIso())}`;
  page.drawText(date, { x: W - M - regular.widthOfTextAtSize(date, 10), y: y + 8, size: 10, font: regular, color: INK });
  y -= 24;
  const title = input.kind === "health_report" ? "SAĞLIK RAPORU GEÇERLİLİK SÜRESİ BİLDİRİMİ" : "GÜVENLİK KİMLİK KARTI GEÇERLİLİK SÜRESİ BİLDİRİMİ";
  page.drawText(title, { x: (W - bold.widthOfTextAtSize(title, 14)) / 2, y, size: 14, font: bold, color: INK });
  y -= 40;

  const until = fmtDay(input.until);
  const expired = input.until.slice(0, 10) < todayIso();
  const firm = input.org ? input.org.legal_name || input.org.name : "Şirketimiz";
  const role = input.person.title ? `${input.person.title} olarak` : "";
  const body =
    input.kind === "health_report"
      ? `${firm} bünyesinde ${role} görev yapmaktasınız. Personel dosyanızdaki sağlık raporunuzun geçerlilik süresi ${until} tarihinde ${expired ? "sona ermiştir" : "sona erecektir"}.\n\nGörevinize kesintisiz devam edebilmeniz için yenilenmiş sağlık raporunuzu ${expired ? "en kısa sürede" : `${until} tarihinden önce`} insan kaynakları birimine teslim etmeniz gerekmektedir.`
      : `${firm} bünyesinde ${role} görev yapmaktasınız. Özel güvenlik kimlik kartınızın geçerlilik süresi ${until} tarihinde ${expired ? "sona ermiştir" : "sona erecektir"}.\n\nGeçerli özel güvenlik kimlik kartı olmadan özel güvenlik görevi yapılamaz. Kartınızın yenilenmesi için gerekli eğitim ve başvuru işlemlerinizi ${expired ? "derhal" : `${until} tarihinden önce`} tamamlayarak yenilenmiş kartınızın bir örneğini insan kaynakları birimine teslim etmeniz gerekmektedir.`;

  page.drawText(`Sayın ${upper(input.person.full_name)},`, { x: M, y, size: 11.5, font: bold, color: INK });
  y -= 26;
  for (const line of wrap(body.replace(/\s{2,}(?!\n)/g, " "), W - 2 * M, 11.5, regular)) {
    if (line) page.drawText(line, { x: M, y, size: 11.5, font: regular, color: INK });
    y -= line ? 18 : 10;
  }
  y -= 8;
  page.drawText("Bilgilerinize rica ederiz.", { x: M, y, size: 11.5, font: regular, color: INK });
  y -= 70;

  signature(page, M + (W - 2 * M) / 4, y, "TEBLİĞ EDEN", input.issuer, "İşveren adına", regular, bold);
  signature(page, W - M - (W - 2 * M) / 4, y, "TEBELLÜĞ EDEN", input.person.full_name, input.person.title || "Personel", regular, bold);
  y -= 128;
  page.drawText("Tebellüğ tarihi: ...... / ...... / ............", { x: W - M - 220, y, size: 10, font: regular, color: INK });
  footer(page, regular);
  return doc.save();
}

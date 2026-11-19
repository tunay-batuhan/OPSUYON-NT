// Bordro hesap motoru: şablon (sütunlar + formüller) ve güvenli formül hesaplayıcı. Tarayıcıda (canlı önizleme) ve
// sunucuda (kayıt, onay, PDF, Excel) AYNI kod çalışır. Formüller eval ile değil, burada yazılı küçük bir ayrıştırıcıyla
// hesaplanır: sayılar, + − × ÷, parantez, karşılaştırma, sütun / değişken adları ve birkaç işlev.

export type PayGroup = "bilgi" | "kazanc" | "kesinti" | "odeme";
export type PayKind = "input" | "formula" | "text";

/** Maaş tablosunun bir sütunu. */
export type PayCol = {
  /** formüllerde kullanılan ad: küçük harf, rakam, alt çizgi (ör. net_maas) */
  code: string;
  label: string;
  group: PayGroup;
  /** input: elle girilen sayı · formula: hesaplanan (satırda elle ezilebilir) · text: not / açıklama */
  kind: PayKind;
  /** formula: hesap · input: satır açılırken bir kez hesaplanan ilk değer (ör. tanim_net_maas ya da 30) */
  formula?: string;
  /** TOPLAM satırında toplanır */
  total?: boolean;
};

export const GROUP_LABEL: Record<PayGroup, string> = { bilgi: "Bilgi", kazanc: "Kazançlar", kesinti: "Kesintiler", odeme: "Ödeme" };
export const KIND_LABEL: Record<PayKind, string> = { input: "Giriş (elle)", formula: "Formül", text: "Metin" };

/** Formüllerde kullanılabilen hazır değişkenler: personelin ücret tanımı ve o ayın avansları. */
export const RATE_VARS: { code: string; label: string }[] = [
  { code: "tanim_net_maas", label: "Ücret tanımı: net maaş (aylık)" },
  { code: "tanim_yol", label: "Ücret tanımı: yol (aylık)" },
  { code: "tanim_destek", label: "Ücret tanımı: destek ödeme (aylık)" },
  { code: "tanim_ticket", label: "Ücret tanımı: ticket / yemek kartı (aylık)" },
  { code: "tanim_fazla_mesai", label: "Ücret tanımı: fazla mesai (aylık)" },
  { code: "tanim_ek", label: "Ücret tanımı: ek ödeme (aylık)" },
  { code: "tanim_bes", label: "Ücret tanımı: BES (aylık)" },
  { code: "avans_kayit", label: "O ay Avanslar ekranına girilen avansların toplamı" },
];
export type RateVars = Record<string, number>;

/**
 * Varsayılan şablon: müşterinin Excel bordrosu (HELBA, Ekim 2026) ile aynı sütunlar ve formüller.
 *   normal = net maaş ÷ 30 × gün · yol / destek / ticket = aylık tanım ÷ 30 × gün · BES = aylık ÷ 30 × gün
 *   bankadan = normal + yol + emekli + bayram mesai + fazla mesai − kesintiler · net = bankadan + destek + ticket
 */
export const DEFAULT_TEMPLATE: PayCol[] = [
  { code: "net_maas", label: "Net maaş", group: "bilgi", kind: "input", formula: "tanim_net_maas" },
  { code: "gun", label: "Gün", group: "bilgi", kind: "input", formula: "30", total: true },
  { code: "normal", label: "Normal kazanç", group: "kazanc", kind: "formula", formula: "net_maas / 30 * gun", total: true },
  { code: "yol", label: "Yol ödeme", group: "kazanc", kind: "formula", formula: "tanim_yol / 30 * gun", total: true },
  { code: "destek", label: "Destek ödeme", group: "kazanc", kind: "formula", formula: "tanim_destek / 30 * gun", total: true },
  { code: "ticket", label: "Ticket ödeme", group: "kazanc", kind: "formula", formula: "tanim_ticket / 30 * gun", total: true },
  { code: "emekli", label: "Emekli vergi", group: "kazanc", kind: "input", formula: "tanim_ek", total: true },
  { code: "bayram_not", label: "Bayram mesai", group: "kazanc", kind: "text" },
  { code: "bayram", label: "B. mesai tutar", group: "kazanc", kind: "input", formula: "0", total: true },
  { code: "fmesai_gun", label: "F. mesai gün", group: "kazanc", kind: "input", formula: "0" },
  { code: "fmesai", label: "F. mesai tutar", group: "kazanc", kind: "formula", formula: "net_maas / 30 * 1.5 * fmesai_gun", total: true },
  { code: "ek_toplam", label: "Ek kazanç toplamı", group: "kazanc", kind: "formula", formula: "yol + destek + ticket + emekli + bayram + fmesai", total: true },
  { code: "kazanc_toplam", label: "Kazançlar toplamı", group: "kazanc", kind: "formula", formula: "normal + ek_toplam", total: true },
  { code: "avans", label: "Avans", group: "kesinti", kind: "formula", formula: "avans_kayit", total: true },
  { code: "ceza", label: "Ceza kesinti", group: "kesinti", kind: "input", formula: "0", total: true },
  { code: "bes", label: "BES", group: "kesinti", kind: "formula", formula: "tanim_bes / 30 * gun", total: true },
  { code: "diger", label: "Diğer kesinti", group: "kesinti", kind: "input", formula: "0", total: true },
  { code: "kesinti_toplam", label: "Kesintiler toplam", group: "kesinti", kind: "formula", formula: "avans + ceza + bes + diger", total: true },
  { code: "bankadan", label: "Bankadan ödenen", group: "odeme", kind: "formula", formula: "normal + yol + emekli + bayram + fmesai - kesinti_toplam", total: true },
  { code: "destek_odeme", label: "Destek ödeme", group: "odeme", kind: "formula", formula: "destek", total: true },
  { code: "ticket_odeme", label: "Ticket ödeme", group: "odeme", kind: "formula", formula: "ticket", total: true },
  { code: "net", label: "Net ödenen", group: "odeme", kind: "formula", formula: "bankadan + destek_odeme + ticket_odeme", total: true },
];

/* ------------------------------------------------------------------ */
/* Formül ayrıştırıcı                                                   */
/* ------------------------------------------------------------------ */
type Node =
  | { t: "num"; v: number }
  | { t: "ref"; name: string }
  | { t: "neg"; a: Node }
  | { t: "bin"; op: string; a: Node; b: Node }
  | { t: "call"; fn: string; args: Node[] };

const FUNCS: Record<string, string> = {
  min: "min", max: "max", round: "round", yuvarla: "round", abs: "abs", mutlak: "abs", if: "if", eger: "if", "eğer": "if",
};
const IDENT = /^[A-Za-zÇĞİÖŞÜçğıöşü_][A-Za-z0-9ÇĞİÖŞÜçğıöşü_]*/;

function tokenize(src: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    const two = src.slice(i, i + 2);
    if (two === "<=" || two === ">=" || two === "<>") { out.push(two); i += 2; continue; }
    if ("+-*/()<>=,;%×÷".includes(ch)) { out.push(ch === "×" ? "*" : ch === "÷" ? "/" : ch === ";" ? "," : ch); i++; continue; }
    const num = src.slice(i).match(/^\d+(\.\d+)?/);
    if (num) { out.push(num[0]); i += num[0].length; continue; }
    const id = src.slice(i).match(IDENT);
    if (id) { out.push(id[0]); i += id[0].length; continue; }
    throw new Error(`Formülde tanınmayan karakter: “${ch}”`);
  }
  return out;
}

/** Formülü ayrıştırır; hatalıysa Türkçe mesajla Error fırlatır. */
export function parseFormula(src: string): Node {
  const tk = tokenize(src);
  let p = 0;
  const peek = () => tk[p];
  const next = () => tk[p++];
  const expect = (s: string) => { if (next() !== s) throw new Error(`Formülde “${s}” bekleniyor`); };
  const primary = (): Node => {
    const t = next();
    if (t === undefined) throw new Error("Formül eksik");
    if (t === "(") { const e = cmp(); expect(")"); return e; }
    if (/^\d/.test(t)) {
      let v = Number(t);
      if (peek() === "%") { next(); v /= 100; }
      return { t: "num", v };
    }
    if (IDENT.test(t)) {
      if (peek() === "(") {
        const fn = FUNCS[t.toLocaleLowerCase("tr-TR")];
        if (!fn) throw new Error(`Bilinmeyen işlev: ${t}`);
        next();
        const args: Node[] = [];
        if (peek() !== ")") { args.push(cmp()); while (peek() === ",") { next(); args.push(cmp()); } }
        expect(")");
        return { t: "call", fn, args };
      }
      return { t: "ref", name: t };
    }
    throw new Error(`Formülde beklenmeyen “${t}”`);
  };
  const unary = (): Node => (peek() === "-" ? (next(), { t: "neg", a: unary() }) : peek() === "+" ? (next(), unary()) : primary());
  const mul = (): Node => { let a = unary(); while (peek() === "*" || peek() === "/") { const op = next()!; a = { t: "bin", op, a, b: unary() }; } return a; };
  const add = (): Node => { let a = mul(); while (peek() === "+" || peek() === "-") { const op = next()!; a = { t: "bin", op, a, b: mul() }; } return a; };
  function cmp(): Node {
    const a = add();
    const op = peek();
    if (op && ["<", ">", "<=", ">=", "=", "<>"].includes(op)) { next(); return { t: "bin", op, a, b: add() }; }
    return a;
  }
  const tree = cmp();
  if (p < tk.length) throw new Error(`Formülde beklenmeyen “${tk[p]}”`);
  return tree;
}

function evalNode(n: Node, env: (name: string) => number): number {
  switch (n.t) {
    case "num": return n.v;
    case "ref": return env(n.name);
    case "neg": return -evalNode(n.a, env);
    case "bin": {
      const a = evalNode(n.a, env), b = evalNode(n.b, env);
      switch (n.op) {
        case "+": return a + b;
        case "-": return a - b;
        case "*": return a * b;
        case "/": return b === 0 ? 0 : a / b;
        case "<": return a < b ? 1 : 0;
        case ">": return a > b ? 1 : 0;
        case "<=": return a <= b ? 1 : 0;
        case ">=": return a >= b ? 1 : 0;
        case "=": return Math.abs(a - b) < 1e-9 ? 1 : 0;
        default: return Math.abs(a - b) < 1e-9 ? 0 : 1; // <>
      }
    }
    case "call": {
      const v = (i: number) => evalNode(n.args[i], env);
      if (n.fn === "if") {
        if (n.args.length !== 3) throw new Error("EĞER(koşul, doğruysa, yanlışsa) üç değer ister");
        return v(0) !== 0 ? v(1) : v(2);
      }
      if (n.args.length === 0) throw new Error("İşlev en az bir değer ister");
      if (n.fn === "min") return Math.min(...n.args.map((_, i) => v(i)));
      if (n.fn === "max") return Math.max(...n.args.map((_, i) => v(i)));
      if (n.fn === "abs") return Math.abs(v(0));
      const d = n.args.length > 1 ? Math.max(0, Math.min(6, Math.round(v(1)))) : 0; // round
      const f = 10 ** d;
      return Math.round((v(0) + Number.EPSILON) * f) / f;
    }
  }
}

function refsOf(n: Node, out: Set<string>) {
  if (n.t === "ref") out.add(n.name);
  else if (n.t === "neg") refsOf(n.a, out);
  else if (n.t === "bin") { refsOf(n.a, out); refsOf(n.b, out); }
  else if (n.t === "call") n.args.forEach((a) => refsOf(a, out));
}

const CODE = /^[a-z][a-z0-9_]{0,29}$/;
const VAR_CODES = new Set(RATE_VARS.map((v) => v.code));

/** Şablon denetimi: hata mesajları (boşsa geçerli). Sütun kodları benzersiz, formüller geçerli, başvurular tanımlı, döngü yok. */
export function validateTemplate(cols: PayCol[]): string[] {
  const errs: string[] = [];
  if (!Array.isArray(cols) || cols.length === 0) return ["Şablonda en az bir sütun olmalı."];
  if (cols.length > 60) errs.push("Şablonda en fazla 60 sütun olabilir.");
  const codes = new Set<string>();
  for (const c of cols) {
    const name = c.label?.trim() || c.code;
    if (!c.label?.trim()) errs.push(`“${c.code}” sütununun başlığı boş.`);
    if (!CODE.test(c.code ?? "")) errs.push(`“${name}”: kod küçük harfle başlamalı; yalnızca küçük harf, rakam ve alt çizgi (ör. yol_odeme).`);
    else if (VAR_CODES.has(c.code)) errs.push(`“${name}”: “${c.code}” hazır bir değişken adı; başka bir kod seçin.`);
    else if (codes.has(c.code)) errs.push(`“${c.code}” kodu birden çok sütunda kullanılmış.`);
    codes.add(c.code);
    if (!["bilgi", "kazanc", "kesinti", "odeme"].includes(c.group)) errs.push(`“${name}”: grup geçersiz.`);
    if (!["input", "formula", "text"].includes(c.kind)) errs.push(`“${name}”: tür geçersiz.`);
    if (c.kind === "formula" && !c.formula?.trim()) errs.push(`“${name}”: formül boş.`);
  }
  const numeric = new Set(cols.filter((c) => c.kind !== "text").map((c) => c.code));
  const deps = new Map<string, Set<string>>();
  for (const c of cols) {
    if (c.kind === "text" || !c.formula?.trim()) continue;
    try {
      const refs = new Set<string>();
      refsOf(parseFormula(c.formula), refs);
      for (const r of refs) {
        if (!numeric.has(r) && !VAR_CODES.has(r)) errs.push(`“${c.label}”: formüldeki “${r}” tanımlı bir sütun ya da değişken değil.`);
        if (c.kind === "input" && numeric.has(r)) errs.push(`“${c.label}”: giriş sütununun ilk değeri başka sütuna başvuramaz (yalnızca sayı ya da tanim_… değişkeni).`);
      }
      if (c.kind === "formula") deps.set(c.code, refs);
    } catch (e) {
      errs.push(`“${c.label}”: ${e instanceof Error ? e.message : "formül hatalı"}.`);
    }
  }
  // döngü
  const state = new Map<string, number>();
  const visit = (code: string): boolean => {
    if (state.get(code) === 2) return false;
    if (state.get(code) === 1) return true;
    state.set(code, 1);
    for (const r of deps.get(code) ?? []) if (deps.has(r) && visit(r)) return true;
    state.set(code, 2);
    return false;
  };
  for (const code of deps.keys()) if (visit(code)) { errs.push(`“${code}” formülü kendine dönüyor (döngüsel başvuru).`); break; }
  return [...new Set(errs)];
}

export type Cells = Record<string, number | string | null | undefined>;
export type RowResult = { values: Record<string, number>; texts: Record<string, string>; overridden: string[] };

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const parsed = new Map<string, Node>();
const tree = (src: string) => {
  let t = parsed.get(src);
  if (!t) { t = parseFormula(src); parsed.set(src, t); }
  return t;
};

/**
 * Bir satırı hesaplar. Hücrede sayı varsa o geçerlidir (giriş değeri ya da elle ezilmiş formül); yoksa formül
 * sütunu formülünden, giriş sütunu ilk değer formülünden (yalnızca değişkenler) hesaplanır. Hata veren formül 0 sayılır.
 */
export function computeRow(cols: PayCol[], cells: Cells, vars: RateVars): RowResult {
  const byCode = new Map(cols.map((c) => [c.code, c]));
  const values: Record<string, number> = {};
  const texts: Record<string, string> = {};
  const overridden: string[] = [];
  const busy = new Set<string>();
  const get = (name: string): number => {
    if (name in values) return values[name];
    const col = byCode.get(name);
    if (!col || col.kind === "text") return vars[name] ?? 0;
    const own = num(cells[name]);
    if (own !== null) {
      if (col.kind === "formula") overridden.push(name);
      return (values[name] = own);
    }
    if (!col.formula?.trim() || busy.has(name)) return (values[name] = 0);
    busy.add(name);
    let v = 0;
    try {
      v = evalNode(tree(col.formula), col.kind === "input" ? (n) => vars[n] ?? 0 : get);
    } catch {
      v = 0;
    }
    busy.delete(name);
    return (values[name] = Number.isFinite(v) ? v : 0);
  };
  for (const c of cols) {
    if (c.kind === "text") texts[c.code] = typeof cells[c.code] === "string" ? (cells[c.code] as string) : "";
    else get(c.code);
  }
  return { values, texts, overridden: [...new Set(overridden)] };
}

/** Satır açılırken giriş sütunlarının ilk değerleri (ücret tanımından / sabitten); sonradan elle değiştirilir. */
export function initialCells(cols: PayCol[], vars: RateVars): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of cols) {
    if (c.kind !== "input") continue;
    let v = 0;
    try {
      v = c.formula?.trim() ? evalNode(tree(c.formula), (n) => vars[n] ?? 0) : 0;
    } catch {
      v = 0;
    }
    out[c.code] = round2(v);
  }
  return out;
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** TOPLAM satırı: `total` işaretli sütunların toplamı (ham değerler toplanır, sonra yuvarlanır; Excel'deki gibi). */
export function sumRows(cols: PayCol[], rows: { values: Record<string, number> }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of cols) if (c.total && c.kind !== "text") out[c.code] = round2(rows.reduce((s, r) => s + (r.values[c.code] ?? 0), 0));
  return out;
}

/** Şablonu güvenli biçime getirir (veritabanından okunan JSON için). */
export function normalizeTemplate(raw: unknown): PayCol[] | null {
  if (!Array.isArray(raw)) return null;
  const cols = raw
    .filter((c): c is Record<string, unknown> => Boolean(c) && typeof c === "object")
    .map((c) => ({
      code: String(c.code ?? "").trim(),
      label: String(c.label ?? "").trim().slice(0, 40),
      group: (["bilgi", "kazanc", "kesinti", "odeme"].includes(String(c.group)) ? c.group : "bilgi") as PayGroup,
      kind: (["input", "formula", "text"].includes(String(c.kind)) ? c.kind : "input") as PayKind,
      ...(typeof c.formula === "string" && c.formula.trim() ? { formula: c.formula.trim().slice(0, 300) } : {}),
      ...(c.total ? { total: true } : {}),
    }));
  return cols.length ? cols : null;
}

/** Ödeme özetinde kullanılan "net ödenen" sütunu: kodu `net` olan, yoksa ödeme grubunun son sayısal sütunu. */
export function netColumn(cols: PayCol[]): PayCol | undefined {
  return cols.find((c) => c.code === "net" && c.kind !== "text") ?? [...cols].reverse().find((c) => c.group === "odeme" && c.kind !== "text");
}

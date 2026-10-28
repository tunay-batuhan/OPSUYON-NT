/** Özlük Evrakları ekranında evrak türlerinin sırası (müşterinin listesi). */
export type FileSection = { no: string; label: string; code?: string; children?: FileSection[] };

export const FILE_SECTIONS: FileSection[] = [
  { no: "1", label: "Personel İş Sözleşmesi", code: "sozlesme" },
  { no: "2", label: "İSG Evrakları", code: "isg_evraklari" },
  { no: "3", label: "Nüfus Cüzdanı / Güvenlik Kimliği", code: "nufus_kimlik" },
  { no: "4", label: "İkametgah", code: "ikametgah" },
  { no: "5", label: "Adli Sicil Kaydı", code: "adli_sicil" },
  { no: "6", label: "Sağlık Raporu", code: "saglik_raporu" },
  {
    no: "7",
    label: "Onam Formları",
    children: [
      { no: "7-1", label: "Fazla Çalışma Muvaffakatnamesi", code: "fazla_calisma_muvaffakat" },
      { no: "7-2", label: "Gece Çalışma Muvaffakatnamesi", code: "gece_calisma_muvaffakat" },
      { no: "7-3", label: "Yıllık İzin Muvaffakatnamesi", code: "yillik_izin_muvaffakat" },
      { no: "7-4", label: "Transfer Muvaffakatnamesi", code: "transfer_muvaffakat" },
    ],
  },
  // Listede olmayan eski/genel özlük evrakları: yalnızca belge varsa gösterilir
  { no: "8", label: "Diğer Özlük Evrakları", code: "ozluk" },
];

export const sectionCodes = (sections: FileSection[]): string[] =>
  sections.flatMap((s) => [...(s.code ? [s.code] : []), ...sectionCodes(s.children ?? [])]);

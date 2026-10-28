# OPSÜYON — Operasyonel Personel Süreç Yönetimi

opsuyon.com · Next.js 16 (App Router) + Supabase (Postgres, Auth, Storage)

Güvenlik, temizlik ve kurumsal tedarik hizmetlerinde personel, puantaj, izin, bordro, fatura
ve cari hesap takibi. Hesapları **merkez** açar; müşteriler yalnızca merkezin yetkilendirdiği
bilgiye ulaşır.

## Kurulum

```bash
npm install
cp .env.example .env        # SUPABASE_URL, SUPABASE_PUBLIC_KEY, SUPABASE_SECRET_KEY
npm run dev
```

Veritabanı şeması `supabase/migrations/` altındadır ve sırayla uygulanır:

| Dosya | İçerik |
|---|---|
| `…0100_foundation` | uzantılar, hizmet alanları, izin kataloğu, roller |
| `…0200_core_access` | firma, proje, profil, proje üyeliği, izin istisnaları, RLS fonksiyonları |
| `…0300_personnel` | personel, hassas bilgiler (ayrı tablo), proje atamaları |
| `…0400_documents` | belge kategorileri, belgeler, özel Storage bucket'ı |
| `…0500_operations_finance` | puantaj, izin, fatura, ödeme, cari hesap, içe aktarma kayıtları |
| `…0600_messaging_audit` | merkez ile yazışma, işlem geçmişi |
| `…0700_public_landing` | açılış sayfası için halka açık hizmet alanları |
| `…0800_shifts_reports_notifications` | vardiya planı, raporlar, bildirim sayaçları |
| `…0900_notes_round` | Danışma ve Tesis hizmet alanı, kişiye özel merkez yetkisi, Excel cari ekstre, izin kayıtları, otomatik pasife alma |
| `20261019…customer_modules` | müşteri modül anahtarları (`app_modules`), Teknik Personel hizmeti, kıyafet / savunma / denetim / risk / cari ekstre belge türleri, personel → işveren firma |
| `20261019…opsuyon_ai` | Opsüyon AI modül anahtarı |
| `20261020…notes_round3` | Formlar (form şablonları), `forms.read`, Savunmalar adı, Yaklaşan Sözleşme anahtarı |
| `20261028…one_project_per_person` | Personel aynı anda yalnızca 1 projede (tetikleyici + benzersiz dizin; eski çift atamalar temizlendi) |
| `20261027…notes_round4` | Özlük evrak türleri (iş sözleşmesi, İSG, kimlik, ikametgah, adli sicil, sağlık raporu, onam formları), Eğitim ve İhtar belge türleri, `trainings.read`, modül adları |
| `20261020…patrol` | Devriye: noktalar, okutma kayıtları, `record_patrol_scan()`, Devriye Görevlisi rolü |

Test / demo hesapları (müşteri denemesi için):

```bash
node --env-file=.env scripts/seed-demo.mjs           # kurar (varsa dokunmaz)
node --env-file=.env scripts/seed-demo.mjs --reset   # silip yeniden kurar
node --env-file=.env scripts/seed-docs.mjs           # ek örnek belgeler (denetim, kıyafet, savunma, izin formu…); tekrar çalıştırılabilir
```

İlk süper yönetici:

```bash
node --env-file=.env scripts/bootstrap-admin.mjs --username=admin --name="Ad Soyad"
```

## Mimari notlar

- **Giriş:** tek ekran (`/giris`), kullanıcı adı + parola; hesabın türü ve yetkisi açılacak ekranları belirler. Supabase Auth e-posta ister; `kullanici@portal.opsuyon.com`
  biçiminde iç bir adres türetilir (e-posta gönderilmez). Açık kayıt kapalıdır.
- **Cari hesap:** muhasebe Excel ekstreyi yükler (Proje → Excel aktar); son satırın bakiyesi güncel bakiyedir.
- **Yetki modeli:** `permissions` (katalog) → `roles` → `role_permissions`. Müşteri erişimi
  `project_members` (proje başına rol) + `member_permission_overrides` (kişiye özel izin ver / engelle).
  Güvenlik **RLS** ile veritabanında sağlanır; arayüzdeki gizlemeler yalnızca kolaylıktır.
- **Müşteri modülleri:** müşteri panelindeki her ekran `app_modules` tablosunda bir modüldür. Kapalı modül müşteri menüsünde görünmez
  ve adresi 404 verir; merkez her zaman erişir. Açıp kapatmak için Merkez → *Müşteri modülleri* (yeniden yayın gerekmez).
  Müşterinin yazılı isteği ve aşamalar: `docs/yol-haritasi.md`.
- **Opsüyon AI (yardım asistanı):** sağ altta açılan, portalın ekranlarını bilen sohbet asistanı (yalnızca test aşaması). Claude Haiku kullanır; anahtar `CLAUDE_API_KEY` (yalnızca sunucu; Vercel'e de eklenmeli). Bilgisi `src/lib/assistant/guide.ts` içindedir ve **özellik eklendikçe/değiştikçe güncellenmelidir**. Soran kişinin menüsü de modele verilir; veritabanına erişmez, sohbet kaydedilmez. Canlıya çıkarken Merkez → Müşteri modülleri → *Opsüyon AI* anahtarını kapatın.
- **Görüntüle:** her "PDF indir"in yanında "Görüntüle" düğmesi vardır (`ViewButton`); belge AppShell'deki tek görüntüleyicide, sayfanın altında açılır (`/api/documents/[id]/view`, `/api/forms/[id]/view`). Yeni bir indirme bağlantısı eklerken `DownloadLink`/`PdfIcon` kullanın, görüntüleme kendiliğinden gelir.
- **Devriye (DEMO — henüz onaylanmadı; menüde rozet, ekranlarda uyarı):** noktalar (`patrol_points`) QR olarak basılır; devriye görevlisi telefonunda *Barkod Okut* ile okutur (`zxing`, kamera yalnızca https'te); günlük rapor okutma kayıtlarından her istekte PDF olarak üretilir (`pdf-lib`, Türkçe karakterler için gömülü Roboto). Okutma yalnızca `record_patrol_scan()` ile yazılır (yetki ve çift okuma kontrolü veritabanında).
- **Yeni özellik eklemek:** yeni izin = `permissions` satırı; yeni belge türü = `document_categories`
  satırı; yeni hizmet alanı = `service_lines` satırı. Yeni tablo → RLS aç, politikaları
  `app.has_project_permission(...)` ile yaz, `app.audit_row()` tetikleyicisini bağla.
- **Belgeler:** özel bucket; tarayıcı doğrudan imzalı URL ile yükler, indirme
  `/api/documents/[id]` üzerinden RLS kontrolünden sonra 60 sn'lik imzalı URL ile yapılır.
- **Gizli anahtar:** `SUPABASE_SECRET_KEY` yalnızca `src/lib/supabase/admin.ts` (server-only) içinde kullanılır.

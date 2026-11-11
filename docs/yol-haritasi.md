# OPSÜYON — Müşteri çalışmasına göre yol haritası

Kaynak: `docs/` klasöründeki müşteri çalışması (18–19 Ekim 2026)
- 5 görsel: 2 ekran düzenlemesi (Puantaj, Denetimler), 3 el yazısı sayfa (menü yapısı, devam, ileri özellikler)
- 5 PDF form örneği: Kıyafet Teslim Tutanağı, Savunma Tutanağı, İzin Talep / İzin Kullanım / İzin Ücreti Talep formları

**İlke:** Şimdiye kadar yapılanlar tahmine dayalıydı. Bundan sonra yalnızca müşterinin **yazılı olarak istediği** ekranlar müşteri panelinde açık olur. İstenmeyenler silinmez, **modül anahtarıyla kapalı** tutulur ve müşteri isteyince tek tıkla açılır (Merkez → Müşteri modülleri). Böylece müşteri sadece istediği şeyi test eder.

---

## 0. Projenin asıl amacı (müşteriden, 19 Ekim)

Siteler ve hastaneler güvenlik ve temizlik çalışanlarına ihtiyaç duyar. Bu firma şimdiye kadar onlara personel sağlayıp denetimi de yapıyordu; bu, sitelere **yüksek vergi yükü ve maliyet** getiriyor.

**Yeni model:** Güvenlik ve temizlik personeli, hizmeti isteyen kurumun **kendi altyapısında, kendi bünyesinde** çalışır (işveren = site/hastane). **Yönetim yine bu firmada kalır.** Aradaki vergi/maliyet farkı büyük olduğu için kurumlar bu hizmeti satın alır.

### Bunun tasarıma etkisi
| Sonuç | Sistemde karşılığı |
|---|---|
| Personelin işvereni müşteri kurumdur | Her personel bir **işveren firmaya** bağlı; başka firmanın projesine atanamaz |
| Sözleşme, özlük, bordro müşterinin İK belgeleridir; merkez onun adına hazırlar | Bordro **hizmet bazında toplu** yüklenir (müşterinin notuyla uyumlu) |
| Firmanın işi: yönetim, denetim, disiplin, ekipman, risk | Ürünün çekirdeği: **Denetimler, Savunmalar, Kıyafet/Ekipman, Risk Analizi, Devriye, Puantaj** |
| Müşteri firmaya "yönetim hizmeti" öder | **Cari hesap / faturalar** yönetim hizmeti bedelidir; Banka entegrasyonu bu tahsilatı otomatikleştirir |
| Dil önemli | "Personel tedariki" ifadesi yeni yapıyı yanlış anlatabilir → ana sayfa ve menülerde "personel yönetimi / operasyon yönetimi" dili önerilir |

> **Dikkat (ürünün dışında ama kritik):** Vergi avantajı, yapının hukuken doğru kurulmasına bağlıdır (işveren kim, sözleşmeleri kim imzalıyor, hizmet "yönetim/danışmanlık" mı "personel temini" mi, özel güvenlik mevzuatı, muvazaa riski). Bunu **mali müşavir ve hukukçuyla** netleştirmenizi öneririm; sistem de bu yapıya uygun belge ve alanlarla kurulacak.

---

## 1. Müşterinin isteği (görsellerden)

### Hedef müşteri menüsü
```
Ana Sayfa
Personel  ▾
   Personel Sözleşmeleri
   Özlük Dosyaları
   Bordrolar
   Yıllık İzinler
   Kıyafet ve Ekipman
   Personele Savunmalar
Puantaj
Denetimler
Cari Hesap  ▾
   Faturalar
```

### Kaldırılacak (müşteri panelinden)
Projeler · Vardiya Planı · İzin Yönetimi · Sözleşmeler (ana menüdeki) · Bordrolar (ana menüdeki) · Faturalar (ana menüdeki, Cari Hesap altına taşınıyor) · Raporlar · Mesajlar (menüden; ana sayfada zaten görünüyor)

### Ekran ekran istekler
| Ekran | İstek |
|---|---|
| **Hizmet filtresi** (hepsinde ortak) | Güvenlik · Temizlik · Danışma · Teknik Personel |
| **Personel Sözleşmeleri** | Üstte hizmet filtresi; altta tüm personel listesi (filtreye göre değişir); her satırda PDF indir ikonu |
| **Özlük Dosyaları** | Personel Sözleşmeleri ile aynı |
| **Bordrolar** | Üstte filtre (hizmet); bizim yüklediğimiz bordro altta PDF olarak listelenir, yanında PDF indir. **Bordro kişi bazlı değil, hizmet bazında toplu yüklenir** (Güvenlik, Temizlik, Danışma, Teknik Personel) |
| **Yıllık İzinler** | Üstte hizmet filtresi; altta personel satırları: işe giriş tarihi · hak edilen izin süresi · kullanılan izin gün sayısı · kalan izin. Personel adına tıklayınca altında o personelin yüklenmiş **PDF izin formları** açılır, yanında indir |
| **Kıyafet ve Ekipman** | Personel listesi + hizmet filtresi; personel seçince altında kıyafet/ekipman teslim tutanakları (PDF, indirilebilir) |
| **Personele Savunmalar** | Aynı kalıp: personel listesi → savunma tutanakları (PDF) |
| **Puantaj** | Üstte filtre: Hizmet · Ay · Yıl. Seçime göre altta ilgili PDF puantaj görünür, yanında PDF indir (görselde sayfa içinde önizleme + "Excel Aç") |
| **Denetimler** *(yeni, Test Site kullanıcısı için)* | Filtre: Proje · Ay · Yıl. Liste: Tarih · Gece/Gündüz · Denetim Raporu (PDF ikonu) |
| **Cari Hesap** | Tıklayınca son yüklenen cari ekstre (PDF indirilebilir) |
| **Cari Hesap → Faturalar** | Üstte Ay ve Yıl filtresi; altta o aya ait fatura satırı + PDF indir |
| **Ana sayfa** | Mesajlar görünür; **Risk Analizi Raporu** (PDF, biz yükleyeceğiz) |

### Daha sonra (not düşülmüş, henüz tasarlanmadı)
| İstek | Not |
|---|---|
| **Devriye sistemi** | Güvenlik / danışma devriyede noktalar yerine **barkod okutacak**; devriye raporu günlük belirlenen **cep telefonlarına** gidecek; personel durum fotoğrafı ekleyebilecek |
| **Banka entegrasyonu** | Müşteri havale/EFT yapınca program otomatik işlem yapacak |

---

## 2. Aşamalar

### Faz 0 — Temel (önce) · ✅ tamamlandı
- **Modül anahtarları:** müşteri panelindeki her ekran bir modül; açık/kapalı durumu veritabanında. Merkez → Müşteri modülleri sayfasından açılıp kapatılır, yeniden yayına gerek yoktur.
- Müşteri menüsüne **alt menü** (aç/kapa) desteği.
- Yeni hizmet alanı **Teknik Personel**; yeni belge türleri: Kıyafet ve Ekipman Teslim Tutanağı, Personel Savunması, Denetim Raporu, Risk Analizi Raporu, Cari Ekstre (PDF).
- Bordro: kişi bazlı değil **hizmet/proje bazlı toplu** belge.
- **Personel → işveren firma** bağı (personel müşteri firmanın kadrosunda; başka firmaya atanamaz).

### Faz 1 — Müşteri paneli · ✅ tamamlandı
Hedef menü ağacındaki bütün ekranlar + filtreler + PDF indirme + sayfa içi PDF önizleme.
Kabul ölçütü: her ekran, ilgili belge yüklenince görünür; yetkisi olmayan hesap göremez; mobil uyumlu.

### Faz 2 — Merkez tarafı kolaylaştırma · kısmen
- Toplu yükleme (aynı belgeyi birden çok personele / çoklu dosya) — *bekliyor*
- ✅ Denetim yüklerken tarih + Gece/Gündüz alanı (Merkez → proje → Belgeler)
- Puantaj sayfasında Excel dosyasını tabloya çevirip önizleme (görseldeki gibi) — *bekliyor*
- Müşteriye göre hangi modüllerin açık olduğu (firma bazlı anahtar) — *bekliyor; şu an anahtarlar tüm müşteriler için ortak*

### Faz 3 — Müşteri isteyince (kod yazılmaz, önce netleşir)
- **Devriye sistemi:** barkod/QR noktaları, okutma kaydı, günlük rapor, cep telefonuna bildirim, fotoğraf. *Gerekenler:* nokta listesi, hangi telefonlara (WhatsApp / SMS / e-posta?), rapor şablonu.
- **Banka entegrasyonu:** *Gerekenler:* hangi banka(lar), API / hesap hareketi erişimi (açık bankacılık), eşleştirme kuralı (açıklama / IBAN / tutar).
- **Form üretimi:** İzin talep / kullanım / ücret talep, kıyafet teslim, savunma formlarının sistemden doldurulup PDF üretilmesi (şu an müşteri hazır PDF yüklüyor).

---

## 3. Modül anahtarları (varsayılan)
| Modül | Müşteri panelinde | Not |
|---|---|---|
| Personel Sözleşmeleri, Özlük, Bordro, Yıllık İzin, Kıyafet ve Ekipman, Savunma | **Açık** | İstendi |
| Puantaj, Denetimler, Cari Hesap, Faturalar | **Açık** | İstendi |
| Risk Analizi Raporu (ana sayfa) | **Açık** | İstendi |
| Projeler, Vardiya Planı, İzin Yönetimi (kayıt ekranı), Raporlar, Mesajlar (menü) | **Kapalı** | "Kaldırılacak" denildi; istenirse açılır |
| Formlar, Risk Analizi (menü) | **Açık** | 19 Ekim notları |
| Devriye Sistemi | **Açık — DEMO** | Onaylanmadı; rozet ve uyarıyla gösterim amaçlı |
| Yaklaşan Sözleşme (ana sayfa kutusu) | **Kapalı** | "Kalkacak" denildi; merkezde durur |
| Banka Entegrasyonu | **Planlandı** | Faz 3 |

Merkez (yönetici) tarafında bu ekranlar çalışmaya devam eder; çünkü müşterinin göreceği belgeleri merkez yükler.

---

## 4. Netleştirilecek sorular
1. **Teknik Personel**, Kurumsal Tedarik'in yerine mi geçiyor, yoksa yanına mı ekleniyor? (Şimdilik ikisi de var.)
2. **Cari ekstre:** PDF ekstre proje bazında mı, firma bazında mı yüklenecek? (Şimdilik proje bazında; Excel ekstreden gelen bakiye de duruyor.)
3. **Devriye notundaki "personel ... resmi":** durum/olay fotoğrafı mı demek?
4. **Savunmalar** için notta alt madde yok; Kıyafet ile aynı kalıpta (personel → PDF tutanaklar) yaptım. Doğru mu?
5. Banka entegrasyonu için hangi banka ve nasıl bir erişim (API) mümkün?
6. Ana sayfa dili: "Personel Tedariki" / "Kurumsal Tedarik" ifadeleri, personelin müşterinin kendi bünyesinde çalıştığı yeni yapıyı yanlış anlatır mı? Önerim: "Personel ve Operasyon Yönetimi".
7. Sözleşme ve bordro belgelerinde işveren olarak **müşteri kurum** adı mı görünecek? (Sistem buna göre kurulacak.)
8. "**Verso**" (ilk notlarda) hâlâ okunamadı.

---

## 5. Uygulama durumu (19 Ekim)
| Parça | Durum |
|---|---|
| Modül anahtarları (`app_modules`) + Merkez → Müşteri modülleri | ✅ |
| Müşteri menüsü: alt menüler (Personel ▾, Cari Hesap ▾), kapalı modül = menüde ve adreste yok (404) | ✅ |
| Personel: Sözleşmeler, Özlük, Bordrolar, Yıllık İzinler (işe giriş / hak / kullanılan / kalan + formlar), Kıyafet, Savunmalar | ✅ |
| Puantaj (Hizmet + Ay + Yıl, sayfa içi PDF önizleme), Denetimler (Proje + Ay + Yıl; Tarih · Gece/Gündüz · PDF), Cari Hesap (son ekstre), Faturalar (Ay + Yıl) | ✅ |
| Ana sayfa: Risk Analizi Raporu kartı, hizmet kartları (4 hizmet, Teknik Personel dahil) | ✅ |
| Personel → işveren firma (`personnel.organization_id`, başka firmaya atama veritabanında reddedilir) | ✅ |
| Demo veri: `scripts/seed-docs.mjs` (Teknik Personel projesi, denetim/kıyafet/savunma/izin formları, toplu bordro, puantaj, ekstre, risk) | ✅ |
| Banka entegrasyonu | ⏳ Faz 3 — müşteri istediğinde |

---

## 6. 19 Ekim el yazısı notları (3. tur) ve örnek bordro
| İstek | Durum |
|---|---|
| Ana sayfa: "Yaklaşan sözleşmeler kalkacak" | ✅ Müşteri ana sayfasından ve bildirimlerinden kalktı (`yaklasan_sozlesme` modülü kapalı; merkezde durur) |
| Bordrolar: üstte Hizmet Türü · Ay · Yıl filtresi; altta bordro; tek personel için değil **toplu** | ✅ Filtreler hazırdı; liste altında bordro dosyası sayfada önizleniyor (PDF / görsel; Excel ise "Excel Aç"). Demo bordro, müşterinin örnek tablosunun sütunlarıyla (kurgusal isimler) üretildi |
| Yıllık İzin · Kıyafet Ekipman · Savunmalar: üstte Hizmet Türü ve **Personel Adı** filtresi | ✅ Personel adı arama kutusu (birkaç harf yeter; Türkçe karakter/büyük-küçük harf fark etmez) |
| "Personele Savunmalar" başlığı **Savunmalar** olacak | ✅ Menü, sayfa ve modül adı değişti |
| **Formlar** eklenecek; filtre kısmı birkaç harf ile arama | ✅ Form şablonları kütüphanesi: arama kutusuna birkaç harf yazınca liste anında süzülür, İndir. Merkez "Form ekle" ile yükler |
| **Devriye Sistemi**: noktalarda telefonla barkod okutma, günlük devriye raporu otomatik, "Devriye Rapor" sekmesi: Gün-Ay-Yıl filtresi, altta rapor ve PDF | ✅ Bkz. aşağıdaki "Devriye" |
| **Risk Analizi**: bizim yüklediğimiz rapor PDF olarak inecek, altta satır | ✅ Kendi menü öğesi; ana sayfadaki kart kaldırıldı |

### Devriye (nasıl çalışıyor) — DEMO sürüm
> **Durum: DEMO.** Devriye henüz onaylanmadı; gösterim amaçlı yayında. Menüde "Demo" rozeti, ekranlarda "Demo sürüm" uyarısı, PDF raporda "DEMO SÜRÜM" yazar. Kesinleşince rozet ve uyarılar kaldırılır (`DemoNotice`, menüdeki `badge: "Demo"`, PDF başlığı).

- **Noktalar:** Merkez → Devriye Sistemi → *Noktalar ve Etiketler*: projeye nokta eklenir (barkod içeriği otomatik, `DVR-XXXXXXXX`), etiketler A4'e QR olarak yazdırılıp noktaya yapıştırılır.
- **Okutma:** *Devriye Görevlisi* hesabı (yeni rol) telefonundan giriş yapar → *Barkod Okut* → kamera QR/barkodu okur (kamera yoksa kod elle girilir). Aynı nokta 20 sn içinde tekrar okutulursa çift kayıt açılmaz.
- **Rapor:** Okutma kayıtlarından her gün otomatik oluşur (PDF: özet kutuları, nokta özeti, okutma kayıtları). Müşteri/merkez *Devriye Rapor* ekranında Proje · Gün · Ay · Yıl ile bulur, sayfada görür, PDF indirir.
- Yetkiler: `patrol.scan` (okutma), `patrol.read` (rapor), `patrol.manage` (nokta/etiket; yalnızca merkez).

### Varsayımlar — doğrulanmalı
1. **Formlar** = boş form şablonları (izin talep, izin kullanım, ücret talep, kıyafet teslim, savunma). Yoksa "personelin doldurulmuş formlarının" arandığı bir ekran mı kastedildi?
2. **Barkod** yerine **QR** etiket basıldı (telefon kamerasıyla daha güvenilir okunur); sistem 1D barkodları (Code128/EAN) da okur. Mevcut barkodlu etiketleriniz varsa kodlarını nokta olarak girebiliriz.
3. Devriye raporu **takvim günü** (00:00–24:00) bazlı. Gece vardiyası gece yarısını aşıyorsa rapor iki güne bölünür; "vardiya bazlı rapor" gerekiyorsa değiştirilir.
4. "Okutulmayan nokta" = o gün hiç okutulmayan nokta. Tur sayısı, sıklık ve nokta sırası zorunluluğu tanımlı değil.
5. Devriye'de fotoğraf ve telefona bildirim yok (ikinci notta "ana sayfada / rapor sekmesinde görülecek" denmiş).
6. Bordro dosyası PDF/görsel/Excel olabilir; Excel'in sayfada **tablo olarak** gösterilmesi gerekiyorsa ayrıca yapılır.
7. Notun "Anasayfa" altındaki ikinci satırı okunamadı.

---

## 7. "Demo Site Kullanıcısı" tablosu (27 Ekim, 4. tur)
| İstek | Durum |
|---|---|
| Yazılımdaki tüm **PDF indir**'in yanında **GÖRÜNTÜLE**; seçilince belge indirmeden **altta** görünsün | ✅ Her indirme noktasında (Özlük, Eğitimler, Savunmalar, İzinler, Kıyafet, Bordro, Denetim, Cari Hesap, Faturalar, Risk, Formlar, merkez Belgeler…) "Görüntüle" düğmesi; belge sayfanın altındaki görüntüleyicide açılır, "Kapat" ile kapanır. PDF/görsel görüntülenir; Excel/Word için "görüntülenemez, indir" bilgi sayfası |
| **Personel Sözleşmeleri** sekmesi kalkacak; tüm sözleşmeler Özlük Evrakları altında | ✅ Sekme kalktı (modül kapalı; eski adres Özlük Evrakları'na yönlenir). Sözleşme, Özlük Evrakları'nın 1. sırası |
| "Özlük Dosyaları" adı **Özlük Evrakları** | ✅ |
| Üst filtre: **Ad Soyad ile personel seçilsin**; altta o personelin evrakları satır satır: Personel Adı / Evrakın Adı / PDF indir + Görüntüle | ✅ Hizmet + Personel (Ad Soyad) seçimi; seçilince evrak türleri istenen sırada listelenir, olmayan evrak "Yüklenmemiş" yazar |
| Sıra: 1 İş Sözleşmesi · 2 İSG · 3 Nüfus Cüzdanı/Güvenlik Kimliği · 4 İkametgah · 5 Adli Sicil · 6 Sağlık Raporu · 7 Onam Formları (7-1 Fazla Çalışma, 7-2 Gece Çalışma, 7-3 Yıllık İzin, 7-4 Transfer Muvaffakatnamesi) | ✅ Yeni belge türleri; merkez Belgeler > Belge yükle'den yükler |
| **Eğitimler** (yeni): personel seçilir; katıldığı tüm eğitimler satır satır, PDF indir + Görüntüle | ✅ Üst sekme; `trainings.read` izni, "Eğitim Belgesi" türü (her eğitim ayrı belge) |
| **Bordrolar** Personel altında olmasın; Puantaj gibi ayrı sekme | ✅ Üst sekme (`/bordrolar`); eski adres yönlenir |
| **Savunmalar** → "SAVUNMALAR VE İHTARLAR" | ✅ Üst sekme + yeni "Personel İhtarı" belge türü |
| Merkez hesabında projeler gözükmedi — kontrol | ✅ İncelendi, aşağıya bakın |

### Projeler neden görünmedi? (inceleme sonucu)
Veritabanında `admin` dışında merkez (staff) hesabı yok; sorun müşteri hesabı `butik.garden`'daydı:
1. **Yeni proje, firmanın mevcut hesaplarına otomatik bağlanmıyordu.** Hesap açıldıktan sonra eklenen "Temizlik Hizmeti" projesine hesabın üyeliği yoktu. → Düzeltildi: proje oluşturulunca firmanın *Firma Yöneticisi* hesaplarına erişim otomatik verilir (proje sayfasında bilgi bandı çıkar). Diğer roller (İK, Muhasebe…) için Kullanıcılar > kişi > "Projeye erişim ver" gerekir.
2. **Aynı adlı eski bir "Temizlik Hizmeti" projesi bitiş tarihi 01.01.2026 olduğu için otomatik Pasif'e alınmıştı;** Pasif projede müşteri erişimi kapanır (müşteri isteği). → Proje formlarına "bitiş tarihi geçmişte, proje Pasif olur" uyarısı eklendi.
3. `butik.garden` hesabına yeni Temizlik projesi için erişim verildi (düzeltme).

---

## 8. Kural: bir personel aynı anda yalnızca 1 projede (28 Ekim)
- Bir personel aynı anda **en fazla 1 projede** görevli olabilir. Başka projeye alınmak için önce mevcut projeden çıkarılır (**Görevden al**), sonra yeni projeye atanır.
- Veritabanında zorunlu (tetikleyici + benzersiz dizin): kural arayüz dışından da çiğnenemez. Hata mesajı hangi projede görevli olduğunu söyler.
- Arayüz: "Personel ata" listesinde yalnızca boştaki personel görünür; başka projede görevli olanlar nedeniyle birlikte altta listelenir. Excel aktarımında da aynı denetim var.
- Mevcut çift atamalar temizlendi (personelin kendi firmasındaki atama kaldı).
- Not: personel yalnızca kendi firmasının projelerine atanabilir (ayrı kural, önceki turdan).

### "Hesap açtım, 2 proje tanımladım, girince projeleri göremedim" (inceleme)
Veritabanı geçmişinden olay sırası çıkarıldı (27 Ekim). İki neden birlikte çalışıyordu:
1. Hesap, projelerden **önce** açılmıştı; sonradan açılan projeye hesabın erişimi otomatik bağlanmıyordu (düzeltildi: Firma Yöneticisi hesaplarına otomatik erişim).
2. Müşteri menüsünde **Projeler yok** (müşteri istemişti); müşteri projeleri yalnızca ana sayfadaki hizmet kartlarında sayı olarak görüyordu. → Kartların altına **proje adları** eklendi.
Ayrıca eski bir projenin bitiş tarihi geçmişti; otomatik Pasif olup erişimi kapattı (formlara uyarı eklendi).

---

## 9. 5. tur (5 Kasım): sadeleştirme, sayfalama, personel kartı
Kaynak: müşterinin el yazısı notu + Tunay'ın notları. Genel ilke: aynı işi yapan ekranlar tek sayfada / alt sekmede toplanır; **form ve evrak ekleme sayfanın en üstünde**; tüm listeler sunucu tabanlı **10'arlık sayfalama** ve tablodaki her sütunu kapsayan filtre alır.

| İstek | Karar / uygulama |
|---|---|
| Danışma ve Tesis birbirinden ayrılacak (müşteri) / "sadece Danışma olacak" (Tunay) | Mevcut hat **Danışma** oldu, **Tesis Yönetimi** ayrı hat eklendi (iki notu birden karşılar) |
| Kurumsal Tedarik kalkacak | Pasife alındı: yeni proje açılamaz, mevcut projeler durur |
| Proje pasif edilince aktifler arasında görünmesin; personelde Aktif/Pasif/Ayrıldı filtresi | Projeler ve Personel listelerinde Durum filtresi, varsayılan **Aktif** |
| Personel listesinde / kartta Sicil No olmasın | Arayüzden kaldırıldı (veritabanında duruyor; Excel eşleştirmesi için) |
| Personel kartına: doğum yeri/tarihi, memleket, adres, medeni hal, boy, kilo, pantolon/gömlek/mont ölçüsü, ayakkabı no, yedek telefon + kime ait | Eklendi (migration `20261105000100`) |
| İşe giriş + yaş + çalışma süresi → yıllık izin hakkı kanuna göre | `src/lib/leave-law.ts`: İş K. md. 53 (1–5 yıl 14, 5–15 yıl 20, 15+ 26 gün; ≤18 / ≥50 yaş en az 20). Kullanılan yıllık izin bakiyeden düşer |
| Personel sayfası alt sekmeleri: Personel ekle, Evrak ekle; detayda evraklar açılır-kapanır + filtre; detaydaki Yıllık izin kartı kalkar | Yapıldı |
| Puantaj: tüm projelerin puantaj dosyaları liste halinde (PDF indir + Görüntüle); "Puantaj ekle" alt sekmesi (Proje/Ay/Yıl/Gözat/Ekle) | Yapıldı; proje içindeki puantaj tablosu şimdilik duruyor |
| Denetimler: Gece/Gündüz filtresi; "Yeni denetim ekle" alt sekmesi | Yapıldı |
| İzin Yönetimi: filtre Proje/Ad Soyad/Yıl/İzin türü; "İzin evrakı ekle" alt sekmesi (personel, tür, gün, tarihler, imzalı evrak) | Yapıldı |
| Vardiya Planı kaldırılacak; Sözleşmeler menüsü kalkacak | Menüden kaldırıldı (kod duruyor) |
| Müşteri: Özlük Evrakları ve Eğitimler'de personel açılır kutuda değil listede; tıklayınca detay | Liste + detay sayfası |
| Devriye mobil beklenmeyecek | Devriye olduğu gibi (demo) kaldı |
| (6 Kasım, Tunay) Müşteri **Personel**'e tıklayınca tüm personeli görmeli | `/personel`: tüm aktif personel listesi (Hizmet / Proje / Ad soyad filtresi, 10'ar), alt menüde **Tüm Personel**. Kişiye tıklayınca `/personel/[id]`: özet + Özlük durumu (✓/eksik) + Yıllık izin (hak/kullanılan/kalan, kayıtlar, formlar) + Eğitimler + Kıyafet + Savunma/İhtar, tek sayfada; yetkisi/modülü olmayan bölüm görünmez; doğum tarihi, adres, telefon müşteriye gösterilmez. Ana sayfa hizmet kartları da bu listeye açılır |

Not: "4TB – 12.000 ₺ + KDV" satırı teklif notu olarak okundu, sisteme yansıtılmadı.

## 10. Sekme düzeni ve form kolaylıkları (6 Kasım, Tunay)
| İstek | Uygulama |
|---|---|
| Sayfalar arası geçişte ilerleme çubuğu | `@bprogress/next` (nextjs-toploader indirme bağlantılarında takılı kalıyordu). Çubuk "Yükleniyor…" iskeleti boyunca sürer; /api/ indirmelerinde başlamaz. Filtre/arama formları `next/form` ile sayfa yenilemeden çalışır |
| İzin girerken "işe başlama" soruluyor | Alan aslında izin dönüşüydü: adı **İşe dönüş tarihi** oldu (son tarih + 1 gün otomatik) |
| Personel adı aranabilir olsun | Ortak aranabilir seçim kutusu (`SelectField searchable`): izin, evrak ekleme, belge yükleme, proje ataması |
| İzin ekranında kalan izin | Personel seçilince bu yılın hak edilen / kullanılan / kalan günü ve "bu izinle kalan" |
| Aynı ekranda birden çok iş olmasın; alt sayfalar sekme olsun | Sol menü açılır alt menüleri kalktı; Personel, Devriye, Cari Hesap alt sayfaları sekme (`sectionPages` + `SectionTabs`). Firmalar, Kullanıcılar, Formlar, Devriye noktaları: liste / ekle sekmeleri. Firma, kullanıcı ve personel detayları sekmeli (layout + alt sayfalar) |
| Sekmeler daha belirgin, sağdaki kaydırma çubuğu | Sekme şeridi kart görünümünde, seçili sekme dolu mavi, sayılar rozet; kaydırma çubuğu gizli (`.no-scrollbar`) |

| Sekmeye basınca bütün sayfa yeniden çiziliyor; başlık hafif kayıyor | Başlık + sekmeler bölümün `layout.tsx` dosyasında (`SectionHeader`): sekme değişince yalnızca içerik yüklenir, iskelet başlıksız (`PageSkeleton header={false}`). Detay sayfaları sekmesiz kalsın diye sekmeli sayfalar `(sekme)` route group içinde. Kayma: kaydırma çubuğu kısa/uzun sayfada gelip gidiyordu → `html { scrollbar-gutter: stable }` |

Kalan: proje içi sekmelerde (Personel, Belgeler, İzinler, Puantaj) ekleme formu ile liste hâlâ aynı sayfada.


## 11. 11 Kasım: cari hesap, bildirim, izin günü hesabı
| İstek | Uygulama |
|---|---|
| Formlar form ekranında silinebilsin | Listede her satırda onaylı **Sil** düğmesi (silme vardı ama silik bir ikondu) |
| Danışma projeleri de devriye kullanabilsin | Kod zaten izin veriyor (Güvenlik, Danışma, Tesis Yönetimi). Mevcut Danışma projelerinin hepsi 9 Kasım'da Pasif yapılmış; Pasif proje devriye listesinde görünmez. Aktif bir Danışma projesi listede çıkar |
| Görevden alma çalışmıyor, başka projeye atanamıyor | Görevden almalar veritabanına işlenmişti; engel "personel yalnızca kendi firmasının projesine atanır" kuralıydı ve ekran söylemiyordu → atama kartına not. Ayrıca sessiz hata yolu kapatıldı: Türkiye saatiyle tarih, ileri tarihli atama iptal edilir, onay penceresi + sonuç/hata mesajı, personel kartından da görevden alma |
| Cari Hesap: fatura ve tahsilat girişi firma bazlı; bakiye = faturalar − tahsilatlar | `firm_ledger_entries` (firma, tür, tarih, saat, açıklama, tutar) + `firm_ledger_balances` / `firm_ledger_movements` görünümleri. Sekmeler: Cari Hesap · Fatura girişi · Tahsilat girişi. Müşteri kendi firmasını görür. Eski Excel ekstre ekranı kaldırıldı (tablolar duruyor) |
| Raporlar ekranı gereksiz | Ekran, menü, Excel servisi ve modül satırı kaldırıldı |
| Bildirim animasyonu; müşteri → merkez bildirimi çalışmıyor | Veri doğruydu; zil sayısı ortak düzende bir kez çiziliyor ve sayfa değişse de yenilenmiyordu. Zil artık 25 sn'de bir ve sekmeye dönünce kendini günceller (`/api/notifications/count`), artışta sallanır |
| İzin: resmi tatil, hafta sonu, yarım gün | Karma çözüm: sistem önerir, yönetici düzeltir. `src/lib/leave-days.ts` (hafta tatili + resmi tatiller sayılmaz, yarım gün tatil 0,5), formda Hafta tatili seçimi ve döküm kutusu; `public_holidays` tablosu + **Resmi tatiller** sekmesi; izin gününü ve kalan bakiyeyi elle düzeltme (`leave-edit.tsx`) |

Açık kararlar: (1) Danışma projeleri Aktif yapılsın mı? (2) ✅ Firmalar arası geçiş: aktif görev yokken Süper Yönetici personel kartından firmayı değiştirir (geçmiş görevi olan personelde yalnızca Süper Yönetici; hiç ataması yoksa personel yöneticisi de). (3) Merkez ana sayfasında "Okunmamış Mesaj" kutusu gösterilsin mi? (4) 2028+ dini bayram tarihleri açıklanınca Resmi tatiller'e eklenmeli.

## 12. Devriye TURU (11 Kasım — yapı değişti)
Devriye, manyetik kalem/anahtar sisteminin QR karşılığıdır: **başlatılır, noktalar okutulur, bitirilir.**
| Konu | Karar / uygulama |
|---|---|
| Başlatma | Projenin tek **“Devriye başlat / bitir”** etiketi (`patrol_points.kind = 'tur'`, ilk nokta eklenince kendiliğinden oluşur). Okutulunca PIN + ad sorulur, tur açılır (`patrol_tours`), telefon çerezle tura bağlanır (veritabanında yalnızca özet) |
| Noktalar | PIN/ad sorulmaz; sayfa açılınca okutma tura yazılır. Sıra serbest. Tur başlatılmadan okutulan nokta **kaydedilmez** |
| Bitirme | Aynı etiket tekrar okutulur → durum + okutulmayan noktalar + **Devriyeyi bitir** düğmesi. Kendiliğinden bitmez (çift okutma korkusu). Eksikle bitirirken onay sorar |
| Bitirilmeyen tur | Son okutmadan **1 saat** sonra "Zaman aşımı" ile kapanır |
| Nokta okutma | Görevli tüm QR'ları telefonun kendi kamerasıyla okutur. Tur bulma: (1) telefonun anahtarı (çerez + yerel hafıza) açık tura denk geliyorsa o tur; (2) gelmiyorsa projedeki TEK açık tur (`app.patrol_find_tour`). Sebep (canlı test, 11 Kasım): bazı telefonların QR uygulaması her kodu hafızasız ayrı pencerede açıyor, çerez gelmiyor. Bilinçli ödün: tek açık tur varken o noktayı fiziken okutan herkesin okutması o tura yazılır ve başlat/bitir etiketinden PIN'siz bitirilebilir (etiket sahada; raporda görünür) |
| Birden fazla açık tur | Telefon tanımazsa noktada "Hangi devriye?" → PIN + ad ile kişinin turuna yazılır. Başlat/bitir'de PIN + ad: kişinin açık turu varsa yenisi açılmaz, ona devam edilir (`patrol_tour_start` → "active") |
| Rapor | Devriye Kayıtları tur bazlı: Tamamlandı / Eksik / Zaman aşımı / Devam ediyor / Yeni turla kapandı; atlanan noktalar; Nokta durumu (kaç turda atlandı); PDF de tur bazlı. Eski (tursuz) okutmalar ayrı kartta |
| Etiket | **A7** (74×105 mm), A4 yatayda 8 adet, başlıkta logo; başlat/bitir etiketi lacivert başlıklı |
Kod: migration `20261111000600_patrol_tours.sql` (kurallar veritabanında: `patrol_tour_scan/start/end/resume`), `src/app/actions/patrol-tour.ts`, `src/components/patrol-scan.tsx`, `src/lib/patrol-report.ts`.
Sonraya: planlı tur saatleri ve "tur atılmadı" uyarısı, devriye fotoğrafı, raporun telefonlara gönderilmesi.

## 13. Yetkilendirme (11 Kasım): roller, müşteri ekranları, güvenlik
**Model (üç katman + bir kapı):**
1. **Hesap türü** — Merkez (kendi ekibimiz) / Müşteri (bir firmaya bağlı).
2. **Rol = yetki paketi** — merkez hesabında tek rol, her yerde geçerli; müşteri hesabında proje bazında rol (`project_members.role_id`).
3. **Kişiye özel istisna** — rolün üstüne tek tek izin ver / engelle (`staff_permission_overrides`, `member_permission_overrides`).
4. **Müşteri ekranları** (eski "Müşteri modülleri", `app_modules`) — ekran müşteri panelinde var mı; TÜM müşteriler için tek düğme. Müşteri bir ekranı ancak ekran açık VE rolünde yetkisi varsa görür.

**Yeni:** Yönetim › **Roller ve yetkiler** (`/merkez/yetkiler`): Genel bakış (açıklama + rol × ekran tabloları) · Merkez rolleri · Müşteri rolleri · Müşteri ekranları. Süper Yönetici yeni rol açar, yetkilerini seçer (alanlara göre, Görme / Değiştirme), "Bu rolle görünen menüler" önizlemesi. Hazır roller silinemez, yetkileri düzenlenebilir.

**Kapatılan açıklar** (migration `20261111000700_role_management.sql` + `src/app/actions/users.ts`): "kullanıcı yönetme" yetkisi olan merkez çalışanı Süper Yönetici'nin parolasını sıfırlayabiliyor, rolünü düşürebiliyor, hesabını kısıtlayabiliyor; doğrudan veritabanı isteğiyle kendini Süper Yönetici yapabiliyor ve kendine yetki verebiliyordu. Artık kurallar veritabanında:
- roller, rol yetkileri, merkez çalışanının kişiye özel yetkileri, hesap türü ve merkez rolü → yalnızca Süper Yönetici
- merkez hesapları (parola, kısıtlama) → yalnızca Süper Yönetici
- müşteri rolüne / müşteri istisnasına yalnızca "müşteriye verilebilir" (görme) yetkiler (`permissions.customer_grantable`)
- son aktif Süper Yönetici silinemez, kısıtlanamaz, rolü düşürülemez

**Test:** 27 veritabanı saldırı/izin denemesi (işlem geri alınarak), tarayıcıda sınırlı merkez hesabıyla sunucuya giden isteği değiştirme saldırısı, bağımsız güvenlik denetimi.

**Bağımsız güvenlik denetimi (11 Kasım) — bulgular ve durum:** kritik bulgu yok; kiracı (firma) ayrımı, müşterinin yazamaması, pasif proje / arşiv firma / kısıtlı hesap, depolama, anonim erişim ve XSS denetimleri temiz.
| Bulgu | Durum |
|---|---|
| Yüksek: müşteri hesapları personelin kişisel bilgilerini (adres, doğum tarihi, telefon…) doğrudan veritabanı isteğiyle okuyabiliyordu | `personnel_personal` görünümü + `personnel.personal.read` yetkisi (migration 000800); sütunların kapatılması `20261111000900` — yeni kod yayına girdikten SONRA uygulanır |
| Orta: firma değiştiren personeli ve yeni firmadaki izinlerini eski firma görmeye devam ediyordu | `app.can_access_personnel` personelin hâlâ o firmanın kadrosunda olmasını ister; izin kayıtları projesine göre süzülür |
| Orta: devriye PIN deneme sınırı etiket başınaydı | Sınır proje başına (5 hatalı / 10 dk) |
| Düşük: `.env.local` (eski Supabase projesinin genel anahtarı) ve demo parolası herkese açık depoda | Karar bekliyor: gerçek veri öncesi demo hesapları kapatılmalı / parolaları değiştirilmeli |
| Düşük: Supabase parola kuralları zayıf (en az 6 karakter, captcha yok) | Karar bekliyor |

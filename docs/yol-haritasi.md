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

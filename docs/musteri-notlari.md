# Müşteri el yazısı notları → uygulama durumu

Kaynak: iki sayfalık el yazısı not (2026-10-15). Aşağıda her madde ve nasıl karşılandığı yer alıyor.

## 1. sayfa
| Not | Durum |
|---|---|
| Merkez tüm personele farklı yetkilendirme yapılsın | ✅ Rol bir şablon; **kişiye özel izin ver / engelle** (Kullanıcılar → kişi sayfası → "Kişiye özel yetkiler"). Yalnızca süper yönetici değiştirir. |
| Yıllık izin: altta giriş, üstte liste | ✅ İzin Yönetimi sayfası: üstte kayıtlar, altta "İzin ekle" formu |
| Alt: kategori, personel adı, izin başlangıç, izin son, işe başlama, toplam süre (yazılıp kaydedilecek) | ✅ Form; süre ve işe başlama tarihi tarihlerden önerilir, elle değiştirilebilir |
| Üst: kaydedilenler tek satırda, kalan izin süresi | ✅ Her kayıt tek satır; "Kalan izin" = bakiye − kayıtlı yıllık izin günleri |
| Satır yanında evrak göster / yükleyebilsin | ✅ Satırda "Evrak göster" ve "Evrak yükle / Değiştir" |

## 2. sayfa
| Not | Durum |
|---|---|
| 1. Tek giriş; giriş yapınca hangi hizmeti alıyorsa o ekran | ✅ Tek "Giriş Yap" butonu (`/giris`). Menü ve ekranlar hesabın yetkisine göre açılır |
| 2. Yeni müşteri: kullanıcı türü gerekmez | ✅ Müşteri formunda tür seçimi yok; merkez personeli ayrı formda |
| 2. Hizmet alanına "Danışma ve Tesis Yönetimi" | ✅ Dördüncü hizmet alanı (mor) |
| 2. Biten proje pasife alınmalı | ✅ Bitiş tarihi geçen proje her gece (ve merkez girişinde) otomatik **Pasif** olur |
| 2. "Verso" | ❓ Okunamadı / netleşmedi — sorulacak |
| 3. Personel atamasında vardiya yok | ✅ Atama formundan ve tablodan kaldırıldı (Vardiya Planı modülü ayrı kalır) |
| 4. Firma düzenle; eklerken vergi dairesi, vergi no, adres, telefon zorunlu | ✅ Firma sayfası (düzenleme) + zorunlu alanlar (sunucuda da doğrulanır) |
| Yeni proje alanları Camel Case | ✅ Proje adı ve adres alanları her kelimenin ilk harfi büyük |
| Personel kartı düzenleme; işlem açıldıysa silme | ✅ Kart düzenlenir; atama / puantaj / izin / vardiya / belge kaydı olan personel **silinemez** (durum "Ayrıldı" yapılır) |
| Proje personeli durum filtresi | ✅ Aktif / Ayrılan / Tümü |
| Belgeler doğru belge türü altında | ✅ Belgeler tür başlıklarına göre gruplanır |
| Fatura girişi / ödeme girişi (çarpı ile iptal) | ✅ Giriş ekranları **kaldırıldı** |
| Aktif cari bakiye; muhasebe Excel cari ekstre yükler; son satır = güncel bakiye | ✅ Proje → Excel aktar → "Cari hesap ekstresi". Yeni ekstre eskisinin yerine geçer (eskisi arşivlenir). |

Not: "Faturalar" menüsü artık fatura **belgelerini** (PDF) listeler; bakiye Cari Hesap sayfasındadır.

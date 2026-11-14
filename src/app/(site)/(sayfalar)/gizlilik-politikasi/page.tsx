import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/site/parts";
import { CompanyRef } from "@/components/site/legal-bits";
import { Fact } from "@/components/site/parts";
import { COMPANY, KVKK, LEGAL_UPDATED_AT, mailHref } from "@/lib/site";
import { pageMetadata } from "@/lib/seo";
import { BRAND } from "@/lib/brand";

// TASLAK — avukat incelemesinden geçmedi. Ürünün bugünkü işleyişine göre yazıldı (12 Kasım 2026).

export const metadata: Metadata = pageMetadata({
  title: "Gizlilik Politikası",
  description: `${BRAND} web sitesi ve portalında hangi bilgilerin toplandığı, nasıl kullanıldığı, ne kadar saklandığı ve nasıl korunduğu.`,
  path: "/gizlilik-politikasi",
});

const retention: [string, string][] = [
  ["İletişim formu mesajları", "Gönderimden itibaren 12 ay; sonra otomatik olarak silinir."],
  ["İletişim formunda IP adresi özeti", "30 gün; yalnızca gönderim sınırı için tutulur, sonra silinir."],
  ["Portaldaki işlem geçmişi", "1 ay; sonra her gece otomatik olarak silinir."],
  ["QR devriye okutmaları ve turları", "1 ay; sonra her gece otomatik olarak silinir."],
  ["Oturum çerezi", "Çıkış yaptığınızda silinir; çıkış yapılmazsa tarayıcınızda en fazla 400 gün kalabilir."],
  ["Devriye cihaz anahtarı (çerez ve yerel depolama)", "12 saat."],
  ["Portal hesap bilgileri ve müşteri adına tutulan kayıtlar", "Hizmet sözleşmesi süresince; sözleşme sona erdiğinde müşterinin talimatı ve yasal saklama süreleri doğrultusunda silinir veya iade edilir."],
  ["Barındırma sağlayıcısının sunucu kayıtları", "Sağlayıcının belirlediği sınırlı süre boyunca."],
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Gizlilik Politikası"
      path="/gizlilik-politikasi"
      updated={LEGAL_UPDATED_AT}
      lead={`${BRAND} web sitesini ve portalını kullanırken hangi bilgilerinizin toplandığını, bunların nasıl kullanıldığını, ne kadar saklandığını ve nasıl korunduğunu sade bir dille anlatır.`}
    >
      <h2 id="kapsam">1. Kapsam</h2>
      <p>
        Bu politika, <CompanyRef /> tarafından işletilen {BRAND} web sitesi, iletişim formu, müşteri ve merkez portalı ile QR
        devriye sayfaları için geçerlidir. Kişisel verilerinizin işlenmesine ilişkin yasal aydınlatma{" "}
        <Link href="/kvkk-aydinlatma-metni">KVKK Aydınlatma Metni</Link>’nde, çerezler ise{" "}
        <Link href="/cerez-politikasi">Çerez Politikası</Link>’nda ayrıca açıklanmıştır.
      </p>

      <h2 id="toplanan">2. Hangi bilgileri topluyoruz?</h2>
      <h3>Web sitesini ziyaret ettiğinizde</h3>
      <p>
        Web sitemizde reklam, analiz veya ziyaretçi izleme aracı kullanılmaz; ziyaretçiler için çerez bırakılmaz. Siteyi
        barındıran hizmet sağlayıcının sunucuları, her web sitesinde olduğu gibi, güvenlik ve hata tespiti amacıyla IP adresi,
        istek zamanı, istenen sayfa ve tarayıcı bilgisi gibi teknik kayıtlar tutar. Yazı tipleri sitemizin kendi sunucusundan
        yüklenir; üçüncü taraf yazı tipi hizmetine istek gönderilmez.
      </p>
      <h3>İletişim formunu kullandığınızda</h3>
      <p>
        Adınız soyadınız, e-posta adresiniz, isteğe bağlı olarak firma adınız ve telefon numaranız, seçtiğiniz konu ve mesajınız
        kaydedilir. Formun otomatik ve toplu gönderimlerle kötüye kullanılmasını önlemek için IP adresiniz kaydedilmez; yalnızca
        gizli bir anahtarla alınmış, geri çevrilemeyen özeti 30 gün tutulur.
      </p>
      <h3>Portalı kullandığınızda</h3>
      <p>
        Portal hesapları Şirket tarafından açılır; kendi kendine kayıt yoktur. Hesabınız için adınız soyadınız, kullanıcı adınız,
        varsa telefonunuz, bağlı olduğunuz firma ve rolünüz tutulur. Giriş yaptığınızda oturumunuzu sürdürmek için zorunlu bir
        çerez kullanılır; son giriş zamanınız ve portalda yaptığınız değişiklikler (kim, neyi, ne zaman değiştirdi) güvenlik
        amacıyla kaydedilir. Portal içi mesajlarınız ilgili müşteri ve merkez kullanıcıları tarafından görülebilir.
      </p>
      <p>
        Portaldaki yardım asistanı Opsüyon AI’ı kullanırsanız, yazdığınız sorular ile adınız, hesap türünüz, rolünüz ve
        menünüzdeki ekran adları yanıt üretilmesi için yapay zekâ hizmet sağlayıcısına gönderilir. Asistan veritabanına erişmez
        ve sohbetler Şirket tarafından saklanmaz. Asistana kişisel veya gizli bilgi yazmamanızı rica ederiz.
      </p>
      <h3>QR devriye sistemini kullandığınızda</h3>
      <p>
        Devriye görevlisinin adı, okutulan nokta ve okutma saati kaydedilir. Tarayıcınız izin verirse okutma anındaki konum da
        kaydedilir; izin vermezseniz okutma konumsuz kaydedilir. Telefonunuzu başlattığınız tura bağlamak için rastgele bir
        anahtar telefonunuzda (çerez ve yerel depolama) 12 saat tutulur; veritabanında bu anahtarın yalnızca özeti bulunur.
      </p>
      <h3>Müşterilerimiz adına tutulan personel bilgileri</h3>
      <p>
        Portalda müşterilerimizin çalışanlarına ait özlük, puantaj, izin, bordro ve benzeri bilgiler, müşterilerimizle yaptığımız
        hizmet sözleşmesi kapsamında ve onların talimatıyla tutulur. Bu konudaki ayrıntılar KVKK Aydınlatma Metni’nin 8.
        bölümündedir.
      </p>

      <h2 id="kullanim">3. Bilgileri ne için kullanıyoruz?</h2>
      <ul>
        <li>İletişim taleplerinizi yanıtlamak, teklif ve demo süreçlerini yürütmek,</li>
        <li>Portal hizmetini sunmak, hesapları ve yetkileri yönetmek,</li>
        <li>Devriye, puantaj, izin, bordro ve benzeri operasyonel süreçleri yürütmek ve raporlamak,</li>
        <li>Hizmetin güvenliğini sağlamak, kötüye kullanımı ve yetkisiz erişimi önlemek,</li>
        <li>Yasal yükümlülüklerimizi yerine getirmek.</li>
      </ul>
      <p>Bilgileriniz reklam amacıyla kullanılmaz, satılmaz ve pazarlama amacıyla üçüncü kişilerle paylaşılmaz.</p>

      <h2 id="paylasim">4. Bilgileri kimlerle paylaşıyoruz?</h2>
      <p>
        Hizmeti sunabilmek için sunucu barındırma, veritabanı, kimlik doğrulama ve dosya depolama ile yalnızca yardım asistanı
        kullanıldığında yapay zekâ hizmet sağlayıcılarından yararlanırız. Web sitesi ve portal Türkiye’deki sunucularımızda
        çalışır; bazı hizmet sağlayıcılarımızın sunucuları yurt dışında bulunduğundan bu aktarımlar yurt dışına aktarım
        niteliğindedir ve KVKK’nın 9. maddesine uygun güvenceler sağlanarak yapılır. Bunların dışında bilgiler yalnızca
        yetkili müşteri hesaplarıyla (kendi kayıtlarıyla sınırlı olarak), yasal zorunluluk hâlinde yetkili kamu kurumlarıyla ve
        gerektiğinde hukuk ve mali danışmanlarımızla paylaşılır.
      </p>

      <h2 id="guvenlik">5. Bilgileri nasıl koruyoruz?</h2>
      <ul>
        <li>Site ile tarayıcınız arasındaki bütün bağlantılar şifrelidir (HTTPS).</li>
        <li>Parolalar açık metin olarak saklanmaz; kimlik doğrulama hizmetinde tek yönlü özet olarak tutulur.</li>
        <li>
          Erişim kuralları veritabanı düzeyinde uygulanır: her hesap yalnızca yetkili olduğu firma ve projelerin kayıtlarını
          görebilir. Personelin kişisel bilgileri (TC kimlik no, IBAN, adres, telefon, doğum tarihi) müşteri hesaplarına açılmaz.
        </li>
        <li>Rolleri ve merkez hesaplarını yalnızca en yetkili yönetici hesabı değiştirebilir; portaldaki değişiklikler kayıt altına alınır.</li>
        <li>İletişim formu mesajlarına yalnızca Şirket’in en yetkili yönetici hesabı erişebilir.</li>
        <li>İletişim formunda IP adresi, devriye sisteminde telefon anahtarı yalnızca geri çevrilemeyen özet olarak tutulur.</li>
      </ul>
      <p>
        Hiçbir sistem tamamen risksiz değildir. Bir güvenlik ihlali fark etmeniz veya hesabınızın başkası tarafından
        kullanıldığından şüphelenmeniz hâlinde lütfen hemen bizimle iletişime geçin.
      </p>

      <h2 id="saklama">6. Ne kadar saklıyoruz?</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th scope="col">Bilgi</th><th scope="col">Saklama süresi</th></tr>
          </thead>
          <tbody>
            {retention.map(([k, v]) => (
              <tr key={k}><td>{k}</td><td>{v}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 id="cocuklar">7. Çocuklar</h2>
      <p>
        {BRAND} işletmelere yönelik bir hizmettir ve 18 yaşından küçüklere yönelik değildir. İletişim formunun 18 yaşından küçükler
        tarafından kullanılmamasını rica ederiz.
      </p>

      <h2 id="haklar">8. Haklarınız</h2>
      <p>
        KVKK’nın 11. maddesindeki haklarınızı ve başvuru yollarını{" "}
        <Link href="/kvkk-aydinlatma-metni#haklar">KVKK Aydınlatma Metni</Link>’nde bulabilirsiniz. Başvurularınızı{" "}
        <Fact value={KVKK.email} href={mailHref(KVKK.email, "KVKK başvurusu")} /> adresine iletebilirsiniz.
      </p>

      <h2 id="degisiklikler">9. Değişiklikler</h2>
      <p>
        Bu politika, hizmetlerimizde veya mevzuatta değişiklik oldukça güncellenebilir. Güncel metin her zaman bu sayfada yer alır;
        sayfanın üstündeki “Son güncelleme” tarihi en son değişikliği gösterir.
      </p>

      <h2 id="iletisim">10. İletişim</h2>
      <p>
        Bu politikayla ilgili sorularınız için <Fact value={COMPANY.email} href={mailHref(COMPANY.email, "Gizlilik")} /> adresine
        yazabilir ya da <Link href="/iletisim">iletişim formunu</Link> kullanabilirsiniz.
      </p>
    </LegalPage>
  );
}

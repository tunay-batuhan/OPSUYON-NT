import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/site/parts";
import { CompanyRef } from "@/components/site/legal-bits";
import { Fact } from "@/components/site/parts";
import { COMPANY, JURISDICTION, LEGAL_UPDATED_AT, mailHref } from "@/lib/site";
import { pageMetadata } from "@/lib/seo";
import { BRAND } from "@/lib/brand";

// TASLAK — avukat incelemesinden geçmedi. Sorumluluk ve yetki hükümleri avukatla netleştirilmeli.

export const metadata: Metadata = pageMetadata({
  title: "Kullanım Koşulları",
  description: `${BRAND} web sitesi ve portalının kullanım koşulları: hesaplar, kullanım kuralları, fikri mülkiyet, sorumluluk ve uygulanacak hukuk.`,
  path: "/kullanim-kosullari",
});

export default function TermsPage() {
  return (
    <LegalPage
      title="Kullanım Koşulları"
      path="/kullanim-kosullari"
      updated={LEGAL_UPDATED_AT}
      lead={`${BRAND} web sitesini ve portalını kullanırken geçerli olan kuralları açıklar. Siteyi veya portalı kullanarak bu koşulları kabul etmiş olursunuz.`}
    >
      <h2 id="taraflar">1. Taraflar ve kapsam</h2>
      <p>
        {BRAND} web sitesi ve portalı (“Platform”) <CompanyRef /> tarafından işletilir. Bu koşullar; web sitesini ziyaret eden,
        iletişim formunu kullanan, portala giriş yapan ve QR devriye sayfalarını kullanan herkes (“Kullanıcı”) için geçerlidir.
        Şirket ile hizmet sözleşmesi bulunan müşteriler (“Müşteri”) bakımından, bu koşullarla hizmet sözleşmesi arasında
        farklılık olması hâlinde hizmet sözleşmesi hükümleri uygulanır.
      </p>

      <h2 id="hesaplar">2. Hesaplar</h2>
      <ul>
        <li>Portala kendi kendine kayıt olunamaz; hesaplar Şirket tarafından açılır ve kullanıcı adı ile parola Kullanıcı’ya iletilir.</li>
        <li>Hesaplar kişiseldir. Kullanıcı adınızı ve parolanızı başkasıyla paylaşmamak ve güvenli tutmak sizin sorumluluğunuzdadır.</li>
        <li>Hesabınızın yetkisiz kullanıldığından şüphelenirseniz derhâl Şirket’e bildirmeniz gerekir; parolanız Şirket tarafından sıfırlanır.</li>
        <li>
          Her hesap yalnızca kendisine tanımlanan rol ve yetkiler ölçüsünde, ilgili firma ve projelerin bilgilerini görebilir.
          Müşteri hesaplarına verilen yetkiler Müşteri’nin talebi doğrultusunda belirlenir.
        </li>
        <li>
          Şirket; bu koşullara veya hizmet sözleşmesine aykırılık, güvenlik riski, Müşteri’nin talebi ya da sözleşmenin sona ermesi
          hâllerinde hesapları kısıtlayabilir veya kapatabilir.
        </li>
      </ul>

      <h2 id="kurallar">3. Kullanım kuralları</h2>
      <p>Platformu kullanırken şunları yapmamayı kabul edersiniz:</p>
      <ul>
        <li>Yetkiniz olmayan hesaplara, verilere veya sistemlere erişmeye çalışmak, güvenlik önlemlerini aşmaya veya test etmeye çalışmak,</li>
        <li>Platformu aşırı yükleyecek otomatik istekler göndermek, yazılımı kopyalamak, tersine mühendislik uygulamak,</li>
        <li>Zararlı yazılım içeren, hukuka aykırı veya üçüncü kişilerin haklarını ihlal eden içerik yüklemek,</li>
        <li>Portalda gördüğünüz bilgileri yetkisiz kişilerle paylaşmak veya hizmet amacı dışında kullanmak,</li>
        <li>İletişim formunu toplu, otomatik veya yanıltıcı mesajlar göndermek için kullanmak.</li>
      </ul>

      <h2 id="veriler">4. Yüklenen bilgi ve belgeler</h2>
      <p>
        Portala yüklenen personel bilgileri ve belgeler, hizmet sözleşmesi kapsamında Müşteri adına işlenir. Platforma kişisel
        veri giren veya yükleyen taraf, bu verilerin hukuka uygun olarak elde edildiğinden ve gerekli aydınlatmanın yapıldığından
        sorumludur. Kişisel verilerin işlenmesine ilişkin ayrıntılar{" "}
        <Link href="/kvkk-aydinlatma-metni">KVKK Aydınlatma Metni</Link> ve <Link href="/gizlilik-politikasi">Gizlilik Politikası</Link>’ndadır.
      </p>

      <h2 id="devriye">5. QR devriye sayfaları</h2>
      <p>
        Devriye noktalarındaki QR etiketleri giriş gerektirmeyen sayfaları açar ve yalnızca görevlendirilmiş devriye personeli
        tarafından kullanılmalıdır. Proje PIN’i gizlidir; yetkisiz kişilerle paylaşılmamalıdır. Devriye kayıtlarının doğruluğu
        okutmayı yapan görevlinin sorumluluğundadır.
      </p>

      <h2 id="asistan">6. Yardım asistanı (Opsüyon AI)</h2>
      <p>
        Portaldaki yardım asistanı, portalın kullanımı hakkında yapay zekâ ile üretilmiş bilgilendirici yanıtlar verir. Yanıtlar
        hatalı veya eksik olabilir; hukuki, mali veya iş sağlığı ve güvenliği tavsiyesi değildir. Asistana kişisel veya gizli
        bilgi yazmayınız; sorularınız yanıt üretilmesi için yapay zekâ hizmet sağlayıcısına iletilir.
      </p>

      <h2 id="fikri-mulkiyet">7. Fikri mülkiyet</h2>
      <p>
        {BRAND} adı ve logosu, Platform’un yazılımı, tasarımı ve içerikleri Şirket’e veya lisans verenlerine aittir. Bunlar
        Şirket’in yazılı izni olmadan kopyalanamaz, çoğaltılamaz, dağıtılamaz veya başka bir hizmette kullanılamaz. Müşteri’nin
        yüklediği bilgi ve belgeler üzerindeki haklar Müşteri’de kalır.
      </p>

      <h2 id="sureklilik">8. Hizmetin sürekliliği ve değişiklikler</h2>
      <p>
        Şirket, Platform’un kesintisiz ve hatasız çalışması için makul özeni gösterir; ancak bakım, güncelleme, hizmet
        sağlayıcılardan kaynaklanan sorunlar veya mücbir sebepler nedeniyle kesintiler yaşanabilir. Platform’un özellikleri zaman
        içinde geliştirilebilir, değiştirilebilir veya kaldırılabilir. Müşteri’ye karşı taahhüt edilen hizmet düzeyi, hizmet
        sözleşmesinde belirlenir.
      </p>

      <h2 id="sorumluluk">9. Sorumluluk</h2>
      <p>
        Web sitesindeki tanıtım içerikleri genel bilgilendirme amaçlıdır ve teklif niteliği taşımaz. Şirket’in Müşteri’ye karşı
        sorumluluğu hizmet sözleşmesi hükümlerine tabidir. Kanunun emredici hükümleri ile kast ve ağır ihmal hâlleri saklı
        kalmak üzere Şirket; Kullanıcı’nın bu koşullara aykırı kullanımından, hesap bilgilerinin Kullanıcı tarafından üçüncü
        kişilerle paylaşılmasından ve üçüncü kişilere ait sitelerin içeriğinden sorumlu değildir.
      </p>

      <h2 id="baglantilar">10. Üçüncü taraf bağlantıları</h2>
      <p>
        Platform’da üçüncü kişilere ait sitelere bağlantılar bulunabilir. Bu sitelerin içeriği ve gizlilik uygulamaları
        üzerinde Şirket’in kontrolü yoktur.
      </p>

      <h2 id="degisiklik">11. Koşulların değiştirilmesi</h2>
      <p>
        Şirket bu koşulları gerektiğinde güncelleyebilir. Güncel metin her zaman bu sayfada yayımlanır ve sayfanın üstündeki
        “Son güncelleme” tarihi değişir.
      </p>

      <h2 id="hukuk">12. Uygulanacak hukuk ve yetkili yer</h2>
      <p>
        Bu koşullar Türkiye Cumhuriyeti hukukuna tabidir. Bu koşullardan doğan uyuşmazlıklarda <Fact value={JURISDICTION} />{" "}
        yetkilidir. Tüketici sıfatını taşıyan kişilerin kanundan doğan hakları saklıdır.
      </p>

      <h2 id="iletisim">13. İletişim</h2>
      <p>
        Bu koşullarla ilgili sorularınız için <Fact value={COMPANY.email} href={mailHref(COMPANY.email, "Kullanım koşulları")} />{" "}
        adresine yazabilir veya <Link href="/iletisim">iletişim formunu</Link> kullanabilirsiniz.
      </p>
    </LegalPage>
  );
}

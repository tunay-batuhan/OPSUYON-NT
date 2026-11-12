import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/site/parts";
import { ApplicationChannels, CompanyRef, ControllerIdentity } from "@/components/site/legal-bits";
import { LEGAL_UPDATED_AT } from "@/lib/site";
import { pageMetadata } from "@/lib/seo";
import { BRAND } from "@/lib/brand";

// TASLAK — avukat incelemesinden geçmedi. Ürünün bugünkü işleyişine göre yazıldı (12 Kasım 2026).
// Şirket bilgileri src/lib/site.ts'den gelir. Avukatla netleştirilecek noktalar docs/yol-haritasi.md §14'te.

export const metadata: Metadata = pageMetadata({
  title: "KVKK Aydınlatma Metni",
  description: `6698 sayılı KVKK kapsamında ${BRAND} web sitesi, iletişim formu, portal ve QR devriye sistemi aracılığıyla işlenen kişisel veriler hakkında aydınlatma metni.`,
  path: "/kvkk-aydinlatma-metni",
});

export default function KvkkPage() {
  return (
    <LegalPage
      title="KVKK Aydınlatma Metni"
      path="/kvkk-aydinlatma-metni"
      updated={LEGAL_UPDATED_AT}
      lead="6698 sayılı Kişisel Verilerin Korunması Kanunu’nun 10. maddesi ve Aydınlatma Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve Esaslar Hakkında Tebliğ uyarınca, kişisel verilerinizin kim tarafından, hangi amaçla ve nasıl işlendiğini açıklar."
    >
      <h2 id="veri-sorumlusu">1. Veri sorumlusu</h2>
      <p>
        Kişisel verileriniz, veri sorumlusu sıfatıyla <CompanyRef /> tarafından, {BRAND} web sitesi ve portalı aracılığıyla
        aşağıda açıklanan kapsamda işlenmektedir.
      </p>
      <ControllerIdentity />

      <h2 id="kapsam">2. Bu metin kimleri kapsar?</h2>
      <ul>
        <li>Web sitemizi ziyaret edenler,</li>
        <li>İletişim formu aracılığıyla bize ulaşanlar,</li>
        <li>{BRAND} portalının kullanıcıları (müşteri firma çalışanları ve Şirket çalışanları),</li>
        <li>QR devriye sistemini kullanan saha görevlileri,</li>
        <li>Müşterilerimiz adına portalda bilgileri yönetilen personel (bu grup için ayrıca 8. bölüme bakınız).</li>
      </ul>

      <h2 id="veriler">3. İşlenen kişisel veriler, amaçlar ve hukuki sebepler</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Kimden</th>
              <th scope="col">Hangi veriler</th>
              <th scope="col">Amaç</th>
              <th scope="col">Hukuki sebep (KVKK m.5/2)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>İletişim formunu kullananlar</td>
              <td>
                Kimlik (ad soyad), iletişim (e-posta, isteğe bağlı telefon), firma adı (isteğe bağlı), talep konusu ve mesaj
                içeriği; işlem güvenliği (gönderim zamanı, IP adresinin gizli anahtarla alınmış ve geri çevrilemeyen özeti).
              </td>
              <td>Talebinizi değerlendirmek ve yanıtlamak, teklif ve demo süreçlerini yürütmek, formun kötüye kullanılmasını (otomatik ve toplu gönderim) önlemek.</td>
              <td>(c) bir sözleşmenin kurulmasıyla doğrudan ilgili olması (teklif ve demo talepleri); (f) meşru menfaat (taleplere yanıt verme, güvenlik).</td>
            </tr>
            <tr>
              <td>Web sitesi ziyaretçileri</td>
              <td>İşlem güvenliği: IP adresi, tarih-saat, istenen sayfa ve tarayıcı bilgisi (barındırma hizmeti sağlayıcısının sunucu kayıtlarında).</td>
              <td>Sitenin güvenli ve kesintisiz çalışması, hataların ve kötüye kullanımın tespiti.</td>
              <td>(f) meşru menfaat.</td>
            </tr>
            <tr>
              <td>Portal kullanıcıları</td>
              <td>
                Kimlik (ad soyad), iletişim (telefon), kullanıcı adı, bağlı olunan firma, rol ve yetkiler; işlem güvenliği (oturum
                bilgisi, son giriş zamanı, portalda yapılan değişikliklerin kaydı); portal içi mesajlar; yardım asistanını
                (Opsüyon AI) kullanırsanız yazdığınız sorular.
              </td>
              <td>Hesabın açılması ve yönetimi, hizmet sözleşmesinin yürütülmesi, yetkilendirme, işlem güvenliğinin sağlanması, destek verilmesi.</td>
              <td>(c) sözleşmenin ifası; (ç) hukuki yükümlülük; (f) meşru menfaat (işlem güvenliği ve kayıt).</td>
            </tr>
            <tr>
              <td>QR devriye görevlileri</td>
              <td>
                Ad soyad, okutulan nokta ve saati, tur başlangıç / bitiş zamanı, izin verirseniz konum bilgisi, telefonu tura
                bağlayan rastgele anahtar (veritabanında yalnızca özeti tutulur).
              </td>
              <td>Devriye hizmetinin yürütülmesi, raporlanması ve hizmetin yerine getirildiğinin gösterilmesi.</td>
              <td>(c) sözleşmenin ifası; (f) meşru menfaat.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Konum bilgisi yalnızca tarayıcınızın konum izni verildiğinde ve okutma anında alınır; izin vermezseniz okutma konumsuz
        kaydedilir. Web sitemizde reklam, analiz ya da kullanıcı izleme amaçlı çerez veya araç kullanılmaz (bkz.{" "}
        <Link href="/cerez-politikasi">Çerez Politikası</Link>).
      </p>

      <h2 id="toplama">4. Kişisel verilerin toplanma yöntemi</h2>
      <p>
        Kişisel verileriniz; web sitesindeki iletişim formu, portal ekranları ve QR devriye sayfası aracılığıyla sizin
        tarafınızdan, portalı kullanan müşterilerimiz ve Şirket çalışanları tarafından girilerek, tarayıcınızın gönderdiği
        teknik bilgiler ve zorunlu çerezler ile barındırma hizmeti sağlayıcısının otomatik sunucu kayıtları yoluyla, elektronik
        ortamda otomatik ve kısmen otomatik yöntemlerle toplanır.
      </p>

      <h2 id="aktarim">5. Kişisel verilerin aktarılması</h2>
      <p>Kişisel verileriniz, yukarıdaki amaçlarla sınırlı olmak üzere şu alıcı gruplarına aktarılabilir:</p>
      <ul>
        <li>
          <strong>Hizmet sağlayıcılarımız (veri işleyenler):</strong> barındırma hizmeti (Vercel Inc., sunucular İrlanda / AB),
          veritabanı, kimlik doğrulama ve dosya depolama hizmeti (Supabase Inc., sunucular İrlanda / AB) ve yalnızca yardım
          asistanını kullandığınızda, yazdığınız sorular ile adınız ve rolünüzle sınırlı olmak üzere yapay zekâ hizmet sağlayıcısı
          (Anthropic PBC, ABD).
        </li>
        <li>
          <strong>Müşterilerimiz:</strong> portal kullanıcısı ve personel bilgileri, yalnızca ilgili müşteri firmanın yetkili
          hesaplarına ve yetkileri ölçüsünde.
        </li>
        <li>
          <strong>Yetkili kamu kurum ve kuruluşları ile yargı mercileri:</strong> hukuki yükümlülüklerimiz kapsamında ve talep
          edilmesi hâlinde.
        </li>
        <li>
          <strong>Hukuk ve mali müşavirlik danışmanlarımız:</strong> bir hakkın tesisi, kullanılması veya korunması için gerekli
          olduğunda.
        </li>
      </ul>
      <p>
        Hizmet sağlayıcılarımızın sunucuları yurt dışında bulunduğundan, bu sağlayıcılara yapılan aktarımlar yurt dışına
        aktarım niteliğindedir ve KVKK’nın 9. maddesinde öngörülen uygun güvencelerden biri (örneğin Kişisel Verileri Koruma
        Kurulu tarafından ilan edilen standart sözleşmenin imzalanması ve Kurul’a bildirilmesi) sağlanarak gerçekleştirilir.
      </p>

      <h2 id="saklama">6. Saklama süreleri</h2>
      <p>
        Kişisel verileriniz işlenme amacının gerektirdiği süre ve ilgili mevzuattaki saklama süreleri boyunca saklanır, süre
        sonunda silinir, yok edilir veya anonim hâle getirilir. Başlıca süreler:
      </p>
      <ul>
        <li>İletişim formu mesajları: gönderimden itibaren 12 ay (sonra otomatik silinir).</li>
        <li>İletişim formunda IP adresi özeti: 30 gün (yalnızca gönderim sınırı için).</li>
        <li>Portaldaki işlem geçmişi (kim, neyi, ne zaman değiştirdi): 1 ay.</li>
        <li>QR devriye okutmaları ve turları: 1 ay.</li>
        <li>
          Portal hesap bilgileri ve müşterilerimiz adına tutulan kayıtlar: hizmet sözleşmesi süresince; sözleşme sona erdiğinde
          müşterinin talimatı ve yasal saklama süreleri doğrultusunda silinir veya iade edilir.
        </li>
      </ul>
      <p>
        Ayrıntılar için <Link href="/gizlilik-politikasi">Gizlilik Politikası</Link>’na bakabilirsiniz.
      </p>

      <h2 id="haklar">7. KVKK’nın 11. maddesi kapsamındaki haklarınız</h2>
      <p>Şirket’e başvurarak;</p>
      <ol className="letters">
        <li><strong>a)</strong> kişisel verilerinizin işlenip işlenmediğini öğrenme,</li>
        <li><strong>b)</strong> kişisel verileriniz işlenmişse buna ilişkin bilgi talep etme,</li>
        <li><strong>c)</strong> kişisel verilerinizin işlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme,</li>
        <li><strong>ç)</strong> yurt içinde veya yurt dışında kişisel verilerinizin aktarıldığı üçüncü kişileri bilme,</li>
        <li><strong>d)</strong> kişisel verilerinizin eksik veya yanlış işlenmiş olması hâlinde bunların düzeltilmesini isteme,</li>
        <li><strong>e)</strong> KVKK’nın 7. maddesinde öngörülen şartlar çerçevesinde kişisel verilerinizin silinmesini veya yok edilmesini isteme,</li>
        <li><strong>f)</strong> düzeltme, silme ve yok etme işlemlerinin, kişisel verilerin aktarıldığı üçüncü kişilere bildirilmesini isteme,</li>
        <li><strong>g)</strong> işlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme,</li>
        <li><strong>ğ)</strong> kişisel verilerinizin kanuna aykırı olarak işlenmesi sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme</li>
      </ol>
      <p>haklarına sahipsiniz.</p>

      <h2 id="personel">8. Müşterilerimiz adına işlenen personel verileri</h2>
      <p>
        Portalda, müşterilerimizin (işveren firmaların) çalışanlarına ait özlük evrakı, puantaj, izin, bordro, eğitim, denetim,
        savunma ve ihtar, kıyafet ve ekipman gibi bilgiler, müşterilerimizle yaptığımız hizmet sözleşmesi kapsamında ve onların
        talimatıyla işlenir. Bu verilerin veri sorumlusu kural olarak ilgili işveren firmadır; Şirket bu verileri veri işleyen
        sıfatıyla işler. Bu kapsamdaki çalışanlar haklarını öncelikle işverenlerine iletebilir; Şirket’e ulaşan başvurular
        gecikmeksizin ilgili işverene iletilir ve başvurunun yanıtlanmasına destek olunur.
      </p>
      <p>
        Personelin TC kimlik numarası, IBAN, adres, telefon ve doğum tarihi gibi kişisel bilgileri müşteri hesaplarına açılmaz;
        Şirket içinde de yalnızca bu bilgileri görme yetkisi verilen hesaplar tarafından görülebilir.
      </p>

      <h2 id="basvuru">9. Başvuru yöntemi</h2>
      <p>
        Haklarınıza ilişkin taleplerinizi, Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ’e uygun olarak aşağıdaki
        yollardan biriyle iletebilirsiniz:
      </p>
      <ApplicationChannels />
      <p>
        Başvurunuzda adınız soyadınız, yazılı başvuruda imzanız, Türkiye Cumhuriyeti vatandaşları için TC kimlik numaranız
        (yabancılar için uyruğunuz ve pasaport ya da kimlik numaranız), tebligata esas yerleşim yeri veya iş yeri adresiniz,
        varsa bildirime esas e-posta adresiniz ve telefon numaranız ile talebinizin konusu bulunmalıdır.
      </p>
      <p>
        Başvurunuz, talebin niteliğine göre en geç otuz gün içinde ücretsiz olarak sonuçlandırılır. İşlemin ayrıca bir maliyet
        gerektirmesi hâlinde Kişisel Verileri Koruma Kurulu’nca belirlenen tarifedeki ücret alınabilir. Başvurunuzun
        reddedilmesi, verilen cevabı yetersiz bulmanız veya süresinde cevap verilmemesi hâlinde; cevabı öğrendiğiniz tarihten
        itibaren otuz gün ve her hâlde başvuru tarihinden itibaren altmış gün içinde Kurul’a şikâyette bulunabilirsiniz.
      </p>
    </LegalPage>
  );
}

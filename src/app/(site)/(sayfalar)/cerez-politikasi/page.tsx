import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/site/parts";
import { CompanyRef } from "@/components/site/legal-bits";
import { LEGAL_UPDATED_AT } from "@/lib/site";
import { pageMetadata } from "@/lib/seo";
import { BRAND } from "@/lib/brand";

// TASLAK — avukat incelemesinden geçmedi. Liste koddaki gerçek kullanıma göre çıkarıldı (12 Kasım 2026):
// Supabase oturum çerezi (@supabase/ssr), opsuyon_devriye (src/app/actions/patrol-tour.ts),
// localStorage opsuyon:devriye:anahtar ve opsuyon:devriye:son (src/components/patrol-scan.tsx).
// Yeni bir çerez / depolama anahtarı eklenirse bu tablo güncellenmeli.

export const metadata: Metadata = pageMetadata({
  title: "Çerez Politikası",
  description: `${BRAND} web sitesi ve portalında kullanılan çerezler ve yerel depolama: yalnızca oturum ve devriye için zorunlu olanlar; reklam ve analiz çerezi yok.`,
  path: "/cerez-politikasi",
});

export default function CookiePage() {
  return (
    <LegalPage
      title="Çerez Politikası"
      path="/cerez-politikasi"
      updated={LEGAL_UPDATED_AT}
      lead="Hangi çerezleri ve tarayıcı depolama alanlarını neden kullandığımızı açıklar. Kısaca: yalnızca hizmetin çalışması için zorunlu olanları kullanıyoruz; reklam, analiz veya izleme çerezi kullanmıyoruz."
    >
      <h2 id="cerez-nedir">1. Çerez nedir?</h2>
      <p>
        Çerezler, ziyaret ettiğiniz web sitesinin tarayıcınıza kaydettiği küçük metin dosyalarıdır. Benzer amaçla tarayıcının
        “yerel depolama” (localStorage) alanı da kullanılabilir. Bu politika her ikisini de kapsar ve <CompanyRef /> tarafından
        işletilen {BRAND} web sitesi ile portalı için geçerlidir.
      </p>

      <h2 id="ozet">2. Kısaca</h2>
      <ul>
        <li>Tanıtım sayfalarımızı yalnızca gezen ziyaretçilerin tarayıcısına çerez bırakılmaz.</li>
        <li>Çerezler yalnızca portala giriş yaptığınızda ve QR devriye sayfasında tur başlattığınızda kullanılır.</li>
        <li>Reklam, analiz, sosyal medya veya üçüncü taraf izleme çerezi kullanılmaz; bu nedenle çerez onay penceresi gösterilmez.</li>
      </ul>

      <h2 id="liste">3. Kullandığımız çerezler</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Ad</th>
              <th scope="col">Amaç</th>
              <th scope="col">Tür</th>
              <th scope="col">Süre</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>sb-…-auth-token</code><br />(gerekirse <code>.0</code>, <code>.1</code> parçaları)</td>
              <td>Portala giriş yapan kullanıcının oturumunu sürdürmek; sayfalar arasında yeniden giriş istenmemesi. Yalnızca giriş yapıldığında oluşur.</td>
              <td>Birinci taraf, zorunlu</td>
              <td>Çıkış yapınca silinir; çıkış yapılmazsa en fazla 400 gün.</td>
            </tr>
            <tr>
              <td><code>opsuyon_devriye</code></td>
              <td>QR devriye sayfasında turu başlatan telefonu o tura bağlamak; sonraki noktalarda PIN sorulmaması. Yalnızca devriye sayfalarında oluşur.</td>
              <td>Birinci taraf, zorunlu</td>
              <td>12 saat</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="yerel-depolama">4. Yerel depolama (localStorage)</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Anahtar</th>
              <th scope="col">Amaç</th>
              <th scope="col">Tür</th>
              <th scope="col">Süre</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>opsuyon:devriye:anahtar</code></td>
              <td>Devriye tur anahtarının yedeği: bazı telefonların QR uygulaması çerezi taşımadığı için tur bu anahtarla bulunur.</td>
              <td>Zorunlu</td>
              <td>12 saat sonra geçersiz sayılır; tur bitince silinir.</td>
            </tr>
            <tr>
              <td><code>opsuyon:devriye:son</code></td>
              <td>Devriye sayfasında aynı telefondan en son seçilen görevliyi bir sonraki sefer önceden seçmek (yalnızca sistemdeki kayıt numarası tutulur, ad tutulmaz).</td>
              <td>İşlevsel</td>
              <td>Tarayıcı verileri silinene kadar.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="hukuki">5. Hukuki dayanak</h2>
      <p>
        Zorunlu çerezler, talep ettiğiniz hizmetin (portala giriş, devriye kaydı) sunulabilmesi için gereklidir ve KVKK’nın 5/2-c
        (sözleşmenin ifası) ve 5/2-f (meşru menfaat) bentlerine dayanır. Kişisel Verileri Koruma Kurumu’nun Çerez Uygulamaları
        Hakkında Rehberi’ne göre bu tür çerezler için açık rıza alınması gerekmez. İleride analiz veya pazarlama amaçlı bir
        çerez kullanılması gündeme gelirse, bu çerezler ancak açık rızanız alındıktan sonra etkinleştirilir ve bu politika
        güncellenir.
      </p>

      <h2 id="yonetim">6. Çerezleri nasıl yönetebilirsiniz?</h2>
      <p>
        Tarayıcınızın ayarlarından çerezleri ve site verilerini görüntüleyebilir, silebilir veya engelleyebilirsiniz. Zorunlu
        çerezleri engellerseniz portala giriş yapamaz, devriye sayfasında her noktada kimlik doğrulaması gerekebilir. Portaldan
        “Çıkış” yaptığınızda oturum çerezi silinir.
      </p>

      <h2 id="ilgili">7. İlgili metinler</h2>
      <p>
        Kişisel verilerinizin işlenmesi hakkında ayrıntılı bilgi için <Link href="/kvkk-aydinlatma-metni">KVKK Aydınlatma Metni</Link>’ni
        ve <Link href="/gizlilik-politikasi">Gizlilik Politikası</Link>’nı inceleyebilirsiniz.
      </p>
    </LegalPage>
  );
}

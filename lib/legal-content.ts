/**
 * Hukuki taslak metinler — Wexon.dev | Business OS
 * Son güncelleme: 13 Temmuz 2026
 *
 * LEGAL_ENTITY_PLACEHOLDER: şirket ünvanı kurulunca buraya eklenebilir.
 * Metinlerde şimdilik "Ltd." / "A.Ş." kullanılmaz.
 */
export const LEGAL_ENTITY_PLACEHOLDER = "";

export const LEGAL_BRAND = "Wexon.dev | Business OS";
export const LEGAL_CONTROLLER = "Mehmet Levlen";
export const LEGAL_CONTACT_EMAIL = "mlevn@wexon.dev";
export const LEGAL_SITE_URL = "https://www.wexon.dev";
export const LEGAL_LAST_UPDATED = "13 Temmuz 2026";

export type LegalBlock =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "contact"; lines: string[] }
  | { type: "subheading"; text: string };

export type LegalSection = {
  heading: string;
  blocks: LegalBlock[];
};

export type LegalDocument = {
  slug: "kvkk" | "gizlilik" | "kullanim-sartlari" | "cerez-politikasi";
  badge: string;
  title: string;
  description: string;
  /** Page <title> segment; root template appends "| Wexon.dev" */
  metaTitle: string;
  metaDescription: string;
  sections: LegalSection[];
  footerNote?: string;
};

export const LEGAL_DOCUMENTS = {
  kvkk: {
    slug: "kvkk",
    badge: "KVKK",
    title: "KVKK Aydınlatma Metni",
    description:
      "Wexon.dev | Business OS kapsamında kişisel verilerinizin nasıl işlendiğine ilişkin bilgilendirme.",
    metaTitle: "KVKK Aydınlatma Metni",
    metaDescription:
      "Wexon.dev | Business OS kapsamında kişisel verilerinizin 6698 sayılı KVKK uyarınca nasıl işlendiğine ilişkin aydınlatma metni.",
    footerNote:
      "Bu metin gerektiğinde güncellenebilir. Güncel metin her zaman bu sayfada yayımlanır.",
    sections: [
      {
        heading: "1. Veri Sorumlusu",
        blocks: [
          {
            type: "p",
            text: "Bu aydınlatma metni, Mehmet Levlen tarafından yürütülen Wexon.dev | Business OS markası kapsamında, 6698 sayılı Kişisel Verilerin Korunması Kanunu uyarınca kişisel verilerinizin işlenmesine ilişkin olarak hazırlanmıştır.",
          },
          {
            type: "p",
            text: "Veri sorumlusu iletişim:",
          },
          {
            type: "contact",
            lines: [
              `Marka: ${LEGAL_BRAND}`,
              `Yetkili: ${LEGAL_CONTROLLER}`,
              `E-posta: ${LEGAL_CONTACT_EMAIL}`,
              `Web sitesi: ${LEGAL_SITE_URL}`,
            ],
          },
        ],
      },
      {
        heading: "2. İşlenen Kişisel Veriler",
        blocks: [
          {
            type: "p",
            text: "Aşağıdaki veri kategorileri işlenebilir:",
          },
          {
            type: "ul",
            items: [
              "Kimlik bilgileri: ad, soyad",
              "İletişim bilgileri: e-posta, telefon",
              "İşletme bilgileri: işletme adı, sektör, web sitesi, talep edilen ürün/hizmet",
              "Hesap bilgileri: kullanıcı hesabı, oturum, organizasyon bilgileri",
              "İşlem güvenliği bilgileri: IP adresi, cihaz/tarayıcı bilgisi, log kayıtları",
              "Finans/ödeme bilgileri: abonelik planı, ödeme durumu, ödeme işlem referansı",
              "Talep ve destek bilgileri: demo talebi, iletişim mesajları, destek notları",
            ],
          },
          {
            type: "p",
            text: "Kart bilgileri Wexon tarafından saklanmaz. Kart ödeme süreci yetkili ödeme kuruluşu/sağlayıcı PayTR altyapısı üzerinden yürütülür.",
          },
        ],
      },
      {
        heading: "3. İşleme Amaçları",
        blocks: [
          {
            type: "p",
            text: "Kişisel veriler şu amaçlarla işlenebilir:",
          },
          {
            type: "ul",
            items: [
              "Demo ve iletişim taleplerini almak",
              "Wexon platformuna kullanıcı hesabı oluşturmak",
              "Abonelik, ödeme ve plan yönetimini yürütmek",
              "WexPay ve diğer Wexon ürünlerini sunmak",
              "Müşteri destek süreçlerini yürütmek",
              "Güvenlik, fraud önleme ve sistem loglarını tutmak",
              "Yasal yükümlülükleri yerine getirmek",
              "Hizmet kalitesini artırmak",
              "Kullanıcı deneyimini ve platform performansını analiz etmek",
            ],
          },
        ],
      },
      {
        heading: "4. Hukuki Sebepler",
        blocks: [
          {
            type: "p",
            text: "Veriler, KVKK kapsamında aşağıdaki hukuki sebeplere dayanılarak işlenebilir:",
          },
          {
            type: "ul",
            items: [
              "Bir sözleşmenin kurulması veya ifası için gerekli olması",
              "Hukuki yükümlülüklerin yerine getirilmesi",
              "Bir hakkın tesisi, kullanılması veya korunması",
              "Meşru menfaatler",
              "Açık rıza gereken hallerde kullanıcının açık rızası",
            ],
          },
        ],
      },
      {
        heading: "5. Verilerin Aktarılması",
        blocks: [
          {
            type: "p",
            text: "Kişisel veriler, hizmetin sunulması için gerekli olduğu ölçüde aşağıdaki taraflarla paylaşılabilir:",
          },
          {
            type: "ul",
            items: [
              "Barındırma ve altyapı sağlayıcıları (örneğin Vercel, Cloudflare)",
              "Veritabanı ve bulut servis sağlayıcıları (örneğin Supabase)",
              "Ödeme hizmeti sağlayıcıları, özellikle PayTR",
              "E-posta, bildirim ve destek servisleri",
              "Yetkili kamu kurumları, mahkemeler ve resmi merciler",
            ],
          },
        ],
      },
      {
        heading: "6. Saklama Süresi",
        blocks: [
          {
            type: "p",
            text: "Kişisel veriler, işleme amacının gerektirdiği süre boyunca ve ilgili mevzuatta öngörülen süreler kadar saklanır. Süre sonunda veriler silinir, yok edilir veya anonim hale getirilir.",
          },
        ],
      },
      {
        heading: "7. KVKK Kapsamındaki Haklarınız",
        blocks: [
          {
            type: "p",
            text: "İlgili kişiler:",
          },
          {
            type: "ul",
            items: [
              "Kişisel verilerinin işlenip işlenmediğini öğrenebilir",
              "İşlenmişse buna ilişkin bilgi talep edebilir",
              "İşleme amacını ve amaca uygun kullanılıp kullanılmadığını öğrenebilir",
              "Aktarıldığı üçüncü kişileri öğrenebilir",
              "Eksik veya yanlış işlenmişse düzeltilmesini isteyebilir",
              "Silinmesini veya yok edilmesini talep edebilir",
              "İşlemeye itiraz edebilir",
              "Zarara uğraması halinde giderim talep edebilir",
            ],
          },
        ],
      },
      {
        heading: "8. Başvuru",
        blocks: [
          {
            type: "p",
            text: "KVKK kapsamındaki talepler için:",
          },
          {
            type: "contact",
            lines: [LEGAL_CONTACT_EMAIL],
          },
        ],
      },
    ],
  } satisfies LegalDocument,

  gizlilik: {
    slug: "gizlilik",
    badge: "Gizlilik",
    title: "Gizlilik Politikası",
    description:
      "Wexon.dev hizmetlerini kullanırken verilerinizin gizliliğini nasıl koruduğumuzu açıklar.",
    metaTitle: "Gizlilik Politikası",
    metaDescription:
      "Wexon.dev | Business OS gizlilik politikası: toplanan veriler, kullanım amaçları, PayTR ödeme güvenliği ve iletişim.",
    footerNote:
      "Bu politika zaman zaman güncellenebilir. Güncel sürüm bu sayfada yayımlanır.",
    sections: [
      {
        heading: "1. Genel Bilgilendirme",
        blocks: [
          {
            type: "p",
            text: "Wexon.dev | Business OS, işletmelerin dijital operasyon, ödeme, abonelik ve müşteri yönetimi süreçlerini yönetmesine yardımcı olan bir yazılım platformudur. Bu politika, web sitesi ve platform kullanımında toplanan verilerin nasıl işlendiğini açıklar.",
          },
        ],
      },
      {
        heading: "2. Topladığımız Bilgiler",
        blocks: [
          {
            type: "ul",
            items: [
              "Ad soyad",
              "E-posta",
              "Telefon",
              "İşletme adı",
              "Web sitesi",
              "Demo/iletişim talepleri",
              "Abonelik planı",
              "Ödeme işlem durumu",
              "IP adresi, cihaz ve tarayıcı bilgileri",
              "Platform kullanım kayıtları",
            ],
          },
        ],
      },
      {
        heading: "3. Verileri Nasıl Kullanırız?",
        blocks: [
          {
            type: "ul",
            items: [
              "Hizmet sağlamak",
              "Hesap ve abonelik yönetimi yapmak",
              "Ödeme süreçlerini yürütmek",
              "Destek taleplerine cevap vermek",
              "Güvenliği sağlamak",
              "Hataları analiz etmek",
              "Yasal yükümlülükleri yerine getirmek",
              "Ürün geliştirme ve performans iyileştirme yapmak",
            ],
          },
        ],
      },
      {
        heading: "4. Ödeme Güvenliği",
        blocks: [
          {
            type: "p",
            text: "Kart bilgileri Wexon.dev tarafından saklanmaz. Ödeme işlemleri PayTR gibi yetkili ödeme altyapıları üzerinden yürütülür. Wexon.dev ödeme sonucuna ilişkin işlem referansı, abonelik durumu ve fatura/ödeme kayıtlarını tutabilir.",
          },
        ],
      },
      {
        heading: "5. Üçüncü Taraf Servisler",
        blocks: [
          {
            type: "p",
            text: "Platform aşağıdaki tür servislerle çalışabilir:",
          },
          {
            type: "ul",
            items: [
              "Hosting ve deployment sağlayıcıları",
              "Veritabanı sağlayıcıları",
              "Ödeme sağlayıcıları",
              "Güvenlik ve CDN servisleri",
              "E-posta/bildirim servisleri",
              "Analitik servisleri",
            ],
          },
        ],
      },
      {
        heading: "6. Veri Güvenliği",
        blocks: [
          {
            type: "p",
            text: "Verilerin korunması için makul teknik ve idari tedbirler alınır. Ancak internet üzerinden yapılan hiçbir aktarımın yüzde yüz güvenli olduğu garanti edilemez.",
          },
        ],
      },
      {
        heading: "7. Çocukların Gizliliği",
        blocks: [
          {
            type: "p",
            text: "Wexon.dev çocuklara yönelik bir hizmet değildir. 18 yaş altı kişilerden bilerek veri toplanmaz.",
          },
        ],
      },
      {
        heading: "8. Veri Saklama",
        blocks: [
          {
            type: "p",
            text: "Veriler, hizmetin sunulması, yasal yükümlülükler ve meşru iş amaçları için gerekli süre boyunca saklanır.",
          },
        ],
      },
      {
        heading: "9. Haklarınız ve İletişim",
        blocks: [
          {
            type: "p",
            text: "Gizlilik ve kişisel veri talepleri için:",
          },
          {
            type: "contact",
            lines: [LEGAL_CONTACT_EMAIL],
          },
        ],
      },
      {
        heading: "10. Güncellemeler",
        blocks: [
          {
            type: "p",
            text: "Bu politika zaman zaman güncellenebilir. Güncel sürüm bu sayfada yayımlanır.",
          },
        ],
      },
    ],
  } satisfies LegalDocument,

  kullanimSartlari: {
    slug: "kullanim-sartlari",
    badge: "Kullanım Şartları",
    title: "Kullanım Şartları",
    description: "Wexon.dev web sitesi ve platform hizmetlerinin kullanımına ilişkin şartlar.",
    metaTitle: "Kullanım Şartları",
    metaDescription:
      "Wexon.dev | Business OS kullanım şartları: hesap, abonelik, ödeme (PayTR), fikri mülkiyet ve sorumluluk sınırları.",
    footerNote:
      "Bu şartlar gerektiğinde güncellenebilir. Güncel metin her zaman bu sayfada yayımlanır.",
    sections: [
      {
        heading: "1. Taraflar",
        blocks: [
          {
            type: "p",
            text: "Bu kullanım şartları, Wexon.dev | Business OS markası altında sunulan web sitesi ve yazılım hizmetlerini kullanan kişiler ile Mehmet Levlen tarafından yürütülen Wexon.dev markası arasındaki şartları düzenler.",
          },
        ],
      },
      {
        heading: "2. Hizmetin Kapsamı",
        blocks: [
          {
            type: "p",
            text: "Wexon.dev; işletmeler için dijital yönetim, ödeme, abonelik, müşteri paneli, WexPay ve benzeri yazılım çözümleri sunar. Hizmet kapsamı zaman içinde değişebilir, geliştirilebilir veya sonlandırılabilir.",
          },
        ],
      },
      {
        heading: "3. Hesap Oluşturma ve Güvenlik",
        blocks: [
          {
            type: "p",
            text: "Kullanıcı, hesap bilgilerinin doğruluğundan ve güvenliğinden sorumludur. Hesabın yetkisiz kullanımından şüphelenilmesi halinde Wexon.dev bilgilendirilmelidir.",
          },
        ],
      },
      {
        heading: "4. Kullanıcı Yükümlülükleri",
        blocks: [
          {
            type: "p",
            text: "Kullanıcı:",
          },
          {
            type: "ul",
            items: [
              "Sistemi hukuka uygun kullanmalıdır",
              "Başkasına ait verilere yetkisiz erişmemelidir",
              "Hizmeti kötüye kullanmamalıdır",
              "Zararlı kod, spam veya saldırı amaçlı işlem yapmamalıdır",
              "Yanlış, yanıltıcı veya hukuka aykırı içerik girmemelidir",
            ],
          },
        ],
      },
      {
        heading: "5. Abonelik ve Ödeme",
        blocks: [
          {
            type: "p",
            text: "Wexon.dev hizmetleri ücretsiz, deneme, manuel onaylı veya ücretli abonelik modeliyle sunulabilir. Ücretli aboneliklerde fiyatlar, ödeme dönemi ve kapsam kullanıcıya gösterilir.",
          },
          {
            type: "p",
            text: "Ödemeler PayTR veya benzeri ödeme sağlayıcıları üzerinden alınabilir. Ödeme işlemlerinde kart bilgileri Wexon.dev tarafından saklanmaz.",
          },
        ],
      },
      {
        heading: "6. Hizmet Değişiklikleri",
        blocks: [
          {
            type: "p",
            text: "Wexon.dev; ürün özelliklerini, fiyatlandırmayı, paketleri ve hizmet kapsamını güncelleyebilir. Mevcut müşteriler için değişiklikler mümkün olduğunda önceden duyurulur.",
          },
        ],
      },
      {
        heading: "7. Fikri Mülkiyet",
        blocks: [
          {
            type: "p",
            text: "Wexon.dev’e ait yazılım, tasarım, marka, logo, metin, görsel, kod ve arayüz hakları Wexon.dev’e aittir. İzinsiz kopyalanamaz, çoğaltılamaz veya ticari amaçla kullanılamaz.",
          },
        ],
      },
      {
        heading: "8. Hizmetin Askıya Alınması",
        blocks: [
          {
            type: "p",
            text: "Hukuka aykırı kullanım, ödeme sorunları, güvenlik riski veya kullanım şartlarının ihlali halinde hesaplar geçici veya kalıcı olarak askıya alınabilir.",
          },
        ],
      },
      {
        heading: "9. Sorumluğun Sınırlandırılması",
        blocks: [
          {
            type: "p",
            text: "Wexon.dev, hizmeti makul özenle sunmayı amaçlar. Ancak hizmetin kesintisiz, hatasız veya her zaman erişilebilir olacağı garanti edilmez. Dolaylı zararlar, veri kaybı veya ticari kayıplardan doğabilecek sorumluluk yürürlükteki hukuk kapsamında sınırlıdır.",
          },
        ],
      },
      {
        heading: "10. Üçüncü Taraf Hizmetler",
        blocks: [
          {
            type: "p",
            text: "PayTR, barındırma, veritabanı, e-posta, CDN ve benzeri üçüncü taraf servisler kendi şartlarına tabidir. Bu servislerdeki kesinti veya değişikliklerden Wexon.dev doğrudan sorumlu olmayabilir.",
          },
        ],
      },
      {
        heading: "11. Uygulanacak Hukuk",
        blocks: [
          {
            type: "p",
            text: "Bu şartlar Türkiye Cumhuriyeti hukukuna tabidir. Uyuşmazlıklarda yetkili mahkeme ve merciler Türkiye’deki yetkili mercilerdir.",
          },
        ],
      },
      {
        heading: "12. İletişim",
        blocks: [
          {
            type: "p",
            text: "Kullanım şartlarına ilişkin sorular için:",
          },
          {
            type: "contact",
            lines: [LEGAL_CONTACT_EMAIL],
          },
        ],
      },
    ],
  } satisfies LegalDocument,

  cerezPolitikasi: {
    slug: "cerez-politikasi",
    badge: "Çerez Politikası",
    title: "Çerez Politikası",
    description:
      "Wexon.dev web sitesinde kullanılan çerezler ve benzeri teknolojiler hakkında bilgilendirme.",
    metaTitle: "Çerez Politikası",
    metaDescription:
      "Wexon.dev çerez politikası: zorunlu, analitik ve pazarlama çerezleri ile tercih yönetimi.",
    footerNote:
      "Bu politika zaman zaman güncellenebilir. Güncel sürüm bu sayfada yayımlanır.",
    sections: [
      {
        heading: "1. Çerez Nedir?",
        blocks: [
          {
            type: "p",
            text: "Çerezler, bir web sitesini ziyaret ettiğinizde tarayıcınıza veya cihazınıza kaydedilen küçük metin dosyalarıdır. Çerezler sitenin çalışmasını sağlamak, tercihleri hatırlamak, güvenliği artırmak ve kullanım deneyimini iyileştirmek için kullanılabilir.",
          },
        ],
      },
      {
        heading: "2. Kullandığımız Çerez Türleri",
        blocks: [
          {
            type: "subheading",
            text: "A. Zorunlu Çerezler",
          },
          {
            type: "p",
            text: "Sitenin ve platformun güvenli şekilde çalışması için gereklidir.",
          },
          {
            type: "p",
            text: "Örnek:",
          },
          {
            type: "ul",
            items: [
              "Oturum çerezleri",
              "Güvenlik çerezleri",
              "CSRF koruması",
              "Dil/tema tercihi",
              "Giriş durumu",
            ],
          },
          {
            type: "subheading",
            text: "B. Performans ve Analitik Çerezleri",
          },
          {
            type: "p",
            text: "Site performansını ve kullanımını anlamak için kullanılabilir.",
          },
          {
            type: "p",
            text: "Örnek:",
          },
          {
            type: "ul",
            items: [
              "Sayfa görüntüleme",
              "Ziyaretçi davranışı",
              "Hata ve performans analizi",
            ],
          },
          {
            type: "subheading",
            text: "C. Pazarlama Çerezleri",
          },
          {
            type: "p",
            text: "Reklam, kampanya ve hedefleme için kullanılabilir. Bu çerezler yalnızca gerekli izinler alındığında kullanılmalıdır.",
          },
        ],
      },
      {
        heading: "3. Üçüncü Taraf Çerezleri",
        blocks: [
          {
            type: "p",
            text: "Wexon.dev; analitik, güvenlik, ödeme ve altyapı sağlayıcıları nedeniyle üçüncü taraf çerezleri veya benzeri teknolojiler kullanabilir.",
          },
        ],
      },
      {
        heading: "4. Çerezleri Nasıl Yönetebilirsiniz?",
        blocks: [
          {
            type: "p",
            text: "Tarayıcı ayarlarınızdan çerezleri silebilir veya engelleyebilirsiniz. Ancak zorunlu çerezlerin kapatılması sitenin bazı özelliklerinin çalışmamasına neden olabilir.",
          },
        ],
      },
      {
        heading: "5. Çerez Tercihleri",
        blocks: [
          {
            type: "p",
            text: "Wexon.dev çerez tercih paneli üzerinden:",
          },
          {
            type: "ul",
            items: [
              "Zorunlu çerezler her zaman aktiftir",
              "Analitik çerezleri yalnızca kullanıcı onayıyla aktif edilir",
              "Pazarlama çerezleri yalnızca kullanıcı onayıyla aktif edilir",
              "“Tümünü Kabul Et”, “Tümünü Reddet” ve “Tercihlerimi Yönet” seçenekleri sunulur",
              "Tercihleriniz tarayıcınızda (localStorage) saklanır",
              "Analytics/marketing betikleri rıza olmadan yüklenmez",
            ],
          },
        ],
      },
      {
        heading: "6. Güncellemeler",
        blocks: [
          {
            type: "p",
            text: "Bu politika zaman zaman güncellenebilir. Güncel sürüm bu sayfada yayımlanır.",
          },
          {
            type: "p",
            text: "İletişim:",
          },
          {
            type: "contact",
            lines: [LEGAL_CONTACT_EMAIL],
          },
        ],
      },
    ],
  } satisfies LegalDocument,
} as const;

export type LegalDocumentKey = keyof typeof LEGAL_DOCUMENTS;

export function getLegalDocument(key: LegalDocumentKey): LegalDocument {
  return LEGAL_DOCUMENTS[key];
}

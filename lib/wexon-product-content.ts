import type { RoadmapProductContent } from "@/types/wexon";

export const WEXHOTEL_CONTENT: RoadmapProductContent = {
  id: "wexhotel",
  name: "WexHotel",
  accent: "indigo",
  statusLabel: "Roadmap",
  heroBadge: "Roadmap · Yakında",
  heroTitle: "Otel ve konaklama işletmeleri için oda, rezervasyon ve operasyon yönetimi",
  heroDescription:
    "WexHotel; oda durumu, rezervasyon takvimi, misafir kayıtları, ödeme ve personel süreçlerini tek operasyon paneline bağlamayı hedefleyen Wexon ürünüdür. WexPay pilotu tamamlandıktan sonra ikinci ürün olarak planlanıyor.",
  ecosystemNote: "WexHotel de Wexon Core'a bağlı çalışacak; lisans, abonelik ve erişim kararları merkezi olarak yönetilecek.",
  roadmapNote: "WexPay pilotu sonrası ikinci ürün olarak planlanıyor.",
  capabilities: [
    {
      icon: "table",
      title: "Oda yönetimi",
      description: "Oda durumu (müsait, dolu, temizlik, rezerve) tek grid üzerinden anlık takip edilir.",
    },
    {
      icon: "subscription",
      title: "Rezervasyon takvimi",
      description: "Check-in / check-out tarihleri, oda tipi ve misafir bilgisi tek takvimde planlanır.",
    },
    {
      icon: "users",
      title: "Misafir kayıtları",
      description: "Misafir geçmişi, iletişim bilgisi ve konaklama notları merkezi olarak saklanır.",
    },
    {
      icon: "billing",
      title: "Ödeme ve fatura takibi",
      description: "Kapora, tam ödeme ve gecikmiş tahsilat durumları ayrı ayrı izlenir.",
    },
    {
      icon: "team",
      title: "Personel rolleri",
      description: "Resepsiyon, temizlik ve yönetim ekipleri için ayrı yetki seviyeleri tanımlanır.",
    },
    {
      icon: "audit",
      title: "Raporlama",
      description: "Doluluk, gelir ve operasyon metrikleri gün/hafta/ay bazında raporlanır.",
    },
  ],
  faq: [
    {
      question: "WexHotel ne zaman aktif olacak?",
      answer:
        "WexHotel şu an roadmap aşamasında. WexPay pilotunun tamamlanmasının ardından geliştirme ve pilot süreci başlayacak; kesin tarih için demo talep ederek güncel durumu öğrenebilirsiniz.",
    },
    {
      question: "Şu an ön kayıt yapabilir miyim?",
      answer:
        "Evet. Demo talep formunu doldurarak WexHotel için ilginizi iletebilir, lansman sürecinde öncelikli bilgilendirilebilirsiniz.",
    },
    {
      question: "Fiyatlandırma nasıl belirlenecek?",
      answer:
        "WexHotel için güncel bir fiyat listesi henüz yayınlanmadı. Fiyatlandırma; WexPay'de olduğu gibi lisans modeli ve işletme ölçeğine göre Wexon Core üzerinden şekillenecek ve lansmanda paylaşılacak.",
    },
    {
      question: "WexHotel de Wexon Core'a mı bağlı olacak?",
      answer:
        "Evet. WexPay ve WexB2B gibi WexHotel de organization, lisans, abonelik ve entitlement yönetimini Wexon Core üzerinden alacak; erişim kararları ödeme durumundan ayrı hesaplanacak.",
    },
  ],
};

export const WEXB2B_CONTENT: RoadmapProductContent = {
  id: "wexb2b",
  name: "WexB2B",
  accent: "amber",
  statusLabel: "Roadmap",
  heroBadge: "Roadmap · Yakında",
  heroTitle: "Bayi ve toptan satış işletmeleri için sipariş ve cari yönetimi",
  heroDescription:
    "WexB2B; ürün kataloğu, bayi bazlı fiyatlandırma, teklif, sipariş ve cari takibini tek panelde birleştirmeyi hedefleyen Wexon ürünüdür. WexPay ve WexHotel'den sonra üçüncü ürün olarak planlanıyor.",
  ecosystemNote: "WexB2B de Wexon Core'a bağlı çalışacak; lisans, abonelik ve erişim kararları merkezi olarak yönetilecek.",
  roadmapNote: "WexPay ve WexHotel'den sonra üçüncü ürün olarak planlanıyor.",
  capabilities: [
    {
      icon: "catalog",
      title: "Ürün kataloğu",
      description: "Stok, bayi fiyatı ve ürün durumu tek katalog tablosunda yönetilir.",
    },
    {
      icon: "invoice",
      title: "Teklif yönetimi",
      description: "Bayilere özel teklifler oluşturulur, onaylanır ve sipariş sürecine bağlanır.",
    },
    {
      icon: "order",
      title: "Bayi siparişleri",
      description: "Sipariş durumu (onaylandı, sevk edildi, tamamlandı) tek listede izlenir.",
    },
    {
      icon: "billing",
      title: "Bayi cari hesapları",
      description: "Bayi bazlı ödeme durumu ve açık bakiye ayrı ayrı takip edilir.",
    },
    {
      icon: "track",
      title: "Sipariş takibi",
      description: "Teklif → sipariş → sevkiyat → ödeme akışı uçtan uca izlenebilir.",
    },
    {
      icon: "audit",
      title: "Raporlama",
      description: "Aylık sipariş, bayi cirosu ve açık bakiye metrikleri raporlanır.",
    },
  ],
  faq: [
    {
      question: "WexB2B ne zaman aktif olacak?",
      answer:
        "WexB2B şu an roadmap aşamasında. WexPay ve WexHotel'in tamamlanmasının ardından geliştirme sürecine alınacak; kesin tarih için demo talep ederek güncel durumu öğrenebilirsiniz.",
    },
    {
      question: "Şu an ön kayıt yapabilir miyim?",
      answer:
        "Evet. Demo talep formunu doldurarak WexB2B için ilginizi iletebilir, lansman sürecinde öncelikli bilgilendirilebilirsiniz.",
    },
    {
      question: "Fiyatlandırma nasıl belirlenecek?",
      answer:
        "WexB2B için güncel bir fiyat listesi henüz yayınlanmadı. Fiyatlandırma; işletme ölçeği ve bayi sayısına göre Wexon Core üzerinden şekillenecek ve lansmanda paylaşılacak.",
    },
    {
      question: "WexB2B de Wexon Core'a mı bağlı olacak?",
      answer:
        "Evet. WexPay ve WexHotel gibi WexB2B de organization, lisans, abonelik ve entitlement yönetimini Wexon Core üzerinden alacak; erişim kararları ödeme durumundan ayrı hesaplanacak.",
    },
  ],
};

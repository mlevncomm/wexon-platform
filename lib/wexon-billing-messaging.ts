import { formatCoreDate } from "@/lib/wexon-core-dashboard";

export type CustomerBillingNoticeTone = "info" | "warning" | "critical";

export type CustomerBillingNotice = {
  tone: CustomerBillingNoticeTone;
  title: string;
  body: string;
};

type SubscriptionLike = {
  status: string;
  cancelAt: Date | null;
  currentPeriodEnd: Date | null;
} | null;

type LicenseLike = {
  endsAt: Date | null;
  status: string;
} | null;

const RENEWAL_SOON_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Customer-facing lifecycle copy for non-recurring PayTR.
 * No self-serve cancel/renew actions — messaging only.
 */
export function buildCustomerBillingNotices(input: {
  subscription: SubscriptionLike;
  license: LicenseLike;
  paytrSubscriptionEnabled: boolean;
  now?: Date;
}): CustomerBillingNotice[] {
  const now = input.now ?? new Date();
  const notices: CustomerBillingNotice[] = [];
  const subscription = input.subscription;

  if (subscription?.status === "PAST_DUE") {
    notices.push({
      tone: "warning",
      title: "Ödeme gecikmesi (PAST_DUE)",
      body:
        "Aboneliğiniz gecikmiş görünüyor. Mevcut erişiminiz korunur; ancak yenileme için destek veya satış ekibiyle iletişime geçin. Otomatik tahsilat bu dönemde çalışmaz.",
    });
  }

  if (subscription?.status === "CANCELLED") {
    const cancelAt = subscription.cancelAt;
    if (cancelAt && cancelAt.getTime() > now.getTime()) {
      notices.push({
        tone: "warning",
        title: "İptal planlandı",
        body: `Aboneliğiniz ${formatCoreDate(cancelAt)} tarihinde sona erecek şekilde planlandı. Bu tarihe kadar erişiminiz devam eder. Yenilemek için paket satın alma veya destek ekibiyle iletişime geçin.`,
      });
    } else {
      notices.push({
        tone: "critical",
        title: "Abonelik iptal edildi",
        body: "WexPay aboneliğiniz iptal durumda. Yeniden açmak için paketleri inceleyin veya destek ekibiyle iletişime geçin.",
      });
    }
  }

  if (subscription?.status === "EXPIRED") {
    notices.push({
      tone: "critical",
      title: "Abonelik süresi doldu",
      body: "Abonelik dönemi sona erdi. Yenileme için paket satın alın veya destek ekibiyle iletişime geçin.",
    });
  }

  if (
    subscription &&
    (subscription.status === "ACTIVE" || subscription.status === "TRIALING") &&
    subscription.currentPeriodEnd &&
    subscription.currentPeriodEnd.getTime() <= now.getTime()
  ) {
    notices.push({
      tone: "warning",
      title: "Abonelik dönemi sona erdi",
      body: "Dönem bitiş tarihi geçti. Otomatik yenileme kapalı olduğu için erişim kesilebilir; yenilemek için tek seferlik satın alma veya destek gerekir.",
    });
  }

  if (
    subscription?.cancelAt &&
    subscription.cancelAt.getTime() > now.getTime() &&
    subscription.status !== "CANCELLED"
  ) {
    notices.push({
      tone: "info",
      title: "İptal tarihi planlandı",
      body: `Aboneliğiniz ${formatCoreDate(subscription.cancelAt)} tarihinde kapanacak. Bu tarihe kadar ürün erişiminiz devam eder.`,
    });
  }

  const renewalAnchor =
    subscription?.currentPeriodEnd ?? input.license?.endsAt ?? null;
  if (
    renewalAnchor &&
    renewalAnchor.getTime() > now.getTime() &&
    renewalAnchor.getTime() - now.getTime() <= RENEWAL_SOON_MS &&
    subscription?.status !== "CANCELLED" &&
    subscription?.status !== "EXPIRED"
  ) {
    notices.push({
      tone: "info",
      title: "Yenileme yaklaşıyor",
      body: `Dönem / lisans bitişi ${formatCoreDate(renewalAnchor)}. Otomatik yenileme yok; kesintisiz kullanım için dönem bitmeden önce paket satın alın veya destek ekibine yazın.`,
    });
  }

  if (!input.paytrSubscriptionEnabled) {
    notices.push({
      tone: "info",
      title: "Self-serve online ödeme durumu",
      body: "Online abonelik tahsilatı şu an kapalı veya henüz açılmamış olabilir. Satın alma açıksa Paketler sayfasından ilerleyin; değilse satış / destek ekibi lisans açılışını yönetir.",
    });
  } else if (subscription?.status === "CANCELLED" || subscription?.status === "EXPIRED") {
    notices.push({
      tone: "info",
      title: "Yenileme nasıl yapılır?",
      body: "Otomatik yenileme yoktur. Paketler sayfasından tek seferlik satın alma ile yeniden başlatabilir veya destek ekibinden yardım isteyebilirsiniz.",
    });
  }

  return notices;
}

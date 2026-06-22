import {
  deactivateProviderCredentialAction,
  testProviderCredentialAction,
  upsertProviderCredentialAction,
} from "@/lib/wexpay-actions";
import type { WexPayProviderCredentialSummary } from "@/lib/wexpay-provider-credentials";
import {
  ActiveBadge,
  DemoInput,
  DemoPrimaryButton,
  DemoSecondaryButton,
  DemoSelect,
  InfoRow,
  WexPayEmptyNotice,
} from "@/components/wexpay/WexPayBusinessUI";

const PROVIDER_OPTIONS = [
  { value: "paytr", label: "PayTR" },
  { value: "iyzico", label: "iyzico" },
  { value: "param", label: "Param" },
];

const MODE_OPTIONS = [
  { value: "TEST", label: "Test bağlantısı" },
  { value: "LIVE", label: "Canlı bağlantı" },
];

function formatConnectionMode(mode: string) {
  return mode === "LIVE" ? "Canlı bağlantı" : "Test bağlantısı";
}

function ModeBadge({ mode }: { mode: string }) {
  const live = mode === "LIVE";
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${
        live ? "bg-rose-100 text-rose-800" : "bg-sky-100 text-sky-800"
      }`}
    >
      {live ? "LIVE" : "TEST"}
    </span>
  );
}

type WexPayProviderCredentialsPanelProps = {
  credentials: WexPayProviderCredentialSummary[];
  canManage: boolean;
  encryptionAvailable: boolean;
  paytrApiEnabled: boolean;
  redirectTo: string;
};

export default function WexPayProviderCredentialsPanel({
  credentials,
  canManage,
  encryptionAvailable,
  paytrApiEnabled,
  redirectTo,
}: WexPayProviderCredentialsPanelProps) {
  return (
    <div className="grid min-w-0 gap-6">
      <p className="text-sm font-medium leading-relaxed text-slate-600">
        WexPay para tutmaz. Restoran kendi banka veya sanal POS anlaşmasını (PayTR, iyzico, Param) yapar; WexPay yalnızca
        API bağlantısı ve operasyon kaydı sağlar. Manuel tahsilat akışı sanal POS bağlantısı gerektirmez.
      </p>

      {!encryptionAvailable ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
          <p className="text-sm font-black text-amber-900">Sanal POS API bilgileri şifrelenemiyor</p>
          <p className="mt-2 text-sm font-medium leading-relaxed text-amber-800/90">
            Sanal POS bağlantısı kaydetmek için sunucuda{" "}
            <code className="font-mono text-xs">WEXPAY_CREDENTIAL_ENCRYPTION_KEY</code> (32 byte) tanımlı olmalıdır.
            Manuel tahsilat akışı bu anahtar olmadan çalışmaya devam eder; sanal POS entegrasyonu için gerekir.
          </p>
        </div>
      ) : null}

      {!paytrApiEnabled ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <p className="text-sm font-black text-slate-900">PayTR canlı token üretimi kapalı</p>
          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">
            Sunucuda <code className="font-mono text-xs">WEXPAY_PAYTR_ENABLE_API=true</code> olmadan operasyon ve QR
            checkout PayTR token üretmez. Bağlantı testi yine de yerel yapılandırmayı doğrular.
          </p>
        </div>
      ) : null}

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-black text-slate-950">Kayıtlı sanal POS bağlantıları</h3>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">
            {credentials.length} kayıt
          </span>
        </div>

        {credentials.length === 0 ? (
          <WexPayEmptyNotice>
            Kayıtlı PayTR, iyzico veya Param sanal POS bağlantısı yok. Manuel tahsilat akışı aktif; sanal POS
            bağlantısı zorunlu değildir.
          </WexPayEmptyNotice>
        ) : (
          <div className="grid min-w-0 gap-3">
            {credentials.map((credential) => (
              <div
                key={credential.id}
                className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-900/5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 grid gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-black text-slate-950">{credential.provider.toUpperCase()}</p>
                      <ModeBadge mode={credential.mode} />
                      <ActiveBadge active={credential.isActive} />
                      <span className="text-xs font-semibold text-slate-500">{formatConnectionMode(credential.mode)}</span>
                    </div>
                    <InfoRow label="Bağlantı adı" value={credential.displayName} />
                    <InfoRow label="Maskelenmiş API anahtarı" value={credential.maskedKey} />
                    <InfoRow label="Parmak izi" value={credential.keyFingerprint} />
                    <InfoRow
                      label="Güncellendi"
                      value={new Date(credential.updatedAt).toLocaleString("tr-TR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    />
                  </div>

                  {canManage && credential.isActive ? (
                    <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                      <form action={testProviderCredentialAction}>
                        <input type="hidden" name="credentialId" value={credential.id} />
                        <input type="hidden" name="redirectTo" value={redirectTo} />
                        <DemoSecondaryButton className="!w-auto px-4 py-2.5 text-xs">
                          Bağlantıyı test et
                        </DemoSecondaryButton>
                      </form>
                      <form action={deactivateProviderCredentialAction}>
                        <input type="hidden" name="credentialId" value={credential.id} />
                        <input type="hidden" name="redirectTo" value={redirectTo} />
                        <DemoSecondaryButton className="!w-auto px-4 py-2.5 text-xs">Bağlantıyı kapat</DemoSecondaryButton>
                      </form>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {canManage && encryptionAvailable ? (
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 sm:p-5">
          <h3 className="text-sm font-black text-slate-950">Sanal POS bağlantısı ekle / güncelle</h3>
          <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">
            Firmanızın kendi sanal POS API bilgilerini girin. Aynı ödeme sağlayıcı ve bağlantı modu için kayıt varsa
            güncellenir. Secret alanını boş bırakırsanız mevcut şifreli API bilgisi korunur. Bağlantı testi gerçek
            ödeme çekmez; yalnızca yerel yapılandırmayı doğrular.
          </p>

          <form action={upsertProviderCredentialAction} className="mt-4 grid min-w-0 gap-4 md:grid-cols-2">
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <DemoSelect label="Ödeme sağlayıcı" name="provider" required options={PROVIDER_OPTIONS} />
            <DemoSelect label="Bağlantı modu" name="mode" defaultValue="TEST" required options={MODE_OPTIONS} />
            <DemoInput
              label="Bağlantı adı"
              name="displayName"
              required
              placeholder="Örn. Kadıköy şubesi PayTR test"
              className="md:col-span-2"
            />
            <DemoInput label="Merchant ID" name="merchantId" required placeholder="Sanal POS mağaza / merchant ID" />
            <DemoInput label="API key (opsiyonel)" name="apiKey" placeholder="API bilgileri" />
            <DemoInput
              label="Secret key"
              name="secretKey"
              type="password"
              placeholder="Yeni bağlantıda zorunlu; güncellemede boş bırakılabilir"
              className="md:col-span-2"
            />
            <DemoInput
              label="Merchant salt (opsiyonel)"
              name="merchantSalt"
              type="password"
              placeholder="PayTR vb. için"
              className="md:col-span-2"
            />
            <div className="md:col-span-2">
              <DemoPrimaryButton>Sanal POS bağlantısını kaydet</DemoPrimaryButton>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

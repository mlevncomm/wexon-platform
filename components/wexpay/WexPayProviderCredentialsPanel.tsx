import {
  deactivateProviderCredentialAction,
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
  { value: "TEST", label: "TEST" },
  { value: "LIVE", label: "LIVE" },
];

type WexPayProviderCredentialsPanelProps = {
  credentials: WexPayProviderCredentialSummary[];
  canManage: boolean;
  encryptionAvailable: boolean;
  redirectTo: string;
};

export default function WexPayProviderCredentialsPanel({
  credentials,
  canManage,
  encryptionAvailable,
  redirectTo,
}: WexPayProviderCredentialsPanelProps) {
  return (
    <div className="grid min-w-0 gap-6">
      {!encryptionAvailable ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
          <p className="text-sm font-black text-amber-900">Credential encryption yapılandırılmadı</p>
          <p className="mt-2 text-sm font-medium leading-relaxed text-amber-800/90">
            PSP credential kaydetmek için sunucuda <code className="font-mono text-xs">WEXPAY_CREDENTIAL_ENCRYPTION_KEY</code>{" "}
            (32 byte) tanımlı olmalıdır. Manuel operasyonel ödeme akışı bu anahtar olmadan çalışmaya devam eder.
          </p>
        </div>
      ) : null}

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-black text-slate-950">Kayıtlı credential&apos;lar</h3>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">
            {credentials.length} kayıt
          </span>
        </div>

        {credentials.length === 0 ? (
          <WexPayEmptyNotice>
            Kayıtlı PayTR, iyzico veya Param credential bulunmuyor. Manuel operasyonel ödeme akışı aktif.
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
                      <p className="text-sm font-black text-slate-950">
                        {credential.provider.toUpperCase()} · {credential.mode}
                      </p>
                      <ActiveBadge active={credential.isActive} />
                    </div>
                    <InfoRow label="Görünen ad" value={credential.displayName} />
                    <InfoRow label="Masked key" value={credential.maskedKey} />
                    <InfoRow label="Fingerprint" value={credential.keyFingerprint} />
                    <InfoRow
                      label="Güncellendi"
                      value={new Date(credential.updatedAt).toLocaleString("tr-TR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    />
                  </div>

                  {canManage && credential.isActive ? (
                    <form action={deactivateProviderCredentialAction} className="shrink-0">
                      <input type="hidden" name="credentialId" value={credential.id} />
                      <input type="hidden" name="redirectTo" value={redirectTo} />
                      <DemoSecondaryButton className="!w-auto px-4 py-2.5 text-xs">Devre dışı bırak</DemoSecondaryButton>
                    </form>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {canManage && encryptionAvailable ? (
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 sm:p-5">
          <h3 className="text-sm font-black text-slate-950">Credential ekle / güncelle</h3>
          <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">
            Aynı sağlayıcı ve mod için kayıt varsa güncellenir. Secret alanını boş bırakırsanız mevcut secret korunur.
            Gerçek PSP adapter entegrasyonu Phase 7&apos;de aktif olacaktır.
          </p>

          <form action={upsertProviderCredentialAction} className="mt-4 grid min-w-0 gap-4 md:grid-cols-2">
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <DemoSelect label="Sağlayıcı" name="provider" required options={PROVIDER_OPTIONS} />
            <DemoSelect label="Mod" name="mode" defaultValue="TEST" required options={MODE_OPTIONS} />
            <DemoInput
              label="Görünen ad"
              name="displayName"
              required
              placeholder="Örn. Kadıköy şubesi PayTR TEST"
              className="md:col-span-2"
            />
            <DemoInput label="Merchant ID" name="merchantId" required placeholder="Merchant / mağaza ID" />
            <DemoInput label="API key (opsiyonel)" name="apiKey" placeholder="API key" />
            <DemoInput
              label="Secret key"
              name="secretKey"
              type="password"
              placeholder="Yeni kayıtta zorunlu; güncellemede boş bırakılabilir"
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
              <DemoPrimaryButton>Credential kaydet</DemoPrimaryButton>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

import { ActivationStepKey } from ".prisma/client";

export const ACTIVATION_STEP_LABELS: Record<ActivationStepKey, string> = {
  BUSINESS_PROFILE: "İşletme profili",
  BRANCH_SETUP: "Şube kurulumu",
  TABLE_SETUP: "Masa kurulumu",
  STAFF_INVITE: "Personel daveti",
  MENU_IMPORT: "Menü aktarımı",
  PAYMENT_PROVIDER: "Ödeme altyapısı",
  VALIDATION: "Son kontroller",
  GO_LIVE: "Yayına alma",
};

const ACTIONABLE_ACTIVATION_STEPS = new Set<ActivationStepKey>([
  ActivationStepKey.BUSINESS_PROFILE,
  ActivationStepKey.BRANCH_SETUP,
  ActivationStepKey.TABLE_SETUP,
  ActivationStepKey.STAFF_INVITE,
  ActivationStepKey.MENU_IMPORT,
  ActivationStepKey.PAYMENT_PROVIDER,
  ActivationStepKey.VALIDATION,
  ActivationStepKey.GO_LIVE,
]);

export function isActivationStepActionable(step: ActivationStepKey | null | undefined): boolean {
  return Boolean(step && ACTIONABLE_ACTIVATION_STEPS.has(step));
}

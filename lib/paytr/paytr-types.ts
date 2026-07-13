export type PaytrSubscriptionCredentials = {
  merchantId: string;
  merchantKey: string;
  merchantSalt: string;
};

export type PaytrIframeTokenRequest = {
  merchantId: string;
  userIp: string;
  merchantOid: string;
  email: string;
  paymentAmountMinor: number;
  userBasketBase64: string;
  userName: string;
  userAddress: string;
  userPhone: string;
  merchantOkUrl: string;
  merchantFailUrl: string;
  currency: string;
  testMode: boolean;
  debugOn: boolean;
  noInstallment?: boolean;
  maxInstallment?: number;
  timeoutLimit?: number;
  lang?: string;
};

export type PaytrCallbackFields = {
  merchantOid: string;
  status: string;
  totalAmount: string;
  paymentAmount?: string;
  currency?: string;
  failedReasonCode?: string;
  failedReasonMsg?: string;
  hash: string;
};

export type PaytrIframeTokenResult = {
  iframeToken: string;
  iframeUrl: string;
};

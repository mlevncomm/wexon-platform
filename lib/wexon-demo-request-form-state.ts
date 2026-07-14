export type DemoRequestFormState = {
  success: boolean;
  submitted: boolean;
  error: string | null;
  message: string | null;
  applicantMessage?: string | null;
};

export const initialDemoRequestState: DemoRequestFormState = {
  success: false,
  submitted: false,
  error: null,
  message: null,
  applicantMessage: null,
};

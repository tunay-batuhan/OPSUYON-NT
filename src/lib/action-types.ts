export type ActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  /** Server-side validation / business errors mapped to form fields. */
  fieldErrors?: Record<string, string>;
} | null;

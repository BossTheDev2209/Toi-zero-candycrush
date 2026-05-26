export interface ToiSubmitInput {
  submitUrl: string;
  cookie: string;
  extraHeaders: Record<string, string>;
  problemSlugId: string;
  language: "c" | "cpp";
  code: string;
}

export interface ToiSubmitResult {
  status: number | null;
  body: unknown;
  error: string | null;
}

export async function submitToToi(_input: ToiSubmitInput): Promise<ToiSubmitResult> {
  return { status: null, body: null, error: "submit-through not yet wired (Task 15 pending)" };
}

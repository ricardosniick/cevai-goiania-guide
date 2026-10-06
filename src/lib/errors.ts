/** Friendly Portuguese message for a failed action; the technical error always goes to the console. */
export const OFFLINE_MSG = "Sem conexão. Tente de novo.";

export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const msg = err instanceof Error ? err.message : typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message) : "";
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(msg);
}

export function friendlyError(err: unknown, fallback: string, context?: string): string {
  console.error(`[erro]${context ? ` ${context}` : ""}`, err);
  return isNetworkError(err) ? OFFLINE_MSG : fallback;
}

const AUTH_MESSAGES: Record<string, string> = {
  weak_password: "Essa senha é muito comum ou fraca. Escolha uma senha mais difícil.",
  user_already_exists: "Este e-mail já tem conta.",
  over_email_send_rate_limit: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
  over_request_rate_limit: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
  email_address_invalid: "Confira o e-mail digitado.",
  validation_failed: "Confira o e-mail digitado.",
  signup_disabled: "Cadastros estão desativados no momento.",
};

/** Portuguese message for an auth error, based on its `code`; unknown errors keep the fallback and are logged in full. */
export function authErrorMessage(err: unknown, fallback: string, context = "auth"): string {
  const e = (typeof err === "object" && err ? err : {}) as { code?: unknown; message?: unknown };
  const code = typeof e.code === "string" ? e.code : "";
  if (AUTH_MESSAGES[code]) return AUTH_MESSAGES[code];
  if (typeof e.message === "string" && e.message.includes("registered")) return AUTH_MESSAGES.user_already_exists!;
  return friendlyError(err, fallback, context);
}

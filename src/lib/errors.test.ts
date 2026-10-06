import { describe, it, expect, vi } from "vitest";
import { authErrorMessage } from "./errors";

const FB = "Não foi possível criar a conta.";
describe("authErrorMessage", () => {
  it("weak_password", () => expect(authErrorMessage({ code: "weak_password" }, FB)).toBe("Essa senha é muito comum ou fraca. Escolha uma senha mais difícil."));
  it("user_already_exists", () => expect(authErrorMessage({ code: "user_already_exists" }, FB)).toBe("Este e-mail já tem conta."));
  it("message with registered", () => expect(authErrorMessage({ message: "User already registered" }, FB)).toBe("Este e-mail já tem conta."));
  it("rate limits", () => {
    expect(authErrorMessage({ code: "over_email_send_rate_limit" }, FB)).toBe("Muitas tentativas. Aguarde alguns minutos e tente de novo.");
    expect(authErrorMessage({ code: "over_request_rate_limit" }, FB)).toBe("Muitas tentativas. Aguarde alguns minutos e tente de novo.");
  });
  it("invalid email", () => {
    expect(authErrorMessage({ code: "email_address_invalid" }, FB)).toBe("Confira o e-mail digitado.");
    expect(authErrorMessage({ code: "validation_failed" }, FB)).toBe("Confira o e-mail digitado.");
  });
  it("signup_disabled", () => expect(authErrorMessage({ code: "signup_disabled" }, FB)).toBe("Cadastros estão desativados no momento."));
  it("network failure", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(authErrorMessage(new TypeError("Failed to fetch"), FB)).toBe("Sem conexão. Tente de novo.");
    spy.mockRestore();
  });
  it("unknown keeps fallback and logs", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(authErrorMessage({ code: "something_else", message: "x" }, FB)).toBe(FB);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
const mocks = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@/lib/save-book", () => ({ saveBook: mocks.save }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: () => ({ select: () => ({ order: async () => ({ data: [], error: null }) }) }),
} }));
import { BooksPanel } from "@/components/cevai/BooksPanel";
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
async function openForm() {
  const notify = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={qc}><BooksPanel user={{ id: "user" } as User} notify={notify} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Registrar livro" }));
  fireEvent.change(screen.getByLabelText("Título"), { target: { value: "  Livro de teste  " } });
  fireEvent.change(screen.getByLabelText("Autor (opcional)"), { target: { value: "Autora" } });
  fireEvent.click(screen.getByRole("button", { name: "4 estrelas" }));
  fireEvent.change(screen.getByPlaceholderText("Minha experiência com o livro"), { target: { value: "Gostei" } });
  fireEvent.change(screen.getByLabelText("Adicionar foto (opcional)"), { target: { files: [new File(["image"], "book.jpg", { type: "image/jpeg" })] } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar livro" }));
  return notify;
}
describe("book form after save", () => {
  it("keeps title, author, review, stars and selected file on failure and allows retry", async () => {
    mocks.save.mockRejectedValue(new Error("insert denied"));
    const notify = await openForm();
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Não foi possível salvar o livro."));
    expect(screen.getByLabelText("Título")).toHaveValue("  Livro de teste  ");
    expect(screen.getByLabelText("Autor (opcional)")).toHaveValue("Autora");
    expect(screen.getByPlaceholderText("Minha experiência com o livro")).toHaveValue("Gostei");
    expect(screen.getByText("book.jpg")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar livro" })).toBeEnabled();
    mocks.save.mockResolvedValue({ photoFailed: false });
    fireEvent.click(screen.getByRole("button", { name: "Salvar livro" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Livro registrado!"));
    expect(mocks.save.mock.calls[1]?.[0]).toMatchObject({ title: "Livro de teste", author: "Autora", rating: 4, comment: "Gostei" });
  });
  it("retains the partial-photo warning when the book saves without its photo", async () => {
    mocks.save.mockResolvedValue({ photoFailed: true });
    const notify = await openForm();
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Livro registrado, mas a foto não pôde ser salva."));
    expect(screen.getByRole("button", { name: "Registrar livro" })).toBeInTheDocument();
  });
});

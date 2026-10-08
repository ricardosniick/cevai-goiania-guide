import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
const mocks = vi.hoisted(() => ({ save: vi.fn(), update: vi.fn(), del: vi.fn(), rows: [] as Array<Record<string, unknown>> }));
vi.mock("@/lib/save-book", () => ({ saveBook: mocks.save }));
vi.mock("@/lib/manage-book", () => ({ updateBook: mocks.update, deleteBook: mocks.del }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: () => ({ select: () => ({ order: async () => ({ data: mocks.rows, error: null }) }) }),
} }));
import { BooksPanel } from "@/components/cevai/BooksPanel";
beforeEach(() => { mocks.rows = []; vi.resetAllMocks(); vi.spyOn(console, "error").mockImplementation(() => {}); });
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

const saved = { id: "book", user_id: "user", title: "Meu livro", author: "Autora", status: "lendo", rating: 3, comment: "Texto original", would_recommend: null, photo_path: null, is_public: false, created_at: "2026-10-08" };
function mountExisting() {
  mocks.rows = [saved];
  const notify = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={qc}><BooksPanel user={{ id: "user" } as User} notify={notify} /></QueryClientProvider>);
  return notify;
}
describe("editing and deleting books", () => {
  it("prefills fields and updates the selected book without creating another", async () => {
    mocks.update.mockResolvedValue({ photoCleanupFailed: false });
    const notify = mountExisting();
    fireEvent.click(await screen.findByRole("button", { name: "Editar livro Meu livro" }));
    expect(screen.getByLabelText("Título")).toHaveValue("Meu livro");
    expect(screen.getByPlaceholderText("Minha experiência com o livro")).toHaveValue("Texto original");
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Título revisado" } });
    fireEvent.click(screen.getByRole("button", { name: "Atualizar livro" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Livro atualizado!"));
    expect(mocks.update).toHaveBeenCalledWith("user", expect.objectContaining({ id: "book" }), expect.objectContaining({ title: "Título revisado", status: "lendo", rating: 3 }), null, false);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("keeps edited fields and allows retry after an update error", async () => {
    mocks.update.mockRejectedValue(new Error("denied"));
    const notify = mountExisting();
    fireEvent.click(await screen.findByRole("button", { name: "Editar livro Meu livro" }));
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Título revisado" } });
    fireEvent.click(screen.getByRole("button", { name: "Atualizar livro" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Não foi possível atualizar o livro. Tente de novo."));
    expect(screen.getByLabelText("Título")).toHaveValue("Título revisado");
    expect(screen.getByRole("button", { name: "Atualizar livro" })).toBeEnabled();
  });
  it("cancels deletion without a backend call", async () => {
    mountExisting(); fireEvent.click(await screen.findByRole("button", { name: "Excluir livro Meu livro" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(mocks.del).not.toHaveBeenCalled();
  });
  it("deletes only after confirmation", async () => {
    mocks.del.mockResolvedValue({ photoCleanupFailed: false });
    const notify = mountExisting(); fireEvent.click(await screen.findByRole("button", { name: "Excluir livro Meu livro" }));
    expect(mocks.del).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Excluir livro" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Livro excluído!"));
    expect(mocks.del).toHaveBeenCalledWith("user", "book");
  });
  it("keeps confirmation available after deletion fails", async () => {
    mocks.del.mockRejectedValue(new Error("denied"));
    const notify = mountExisting(); fireEvent.click(await screen.findByRole("button", { name: "Excluir livro Meu livro" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir livro" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Não foi possível excluir o livro. Tente de novo."));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir livro" })).toBeEnabled();
  });
});

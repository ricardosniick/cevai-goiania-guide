import { useState } from "react";
import type React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { BookOpen, Camera, Image as ImageIcon, Star, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/errors";
import { saveBook } from "@/lib/save-book";
import { compressImage } from "@/lib/compress-image";
import { PHOTO_REJECTION_MESSAGE, photoRejection } from "@/lib/experience-photo-selection";
import { updateBook, deleteBook } from "@/lib/manage-book";
import type { Tables } from "@/integrations/supabase/types";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Field, ListError, Stars } from "@/components/cevai/shared";

const BOOK_STATUS = { quero_ler: "Quero ler", lendo: "Lendo", terminei: "Terminei" } as const;
type BookStatus = keyof typeof BOOK_STATUS;

export function BooksPanel({ user, notify }: { user: User; notify: (m: string) => void }) {
  const qc = useQueryClient();
  const books = useQuery({ queryKey: ["books", user.id], queryFn: async () => {
    const { data, error } = await supabase.from("books").select("*").order("created_at", { ascending: false }); if (error) throw error;
    const paths = (data ?? []).map((b) => b.photo_path).filter((x): x is string => !!x); const urls: Record<string, string> = {};
    if (paths.length) { const { data: sg } = await supabase.storage.from("experience-photos").createSignedUrls(paths, 3600); sg?.forEach((x) => { if (x.path && x.signedUrl) urls[x.path] = x.signedUrl; }); }
    return (data ?? []).map((b) => ({ ...b, photo: b.photo_path ? urls[b.photo_path] ?? null : null }));
  } });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<(Tables<"books"> & { photo: string | null }) | null>(null);
  const [deleting, setDeleting] = useState<Tables<"books"> | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [title, setTitle] = useState(""); const [author, setAuthor] = useState(""); const [status, setStatus] = useState<BookStatus>("terminei");
  const [rating, setRating] = useState(0); const [comment, setComment] = useState(""); const [rec, setRec] = useState(true); const [file, setFile] = useState<File | null>(null); const [saving, setSaving] = useState(false);
  const reset = () => { setOpen(false); setEditing(null); setTitle(""); setAuthor(""); setRating(0); setComment(""); setFile(null); setRemovePhoto(false); };
  const edit = (book: Tables<"books"> & { photo: string | null }) => {
    setEditing(book); setTitle(book.title); setAuthor(book.author ?? ""); setStatus(book.status as BookStatus); setRating(book.rating ?? 0); setComment(book.comment ?? ""); setRec(book.would_recommend ?? true); setFile(null); setRemovePhoto(false); setOpen(true);
  };
  const pickBookPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null; e.target.value = "";
    if (!f) return;
    const bad = photoRejection([f]); if (bad) { notify(PHOTO_REJECTION_MESSAGE[bad]); return; }
    setFile(await compressImage(f));
  };
  const save = async () => {
    if (saving || deletingBusy || !title.trim()) return;
    setSaving(true);
    try {
      const changes = { title: title.trim(), author: author.trim() || null, status, rating: rating || null, comment: comment.trim() || null, would_recommend: status === "terminei" ? rec : null };
      if (editing) {
        const result = await updateBook(user.id, editing, changes, file, removePhoto);
        notify(result.photoCleanupFailed ? "Livro atualizado. A limpeza da foto anterior ficou pendente." : "Livro atualizado!");
      } else {
        const { photoFailed } = await saveBook({ user_id: user.id, ...changes }, file);
        notify(photoFailed ? "Livro registrado, mas a foto não pôde ser salva." : "Livro registrado!");
      }
      reset(); void qc.invalidateQueries({ queryKey: ["books", user.id] });
    } catch (e) { notify(friendlyError(e, editing ? "Não foi possível atualizar o livro. Tente de novo." : "Não foi possível salvar o livro.", "books")); } finally { setSaving(false); }
  };
  const confirmDelete = async () => {
    if (!deleting || deletingBusy) return;
    setDeletingBusy(true);
    try {
      const result = await deleteBook(user.id, deleting.id);
      if (editing?.id === deleting.id) reset();
      setDeleting(null); notify(result.photoCleanupFailed ? "Livro excluído. A limpeza da foto ficou pendente." : "Livro excluído!");
      void qc.invalidateQueries({ queryKey: ["books", user.id] });
    } catch (e) { notify(friendlyError(e, "Não foi possível excluir o livro. Tente de novo.", "delete book")); } finally { setDeletingBusy(false); }
  };
  return <div>
    {open ? <div className="space-y-3 rounded-2xl bg-card p-4 shadow-sm">
      {editing && <h3 className="font-display font-black">Editar livro</h3>}
      <Field label="Título" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: O Pequeno Príncipe" />
      <Field label="Autor (opcional)" value={author} maxLength={120} onChange={(e) => setAuthor(e.target.value)} />
      <div className="flex gap-2">{(Object.keys(BOOK_STATUS) as BookStatus[]).map((k) => <button key={k} onClick={() => setStatus(k)} className={`flex-1 rounded-full py-2 text-xs font-bold ${status === k ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{BOOK_STATUS[k]}</button>)}</div>
      {status !== "quero_ler" && <div className="flex gap-1.5">{[1, 2, 3, 4, 5].map((n) => <button key={n} aria-label={`${n} estrelas`} onClick={() => setRating(n)}><Star size={28} className={n <= rating ? "fill-secondary text-secondary" : "text-muted-foreground/60"} /></button>)}</div>}
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} rows={2} placeholder="Minha experiência com o livro" className="w-full resize-none rounded-xl border border-input bg-background p-3 text-sm outline-none" />
      {editing?.photo_path && !removePhoto && <div className="flex items-center gap-3">{editing.photo && <img src={editing.photo} alt="Foto atual do livro" className="h-20 w-14 rounded-lg object-cover" />}<Button variant="outline" disabled={saving} onClick={() => { setRemovePhoto(true); setFile(null); }} className="rounded-full">Remover foto atual</Button></div>}
      {editing?.photo_path && removePhoto && <Button variant="ghost" disabled={saving} onClick={() => setRemovePhoto(false)}>Manter foto atual</Button>}
      <div><p className="text-xs font-bold text-muted-foreground">{file ? file.name : "Adicionar foto (opcional)"}</p><div className="mt-1 flex gap-4"><label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-muted-foreground"><Camera size={16} />Câmera<input type="file" accept="image/*" capture="environment" className="sr-only" disabled={saving} onChange={pickBookPhoto} /></label><label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-muted-foreground"><ImageIcon size={16} />Galeria<input type="file" accept="image/*" className="sr-only" disabled={saving} onChange={pickBookPhoto} /></label></div></div>
      {status === "terminei" && <button onClick={() => setRec((v) => !v)} className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${rec ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{rec ? "❤️ Recomendo" : "Não recomendo"}</button>}
      <div className="flex gap-2"><Button variant="outline" disabled={saving} onClick={() => { if (editing) reset(); else setOpen(false); }} className="flex-1 rounded-full">Cancelar</Button><Button disabled={!title.trim() || saving || deletingBusy} onClick={() => void save()} className="flex-1 rounded-full bg-secondary font-extrabold text-secondary-foreground hover:bg-secondary/90">{saving ? "Salvando…" : editing ? "Atualizar livro" : "Salvar livro"}</Button></div>
    </div> : <Button onClick={() => setOpen(true)} variant="outline" className="h-11 w-full rounded-full border-dashed font-extrabold"><BookOpen size={16} />Registrar livro</Button>}
    {books.isError && <div className="mt-3"><ListError onRetry={() => void books.refetch()} /></div>}
    <div className="mt-3 space-y-2">{books.data?.map((b) => <div key={b.id} className="flex gap-3 rounded-2xl bg-card p-3 shadow-sm">
      {b.photo ? <img src={b.photo} alt={b.title} className="h-20 w-14 shrink-0 rounded-lg object-cover" /> : <div className="grid h-20 w-14 shrink-0 place-items-center rounded-lg bg-muted text-2xl">📖</div>}
      <div className="min-w-0 flex-1"><p className="truncate font-display font-black">{b.title}</p>{b.author && <p className="truncate text-xs text-muted-foreground">{b.author}</p>}<div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-bold"><span className="rounded-full bg-muted px-2 py-0.5">{BOOK_STATUS[b.status as BookStatus]}</span>{b.rating && <Stars value={b.rating} size={11} />}{b.would_recommend && <span className="text-primary">❤️ Recomendo</span>}</div>{b.comment && <p className="mt-1 line-clamp-2 text-xs text-foreground/80">{b.comment}</p>}
        <div className="mt-2 flex gap-3"><button disabled={saving || deletingBusy} aria-label={`Editar livro ${b.title}`} onClick={() => edit(b)} className="flex items-center gap-1 text-xs font-bold text-primary"><Pencil size={14} />Editar</button><button disabled={saving || deletingBusy} aria-label={`Excluir livro ${b.title}`} onClick={() => setDeleting(b)} className="flex items-center gap-1 text-xs font-bold text-destructive"><Trash2 size={14} />Excluir</button></div></div>
    </div>)}</div>
    <AlertDialog open={!!deleting} onOpenChange={(value) => { if (!value && !deletingBusy) setDeleting(null); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir livro?</AlertDialogTitle><AlertDialogDescription>O registro de “{deleting?.title}” será excluído, incluindo suas notas e comentário. Essa ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel disabled={deletingBusy}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={deletingBusy} onClick={(event) => { event.preventDefault(); void confirmDelete(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{deletingBusy ? "Excluindo…" : "Excluir livro"}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    {books.data?.length === 0 && !open && <p className="mt-2 text-center text-xs text-muted-foreground">Seus livros ficam privados aqui.</p>}
  </div>;
}

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { BookOpen, Camera, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/errors";
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
  const [title, setTitle] = useState(""); const [author, setAuthor] = useState(""); const [status, setStatus] = useState<BookStatus>("terminei");
  const [rating, setRating] = useState(0); const [comment, setComment] = useState(""); const [rec, setRec] = useState(true); const [file, setFile] = useState<File | null>(null); const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      let photo_path: string | null = null; let photoFailed = false;
      if (file && file.size <= 10 * 1024 * 1024) { const path = `${user.id}/books/${Date.now()}.${(file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "")}`; const up = await supabase.storage.from("experience-photos").upload(path, file, { contentType: file.type }); if (!up.error) photo_path = path; else { console.error("[erro] book photo upload", up.error); photoFailed = true; } }
      const { error } = await supabase.from("books").insert({ user_id: user.id, title: title.trim(), author: author.trim() || null, status, rating: rating || null, comment: comment.trim() || null, would_recommend: status === "terminei" ? rec : null, photo_path });
      if (error) return notify(friendlyError(error, "Não foi possível salvar o livro.", "books"));
      setOpen(false); setTitle(""); setAuthor(""); setRating(0); setComment(""); setFile(null); notify(photoFailed ? "Livro registrado, mas a foto não pôde ser salva." : "Livro registrado!"); void qc.invalidateQueries({ queryKey: ["books"] });
    } catch (e) { notify(friendlyError(e, "Não foi possível salvar o livro.", "books")); } finally { setSaving(false); }
  };
  return <div>
    {open ? <div className="space-y-3 rounded-2xl bg-card p-4 shadow-sm">
      <Field label="Título" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: O Pequeno Príncipe" />
      <Field label="Autor (opcional)" value={author} maxLength={120} onChange={(e) => setAuthor(e.target.value)} />
      <div className="flex gap-2">{(Object.keys(BOOK_STATUS) as BookStatus[]).map((k) => <button key={k} onClick={() => setStatus(k)} className={`flex-1 rounded-full py-2 text-xs font-bold ${status === k ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{BOOK_STATUS[k]}</button>)}</div>
      {status !== "quero_ler" && <div className="flex gap-1.5">{[1, 2, 3, 4, 5].map((n) => <button key={n} aria-label={`${n} estrelas`} onClick={() => setRating(n)}><Star size={28} className={n <= rating ? "fill-secondary text-secondary" : "text-border"} /></button>)}</div>}
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} rows={2} placeholder="Minha experiência com o livro" className="w-full resize-none rounded-xl border border-input bg-background p-3 text-sm outline-none" />
      <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground"><Camera size={16} />{file ? file.name : "Adicionar foto (opcional)"}<input type="file" accept="image/*" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
      {status === "terminei" && <button onClick={() => setRec((v) => !v)} className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${rec ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{rec ? "❤️ Recomendo" : "Não recomendo"}</button>}
      <div className="flex gap-2"><Button variant="outline" onClick={() => setOpen(false)} className="flex-1 rounded-full">Cancelar</Button><Button disabled={!title.trim() || saving} onClick={() => void save()} className="flex-1 rounded-full bg-secondary font-extrabold text-secondary-foreground hover:bg-secondary/90">{saving ? "Salvando…" : "Salvar livro"}</Button></div>
    </div> : <Button onClick={() => setOpen(true)} variant="outline" className="h-11 w-full rounded-full border-dashed font-extrabold"><BookOpen size={16} />Registrar livro</Button>}
    {books.isError && <div className="mt-3"><ListError onRetry={() => void books.refetch()} /></div>}
    <div className="mt-3 space-y-2">{books.data?.map((b) => <div key={b.id} className="flex gap-3 rounded-2xl bg-card p-3 shadow-sm">
      {b.photo ? <img src={b.photo} alt={b.title} className="h-20 w-14 shrink-0 rounded-lg object-cover" /> : <div className="grid h-20 w-14 shrink-0 place-items-center rounded-lg bg-muted text-2xl">📖</div>}
      <div className="min-w-0 flex-1"><p className="truncate font-display font-black">{b.title}</p>{b.author && <p className="truncate text-xs text-muted-foreground">{b.author}</p>}<div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-bold"><span className="rounded-full bg-muted px-2 py-0.5">{BOOK_STATUS[b.status as BookStatus]}</span>{b.rating && <Stars value={b.rating} size={11} />}{b.would_recommend && <span className="text-primary">❤️ Recomendo</span>}</div>{b.comment && <p className="mt-1 line-clamp-2 text-xs text-foreground/80">{b.comment}</p>}</div>
    </div>)}</div>
    {books.data?.length === 0 && !open && <p className="mt-2 text-center text-xs text-muted-foreground">Seus livros ficam privados aqui.</p>}
  </div>;
}

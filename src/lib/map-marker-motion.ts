/** Animate only an existing marker; never creates a map or requests place data. */
export function animateSelectedMarker(
  update: (scale: number, lift: number) => void,
): () => void {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return () => {};
  let frame = 0;
  let start: number | undefined;
  let stopped = false;
  const tick = (now: number) => {
    if (stopped) return;
    start ??= now;
    const progress = Math.min(1, (now - start) / 400);
    const hop = Math.sin(Math.PI * progress);
    update(13 + 3 * hop, 8 * hop);
    if (progress < 1) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => { stopped = true; cancelAnimationFrame(frame); };
}

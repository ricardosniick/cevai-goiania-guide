export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const cls = size === "lg" ? "text-[2.6rem]" : size === "sm" ? "text-xl" : "text-2xl";
  return <span className={`font-display font-black leading-none tracking-tight ${cls}`}><span className="text-primary">Cê</span> <span className="text-secondary">Vai?</span></span>;
}

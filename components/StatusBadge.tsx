import type { AppStatus } from "@/types/database";

const MAP: Record<AppStatus, { label: string; cls: string }> = {
  pending: { label: "ממתין לבדיקה", cls: "bg-gold/15 text-gold border-gold/30" },
  approved: { label: "מאושר", cls: "bg-accent/15 text-accent border-accent/30" },
  rejected: { label: "נדחה", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  archived: { label: "בארכיון", cls: "bg-gray-500/15 text-gray-400 border-gray-500/30" }
};

export default function StatusBadge({ status }: { status: AppStatus }) {
  const s = MAP[status];
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${s.cls}`}>
      {s.label}
    </span>
  );
}

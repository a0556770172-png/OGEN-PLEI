"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Download, Check, X, Loader2, User, HardDrive, ArrowLeft, Sparkles, Repeat, Smartphone, Monitor } from "lucide-react";
import { formatFileSize } from "@/lib/format";
import { detectFileKind } from "@/lib/fileKind";
import { useApprovalReminder } from "./ApprovalReminder";

type Proposal = {
  id: string;
  app_id: string;
  uploader_id: string;
  kind: "owner" | "public";
  version: string;
  file_name: string;
  file_size_bytes: number;
  name: string | null;
  platform_override: "apk" | "software" | null;
  created_at: string;
  uploader?: { username: string } | null;
  app?: {
    id: string;
    name: string;
    version: string;
    file_name: string;
    file_size_bytes: number;
    developer_id: string;
    developer?: { username: string } | null;
  } | null;
};

// גרסאות חדשות שממתינות לאישור הצוות (lib/versionProposals.ts). עד האישור האפליקציה
// מוצגת בחנות עם הגרסה הקודמת. באישור - הגרסה הישנה נמחקת לגמרי, ובעדכון ציבורי
// המעלה הופך לבעלים.
export default function VersionProposalsQueue() {
  const router = useRouter();
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { ask, dialog } = useApprovalReminder();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/update-proposals", { cache: "no-store" });
      const json = await res.json();
      setProposals(res.ok ? json.proposals ?? [] : []);
    } catch {
      setProposals([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function download(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/admin/update-proposals/${id}`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    setBusyId(null);
    if (res.ok) window.open(json.url, "_blank");
    else alert(json.error || "שגיאה בהורדה");
  }

  async function act(p: Proposal, action: "approve" | "reject") {
    let note: string | null = null;
    if (action === "reject") {
      note = window.prompt("סיבת הדחייה (תוצג למי שהעלה):");
      if (note === null) return;
    } else {
      const ownerChanges = p.kind === "public" && !!p.app && p.app.developer_id !== p.uploader_id;
      const ok = await ask({
        appName: p.app?.name ?? p.name ?? "",
        kind: p.kind === "public" ? "public" : "private",
        extra: ownerChanges
          ? `באישור: הגרסה הישנה תימחק, והבעלות תעבור ל-${p.uploader?.username ?? "המעלה"}.`
          : "באישור: הגרסה הישנה תימחק לגמרי מהשרת."
      });
      if (!ok) return;
    }
    setBusyId(p.id);
    const res = await fetch(`/api/admin/update-proposals/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note })
    });
    const json = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      alert(json.error || "שגיאה בביצוע הפעולה");
      return;
    }
    setProposals((prev) => (prev ?? []).filter((x) => x.id !== p.id));
    router.refresh();
  }

  if (!proposals || proposals.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {dialog}
      <h2 className="flex items-center gap-2 text-lg font-bold text-white">
        <Sparkles className="h-5 w-5 text-accent" /> גרסאות חדשות ממתינות ({proposals.length})
      </h2>
      <p className="text-xs text-gray-500">
        עד האישור האפליקציה ממשיכה להופיע בחנות עם הגרסה הנוכחית. באישור - הגרסה הישנה נמחקת לגמרי מהשרת.
      </p>
      {proposals.map((p) => {
        const owner = p.app?.developer?.username;
        const ownerChanges = p.kind === "public" && !!p.app && p.app.developer_id !== p.uploader_id;
        const isApkFile = p.platform_override ? p.platform_override === "apk" : detectFileKind(p.file_name) === "apk";
        return (
          <div key={p.id} className="card flex flex-col gap-3 border-accent/30 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Link href={`/apps/${p.app_id}`} target="_blank" className="font-bold text-white hover:underline">
                    {p.app?.name ?? p.name}
                  </Link>
                  {p.kind === "public" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary-light">
                      <Repeat className="h-3 w-3" /> עדכון ציבורי
                    </span>
                  ) : (
                    <span className="rounded-full bg-surface2 px-2 py-0.5 text-[11px] font-bold text-gray-400">עדכון של הבעלים</span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface2 px-2 py-0.5 text-[11px] text-gray-400">
                    {isApkFile ? <Smartphone className="h-3 w-3" /> : <Monitor className="h-3 w-3" />} {isApkFile ? "אפליקציות" : "תוכנות"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-300">
                  <span>גרסה {p.app?.version ?? "?"}</span>
                  <ArrowLeft className="h-3.5 w-3.5 text-gray-500" />
                  <span className="font-bold text-accent">גרסה {p.version}</span>
                </div>
                {p.kind === "public" && p.name && p.app && p.name !== p.app.name && (
                  <p className="mt-1 text-xs text-gray-400">שם חדש: {p.name}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" /> הועלה ע"י {p.uploader?.username ?? "?"}</span>
                  <span className="inline-flex items-center gap-1"><HardDrive className="h-3.5 w-3.5" /> {p.file_name} · {formatFileSize(p.file_size_bytes)}</span>
                </div>
                {ownerChanges && (
                  <p className="mt-2 text-xs text-gold">באישור: הבעלות עוברת מ-{owner ?? "?"} ל-{p.uploader?.username ?? "?"}, וההורדות מעכשיו נזקפות לו.</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => download(p.id)} disabled={busyId === p.id} className="btn-ghost text-xs">
                  {busyId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} הורדה לבדיקה
                </button>
                <button onClick={() => act(p, "approve")} disabled={busyId === p.id} className="inline-flex items-center gap-1 rounded-xl bg-accent/15 px-3 py-2 text-xs font-bold text-accent transition hover:bg-accent/25">
                  <Check className="h-3.5 w-3.5" /> אישור הגרסה
                </button>
                <button onClick={() => act(p, "reject")} disabled={busyId === p.id} className="inline-flex items-center gap-1 rounded-xl bg-red-500/15 px-3 py-2 text-xs font-bold text-red-400 transition hover:bg-red-500/25">
                  <X className="h-3.5 w-3.5" /> דחייה
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

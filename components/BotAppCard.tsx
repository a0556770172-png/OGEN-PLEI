"use client";
import Link from "next/link";
import { Package, Star, Download, Smartphone, Monitor } from "lucide-react";

export interface BotAppCardData {
  id: string;
  name: string;
  category: string;
  type: "apk" | "software";
  downloads: number;
  rating: number | null;
  iconUrl: string | null;
}

export default function BotAppCard({ app, onNavigate }: { app: BotAppCardData; onNavigate?: () => void }) {
  return (
    <Link
      href={`/apps/${app.id}`}
      onClick={onNavigate}
      className="group flex items-center gap-3 rounded-xl border border-border bg-surface2/60 p-2.5 transition hover:border-primary/50 hover:bg-surface2"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface ring-1 ring-border">
        {app.iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={app.iconUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Package className="h-5 w-5 text-primary-light" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-white group-hover:text-primary-light">{app.name}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-gray-500">
          <span className="inline-flex items-center gap-1">
            {app.type === "apk" ? <Smartphone className="h-3 w-3" /> : <Monitor className="h-3 w-3" />}
            {app.category}
          </span>
          {app.rating != null && (
            <span className="inline-flex items-center gap-0.5 text-gold">
              <Star className="h-3 w-3 fill-gold" /> {app.rating}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Download className="h-3 w-3" /> {app.downloads.toLocaleString("he-IL")}
          </span>
        </div>
      </div>
      <span className="shrink-0 rounded-lg bg-primary/15 px-2.5 py-1 text-[11px] font-bold text-primary-light">פתיחה</span>
    </Link>
  );
}

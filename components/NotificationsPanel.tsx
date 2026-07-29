"use client";
import { ClipboardList, Crown, Gift, MessageCircle, BellRing, PartyPopper } from "lucide-react";

export interface NotificationItem {
  key: string;
  label: string;
  description: string;
  count: number;
  icon: typeof ClipboardList;
}

export default function NotificationsPanel({
  items,
  onNavigate
}: {
  items: NotificationItem[];
  onNavigate: (key: string) => void;
}) {
  const active = items.filter((i) => i.count > 0);

  if (active.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-2 p-12 text-center text-gray-500">
        <PartyPopper className="h-8 w-8 text-accent" />
        הכול מטופל! אין כרגע שום דבר שממתין לטיפול.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {active.map((item) => (
        <button
          key={item.key}
          onClick={() => onNavigate(item.key)}
          className="card flex w-full items-center gap-4 p-5 text-right transition hover:ring-1 hover:ring-primary/40"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
            <item.icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-white">{item.label}</p>
            <p className="text-xs text-gray-500">{item.description}</p>
          </div>
          <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-gold px-2 text-sm font-black text-black">
            {item.count}
          </span>
        </button>
      ))}
    </div>
  );
}

export const NOTIFICATION_ICONS = { ClipboardList, Crown, Gift, MessageCircle, BellRing };

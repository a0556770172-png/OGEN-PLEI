"use client";
import { useState } from "react";
import { ClipboardList, MessageCircle, Gift, BellRing } from "lucide-react";
import ReviewQueue from "./ReviewQueue";
import TicketsPanel from "./TicketsPanel";
import SuggestionsQueue from "./SuggestionsQueue";
import NotificationsPanel from "./NotificationsPanel";
import type { AppRow } from "@/types/database";

type TabKey = "notifications" | "review" | "tickets" | "suggestions";

export default function ModeratorDashboardClient({
  apps,
  suggestionsPendingCount,
  ticketsNeedingReplyCount
}: {
  apps: AppRow[];
  suggestionsPendingCount: number;
  ticketsNeedingReplyCount: number;
}) {
  const [tab, setTab] = useState<TabKey>("notifications");

  const notificationCount = apps.length + suggestionsPendingCount + ticketsNeedingReplyCount;

  const tabs = [
    { key: "notifications", label: `התראות${notificationCount ? ` (${notificationCount})` : ""}`, icon: BellRing },
    { key: "review", label: `בדיקת פרסום (${apps.length})`, icon: ClipboardList },
    { key: "suggestions", label: "הצעות אפליקציות", icon: Gift },
    { key: "tickets", label: "פניות תמיכה", icon: MessageCircle }
  ] as const;

  const notificationItems = [
    { key: "review", label: "אפליקציות ממתינות לבדיקה", description: "אפליקציות חדשות שממתינות לאישור/דחייה שלך", count: apps.length, icon: ClipboardList },
    { key: "suggestions", label: "הצעות אפליקציות ממתינות", description: "משתמשים שהציעו אפליקציה להוספה למאגר", count: suggestionsPendingCount, icon: Gift },
    { key: "tickets", label: "פניות תמיכה ממתינות למענה", description: "פניות שמשתמשים כתבו ועדיין לא קיבלו תגובה", count: ticketsNeedingReplyCount, icon: MessageCircle }
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
              tab === t.key ? "bg-primary text-white shadow-glow" : "bg-surface2 text-gray-400 hover:text-white"
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "notifications" && <NotificationsPanel items={notificationItems} onNavigate={(key) => setTab(key as TabKey)} />}
      {tab === "review" && <ReviewQueue apps={apps} canDelete={false} />}
      {tab === "suggestions" && <SuggestionsQueue />}
      {tab === "tickets" && <TicketsPanel />}
    </div>
  );
}

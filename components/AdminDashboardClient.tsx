"use client";
import { useState } from "react";
import { ClipboardList, Users, Crown, MessageCircle, Gift, Tag, LayoutGrid, BellRing, Settings, ShieldAlert } from "lucide-react";
import ReviewQueue from "./ReviewQueue";
import UserManagementTable from "./UserManagementTable";
import ProRequestsQueue from "./ProRequestsQueue";
import TicketsPanel from "./TicketsPanel";
import SuggestionsQueue from "./SuggestionsQueue";
import CategoriesManager from "./CategoriesManager";
import NotificationsPanel from "./NotificationsPanel";
import SiteSettingsPanel from "./SiteSettingsPanel";
import IconBackfillPanel from "./IconBackfillPanel";
import DeletionRequestsPanel from "./DeletionRequestsPanel";
import type { AppRow, Profile, ProRequest, UserDeletionRequest } from "@/types/database";

type TabKey = "notifications" | "review" | "allApps" | "users" | "pro" | "tickets" | "suggestions" | "categories" | "deletionRequests" | "settings";

export default function AdminDashboardClient({
  apps,
  allApps,
  profiles,
  proRequests,
  suggestionsPendingCount,
  ticketsNeedingReplyCount,
  deletionRequests,
  requireEmailVerification,
  currentProfile
}: {
  apps: AppRow[];
  allApps: AppRow[];
  profiles: Profile[];
  proRequests: ProRequest[];
  suggestionsPendingCount: number;
  ticketsNeedingReplyCount: number;
  deletionRequests: UserDeletionRequest[];
  requireEmailVerification: boolean;
  currentProfile: Profile;
}) {
  const [tab, setTab] = useState<TabKey>("notifications");

  const notificationCount =
    apps.length + proRequests.length + suggestionsPendingCount + ticketsNeedingReplyCount + deletionRequests.length;

  const tabs = [
    { key: "notifications", label: `התראות${notificationCount ? ` (${notificationCount})` : ""}`, icon: BellRing },
    { key: "review", label: `בדיקת פרסום (${apps.length})`, icon: ClipboardList },
    { key: "allApps", label: `כל האפליקציות (${allApps.length})`, icon: LayoutGrid },
    { key: "pro", label: `בקשות PRO (${proRequests.length})`, icon: Crown },
    { key: "suggestions", label: "הצעות אפליקציות", icon: Gift },
    { key: "tickets", label: "הודעות", icon: MessageCircle },
    { key: "categories", label: "קטגוריות", icon: Tag },
    { key: "users", label: "ניהול משתמשים", icon: Users },
    { key: "deletionRequests", label: `בקשות מחיקת משתמשים (${deletionRequests.length})`, icon: ShieldAlert },
    { key: "settings", label: "הגדרות", icon: Settings }
  ] as const;

  const notificationItems = [
    { key: "review", label: "אפליקציות ממתינות לבדיקה", description: "אפליקציות חדשות שממתינות לאישור/דחייה שלך", count: apps.length, icon: ClipboardList },
    { key: "pro", label: "בקשות PRO ממתינות", description: "מפתחים שביקשו שדרוג לחשבון PRO", count: proRequests.length, icon: Crown },
    { key: "suggestions", label: "הצעות אפליקציות ממתינות", description: "משתמשים שהציעו אפליקציה להוספה למאגר", count: suggestionsPendingCount, icon: Gift },
    { key: "tickets", label: "הודעות ממתינות למענה", description: "הודעות שמשתמשים כתבו ועדיין לא קיבלו תגובה", count: ticketsNeedingReplyCount, icon: MessageCircle },
    { key: "deletionRequests", label: "בקשות מחיקת משתמשים מצוות פיקוח", description: "בקשות מחיקה שהגיש צוות הפיקוח וממתינות לאישורך", count: deletionRequests.length, icon: ShieldAlert }
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
      {tab === "review" && <ReviewQueue apps={apps} canDelete={true} />}
      {tab === "allApps" && (
        <div className="flex flex-col gap-4">
          <IconBackfillPanel />
          <ReviewQueue apps={allApps} canDelete={true} emptyMessage="אין אפליקציות באתר עדיין." />
        </div>
      )}
      {tab === "pro" && <ProRequestsQueue requests={proRequests} />}
      {tab === "suggestions" && <SuggestionsQueue />}
      {tab === "tickets" && <TicketsPanel currentProfile={currentProfile} profiles={profiles} />}
      {tab === "categories" && <CategoriesManager />}
      {tab === "users" && <UserManagementTable profiles={profiles} isAdmin={true} />}
      {tab === "deletionRequests" && <DeletionRequestsPanel requests={deletionRequests} />}
      {tab === "settings" && <SiteSettingsPanel requireEmailVerification={requireEmailVerification} />}
    </div>
  );
}

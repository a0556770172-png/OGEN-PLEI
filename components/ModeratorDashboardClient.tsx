"use client";
import { useEffect, useState } from "react";
import { ClipboardList, MessageCircle, Gift, BellRing, Tag, Users, LayoutGrid, Siren, Flag, HardDrive, MessageSquareWarning, ScrollText } from "lucide-react";
import ReviewQueue from "./ReviewQueue";
import TicketsPanel from "./TicketsPanel";
import SuggestionsQueue from "./SuggestionsQueue";
import NotificationsPanel from "./NotificationsPanel";
import CategoriesManager from "./CategoriesManager";
import UserManagementTable from "./UserManagementTable";
import IconBackfillPanel from "./IconBackfillPanel";
import CouncilPanel from "./CouncilPanel";
import AppReportsQueue from "./AppReportsQueue";
import SizeOverridePanel from "./SizeOverridePanel";
import BanAppealsPanel from "./BanAppealsPanel";
import SiteRulesEditorPanel from "./SiteRulesEditorPanel";
import type { AppRow, Profile, BanAppeal } from "@/types/database";

type TabKey = "notifications" | "review" | "allApps" | "tickets" | "suggestions" | "categories" | "users" | "council" | "reports" | "sizeOverrides" | "banAppeals" | "siteRules";

export default function ModeratorDashboardClient({
  apps,
  allApps,
  suggestionsPendingCount,
  ticketsNeedingReplyCount,
  profiles,
  currentProfile,
  banAppeals
}: {
  apps: AppRow[];
  allApps: AppRow[];
  suggestionsPendingCount: number;
  ticketsNeedingReplyCount: number;
  profiles: Profile[];
  currentProfile: Profile;
  banAppeals: BanAppeal[];
}) {
  const [tab, setTab] = useState<TabKey>("notifications");

  // תמיכה בקישור ישיר לטאב מסוים (למשל ?tab=tickets) - ראו הסבר זהה ב-AdminDashboardClient.tsx.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wanted = params.get("tab") as TabKey | null;
    if (wanted && ["tickets", "council"].includes(wanted)) setTab(wanted);
  }, []);

  const pendingBanAppealsCount = banAppeals.filter((a) => a.status === "pending").length;
  const notificationCount = apps.length + suggestionsPendingCount + ticketsNeedingReplyCount + pendingBanAppealsCount;

  const tabs = [
    { key: "notifications", label: `התראות${notificationCount ? ` (${notificationCount})` : ""}`, icon: BellRing },
    { key: "review", label: `בדיקת פרסום (${apps.length})`, icon: ClipboardList },
    { key: "allApps", label: `כל האפליקציות (${allApps.length})`, icon: LayoutGrid },
    { key: "suggestions", label: "הצעות אפליקציות", icon: Gift },
    { key: "tickets", label: "הודעות", icon: MessageCircle },
    { key: "categories", label: "קטגוריות", icon: Tag },
    { key: "users", label: "ניהול משתמשים", icon: Users },
    { key: "council", label: "ועדה", icon: Siren },
    { key: "reports", label: "דיווחים על אפליקציות", icon: Flag },
    { key: "sizeOverrides", label: "הרשאות גודל", icon: HardDrive },
    { key: "banAppeals", label: `ערעורי חסימה${pendingBanAppealsCount ? ` (${pendingBanAppealsCount})` : ""}`, icon: MessageSquareWarning },
    { key: "siteRules", label: "חוקי האתר", icon: ScrollText }
  ] as const;

  const notificationItems = [
    { key: "review", label: "אפליקציות ממתינות לבדיקה", description: "אפליקציות חדשות שממתינות לאישור/דחייה שלך", count: apps.length, icon: ClipboardList },
    { key: "suggestions", label: "הצעות אפליקציות ממתינות", description: "משתמשים שהציעו אפליקציה להוספה למאגר", count: suggestionsPendingCount, icon: Gift },
    { key: "tickets", label: "הודעות ממתינות למענה", description: "הודעות שמשתמשים כתבו ועדיין לא קיבלו תגובה", count: ticketsNeedingReplyCount, icon: MessageCircle },
    { key: "banAppeals", label: "ערעורי חסימה ממתינים", description: "משתמשים חסומים שכתבו ערעור וממתינים לתגובת צוות", count: pendingBanAppealsCount, icon: MessageSquareWarning }
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
              tab === t.key ? "bg-primary text-[#fff] shadow-glow" : "bg-surface2 text-gray-400 hover:text-white"
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "notifications" && <NotificationsPanel items={notificationItems} onNavigate={(key) => setTab(key as TabKey)} />}
      {/* צוות פיקוח יכול גם למחוק אפליקציות, לא רק לאשר/לדחות */}
      {tab === "review" && <ReviewQueue apps={apps} canDelete={true} />}
      {tab === "allApps" && (
        <div className="flex flex-col gap-4">
          <IconBackfillPanel />
          {/* גם כפילויות של אפליקציות שכבר אושרו - לפי שיקול דעת הצוות */}
          <ReviewQueue apps={allApps} canDelete={true} emptyMessage="אין אפליקציות באתר עדיין." />
        </div>
      )}
      {tab === "suggestions" && <SuggestionsQueue />}
      {tab === "tickets" && <TicketsPanel currentProfile={currentProfile} profiles={profiles} />}
      {tab === "categories" && <CategoriesManager />}
      {tab === "users" && <UserManagementTable profiles={profiles} />}
      {tab === "council" && <CouncilPanel currentProfile={currentProfile} />}
      {tab === "reports" && <AppReportsQueue />}
      {tab === "sizeOverrides" && <SizeOverridePanel profiles={profiles} isAdmin={false} />}
      {tab === "banAppeals" && <BanAppealsPanel appeals={banAppeals} />}
      {tab === "siteRules" && <SiteRulesEditorPanel isAdmin={false} />}
    </div>
  );
}

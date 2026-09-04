"use client";
import { useEffect, useState } from "react";
import { ClipboardList, Users, Crown, MessageCircle, Gift, Tag, LayoutGrid, BellRing, Settings, ShieldAlert, Siren, History, Flag, HardDrive, MessageSquareWarning, ScrollText, Share2, Archive, Bot, Star } from "lucide-react";
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
import CouncilPanel from "./CouncilPanel";
import AuditLogPanel from "./AuditLogPanel";
import AppReportsQueue from "./AppReportsQueue";
import SizeOverridePanel from "./SizeOverridePanel";
import BanAppealsPanel from "./BanAppealsPanel";
import SiteRulesEditorPanel from "./SiteRulesEditorPanel";
import ReferralsPanel from "./ReferralsPanel";
import BotConfigPanel from "./BotConfigPanel";
import SiteReviewsPanel from "./SiteReviewsPanel";
import type { AppRow, Profile, ProRequest, UserDeletionRequest, BanAppeal, ReferralEvent } from "@/types/database";
import type { SiteReviewRow } from "@/lib/siteReviews";

type TabKey = "notifications" | "review" | "allApps" | "archive" | "users" | "pro" | "tickets" | "suggestions" | "categories" | "deletionRequests" | "council" | "auditLog" | "reports" | "sizeOverrides" | "banAppeals" | "referrals" | "siteReviews" | "bot" | "siteRules" | "settings";

export default function AdminDashboardClient({
  apps,
  allApps,
  profiles,
  proRequests,
  suggestionsPendingCount,
  ticketsNeedingReplyCount,
  deletionRequests,
  councilAutoApprovedCount,
  requireEmailVerification,
  currentProfile,
  banAppeals,
  referralEvents,
  siteReviews
}: {
  apps: AppRow[];
  allApps: AppRow[];
  profiles: Profile[];
  proRequests: ProRequest[];
  suggestionsPendingCount: number;
  ticketsNeedingReplyCount: number;
  deletionRequests: UserDeletionRequest[];
  councilAutoApprovedCount: number;
  requireEmailVerification: boolean;
  currentProfile: Profile;
  banAppeals: BanAppeal[];
  referralEvents: ReferralEvent[];
  siteReviews: SiteReviewRow[];
}) {
  const [tab, setTab] = useState<TabKey>("notifications");

  // תמיכה בקישור ישיר לטאב מסוים (למשל ?tab=tickets) - משמש את פעמון ההתראות בניווט
  // (components/NotificationBell.tsx) כדי לפתוח ישר את הטאב הרלוונטי, במקום שהמנהל/פיקוח
  // יצטרך לחפש אותו ידנית אחרי שהוא לוחץ על התראה.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wanted = params.get("tab") as TabKey | null;
    if (wanted && ["tickets", "council"].includes(wanted)) setTab(wanted);
  }, []);

  const pendingBanAppealsCount = banAppeals.filter((a) => a.status === "pending").length;
  // ארכיון (פיצ'ר 6): כל האפליקציות שהוסרו מהתצוגה הציבורית (status = archived), בלשונית נפרדת.
  const archivedApps = allApps.filter((a) => a.status === "archived");
  const activeApps = allApps.filter((a) => a.status !== "archived");

  const notificationCount =
    apps.length + proRequests.length + suggestionsPendingCount + ticketsNeedingReplyCount + deletionRequests.length + councilAutoApprovedCount + pendingBanAppealsCount;

  const tabs = [
    { key: "notifications", label: `התראות${notificationCount ? ` (${notificationCount})` : ""}`, icon: BellRing },
    { key: "review", label: `בדיקת פרסום (${apps.length})`, icon: ClipboardList },
    { key: "allApps", label: `כל האפליקציות (${activeApps.length})`, icon: LayoutGrid },
    { key: "archive", label: `ארכיון (${archivedApps.length})`, icon: Archive },
    { key: "pro", label: `בקשות PRO (${proRequests.length})`, icon: Crown },
    { key: "suggestions", label: "הצעות אפליקציות", icon: Gift },
    { key: "tickets", label: "הודעות", icon: MessageCircle },
    { key: "categories", label: "קטגוריות", icon: Tag },
    { key: "users", label: "ניהול משתמשים", icon: Users },
    { key: "deletionRequests", label: `בקשות מחיקת משתמשים (${deletionRequests.length})`, icon: ShieldAlert },
    { key: "council", label: "ועדה", icon: Siren },
    { key: "auditLog", label: "מעקב פיקוח", icon: History },
    { key: "reports", label: "דיווחים על אפליקציות", icon: Flag },
    { key: "sizeOverrides", label: "הרשאות גודל", icon: HardDrive },
    { key: "banAppeals", label: `ערעורי חסימה${pendingBanAppealsCount ? ` (${pendingBanAppealsCount})` : ""}`, icon: MessageSquareWarning },
    { key: "referrals", label: "הפניות", icon: Share2 },
    { key: "siteReviews", label: "ביקורות על האתר", icon: Star },
    { key: "bot", label: "צ'אט-בוט", icon: Bot },
    { key: "siteRules", label: "חוקי האתר", icon: ScrollText },
    { key: "settings", label: "הגדרות", icon: Settings }
  ] as const;

  const notificationItems = [
    { key: "review", label: "אפליקציות ממתינות לבדיקה", description: "אפליקציות חדשות שממתינות לאישור/דחייה שלך", count: apps.length, icon: ClipboardList },
    { key: "pro", label: "בקשות PRO ממתינות", description: "מפתחים שביקשו שדרוג לחשבון PRO", count: proRequests.length, icon: Crown },
    { key: "suggestions", label: "הצעות אפליקציות ממתינות", description: "משתמשים שהציעו אפליקציה להוספה למאגר", count: suggestionsPendingCount, icon: Gift },
    { key: "tickets", label: "הודעות ממתינות למענה", description: "הודעות שמשתמשים כתבו ועדיין לא קיבלו תגובה", count: ticketsNeedingReplyCount, icon: MessageCircle },
    { key: "deletionRequests", label: "בקשות מחיקת משתמשים מצוות פיקוח", description: "בקשות מחיקה שהגיש צוות הפיקוח וממתינות לאישורך", count: deletionRequests.length, icon: ShieldAlert },
    { key: "council", label: "ועדות שנפתחו אוטומטית ע\"י הצוות", description: "שני חברי צוות ביקשו לפתוח ועדה תוך 24 שעות - דורש תשומת לבך", count: councilAutoApprovedCount, icon: Siren },
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
      {tab === "review" && <ReviewQueue apps={apps} canDelete={true} />}
      {tab === "allApps" && (
        <div className="flex flex-col gap-4">
          <IconBackfillPanel />
          <ReviewQueue apps={activeApps} canDelete={true} isAdmin={true} emptyMessage="אין אפליקציות באתר עדיין." />
        </div>
      )}
      {tab === "archive" && (
        <ReviewQueue apps={archivedApps} canDelete={true} isAdmin={true} emptyMessage="אין אפליקציות בארכיון. אפליקציות שתעביר ל'בנתיים' יופיעו כאן." />
      )}
      {tab === "pro" && <ProRequestsQueue requests={proRequests} />}
      {tab === "suggestions" && <SuggestionsQueue />}
      {tab === "tickets" && <TicketsPanel currentProfile={currentProfile} profiles={profiles} />}
      {tab === "categories" && <CategoriesManager />}
      {tab === "users" && <UserManagementTable profiles={profiles} isAdmin={true} />}
      {tab === "deletionRequests" && <DeletionRequestsPanel requests={deletionRequests} />}
      {tab === "council" && <CouncilPanel currentProfile={currentProfile} />}
      {tab === "auditLog" && <AuditLogPanel />}
      {tab === "reports" && <AppReportsQueue />}
      {tab === "sizeOverrides" && <SizeOverridePanel profiles={profiles} isAdmin={true} />}
      {tab === "banAppeals" && <BanAppealsPanel appeals={banAppeals} />}
      {tab === "referrals" && <ReferralsPanel events={referralEvents} />}
      {tab === "siteReviews" && <SiteReviewsPanel reviews={siteReviews} />}
      {tab === "bot" && <BotConfigPanel />}
      {tab === "siteRules" && <SiteRulesEditorPanel isAdmin={true} />}
      {tab === "settings" && <SiteSettingsPanel requireEmailVerification={requireEmailVerification} />}
    </div>
  );
}

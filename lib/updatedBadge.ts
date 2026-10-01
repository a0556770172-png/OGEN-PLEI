// תווית "עודכן" - מוצגת על אפליקציה כמה ימים אחרי שאושרה לה גרסה חדשה (apps.last_updated_at,
// נקבע באישור גרסה ב-lib/versionProposals.ts).
export const UPDATED_BADGE_DAYS = 7;

export function isRecentlyUpdated(lastUpdatedAt: string | null | undefined): boolean {
  if (!lastUpdatedAt) return false;
  return Date.now() - new Date(lastUpdatedAt).getTime() < UPDATED_BADGE_DAYS * 24 * 60 * 60 * 1000;
}

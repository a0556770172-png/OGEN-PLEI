-- מתי המשתמש קרא ואישר את "חוקי האתר" (חוקי עוגן פליי, ראו app/site-rules/page.tsx) - שער
-- חובה חד-פעמי שקופץ לכל חשבון (רשום או שנרשם עכשיו) עד שהוא מאשר, ראו
-- components/SiteRulesGate.tsx ו-app/api/site-rules/accept/route.ts.
alter table public.profiles add column if not exists site_rules_accepted_at timestamptz;

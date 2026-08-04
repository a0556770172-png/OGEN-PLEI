import { DEFAULT_SITE_RULES_HTML } from "@/lib/siteRulesDefault";

// תוכן "חוקי האתר" המשותף - מוצג גם בשער החובה החד-פעמי (SiteRulesGate.tsx) וגם בעמוד
// הקבוע /site-rules. אם הצוות (מנהל/פיקוח) ערך גרסה מותאמת דרך SiteRulesEditorPanel.tsx,
// היא נשמרת ב-site_settings.site_rules_html ומוצגת כאן; אחרת מוצגת ברירת המחדל הקבועה.
export default function SiteRulesContent({ html }: { html?: string | null }) {
  return (
    <div
      className="rich-content"
      dangerouslySetInnerHTML={{ __html: html && html.trim() ? html : DEFAULT_SITE_RULES_HTML }}
    />
  );
}

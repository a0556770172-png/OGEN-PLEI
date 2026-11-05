// קטע קצר מהודעה לתצוגה מקדימה, בלי שורות הציטוט (שורות שמתחילות ב-">")
export function forumSnippet(body: string, max = 110): string {
  return body
    .split("\n")
    .filter((l) => !l.startsWith(">"))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

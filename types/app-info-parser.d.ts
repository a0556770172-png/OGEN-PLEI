// הצהרת טיפוסים מינימלית ל-app-info-parser (אין לו טיפוסים משלו).
// משמש גם בשרת (lib/extractIcon.ts) וגם בלקוח (lib/apkManifest.ts).
declare module "app-info-parser" {
  export default class AppInfoParser {
    constructor(file: string | File | Blob | ArrayBuffer | Uint8Array);
    parse(): Promise<Record<string, any>>;
  }
}

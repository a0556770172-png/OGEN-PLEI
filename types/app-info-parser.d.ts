// הצהרת טיפוסים מינימלית ל-app-info-parser (אין לו טיפוסים משלו). משמש בשרת (lib/extractIcon.ts).
declare module "app-info-parser" {
  export default class AppInfoParser {
    constructor(file: string | File | Blob | ArrayBuffer | Uint8Array);
    parse(): Promise<Record<string, any>>;
  }
}

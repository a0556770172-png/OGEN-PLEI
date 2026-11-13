import dns from "dns";
import http from "http";
import https from "https";
import net from "net";

// בקשות HTTP יוצאות לכתובות שהמשתמש סיפק, עם הגנת SSRF אמיתית: בדיקת כתובת ה-IP נעשית ברגע החיבור עצמו
// (בתוך ה-lookup של ה-socket), ולא בבדיקה נפרדת מראש. כך אי אפשר לעקוף עם DNS rebinding - דומיין שמחזיר בהתחלה
// כתובת ציבורית ומיד אחרי זה 127.0.0.1 / 169.254.169.254 (שירות המטא-דאטה של Oracle).

export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 || a === 127 || a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    if (l === "::1" || l === "::") return true;
    if (l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80")) return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(l);
    if (mapped) return isPrivateIp(mapped[1]);
    return false;
  }
  return true;
}

export class UnsafeAddressError extends Error {
  constructor() {
    super("כתובת לא מורשית");
  }
}

function safeLookup(hostname: string, options: any, cb: any) {
  dns.lookup(hostname, { ...(options || {}), all: true }, (err: any, addrs: any) => {
    if (err) return cb(err);
    const list: { address: string; family: number }[] = Array.isArray(addrs) ? addrs : [{ address: addrs, family: 4 }];
    if (!list.length || list.some((a) => isPrivateIp(a.address))) return cb(new UnsafeAddressError());
    if (options && options.all) return cb(null, list);
    return cb(null, list[0].address, list[0].family);
  });
}

export interface SafeResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}

export function safeGet(url: URL, opts: { timeoutMs: number; maxBytes: number; headers?: Record<string, string> }): Promise<SafeResponse> {
  return new Promise((resolve, reject) => {
    const mod = url.protocol === "https:" ? https : http;
    const req = mod.request(url, { method: "GET", headers: opts.headers, lookup: safeLookup as any, timeout: opts.timeoutMs }, (res) => {
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (c: Buffer) => {
        size += c.length;
        if (size > opts.maxBytes) {
          req.destroy();
          reject(Object.assign(new Error("TOO_LARGE"), { code: "TOO_LARGE" }));
          return;
        }
        chunks.push(c);
      });
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("TIMEOUT")));
    req.on("error", reject);
    req.end();
  });
}

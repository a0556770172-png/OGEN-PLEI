import { createHmac, createHash } from "crypto";

// ============================================================
// לקוח R2 מינימלי, ללא תלות ב-AWS SDK.
// יוצר Presigned URLs חתומים ב-AWS Signature V4 (תואם S3 / Cloudflare R2)
// באמצעות מודול ה-crypto המובנה של Node בלבד.
// ============================================================

export const BUCKETS = {
  assets: process.env.R2_BUCKET_ASSETS!,
  apps: process.env.R2_BUCKET_APPS!,
  uploads: process.env.R2_BUCKET_UPLOADS!
};

function getHost() {
  const endpoint = process.env.R2_ENDPOINT!;
  return endpoint.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256Hex(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

// קידוד URI מחמיר לפי דרישות AWS (encodeURIComponent אינו מספיק - צריך גם לקודד ! ' ( ) *)
function rfc3986Encode(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

function encodeS3Key(key: string): string {
  return key.split("/").map(rfc3986Encode).join("/");
}

function getSigningKey(secretAccessKey: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmac("AWS4" + secretAccessKey, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

function toAmzDate(date: Date): string {
  return date.toISOString().replace(/[:-]/g, "").replace(/\.\d{3}Z$/, "Z");
}

interface PresignOptions {
  method: "GET" | "PUT" | "DELETE";
  bucket: string;
  key: string;
  expiresIn?: number;
  extraQuery?: Record<string, string>;
}

function presignR2Url({ method, bucket, key, expiresIn = 300, extraQuery = {} }: PresignOptions): string {
  const accountId = process.env.R2_ACCOUNT_ID!;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID!;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY!;
  const region = "auto";
  const service = "s3";
  const host = getHost() || `${accountId}.r2.cloudflarestorage.com`;

  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const canonicalUri = `/${bucket}/${encodeS3Key(key)}`;

  const queryParams: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresIn),
    "X-Amz-SignedHeaders": "host",
    ...extraQuery
  };

  const sortedKeys = Object.keys(queryParams).sort();
  const canonicalQueryString = sortedKeys.map((k) => `${rfc3986Encode(k)}=${rfc3986Encode(queryParams[k])}`).join("&");

  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = "host";
  const payloadHash = "UNSIGNED-PAYLOAD";

  const canonicalRequest = [method, canonicalUri, canonicalQueryString, canonicalHeaders, signedHeaders, payloadHash].join("\n");

  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");

  const signingKey = getSigningKey(secretAccessKey, dateStamp, region, service);
  const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");

  return `https://${host}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}

export async function createUploadUrl(bucket: string, key: string, _contentType: string, expiresIn = 600): Promise<string> {
  return presignR2Url({ method: "PUT", bucket, key, expiresIn });
}

export async function createDownloadUrl(bucket: string, key: string, filename?: string, expiresIn = 300): Promise<string> {
  const extraQuery: Record<string, string> = {};
  if (filename) {
    extraQuery["response-content-disposition"] = `attachment; filename="${filename.replace(/["]/g, "")}"`;
  }
  return presignR2Url({ method: "GET", bucket, key, expiresIn, extraQuery });
}

export async function deleteObject(bucket: string, key: string): Promise<void> {
  const url = presignR2Url({ method: "DELETE", bucket, key, expiresIn: 60 });
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    throw new Error(`R2 delete failed: ${res.status}`);
  }
}

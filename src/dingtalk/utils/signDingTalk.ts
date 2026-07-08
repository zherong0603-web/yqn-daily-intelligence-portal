import { createHmac } from "node:crypto";

export function signDingTalkUrl(webhookUrl: string, secret?: string, now = Date.now()): string {
  if (!secret) return webhookUrl;
  const timestamp = String(now);
  const stringToSign = `${timestamp}\n${secret}`;
  const sign = createHmac("sha256", secret).update(stringToSign).digest("base64");
  const url = new URL(webhookUrl);
  url.searchParams.set("timestamp", timestamp);
  url.searchParams.set("sign", sign);
  return url.toString();
}

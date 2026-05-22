// Webhook signature verification for partners receiving events
// from the Seamless platform.
//
// Header format: `Seamless-Signature: t=<unix>,v1=<hex>` where v1
// is HMAC-SHA256(`${t}.${rawBody}`, signingSecret). Replay window
// defaults to 5 minutes.
//
// Usage:
//
//   import { Webhooks } from "@seamless/node";
//
//   app.post("/webhooks/seamless", express.raw({type:"application/json"}), (req, res) => {
//     try {
//       const event = Webhooks.constructEvent(
//         req.body,                          // Buffer (raw)
//         req.headers["seamless-signature"], // string
//         process.env.SEAMLESS_WEBHOOK_SECRET,
//       );
//       // ... handle event.type ...
//       res.status(200).end();
//     } catch (err) {
//       res.status(400).send("signature_invalid");
//     }
//   });

import { createHmac, timingSafeEqual } from "node:crypto";

export const DEFAULT_REPLAY_WINDOW_SECONDS = 5 * 60;

export interface SeamlessEvent<T = unknown> {
  id: string;
  type: string;
  created: string;
  delivery_attempt: number;
  data: T;
}

export class WebhookSignatureError extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(`Seamless webhook signature: ${reason}`);
    this.name = "WebhookSignatureError";
    this.reason = reason;
  }
}

const parseHeader = (header: string | undefined | null): { t: number; v1: string } | null => {
  if (!header || typeof header !== "string") return null;
  const parts: Record<string, string> = {};
  for (const kv of header.split(",")) {
    const eq = kv.indexOf("=");
    if (eq < 0) continue;
    parts[kv.slice(0, eq).trim()] = kv.slice(eq + 1).trim();
  }
  const t = Number(parts.t);
  const v1 = parts.v1 || "";
  if (!Number.isFinite(t) || !/^[0-9a-f]{64}$/i.test(v1)) return null;
  return { t, v1 };
};

const toRawBody = (body: string | Buffer): string => {
  if (typeof body === "string") return body;
  if (Buffer.isBuffer(body)) return body.toString("utf8");
  throw new WebhookSignatureError("body_not_raw");
};

export interface VerifyOptions {
  replayWindowSeconds?: number;
}

export const verify = (
  rawBody: string | Buffer,
  signatureHeader: string | undefined | null,
  signingSecret: string,
  opts: VerifyOptions = {},
): true => {
  const replayWindow = opts.replayWindowSeconds ?? DEFAULT_REPLAY_WINDOW_SECONDS;
  const parsed = parseHeader(signatureHeader);
  if (!parsed) throw new WebhookSignatureError("malformed_header");
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parsed.t) > replayWindow) {
    throw new WebhookSignatureError("stale_or_future");
  }
  const body = toRawBody(rawBody);
  const expected = createHmac("sha256", signingSecret)
    .update(`${parsed.t}.${body}`)
    .digest("hex");
  const a = Buffer.from(parsed.v1, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new WebhookSignatureError("bad_signature");
  }
  return true;
};

export const constructEvent = <T = unknown>(
  rawBody: string | Buffer,
  signatureHeader: string | undefined | null,
  signingSecret: string,
  opts: VerifyOptions = {},
): SeamlessEvent<T> => {
  verify(rawBody, signatureHeader, signingSecret, opts);
  const body = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
  return JSON.parse(body) as SeamlessEvent<T>;
};

export const Webhooks = { verify, constructEvent, WebhookSignatureError };

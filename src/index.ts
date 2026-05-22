// `@seamless/node` — official Node SDK for the Seamless Partner API.
//
// Quickstart:
//
//   import { Seamless } from "@seamless/node";
//   const seamless = new Seamless({ apiKey: process.env.SEAMLESS_API_KEY! });
//
//   const me = await seamless.identity.me();
//   const spain = await seamless.catalog.getCountry("spain");
//   const order = await seamless.orders.create({
//     lines: [{ package_detail_id: spain.packages[0]!.package_detail_id }],
//     payment_mode: "partner_wallet",
//   });
//
// Webhook verification:
//
//   import { Webhooks } from "@seamless/node";
//   const event = Webhooks.constructEvent(rawBody, signatureHeader, secret);

export { Seamless } from "./client.js";
export { SeamlessError } from "./errors.js";
export {
  Webhooks,
  verify as verifyWebhook,
  constructEvent as constructWebhookEvent,
  WebhookSignatureError,
  DEFAULT_REPLAY_WINDOW_SECONDS,
  type SeamlessEvent,
} from "./webhooks.js";
export type { ClientOptions } from "./http.js";
export type * from "./types.js";

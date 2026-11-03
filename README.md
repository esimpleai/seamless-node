# @withseamless/node

Official Node.js SDK for the [Seamless Partner API](https://docs.withseamless.com).

Sell eSIMs powered by the Seamless platform from your travel app, fintech, publication,
or MVNO. Catalog → quote → order → activate → top-up → refund, all behind one bearer key.

## Install

```bash
npm install @withseamless/node
```

Requires Node 18+ (uses the global `fetch`).

## Authenticate

```ts
import { Seamless } from "@withseamless/node";

const seamless = new Seamless({
  apiKey: process.env.SEAMLESS_API_KEY!,  // sk_test_… or sk_live_…
});
```

The key prefix decides whether you hit the sandbox (`sk_test_`) or production
(`sk_live_`, real plans + real wallet charges). See [Sandbox](#sandbox).

## Quickstart — issue an eSIM

```ts
// Browse real plans and prices — works with a sandbox key.
const japan = await seamless.catalog.getCountry("japan");
console.log(`Japan: ${japan.package_count} plans from $${japan.starts_at_usd}`);

// A sandbox key orders the free Sandbox SKU; a live key orders any plan.
const { packages: [plan] } = await seamless.catalog.getCountry("sandbox");
let order = await seamless.orders.create({
  lines: [{ package_detail_id: plan!.package_detail_id }],
  payment_mode: "partner_wallet",
  customer: { email: "traveller@example.com" },
});

// eSIMs are issued asynchronously, usually within seconds.
// Poll as below, or listen for the order.provisioned webhook.
while (order.lines[0]!.sims[0]!.status === "pending") {
  await new Promise((r) => setTimeout(r, 2000));
  order = await seamless.orders.retrieve(order.id);
}

const sim     = order.lines[0]!.sims[0]!;
const install = await seamless.esims.installLink(sim.iccid!);
console.log(`Apple one-tap:   ${install.apple_url}`);
console.log(`Android one-tap: ${install.android_url}`);
```

To lock a price you showed the customer, quote first and pass the token back:

```ts
const quote = await seamless.pricing.quote(packageDetailId, 1);   // valid 15 minutes
await seamless.orders.create({
  lines: [{ package_detail_id: packageDetailId, price_quote_token: quote.token ?? undefined }],
  payment_mode: "partner_wallet",
});
```

Plans: `data_mb` is binary (1 GB = 1024 MB). `kind` is `"fixed"` (data for the
whole validity), `"daily"` (`data_mb` resets every day) or `"unlimited"`.

## Resources

| Resource            | Methods |
|---------------------|---------|
| `seamless.catalog`  | `listCountries`, `getCountry`, `listRegions`, `getRegion`, `listGlobalPackages`, `search`, `coverage` |
| `seamless.pricing`  | `quote`, `quoteCart` |
| `seamless.orders`   | `create`, `retrieve`, `list`, `lines`, `cancel`, `resendActivation`, `listRefunds`, `createRefund` |
| `seamless.esims`    | `retrieve`, `activation`, `usage`, `installLink` |
| `seamless.topups`   | `listAvailable`, `list`, `create` |
| `seamless.refunds`  | `retrieve` |
| `seamless.wallet`   | `retrieve`, `topup`, `listTransactions`, `retrieveTransaction` |
| `seamless.sandbox`  | `reset` (sandbox key only) |
| `seamless.identity` | `me` |
| `seamless.health`   | `status`, `version` |

## Idempotency

Every mutating method auto-injects an `Idempotency-Key` header (RFC 4122 v4 UUID).
Pass your own if you want a retry-safe write under your control:

```ts
await seamless.orders.create(body, { idempotencyKey: "order-1234" });
```

Same key + same body within 24h → cached response replay. Same key + different
body → `409 idempotency_mismatch`.

## Errors

```ts
import { SeamlessError } from "@withseamless/node";

try {
  await seamless.orders.create({ /* ... */ });
} catch (err) {
  if (err instanceof SeamlessError) {
    console.error(err.code, err.message, err.requestId);
    if (err.code === "insufficient_partner_balance") {
      // top up wallet, retry
    }
  }
}
```

`SeamlessError` exposes: `status`, `type`, `code`, `param`, `requestId`, `docUrl`, `body`.

## Webhook signatures

Verify incoming events with the same primitive the platform uses to sign them:

```ts
import { Webhooks } from "@withseamless/node";

app.post("/webhooks/seamless", express.raw({ type: "application/json" }), (req, res) => {
  try {
    const event = Webhooks.constructEvent(
      req.body,                            // Buffer (raw)
      req.headers["seamless-signature"],   // string
      process.env.SEAMLESS_WEBHOOK_SECRET!,
    );
    switch (event.type) {
      case "order.provisioned": /* eSIM issued — ICCID + activation in the payload */ break;
      case "order.failed":      /* … */ break;
    }
    res.status(200).end();
  } catch (err) {
    res.status(400).send("signature_invalid");
  }
});
```

5-minute replay window enforced; constant-time HMAC compare. Events:
`order.created`, `order.paid`, `order.provisioned`, `order.failed`,
`topup.applied`, `topup.failed`, `wallet.low_balance`, `wallet.topup_received`.
Register endpoints in the partner portal (Webhooks).

## API version pinning

```ts
const seamless = new Seamless({
  apiKey: process.env.SEAMLESS_API_KEY!,
  apiVersion: "2026-05-22",   // pin to a dated version
});
```

Without `apiVersion`, the API responds in the version your key was issued under.

## Sandbox

A sandbox key (`sk_test_`) sees the real catalogue and real prices, so you can
build your storefront against live data. Orders and top-ups are limited to the
free Sandbox SKU (`seamless.catalog.getCountry("sandbox")`), which issues a test
eSIM within seconds — the whole order → eSIM → install link → top-up → refund
flow runs without money. Ordering any other plan with a sandbox key throws
`non_sandbox_package_for_test_key`.

`sandbox.reset()` cancels sandbox orders that haven't been fulfilled:

```ts
const sandbox = new Seamless({ apiKey: "sk_test_…" });
await sandbox.sandbox.reset();
```

## Spec

The SDK tracks `api-withseamless/openapi.yaml`. Field-level mismatches are bugs —
file an issue.

## License

MIT.

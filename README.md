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

The key prefix decides whether you hit the sandbox (`sk_test_`, real providers
swapped for the Sandbox SKU) or production (`sk_live_`, real providers + real
charges).

## Quickstart — buy an eSIM in 10 lines

```ts
const spain   = await seamless.catalog.getCountry("spain");
const pack    = spain.packages[0]!;
const order   = await seamless.orders.create({
  lines: [{ package_detail_id: pack.package_detail_id }],
  payment_mode: "partner_wallet",
  customer: { email: "traveller@example.com" },
});
const sim     = order.lines[0]!.sims[0]!;
const install = await seamless.esims.installLink(sim.iccid!);

console.log(`Apple one-tap:   ${install.apple_url}`);
console.log(`Android one-tap: ${install.android_url}`);
```

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
      case "order.provisioned": /* … */ break;
      case "order.failed":      /* … */ break;
    }
    res.status(200).end();
  } catch (err) {
    res.status(400).send("signature_invalid");
  }
});
```

5-minute replay window enforced; constant-time HMAC compare.

## API version pinning

```ts
const seamless = new Seamless({
  apiKey: process.env.SEAMLESS_API_KEY!,
  apiVersion: "2026-05-22",   // pin to a dated version
});
```

Without `apiVersion`, the API responds in the version your key was issued under.

## Sandbox

Every endpoint works in sandbox with the same shapes. Catalog includes a `$0`
Sandbox SKU you can use to exercise the full flow without burning real provider
credit. Reset between integration runs:

```ts
const sandbox = new Seamless({ apiKey: "sk_test_…" });
await sandbox.sandbox.reset();
```

## Spec

The SDK tracks `api-withseamless/openapi.yaml`. Field-level mismatches are bugs —
file an issue.

## License

MIT.

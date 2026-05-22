// `Seamless` — the main entrypoint. Construct once per process,
// reuse for every request.
//
//   import { Seamless } from "@withseamless/node";
//   const seamless = new Seamless({ apiKey: process.env.SEAMLESS_API_KEY! });
//   const me = await seamless.identity.me();
//
// Resources are exposed as nested objects (`seamless.orders.create`,
// `seamless.catalog.listCountries`) so IDE autocomplete groups by
// domain.

import { HttpClient, type ClientOptions, type RequestOptions } from "./http.js";
import type * as T from "./types.js";

export class Seamless {
  private readonly http: HttpClient;

  constructor(opts: ClientOptions) {
    this.http = new HttpClient(opts);
    this.catalog = new CatalogResource(this.http);
    this.pricing = new PricingResource(this.http);
    this.orders = new OrdersResource(this.http);
    this.esims = new EsimsResource(this.http);
    this.topups = new TopupsResource(this.http);
    this.refunds = new RefundsResource(this.http);
    this.wallet = new WalletResource(this.http);
    this.sandbox = new SandboxResource(this.http);
    this.identity = new IdentityResource(this.http);
    this.health = new HealthResource(this.http);
  }

  readonly catalog: CatalogResource;
  readonly pricing: PricingResource;
  readonly orders: OrdersResource;
  readonly esims: EsimsResource;
  readonly topups: TopupsResource;
  readonly refunds: RefundsResource;
  readonly wallet: WalletResource;
  readonly sandbox: SandboxResource;
  readonly identity: IdentityResource;
  readonly health: HealthResource;

  get isLiveMode(): boolean {
    return this.http.isLiveMode;
  }
}

class CatalogResource {
  constructor(private readonly http: HttpClient) {}

  listCountries(params: T.ListParams & { include_regional?: boolean } = {}) {
    return this.http.get<T.List<T.Country>>("/catalog/countries", { query: params });
  }
  getCountry(slug: string) {
    return this.http.get<T.CountryWithPackages>(`/catalog/countries/${encodeURIComponent(slug)}`);
  }
  listRegions() {
    return this.http.get<T.List<T.Region>>("/catalog/regions");
  }
  getRegion(slug: string) {
    return this.http.get<T.RegionWithPackages>(`/catalog/regions/${encodeURIComponent(slug)}`);
  }
  listGlobalPackages() {
    return this.http.get<T.List<T.Package & { covered_countries: T.Iso3166Alpha2[] }>>("/catalog/global");
  }
  search(q: string) {
    return this.http.get<T.CatalogSearchResult>("/catalog/search", { query: { q } });
  }
  coverage(countries: T.Iso3166Alpha2[] | string) {
    const countriesParam = Array.isArray(countries) ? countries.join(",") : countries;
    return this.http.get<T.CoverageResult>("/catalog/coverage", { query: { countries: countriesParam } });
  }
}

class PricingResource {
  constructor(private readonly http: HttpClient) {}

  quote(packageDetailId: number, quantity: number = 1) {
    return this.http.get<T.PriceQuote>("/pricing/quote", {
      query: { package_detail_id: packageDetailId, quantity },
    });
  }
  quoteCart(lines: { package_detail_id: number; quantity?: number }[], idempotencyKey?: string) {
    return this.http.post<T.CartQuote>("/pricing/quote-multi", {
      body: { lines },
      idempotencyKey,
    });
  }
}

interface IdemOpt { idempotencyKey?: string }
type ListOrdersParams = T.ListParams & {
  status?: T.OrderStatus;
  created_after?: string;
  created_before?: string;
};

class OrdersResource {
  constructor(private readonly http: HttpClient) {}

  create(body: T.CreateOrderRequest, opts: IdemOpt = {}) {
    return this.http.post<T.Order>("/orders", { body, idempotencyKey: opts.idempotencyKey });
  }
  retrieve(id: string) {
    return this.http.get<T.Order>(`/orders/${encodeURIComponent(id)}`);
  }
  list(params: ListOrdersParams = {}) {
    return this.http.get<T.List<T.Order>>("/orders", { query: params });
  }
  lines(id: string) {
    return this.http.get<T.List<T.OrderLine>>(`/orders/${encodeURIComponent(id)}/lines`);
  }
  resendActivation(id: string, body: { channels?: ("email" | "sms")[] } = {}, opts: IdemOpt = {}) {
    return this.http.post<{ object: "resend_activation"; order_id: string; channels: string[] }>(
      `/orders/${encodeURIComponent(id)}/resend-activation`,
      { body, idempotencyKey: opts.idempotencyKey },
    );
  }
  cancel(id: string, body: { reason?: string } = {}, opts: IdemOpt = {}) {
    return this.http.post<T.Order>(
      `/orders/${encodeURIComponent(id)}/cancel`,
      { body, idempotencyKey: opts.idempotencyKey },
    );
  }
  listRefunds(id: string) {
    return this.http.get<T.List<T.Refund>>(`/orders/${encodeURIComponent(id)}/refunds`);
  }
  createRefund(id: string, body: T.CreateRefundRequest, opts: IdemOpt = {}) {
    return this.http.post<T.Refund>(
      `/orders/${encodeURIComponent(id)}/refunds`,
      { body, idempotencyKey: opts.idempotencyKey },
    );
  }
}

class EsimsResource {
  constructor(private readonly http: HttpClient) {}

  retrieve(iccid: string) {
    return this.http.get<T.Esim>(`/esims/${encodeURIComponent(iccid)}`);
  }
  activation(iccid: string) {
    return this.http.get<T.EsimActivation>(`/esims/${encodeURIComponent(iccid)}/activation`);
  }
  usage(iccid: string) {
    return this.http.get<T.EsimUsage>(`/esims/${encodeURIComponent(iccid)}/usage`);
  }
  installLink(iccid: string, opts: IdemOpt = {}) {
    return this.http.post<T.InstallLink>(
      `/esims/${encodeURIComponent(iccid)}/install-link`,
      { idempotencyKey: opts.idempotencyKey },
    );
  }
}

class TopupsResource {
  constructor(private readonly http: HttpClient) {}

  listAvailable(iccid: string) {
    return this.http.get<{ object: "list"; iccid: string; data: T.AvailableTopup[] }>(
      `/esims/${encodeURIComponent(iccid)}/topups/available`,
    );
  }
  list(iccid: string, params: T.ListParams = {}) {
    return this.http.get<T.List<T.Topup>>(
      `/esims/${encodeURIComponent(iccid)}/topups`,
      { query: params },
    );
  }
  create(iccid: string, body: T.CreateTopupRequest, opts: IdemOpt = {}) {
    return this.http.post<T.Topup>(
      `/esims/${encodeURIComponent(iccid)}/topups`,
      { body, idempotencyKey: opts.idempotencyKey },
    );
  }
}

class RefundsResource {
  constructor(private readonly http: HttpClient) {}

  retrieve(id: string) {
    return this.http.get<T.Refund>(`/refunds/${encodeURIComponent(id)}`);
  }
}

class WalletResource {
  constructor(private readonly http: HttpClient) {}

  retrieve() {
    return this.http.get<T.Wallet>("/wallet");
  }
  topup(body: { amount: number; success_url: string; cancel_url: string }, opts: IdemOpt = {}) {
    return this.http.post<T.WalletTopupSession>("/wallet/topup", {
      body,
      idempotencyKey: opts.idempotencyKey,
    });
  }
  listTransactions(params: T.ListParams & { kind?: "topup" | "order_debit" | "refund_credit" | "adjustment" } = {}) {
    return this.http.get<T.List<T.WalletTransaction>>("/wallet/transactions", { query: params });
  }
  retrieveTransaction(id: string) {
    return this.http.get<T.WalletTransaction>(`/wallet/transactions/${encodeURIComponent(id)}`);
  }
}

class SandboxResource {
  constructor(private readonly http: HttpClient) {}

  reset(opts: IdemOpt = {}) {
    return this.http.post<{
      object: "sandbox_reset";
      reset_at: string;
      wallet_balance: T.AmountUsd;
      cancelled_orders?: number;
      note?: string;
    }>("/sandbox/reset", { idempotencyKey: opts.idempotencyKey });
  }
}

class IdentityResource {
  constructor(private readonly http: HttpClient) {}

  me() {
    return this.http.get<T.ApiKeyContext>("/me");
  }
}

class HealthResource {
  constructor(private readonly http: HttpClient) {}

  status() {
    return this.http.get<{ status: "ok"; version: string; commit: string }>("/health");
  }
  version() {
    return this.http.get<{ current: string; supported: { version: string; sunset_at: string | null }[] }>("/version");
  }
}

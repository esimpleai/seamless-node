// Hand-curated request/response types matching the openapi.yaml
// contract. Kept here (rather than codegen) for ergonomics — Phase 1
// codegen via Fern/Speakeasy may replace this file in Phase 2.
//
// Source of truth: api-withseamless/openapi.yaml. When adding fields,
// land them in the spec first.

export type AmountUsd = string; // decimal string, e.g. "4.50"
export type Iso3166Alpha2 = string;
export type Iso3166Alpha3 = string;

export interface List<T> {
  object: "list";
  data: T[];
  has_more: boolean;
  next_cursor: string | null;
}

// ── Catalog ──────────────────────────────────────────────────────

export interface Country {
  object: "country";
  id: number;
  slug: string;
  name: string;
  iso2: Iso3166Alpha2 | null;
  iso3: Iso3166Alpha3 | null;
  flag_url: string | null;
  package_count: number | null;
  starts_at_usd: AmountUsd | null;
  is_test: boolean;
}

export interface Package {
  object: "package";
  package_detail_id: number;
  name: string;
  data_mb: number | null;
  validity_days: number | null;
  is_unlimited: boolean;
  provider: "keepgo" | "redtea" | "maya" | "sandbox" | "unknown";
  country_iso2: Iso3166Alpha2[];
  price_usd: AmountUsd;
}

export interface CountryWithPackages extends Country {
  packages: Package[];
}

export interface Region {
  object: "region";
  slug: string;
  name: string;
  country_count: number | null;
  starts_at_usd: AmountUsd | null;
}

export interface RegionWithPackages extends Region {
  countries: Country[];
  packages: Package[];
}

export interface CatalogSearchResult {
  object: "search_result";
  countries: Country[];
  regions: Region[];
}

export interface CoverageResult {
  object: "coverage_result";
  countries: Iso3166Alpha2[];
  packages: Package[];
}

// ── Pricing ─────────────────────────────────────────────────────

export interface PriceQuote {
  object: "price_quote";
  token: string;
  package_detail_id: number;
  quantity: number;
  unit_price_usd: AmountUsd;
  line_total_usd: AmountUsd;
  expires_at: string;
}

export interface CartQuote {
  object: "cart_quote";
  lines: PriceQuote[];
  subtotal_usd: AmountUsd;
  total_usd: AmountUsd;
  expires_at: string;
}

// ── Orders ───────────────────────────────────────────────────────

export type PaymentMode = "link" | "partner_wallet" | "bill_later" | "mark_paid_offline";
export type OrderStatus = "pending" | "paid" | "provisioned" | "partially_provisioned" | "failed" | "refunded" | "cancelled";

export interface CreateOrderLine {
  package_detail_id: number;
  quantity?: number;
  price_quote_token?: string;
  recipient_email?: string;
}

export interface CreateOrderRequest {
  partner_reference?: string;
  customer?: { email?: string; full_name?: string; phone_e164?: string };
  lines: CreateOrderLine[];
  payment_mode: PaymentMode;
  link_payment?: { success_url: string; cancel_url: string };
  delivery_channels?: ("email" | "sms" | "none")[];
  metadata?: Record<string, string>;
}

export interface OrderLineSim {
  iccid: string | null;
  status: "pending" | "provisioned" | "failed";
  activation: EsimActivation | null;
}

export interface OrderLine {
  object: "order_line";
  id: string;
  package_detail_id: number;
  package_name: string | null;
  quantity: number;
  unit_price_usd: AmountUsd;
  line_total_usd: AmountUsd;
  sims: OrderLineSim[];
}

export interface Order {
  object: "order";
  id: string;
  ref: string | null;
  livemode: boolean;
  status: OrderStatus;
  payment_mode: string;
  checkout_url: string | null;
  currency: "usd";
  subtotal_usd: AmountUsd;
  total_usd: AmountUsd;
  customer: { email: string | null; full_name: string | null } | null;
  lines: OrderLine[];
  created_at: string;
  paid_at: string | null;
  provisioned_at: string | null;
}

// ── eSIMs ────────────────────────────────────────────────────────

export interface Esim {
  object: "esim";
  iccid: string;
  order_id: string;
  order_line_id: string;
  provider: Package["provider"];
  status: "pending" | "ready" | "active" | "expired" | "suspended" | "failed";
  country_iso2: Iso3166Alpha2[];
  validity_days: number | null;
  data_mb: number | null;
  is_unlimited: boolean;
  activated_at: string | null;
  expires_at: string | null;
}

export interface EsimActivation {
  object: "esim_activation";
  iccid: string;
  sm_dp_address: string;
  activation_code: string;
  lpa_string: string;
  qr_code_url: string | null;
  manual_install: { sm_dp_address: string; activation_code: string };
}

export interface EsimUsage {
  object: "esim_usage";
  iccid: string;
  supported: boolean;
  used_mb: number | null;
  limit_mb: number | null;
  pct_used: number | null;
  is_unlimited: boolean;
  expires_at: string | null;
  fetched_at: string;
}

export interface InstallLink {
  object: "install_link";
  iccid: string;
  apple_url: string;
  android_url: string;
  universal_url: string;
  expires_at: string | null;
}

// ── Top-ups ──────────────────────────────────────────────────────

export interface AvailableTopup {
  object: "available_topup";
  provider_package_code: string;
  name: string | null;
  data_mb: number | null;
  validity_days: number | null;
  is_unlimited: boolean;
  price_usd: AmountUsd;
}

export interface Topup {
  object: "topup";
  id: string;
  iccid: string;
  provider_package_code: string;
  status: "pending" | "paid" | "applied" | "failed";
  amount_usd: AmountUsd;
  data_mb: number | null;
  validity_days: number | null;
  checkout_url: string | null;
  applied_at: string | null;
  created_at: string;
}

export interface CreateTopupRequest {
  provider_package_code: string;
  payment_mode: "partner_wallet" | "link";
  link_payment?: { success_url: string; cancel_url: string };
}

// ── Refunds ──────────────────────────────────────────────────────

export interface CreateRefundRequest {
  amount_usd: AmountUsd | number;
  reason: "requested_by_customer" | "duplicate" | "fraudulent" | "provisioning_failed" | "other";
  notes?: string;
}

export interface Refund {
  object: "refund";
  id: string;
  order_id: string;
  amount_usd: AmountUsd;
  status: "pending" | "succeeded" | "failed" | "cancelled";
  reason: string;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
}

// ── Wallet ───────────────────────────────────────────────────────

export interface Wallet {
  object: "wallet";
  livemode: boolean;
  balance_usd: AmountUsd;
  credit_threshold_usd: AmountUsd;
  headroom_usd: AmountUsd;
  currency: "usd";
  notification_low_balance_threshold_usd: AmountUsd;
}

export interface WalletTopupSession {
  object: "wallet_topup_session";
  id: string;
  url: string;
  amount: AmountUsd;
  expires_at: string | null;
}

export interface WalletTransaction {
  object: "wallet_transaction";
  id: string;
  kind: "topup" | "order_debit" | "refund_credit" | "adjustment";
  amount_usd: AmountUsd;
  balance_after_usd: AmountUsd | null;
  related_order_id: string | null;
  related_refund_id: string | null;
  description: string | null;
  created_at: string;
}

// ── Identity ─────────────────────────────────────────────────────

export interface ApiKeyContext {
  object: "api_key_context";
  partner_id: string;
  partner_name: string | null;
  api_key_id: string;
  livemode: boolean;
  rate_limit_tier: "sandbox" | "starter" | "growth" | "volume";
  scopes: string[];
  api_version: string;
}

// ── Pagination ───────────────────────────────────────────────────

export interface ListParams {
  limit?: number;
  starting_after?: string;
}

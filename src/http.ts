// Low-level HTTP transport for the Seamless SDK. Wraps fetch with:
//   - Bearer auth from the configured API key
//   - Idempotency-Key auto-injection (uuid v4) on mutating methods
//   - Optional Seamless-Version pin
//   - Structured SeamlessError on non-2xx
//   - Network error wrap

import { randomUUID } from "node:crypto";
import { SeamlessError, type SeamlessErrorBody } from "./errors.js";

export interface ClientOptions {
  apiKey: string;
  baseUrl?: string;
  apiVersion?: string;
  timeoutMs?: number;
  fetchImpl?: typeof globalThis.fetch;
  userAgent?: string;
}

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type QueryValue = string | number | boolean | undefined | null;

// `query` accepts any object whose values stringify cleanly; we
// post-filter null/undefined in buildUrl. Loose typing here lets
// resource methods pass their own typed param objects without
// having to add an index signature to every params interface.
export interface RequestOptions {
  query?: object;
  body?: unknown;
  idempotencyKey?: string;
  headers?: Record<string, string>;
}

const MUTATING = new Set<Method>(["POST", "PUT", "PATCH", "DELETE"]);

const buildUrl = (baseUrl: string, path: string, query?: RequestOptions["query"]): string => {
  const base = baseUrl.replace(/\/$/, "");
  const trimmed = path.startsWith("/") ? path : `/${path}`;
  if (!query) return `${base}${trimmed}`;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query as Record<string, unknown>)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "object") continue; // safety net — silently drop non-scalar
    params.append(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${base}${trimmed}?${qs}` : `${base}${trimmed}`;
};

export class HttpClient {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly apiVersion?: string;
  readonly timeoutMs: number;
  readonly userAgent: string;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(opts: ClientOptions) {
    if (!opts.apiKey || typeof opts.apiKey !== "string") {
      throw new TypeError("Seamless: `apiKey` is required (sk_test_* or sk_live_*).");
    }
    if (!/^sk_(test|live)_[a-f0-9]{40,80}$/i.test(opts.apiKey)) {
      throw new TypeError("Seamless: `apiKey` must look like `sk_test_<hex>` or `sk_live_<hex>`.");
    }
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl ?? "https://api.withseamless.com/v1";
    this.apiVersion = opts.apiVersion;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    this.userAgent = opts.userAgent ?? `@withseamless/node/1.0.0`;
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch;
    if (!this.fetchImpl) {
      throw new Error("Seamless: no fetch available — pass `fetchImpl` for environments without global fetch.");
    }
  }

  get isLiveMode(): boolean {
    return this.apiKey.startsWith("sk_live_");
  }

  async request<T>(method: Method, path: string, opts: RequestOptions = {}): Promise<T> {
    const url = buildUrl(this.baseUrl, path, opts.query);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: "application/json",
      "User-Agent": this.userAgent,
      ...opts.headers,
    };
    if (this.apiVersion) {
      headers["Seamless-Version"] = this.apiVersion;
    }
    let body: string | undefined;
    if (opts.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.body);
    }
    if (MUTATING.has(method)) {
      // Idempotency-Key is REQUIRED by the server on every mutating
      // call. Auto-fill with a v4 uuid unless the caller passes
      // their own (recommended for retry-safe writes).
      headers["Idempotency-Key"] = opts.idempotencyKey ?? randomUUID();
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });
    } catch (err) {
      const reason = (err as { name?: string })?.name === "AbortError" ? "timeout" : (err as Error)?.message || String(err);
      throw new SeamlessError(0, {
        type: "network_error",
        code: "network_error",
        message: `Network request failed: ${reason}`,
      });
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text();
    let parsed: unknown = undefined;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { raw: text };
      }
    }
    if (!response.ok) {
      const errBody = (parsed as { error?: SeamlessErrorBody } | null)?.error || null;
      throw new SeamlessError(response.status, errBody, `HTTP ${response.status}`);
    }
    return parsed as T;
  }

  get<T>(path: string, opts: RequestOptions = {}) {
    return this.request<T>("GET", path, opts);
  }
  post<T>(path: string, opts: RequestOptions = {}) {
    return this.request<T>("POST", path, opts);
  }
  patch<T>(path: string, opts: RequestOptions = {}) {
    return this.request<T>("PATCH", path, opts);
  }
  delete<T>(path: string, opts: RequestOptions = {}) {
    return this.request<T>("DELETE", path, opts);
  }
}

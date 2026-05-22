// Error class for Seamless Partner API responses. Mirrors the
// server's error envelope shape ({error: {type, code, message, ...}})
// so partners can `catch (err)` once and branch on `err.code`.

export type SeamlessErrorType =
  | "api_error"
  | "authentication_error"
  | "idempotency_error"
  | "invalid_request_error"
  | "rate_limit_error"
  | "network_error";

export interface SeamlessErrorBody {
  type?: SeamlessErrorType;
  code?: string;
  message?: string;
  param?: string;
  request_id?: string;
  doc_url?: string;
  [k: string]: unknown;
}

export class SeamlessError extends Error {
  readonly type: SeamlessErrorType;
  readonly code: string;
  readonly status: number;
  readonly param?: string;
  readonly requestId?: string;
  readonly docUrl?: string;
  readonly body?: unknown;

  constructor(status: number, body: SeamlessErrorBody | null, fallbackMessage?: string) {
    super(body?.message || fallbackMessage || `Seamless API error ${status}`);
    this.name = "SeamlessError";
    this.status = status;
    this.type = (body?.type as SeamlessErrorType) || "api_error";
    this.code = body?.code || "unknown";
    this.param = body?.param;
    this.requestId = body?.request_id;
    this.docUrl = body?.doc_url;
    this.body = body;
  }
}

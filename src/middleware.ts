import { NextResponse, type NextRequest } from "next/server";

// Per-request Content-Security-Policy. This can't live in next.config.mjs
// because each response needs a fresh nonce; the static headers there (HSTS,
// X-Frame-Options, …) still apply and are unchanged.

/** Plaid Link injects its script and opens its flow in an iframe. */
const PLAID_SCRIPT = "https://cdn.plaid.com";
const PLAID_FRAME = "https://cdn.plaid.com https://*.plaid.com";
const PLAID_CONNECT = "https://*.plaid.com";

function csp(nonce: string, dev: boolean): string {
  const directives = [
    `default-src 'self'`,
    // 'strict-dynamic' lets our nonced bundle load the chunks (and Plaid's
    // script) it needs, while ignoring the host list on modern browsers — the
    // hosts stay for older ones that don't implement strict-dynamic.
    // Dev needs 'unsafe-eval' for React Fast Refresh.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${PLAID_SCRIPT}${dev ? " 'unsafe-eval'" : ""}`,
    // Tailwind and next/font emit inline <style>; style nonces would have to
    // thread through every component for little gain, since injected CSS can't
    // exfiltrate on its own the way script can.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self' data:`,
    // Dev additionally opens a websocket for HMR.
    `connect-src 'self' ${PLAID_CONNECT}${dev ? " ws: wss:" : ""}`,
    `frame-src ${PLAID_FRAME}`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    ...(dev ? [] : [`upgrade-insecure-requests`]),
  ];
  return directives.join("; ");
}

export function middleware(request: NextRequest) {
  const dev = process.env.NODE_ENV !== "production";
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  // Forward the nonce inward so the root layout can stamp its inline script.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp(nonce, dev));
  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and the icons/manifest, which need no CSP.
    {
      source: "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|sample-transactions.csv).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};

/**
 * Marco 3 — Ciclo 3.2.
 *
 * O client urql precisa:
 * - apontar para `/graphql/` (relativo, ou variável VITE_GRAPHQL_URL em prod);
 * - enviar `credentials: 'include'` para session cookie funcionar cross-origin
 *   (SvelteKit em :5173, Django em :8000 durante dev);
 * - incluir o cookie CSRF como header `X-CSRFToken` em mutations.
 */

import { describe, expect, it, vi } from "vitest";

import { buildFetchOptions, createGraphqlClient, getCsrfTokenFromCookie } from "./client";

describe("createGraphqlClient", () => {
  it("returns a Client instance", () => {
    const client = createGraphqlClient({ url: "http://localhost:8000/graphql/" });
    expect(client).toBeDefined();
    expect(typeof client.query).toBe("function");
  });

  it("posts to the configured URL when executing a query", async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { hello: "ok" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = createGraphqlClient({ url: "http://example.test/graphql/", fetch: fakeFetch });
    await client.query("{ hello }", {}).toPromise();
    expect(fakeFetch).toHaveBeenCalled();
    const [calledUrl] = fakeFetch.mock.calls[0];
    expect(calledUrl).toBe("http://example.test/graphql/");
  });
});

describe("buildFetchOptions", () => {
  it("returns credentials: include", () => {
    const opts = buildFetchOptions(null);
    expect(opts.credentials).toBe("include");
  });

  it("includes X-CSRFToken header when a token is present", () => {
    const opts = buildFetchOptions("ABC123");
    expect(opts.headers).toEqual({ "X-CSRFToken": "ABC123" });
  });

  it("omits X-CSRFToken header when no token", () => {
    const opts = buildFetchOptions(null);
    expect(opts.headers).toEqual({});
  });
});

describe("getCsrfTokenFromCookie", () => {
  it("extracts csrftoken from cookie string", () => {
    expect(getCsrfTokenFromCookie("sessionid=abc; csrftoken=XYZ123; other=foo")).toBe("XYZ123");
  });

  it("returns null when csrftoken is missing", () => {
    expect(getCsrfTokenFromCookie("sessionid=abc")).toBeNull();
  });

  it("reads from document.cookie when no argument is given", () => {
    vi.stubGlobal("document", { cookie: "csrftoken=fromDoc; sessionid=z" });
    expect(getCsrfTokenFromCookie()).toBe("fromDoc");
    vi.unstubAllGlobals();
  });
});

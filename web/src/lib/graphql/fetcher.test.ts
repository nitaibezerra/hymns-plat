/**
 * Marco 3 — Ciclo 3.4 (parte 1).
 *
 * O fetcher é usado por todas as load functions. Precisa: POST com JSON,
 * `credentials: 'include'`, repassar CSRF token quando fornecido, e propagar
 * erros HTTP/GraphQL de forma estruturada.
 */

import { describe, expect, it, vi } from "vitest";

import { gqlFetch } from "./fetcher";

const URL = "http://localhost:8000/graphql/";

function mockOk<T>(payload: T) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("gqlFetch", () => {
  it("posts JSON body with query and variables", async () => {
    const fakeFetch = mockOk({ data: { hello: "ok" } });
    await gqlFetch(fakeFetch, URL, "query Hello { hello }", { x: 1 });

    expect(fakeFetch).toHaveBeenCalledWith(URL, expect.any(Object));
    const [, init] = fakeFetch.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(JSON.parse(init.body as string)).toEqual({
      query: "query Hello { hello }",
      variables: { x: 1 },
    });
  });

  it("includes X-CSRFToken header when provided", async () => {
    const fakeFetch = mockOk({ data: null });
    await gqlFetch(fakeFetch, URL, "{ x }", undefined, { csrfToken: "ABC" });
    const [, init] = fakeFetch.mock.calls[0];
    expect((init.headers as Record<string, string>)["X-CSRFToken"]).toBe("ABC");
  });

  it("forwards the visitor cookie header when provided", async () => {
    const fakeFetch = mockOk({ data: null });
    await gqlFetch(fakeFetch, URL, "{ x }", undefined, {
      cookie: "sessionid=abc123; csrftoken=def456",
    });
    const [, init] = fakeFetch.mock.calls[0];
    expect((init.headers as Record<string, string>).cookie).toBe("sessionid=abc123; csrftoken=def456");
  });

  it("omits the cookie header when none is provided", async () => {
    const fakeFetch = mockOk({ data: null });
    await gqlFetch(fakeFetch, URL, "{ x }");
    const [, init] = fakeFetch.mock.calls[0];
    expect(init.headers as Record<string, string>).not.toHaveProperty("cookie");
  });

  it("omits the cookie header when the visitor has no cookies", async () => {
    const fakeFetch = mockOk({ data: null });
    await gqlFetch(fakeFetch, URL, "{ x }", undefined, { cookie: null });
    const [, init] = fakeFetch.mock.calls[0];
    expect(init.headers as Record<string, string>).not.toHaveProperty("cookie");
  });

  it("returns the data envelope on success", async () => {
    const fakeFetch = mockOk({ data: { globalStats: { hymnbooks: 3 } } });
    const result = await gqlFetch<{ globalStats: { hymnbooks: number } }>(fakeFetch, URL, "{ ... }");
    expect(result.data?.globalStats.hymnbooks).toBe(3);
  });

  it("returns an HTTP error in errors[] when status is not ok", async () => {
    const fakeFetch = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
    const result = await gqlFetch(fakeFetch, URL, "{ x }");
    expect(result.errors?.[0].message).toMatch(/HTTP 500/);
  });
});

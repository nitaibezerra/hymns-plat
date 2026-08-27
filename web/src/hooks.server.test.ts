/**
 * Frente A — A1. Repasse da sessão do visitante no SSR.
 *
 * O problema que este arquivo tranca: as dez load functions universais
 * (`+page.ts` / `+layout.ts`) rodam em Node no primeiro paint e falam com o
 * Django via `event.fetch`. O SvelteKit só herda o cookie do visitante nesse
 * caminho quando o destino é o MESMO hostname da app (ver
 * `node_modules/@sveltejs/kit/src/runtime/server/fetch.js`, bloco
 * "Allow cookie passthrough"): `api.dominio.com` NÃO recebe cookie de
 * `app.dominio.com`. Em produção é exatamente essa a topologia, então
 * `currentUser`, `isFavorited`, `notifications` e `isEditor` renderizam
 * anônimos e só a hidratação corrige.
 *
 * A correção é o hook `handleFetch`, que intercepta todo `event.fetch` do
 * servidor num único ponto — sem tocar nas dez loads.
 *
 * O gate de host não é zelo: `handleFetch` vê TODA chamada de servidor, e
 * repassar o cookie de sessão do visitante pra um host arbitrário seria
 * vazamento de credencial. Só a origem de `GRAPHQL_URL` recebe.
 */

import { describe, expect, it, vi } from "vitest";

import { _repassarSessao, handleFetch } from "./hooks.server";

const GRAPHQL = "http://localhost:8000/graphql/";
const COOKIE = "sessionid=abc123; csrftoken=def456";

/** Requisição de saída como o `gqlFetch` monta: POST no /graphql/. */
function outgoing(url = GRAPHQL, headers: Record<string, string> = {}): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ query: "{ currentUser { id } }" }),
  });
}

/** Evento de servidor mínimo: só o header `cookie` da requisição do visitante. */
function visitorEvent(cookie: string | null) {
  return {
    request: new Request("http://localhost:5173/", {
      headers: cookie ? { cookie } : {},
    }),
  };
}

/** `handleFetch` do SvelteKit recebe um evento completo; aqui basta o pedaço usado. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const chamarHook = handleFetch as any;

describe("handleFetch", () => {
  it("repassa o cookie do visitante quando o destino é o host do GraphQL", async () => {
    const inner = vi.fn().mockResolvedValue(new Response("{}"));
    await chamarHook({ event: visitorEvent(COOKIE), request: outgoing(), fetch: inner });

    const enviada: Request = inner.mock.calls[0][0];
    expect(enviada.headers.get("cookie")).toBe(COOKIE);
  });

  it("NÃO repassa o cookie quando o destino é outro host", async () => {
    const inner = vi.fn().mockResolvedValue(new Response("{}"));
    await chamarHook({
      event: visitorEvent(COOKIE),
      request: outgoing("http://evil.example.com/graphql/"),
      fetch: inner,
    });

    const enviada: Request = inner.mock.calls[0][0];
    expect(enviada.headers.get("cookie")).toBeNull();
  });

  it("devolve a resposta do fetch interno intacta", async () => {
    const inner = vi.fn().mockResolvedValue(new Response('{"data":{"ok":true}}'));
    const response: Response = await chamarHook({
      event: visitorEvent(COOKIE),
      request: outgoing(),
      fetch: inner,
    });
    expect(await response.text()).toBe('{"data":{"ok":true}}');
  });
});

describe("_repassarSessao", () => {
  it("põe o cookie do visitante na requisição pro GraphQL", () => {
    const request = _repassarSessao(outgoing(), COOKIE, GRAPHQL);
    expect(request.headers.get("cookie")).toBe(COOKIE);
  });

  it("não vaza o cookie pra outro host", () => {
    const request = _repassarSessao(outgoing("https://api.terceiro.com/x"), COOKIE, GRAPHQL);
    expect(request.headers.get("cookie")).toBeNull();
  });

  it("não vaza o cookie pra outra porta do mesmo hostname", () => {
    const request = _repassarSessao(outgoing("http://localhost:9999/graphql/"), COOKIE, GRAPHQL);
    expect(request.headers.get("cookie")).toBeNull();
  });

  it("não vaza o cookie pra um host que só termina igual ao configurado", () => {
    const gate = "https://api.hinaria.com.br/graphql/";
    const request = _repassarSessao(outgoing("https://evil-api.hinaria.com.br/graphql/"), COOKIE, gate);
    expect(request.headers.get("cookie")).toBeNull();
  });

  it("visitante anônimo (sem cookie) não ganha header cookie", () => {
    const request = _repassarSessao(outgoing(), null, GRAPHQL);
    expect(request.headers.has("cookie")).toBe(false);
  });

  it("visitante com header cookie vazio não ganha header cookie", () => {
    const request = _repassarSessao(outgoing(), "", GRAPHQL);
    expect(request.headers.has("cookie")).toBe(false);
  });

  it("não sobrescreve um cookie que o chamador já definiu", () => {
    const request = _repassarSessao(
      outgoing(GRAPHQL, { cookie: "sessionid=explicito" }),
      COOKIE,
      GRAPHQL,
    );
    expect(request.headers.get("cookie")).toBe("sessionid=explicito");
  });

  it("preserva método, corpo e demais headers da requisição original", async () => {
    const request = _repassarSessao(outgoing(), COOKIE, GRAPHQL);
    expect(request.method).toBe("POST");
    expect(request.headers.get("content-type")).toBe("application/json");
    expect(await request.text()).toContain("currentUser");
  });

  it("não repassa nada quando a URL do GraphQL é inválida", () => {
    const request = _repassarSessao(outgoing(), COOKIE, "nao-e-url");
    expect(request.headers.has("cookie")).toBe(false);
  });
});

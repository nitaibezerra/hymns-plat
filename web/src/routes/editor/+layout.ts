/**
 * Marco 5.B — Ciclo 5B.1.
 *
 * Guard do workspace editorial. Roda em SSR + CSR e cobre TODA rota abaixo
 * de `/editor/` — as frentes 5.C (revisão de hino) e 5.D (CRUD + áudios)
 * penduram páginas aqui dentro e herdam este guard sem recriá-lo.
 *
 * A regra é uma só, e vem do contrato do 5.A½: **quem decide é
 * `UserType.isEditor`**. Inferir editor de `currentUser !== null` deixaria
 * qualquer usuário logado entrar no workspace — era o bug que o 5.A½ pagou.
 *
 * Falha fecha a porta: sem um `isEditor: true` confirmado (anônimo, não
 * editor, backend fora do ar, erro de rede), redireciona pra `/login`
 * preservando o destino em `next`. Isso difere do shell raiz, que engole
 * erros e segue como anônimo — lá a UI pública funciona degradada, aqui
 * não existe workspace degradado.
 *
 * Consolidação (Frente B, B1): o usuário vem de `event.parent()`, ou seja da
 * `CURRENT_USER_QUERY` que o layout raiz já executou — que agora pede
 * `isEditor`. Antes o guard fazia uma query própria, um round-trip extra por
 * navegação dentro de `/editor/`. Nada se perde na troca porque os quatro
 * caminhos de negativa desembocam no mesmo lugar: o shell engole erro de
 * permissão e queda de backend virando `currentUser: null`, e `null` aqui já
 * significava redirect. O guard não distingue "anônimo" de "backend fora do
 * ar" — nunca distinguiu.
 */

import { redirect } from "@sveltejs/kit";

import type { LayoutLoad } from "./$types";

export interface EditorUser {
  id: string;
  username: string;
  isEditor: boolean;
}

export interface EditorLayoutData {
  editor: EditorUser | null;
}

/*
 * Os três helpers abaixo levam prefixo `_` porque o SvelteKit só aceita
 * exports conhecidos (`load`, `prerender`, `csr`, `ssr`, …) num módulo de
 * rota — qualquer outro nome sem underscore quebra o `vite build`. É a mesma
 * convenção que o repo já usa em `_loadLayout`/`_loadEditorDashboard`.
 */

/**
 * Reconhece "você não tem acesso" nas várias formas em que o backend fala.
 *
 * O `require()` de `apps/api/permissions.py` levanta a mensagem PT-BR
 * canônica ("Você não tem permissão para realizar essa ação."), mas
 * `Query.notifications` usa "Autenticação necessária…" e o Strawberry pode
 * emitir formas em inglês. Casar o conjunto evita acoplar a página à
 * string exata de um resolver.
 *
 * Exportado porque as `+page.ts` de `/editor/` reusam a mesma classificação
 * nas 3 queries do workspace, que agora LEVANTAM erro pra não-editor.
 */
export function _isEditorAccessError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("permissão") ||
    m.includes("permissao") ||
    m.includes("autenticação") ||
    m.includes("autenticacao") ||
    m.includes("authenticat") ||
    m.includes("permission denied") ||
    m.includes("must be logged in") ||
    m.includes("unauthorized")
  );
}

/** `/login?next=<destino>` — o destino é o path real, sem querystring. */
export function _editorLoginRedirect(pathname: string): string {
  return `/login?next=${pathname}`;
}

/**
 * URL da tela de revisão de um hino.
 *
 * A rota em si é entregue pelo sub-marco 5.C; o 5.B já precisa apontar pra
 * ela em dois lugares (card "Continuar revisão" e botão "Próximo pendente").
 * Centralizar aqui deixa um ponto único pra ajustar se o 5.C escolher outro
 * path — em vez de dois literais espalhados pelas telas.
 */
export function _editorReviseHref(hymnPk: string): string {
  return `/editor/hinos/${hymnPk}/revisar/`;
}

/**
 * Valida em runtime o `currentUser` que desceu do shell.
 *
 * Por que não confiar no tipo: `LayoutUser` (em `src/routes/+layout.ts`)
 * declara só `id`/`username`/`email` — o `isEditor` está no wire, não na
 * interface. Em vez de assumir a forma, o guard checa: qualquer coisa que
 * não seja um usuário com `isEditor === true` é negativa. Assim um campo
 * ausente (schema mudou, resolver parcial) fecha a porta em vez de abri-la.
 */
export function _asEditor(candidate: unknown): EditorUser | null {
  if (typeof candidate !== "object" || candidate === null) return null;
  const user = candidate as Partial<EditorUser>;
  if (typeof user.id !== "string" || typeof user.username !== "string") return null;
  if (user.isEditor !== true) return null;
  return { id: user.id, username: user.username, isEditor: true };
}

export async function _loadEditorLayout(event: {
  parent: () => Promise<{ currentUser?: unknown }>;
  url: URL;
}): Promise<EditorLayoutData> {
  const target = _editorLoginRedirect(event.url.pathname);

  let editor: EditorUser | null = null;
  try {
    const { currentUser } = await event.parent();
    editor = _asEditor(currentUser);
  } catch (error: unknown) {
    // `redirect()` do SvelteKit é um throw legítimo — repassa intacto.
    if (isRedirect(error)) throw error;
    // O shell engole os próprios erros, então cair aqui é anomalia; ainda
    // assim, sem editor confirmado não existe workspace.
    throw redirect(302, target);
  }

  if (!editor) {
    throw redirect(302, target);
  }
  return { editor };
}

function isRedirect(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    "location" in error
  );
}

export const load: LayoutLoad = (event) => _loadEditorLayout(event);

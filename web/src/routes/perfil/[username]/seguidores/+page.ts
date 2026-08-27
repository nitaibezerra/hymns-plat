/**
 * Marco 4.H — Ciclo 4H.5.
 *
 * Load function da lista paginada de seguidores. `?page=N` define o offset
 * (página 1 = offset 0). Tamanho fixo de 20 itens — alinhado ao default do
 * resolver `UserProfileType.followers`.
 *
 * **Esta rota exige sessão.** `UserProfileType.followers` passou a exigir
 * usuário logado, em paridade com o `@login_required` de
 * `apps/users/views_social.py::followers_list` — a lista era pública só no
 * shell. Anônimo agora recebe GraphQLError e cai no login preservando o
 * destino, exatamente como o guard de `/editor/` faz.
 *
 * A classificação do erro é reusada de lá (`_isEditorAccessError`) em vez de
 * reescrita: o nome fala de editor, mas a função é o classificador de "você
 * não tem acesso" do repo, e é o único lugar que cobre as duas formas em que o
 * backend fala (a mensagem PT-BR canônica de `permissions.require` e o
 * "Autenticação necessária…" que chega aqui). Um classificador próprio
 * procurando "authenticat" no texto PT-BR nunca casaria — é o bug que
 * `routes/notificacoes/+page.ts` ainda tem.
 */

import { GRAPHQL_URL } from "$lib/config";
import { gqlFetch } from "$lib/graphql/fetcher";
import { USER_FOLLOWERS_QUERY } from "$lib/graphql/operations";
import { redirect } from "@sveltejs/kit";

import { _editorLoginRedirect, _isEditorAccessError } from "../../../editor/+layout";

import type { PageLoad } from "./$types";

export interface FollowerUser {
  id: string;
  username: string;
  email: string;
}

export interface FollowersData {
  username: string;
  followers: FollowerUser[];
  followersCount: number;
  page: number;
  pageSize: number;
  error: string | null;
}

const PAGE_SIZE = 20;

function parsePage(raw: string | null): number {
  if (!raw) return 1;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export async function _loadFollowers(event: {
  fetch: typeof globalThis.fetch;
  params: { username: string };
  url: URL;
}): Promise<FollowersData> {
  const page = parsePage(event.url.searchParams.get("page"));
  const offset = (page - 1) * PAGE_SIZE;
  const response = await gqlFetch<{
    userProfile: {
      user: FollowerUser;
      followersCount: number;
      followers: FollowerUser[];
    } | null;
  }>(event.fetch, GRAPHQL_URL, USER_FOLLOWERS_QUERY, {
    username: event.params.username,
    first: PAGE_SIZE,
    offset,
  });

  // Falta de sessão → login. `HTTP nnn` vem do `gqlFetch` para falha de
  // transporte e fica FORA do redirect: backend caído não é falta de login, e
  // mandar o visitante pro login esconderia a queda.
  const errorMessage = response.errors?.[0]?.message;
  if (errorMessage && !errorMessage.startsWith("HTTP ") && _isEditorAccessError(errorMessage)) {
    throw redirect(302, _editorLoginRedirect(event.url.pathname));
  }

  return {
    username: event.params.username,
    followers: response.data?.userProfile?.followers ?? [],
    followersCount: response.data?.userProfile?.followersCount ?? 0,
    page,
    pageSize: PAGE_SIZE,
    error: errorMessage ?? null,
  };
}

export const load: PageLoad = (event) => _loadFollowers(event);

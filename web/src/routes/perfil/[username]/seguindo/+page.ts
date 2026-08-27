/**
 * Marco 4.H — Ciclo 4H.6.
 *
 * Load function da lista paginada de "seguindo". Espelho do
 * /seguidores (4H.5) — só muda a query.
 *
 * Inclusive no gate: `UserProfileType.following` exige sessão (paridade com o
 * `@login_required` de `apps/users/views_social.py::following_list`), e anônimo
 * cai no login preservando o destino. O porquê de reusar
 * `_isEditorAccessError` do guard de `/editor/` está documentado na rota irmã
 * (`../seguidores/+page.ts`).
 */

import { GRAPHQL_URL } from "$lib/config";
import { gqlFetch } from "$lib/graphql/fetcher";
import { USER_FOLLOWING_QUERY } from "$lib/graphql/operations";
import { redirect } from "@sveltejs/kit";

import { _editorLoginRedirect, _isEditorAccessError } from "../../../editor/+layout";

import type { PageLoad } from "./$types";

export interface FollowingUser {
  id: string;
  username: string;
  email: string;
}

export interface FollowingData {
  username: string;
  following: FollowingUser[];
  followingCount: number;
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

export async function _loadFollowing(event: {
  fetch: typeof globalThis.fetch;
  params: { username: string };
  url: URL;
}): Promise<FollowingData> {
  const page = parsePage(event.url.searchParams.get("page"));
  const offset = (page - 1) * PAGE_SIZE;
  const response = await gqlFetch<{
    userProfile: {
      user: FollowingUser;
      followingCount: number;
      following: FollowingUser[];
    } | null;
  }>(event.fetch, GRAPHQL_URL, USER_FOLLOWING_QUERY, {
    username: event.params.username,
    first: PAGE_SIZE,
    offset,
  });

  // Mesma regra da rota irmã: falta de sessão → login; `HTTP nnn` (backend
  // caído) fica de fora e vira mensagem na página.
  const errorMessage = response.errors?.[0]?.message;
  if (errorMessage && !errorMessage.startsWith("HTTP ") && _isEditorAccessError(errorMessage)) {
    throw redirect(302, _editorLoginRedirect(event.url.pathname));
  }

  return {
    username: event.params.username,
    following: response.data?.userProfile?.following ?? [],
    followingCount: response.data?.userProfile?.followingCount ?? 0,
    page,
    pageSize: PAGE_SIZE,
    error: errorMessage ?? null,
  };
}

export const load: PageLoad = (event) => _loadFollowing(event);

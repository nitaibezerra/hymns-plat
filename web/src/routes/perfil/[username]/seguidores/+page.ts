/**
 * Marco 4.H — Ciclo 4H.5.
 *
 * Load function da lista paginada de seguidores. `?page=N` define o offset
 * (página 1 = offset 0). Tamanho fixo de 20 itens — alinhado ao default do
 * resolver `UserProfileType.followers`.
 */

import { GRAPHQL_URL } from "$lib/config";
import { gqlFetch } from "$lib/graphql/fetcher";
import { USER_FOLLOWERS_QUERY } from "$lib/graphql/operations";

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

  return {
    username: event.params.username,
    followers: response.data?.userProfile?.followers ?? [],
    followersCount: response.data?.userProfile?.followersCount ?? 0,
    page,
    pageSize: PAGE_SIZE,
    error: response.errors?.[0]?.message ?? null,
  };
}

export const load: PageLoad = (event) => _loadFollowers(event);

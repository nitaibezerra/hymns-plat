/**
 * Marco 4.H — Ciclo 4H.6.
 *
 * Load function da lista paginada de "seguindo". Espelho do
 * /seguidores (4H.5) — só muda a query.
 */

import { GRAPHQL_URL } from "$lib/config";
import { gqlFetch } from "$lib/graphql/fetcher";
import { USER_FOLLOWING_QUERY } from "$lib/graphql/operations";

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

  return {
    username: event.params.username,
    following: response.data?.userProfile?.following ?? [],
    followingCount: response.data?.userProfile?.followingCount ?? 0,
    page,
    pageSize: PAGE_SIZE,
    error: response.errors?.[0]?.message ?? null,
  };
}

export const load: PageLoad = (event) => _loadFollowing(event);

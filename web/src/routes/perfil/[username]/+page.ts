/**
 * Marco 4.H — Ciclo 4H.1.
 *
 * Load function da página de perfil. Busca `userProfile(username)` no GraphQL
 * usando `params.username`. Retorna `userProfile` ou null (404 silencioso —
 * a página renderiza estado vazio se o usuário não existir).
 */

import { GRAPHQL_URL } from "$lib/config";
import { gqlFetch } from "$lib/graphql/fetcher";
import { USER_PROFILE_QUERY } from "$lib/graphql/operations";

import type { PageLoad } from "./$types";

export interface ProfileUser {
  id: string;
  username: string;
  email: string;
}

export interface ProfileAudio {
  id: string;
  url: string;
  durationSeconds: number | null;
  waveformPeaks: number[];
  uploadedBy: ProfileUser | null;
}

export interface HeatmapBucket {
  date: string;
  count: number;
}

export interface UserProfile {
  user: ProfileUser;
  followersCount: number;
  followingCount: number;
  uploadedAudios: ProfileAudio[];
  activityHeatmap: HeatmapBucket[];
}

export interface ProfileData {
  userProfile: UserProfile | null;
  error: string | null;
}

export async function _loadProfile(event: {
  fetch: typeof globalThis.fetch;
  params: { username: string };
}): Promise<ProfileData> {
  const response = await gqlFetch<{ userProfile: UserProfile | null }>(
    event.fetch,
    GRAPHQL_URL,
    USER_PROFILE_QUERY,
    { username: event.params.username },
  );
  return {
    userProfile: response.data?.userProfile ?? null,
    error: response.errors?.[0]?.message ?? null,
  };
}

export const load: PageLoad = (event) => _loadProfile(event);

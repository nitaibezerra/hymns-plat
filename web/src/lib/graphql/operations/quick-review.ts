/**
 * Sub-marco 5.E — operações GraphQL da revisão ágil e das mutations sociais.
 *
 * Arquivo EXCLUSIVO desta frente. `$lib/graphql/operations.ts` é o barril
 * compartilhado por várias frentes em paralelo; editá-lo produz `export
 * const` duplicado no merge, que já derrubou o build antes. Aqui só entram
 * operações de 5.E.
 *
 * Os helpers de transporte (`runMutation`, `MutationOutcome`) vêm de
 * `operations/crud.ts` (5.D) — a regra de normalizar `union` pelo
 * `__typename` é uma só e não se reescreve.
 */

import { runMutation, type MutationOutcome } from "$lib/graphql/operations/crud";

// ---------------------------------------------------------------------------
// 5E.2 — presets das pílulas
// ---------------------------------------------------------------------------

/**
 * Repetições da revisão ágil, na ORDEM DOS ATALHOS 1/2/3/4.
 *
 * Fonte da verdade: `editor_quick_review` em `apps/hymns/editor_views.py`
 * (chave `quick_repetitions`), que é um subconjunto ordenado de
 * `Hymn.CANONICAL_REPETITIONS`. A view comenta explicitamente por que não usa
 * a tupla canônica inteira aqui: ela tem 5 entradas e ordem própria, e
 * misturaria os atalhos. `QuickReviewPills.test.ts` pina os 4 valores E o
 * fato de todos pertencerem a `CANONICAL_REPETITIONS`.
 */
export const QUICK_REPETITIONS = ["1-2,3-4", "1-4", "1-2,3-4,1-4", "3-4,1-4"] as const;

/**
 * Atalho de cada estilo canônico. Mazurca usa `Z` (3ª letra) porque `M` já é
 * de Marcha — mesma escolha de `templates/hymns/editor/quick_review.html`.
 */
export const STYLE_SHORTCUTS: Record<string, string> = {
  Marcha: "M",
  Valsa: "V",
  Mazurca: "Z",
};

// ---------------------------------------------------------------------------
// 5E.1 — load da revisão ágil
// ---------------------------------------------------------------------------

/**
 * Hinário + todos os hinos com os dois campos objetivos.
 *
 * Pedimos a lista inteira (e não um hino por vez) porque a tela precisa do
 * indicador `N DE TOTAL` e dos links anterior/próximo — que são `<a href>`
 * resolvidos no servidor, não navegação por JS.
 */
export const QUICK_REVIEW_QUERY = `
  query QuickReview($slug: String!) {
    hymnbook(slug: $slug) {
      id
      name
      slug
      hymns {
        id
        number
        title
        body
        style
        repetitions
      }
    }
  }
`;

// ---------------------------------------------------------------------------
// 5E.3 — quickReviewHymn
// ---------------------------------------------------------------------------

/**
 * Grava SÓ `style` e `repetitions`.
 *
 * `quick_review_hymn` (apps/api/mutations.py) nunca toca `review_status`,
 * `last_reviewed_at` nem `last_reviewed_by` — marcar como REVIEWED continua
 * exigindo a tela completa. Regra pinada por teste no backend; a UI diz isso
 * em voz alta pro editor não achar que concluiu a revisão.
 */
export const QUICK_REVIEW_HYMN_MUTATION = `
  mutation QuickReviewHymn($pk: ID!, $style: String!, $repetitions: String!) {
    quickReviewHymn(pk: $pk, style: $style, repetitions: $repetitions) {
      __typename
      ... on HymnType { id number style repetitions }
      ... on ValidationError { message field }
      ... on PermissionDeniedError { message }
      ... on NotFoundError { message }
    }
  }
`;

export interface QuickReviewedHymn {
  __typename: string;
  id: string;
  number: number;
  style: string;
  repetitions: string;
}

export function quickReviewHymn(
  fetchFn: typeof globalThis.fetch,
  pk: string,
  style: string,
  repetitions: string,
): Promise<MutationOutcome<QuickReviewedHymn>> {
  return runMutation<QuickReviewedHymn>(
    fetchFn,
    QUICK_REVIEW_HYMN_MUTATION,
    { pk, style, repetitions },
    "quickReviewHymn",
    ["HymnType"],
  );
}

// ---------------------------------------------------------------------------
// 5E.7 — seguir / deixar de seguir
// ---------------------------------------------------------------------------

export const FOLLOW_USER_MUTATION = `
  mutation FollowUser($username: String!) {
    followUser(username: $username) {
      __typename
      ... on UserProfileType {
        followersCount
        isFollowedByCurrentUser
      }
      ... on PermissionDeniedError { message }
      ... on NotFoundError { message }
    }
  }
`;

export const UNFOLLOW_USER_MUTATION = `
  mutation UnfollowUser($username: String!) {
    unfollowUser(username: $username) {
      __typename
      ... on UserProfileType {
        followersCount
        isFollowedByCurrentUser
      }
      ... on PermissionDeniedError { message }
      ... on NotFoundError { message }
    }
  }
`;

export interface FollowOutcomeProfile {
  __typename: string;
  followersCount: number;
  isFollowedByCurrentUser: boolean;
}

/**
 * `follow: true` segue, `false` deixa de seguir. Uma função só porque o par
 * de mutations é simétrico — quem chama já sabe o estado desejado.
 */
export function setFollowing(
  fetchFn: typeof globalThis.fetch,
  username: string,
  follow: boolean,
): Promise<MutationOutcome<FollowOutcomeProfile>> {
  return runMutation<FollowOutcomeProfile>(
    fetchFn,
    follow ? FOLLOW_USER_MUTATION : UNFOLLOW_USER_MUTATION,
    { username },
    follow ? "followUser" : "unfollowUser",
    ["UserProfileType"],
  );
}

// ---------------------------------------------------------------------------
// 5E.8 — notificações
// ---------------------------------------------------------------------------

/**
 * Igual à `NOTIFICATIONS_QUERY` do barril, mais `sender` — campo do 5.A½ que
 * o template Django (`templates/users/notifications.html`) já mostra como
 * "De: <username>". A query vive aqui porque o barril é intocável nesta
 * frente.
 */
export const NOTIFICATIONS_WITH_SENDER_QUERY = `
  query NotificationsWithSender($unreadOnly: Boolean!) {
    notifications(unreadOnly: $unreadOnly) {
      id
      notificationType
      title
      message
      link
      isRead
      createdAt
      sender { id username }
    }
  }
`;

/** Devolve quantas notificações foram marcadas (`Int!`, não union). */
export const MARK_ALL_NOTIFICATIONS_READ_MUTATION = `
  mutation MarkAllNotificationsRead {
    markAllNotificationsRead
  }
`;

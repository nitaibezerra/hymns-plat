/**
 * Operações GraphQL como strings SDL. Quando consumidas por componentes ou
 * load functions, o `graphql-codegen` (ciclo 3.3) gera tipos para cada uma em
 * `generated.ts` — desde que o documento esteja marcado com a tag `gql\`...\``
 * ou seja referenciado como literal de query.
 *
 * No MVP usamos strings cruas + fetch POST direto (sem urql) para load
 * functions SSR, para evitar acoplar SSR ao state-management do urql. O
 * cliente urql (`./client.ts`) é usado em componentes que precisam de cache
 * reativo (favoritos, currentUser, lista do editor — Marco 4+).
 */

export const GLOBAL_STATS_QUERY = `
  query GlobalStats {
    globalStats {
      hymnbooks
      hymns
      audios
      activeReviewers
    }
  }
`;

export const HYMNBOOKS_QUERY = `
  query HymnBooks {
    hymnbooks {
      id
      name
      slug
      isPublished
    }
  }
`;

export const CURRENT_USER_QUERY = `
  query CurrentUser {
    currentUser {
      id
      username
      email
    }
  }
`;

export const LOGIN_MUTATION = `
  mutation Login($username: String!, $password: String!) {
    login(username: $username, password: $password) {
      __typename
      ... on LoginSuccess { user { id username email } }
      ... on LoginError { message }
    }
  }
`;

/**
 * Marco 4.E — detalhe de hino.
 *
 * Pede tudo que `Query.hymn(pk)` expõe no schema atual (4.A):
 *   - campos básicos (id, number, title, reviewStatus)
 *   - previousInBook / nextInBook (id+number+title pra montar os links)
 *   - siblingsWithSameNumber (lista de hinos com mesmo `number` em outros
 *     hinários visíveis pelo usuário — gating no resolver)
 *   - audios (sem filtro: `approvedOnly` default = true; uploader/editor
 *     veem pendentes via `approvedOnly: false` no futuro — ver TODO em
 *     `_loadHymn`)
 */
export const HYMN_DETAIL_QUERY = `
  query HymnDetail($pk: ID!) {
    hymn(pk: $pk) {
      id
      number
      title
      reviewStatus
      previousInBook { id number title }
      nextInBook { id number title }
      siblingsWithSameNumber { id number title }
      audios {
        id
        url
        waveformPeaks
        durationSeconds
        uploadedBy { id username }
      }
    }
  }
`;

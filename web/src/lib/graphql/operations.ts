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

export const SEARCH_QUERY = `
  query Search($q: String!, $kind: SearchKind = ALL) {
    search(q: $q, kind: $kind) {
      hymns {
        id
        number
        title
        reviewStatus
      }
      hymnbooks {
        id
        name
        slug
        isPublished
      }
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

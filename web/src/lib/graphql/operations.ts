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
      stats {
        hymnsTotal
        hymnsReviewed
        audiosApproved
      }
    }
  }
`;

export const HOURLY_FEATURED_QUERY = `
  query HourlyFeatured {
    hourlyFeatured {
      id
      name
      slug
      isPublished
      stats {
        hymnsTotal
        hymnsReviewed
        audiosApproved
      }
    }
  }
`;

export const HYMNBOOK_DETAIL_QUERY = `
  query HymnBookDetail($slug: String!) {
    hymnbook(slug: $slug) {
      id
      name
      slug
      isPublished
      hymns {
        id
        number
        title
        body
      }
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

export const USER_PROFILE_QUERY = `
  query UserProfile($username: String!) {
    userProfile(username: $username) {
      user { id username email }
      followersCount
      followingCount
      uploadedAudios {
        id
        url
        durationSeconds
        waveformPeaks
        uploadedBy { id username email }
      }
      activityHeatmap(days: 365) {
        date
        count
      }
    }
  }
`;

export const USER_FOLLOWERS_QUERY = `
  query UserFollowers($username: String!, $first: Int!, $offset: Int!) {
    userProfile(username: $username) {
      user { id username email }
      followersCount
      followers(first: $first, offset: $offset) {
        id
        username
        email
      }
    }
  }
`;

export const USER_FOLLOWING_QUERY = `
  query UserFollowing($username: String!, $first: Int!, $offset: Int!) {
    userProfile(username: $username) {
      user { id username email }
      followingCount
      following(first: $first, offset: $offset) {
        id
        username
        email
      }
    }
  }
`;

export const NOTIFICATIONS_QUERY = `
  query Notifications($unreadOnly: Boolean!) {
    notifications(unreadOnly: $unreadOnly) {
      id
      notificationType
      title
      message
      link
      isRead
      createdAt
    }
  }
`;

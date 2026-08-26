/**
 * Marco 5.B — operações GraphQL EXCLUSIVAS do workspace editorial.
 *
 * Por que um arquivo novo em vez de `$lib/graphql/operations.ts`: aquele
 * módulo é editado por várias frentes ao mesmo tempo e um `export const`
 * duplicado já derrubou o build inteiro uma vez. Cada frente tem o seu
 * próprio arquivo aqui em `operations/` — zero sobreposição de linhas.
 *
 * O SDL de referência é `schema.graphql` na raiz do repo.
 */

/**
 * `currentUser` com `isEditor` — o campo que decide o guard (contrato 5.A½).
 *
 * A query compartilhada `CURRENT_USER_QUERY` do shell NÃO pede `isEditor`,
 * então o layout do editor faz a sua própria chamada. É um round-trip extra
 * por navegação, aceito de propósito: inferir "editor" de
 * `currentUser !== null` é exatamente o bug que o 5.A½ veio corrigir.
 */
export const EDITOR_CURRENT_USER_QUERY = `
  query EditorCurrentUser {
    currentUser {
      id
      username
      isEditor
    }
  }
`;

/**
 * Detalhe de um hinário na visão do editor.
 *
 * `hymnbook(slug:)` é a query pública, e é o certo aqui: ela usa
 * `visible_to(user)`, então o editor vê o próprio rascunho não publicado
 * enquanto o anônimo não vê nada — sem precisar de uma query paralela.
 *
 * `nextPendingHymn` (sem `currentPk`) é o primeiro hino não revisado do
 * hinário — é o que alimenta o botão "Próximo pendente" (5B.9). Vem do
 * backend porque a fila de revisão tem regra de wrap-around que não deve
 * ser reimplementada no cliente.
 */
export const EDITOR_HYMNBOOK_DETAIL_QUERY = `
  query EditorHymnBookDetail($slug: String!) {
    hymnbook(slug: $slug) {
      id
      name
      slug
      ownerName
      priority
      isPublished
      reviewProgress {
        reviewPct
        stylePct
        repsPct
        audioPct
      }
      stats {
        hymnsTotal
        hymnsReviewed
        audiosApproved
      }
      nextPendingHymn {
        id
        number
        title
      }
      hymns {
        id
        number
        title
        reviewStatus
      }
    }
  }
`;

/**
 * Dashboard do editor num único round-trip: as stats agregadas + a fila de
 * hinários. São duas queries no mesmo documento de propósito — a tela não
 * renderiza metade útil, e um POST é mais barato que dois em SSR.
 *
 * `reviewProgress` traz os 4 percentuais já calculados pelo backend (5.A½);
 * o cliente NÃO recalcula nada. `stats` complementa com os absolutos
 * ("12 de 30 revisados") que a barra de revisão formal mostra ao lado do %.
 *
 * `sort` é `[SortInput!]` (`{column, direction}`) e `priority` é
 * `String! = "all"` — com "all" o backend não filtra e promove a prioridade
 * a ORDER BY primário (P1 no topo), deixando os sorts do usuário como
 * secundários.
 */
export const EDITOR_DASHBOARD_QUERY = `
  query EditorDashboard($sort: [SortInput!], $priority: String!) {
    editorDashboardStats {
      totalHinarios
      pendingHymns
      recentReviewed7d
      p1Count
      pendingAudiosCount
      resumeHymn {
        id
        number
        title
        hymnBook {
          name
          slug
        }
      }
    }
    editorHymnbooks(sort: $sort, priority: $priority) {
      id
      name
      slug
      priority
      isFeatured
      isPublished
      ownerName
      createdAt
      reviewProgress {
        reviewPct
        stylePct
        repsPct
        audioPct
      }
      stats {
        hymnsTotal
        hymnsReviewed
        audiosApproved
      }
    }
  }
`;

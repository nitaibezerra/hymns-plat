/**
 * Sub-marco 5.F — operações GraphQL do fluxo `/contribuir/`.
 *
 * Arquivo exclusivo desta frente: `web/src/lib/graphql/operations.ts` é
 * editado por várias frentes ao mesmo tempo e um `export const` duplicado já
 * derrubou o build antes. Nada aqui é importado de lá além do que já existe.
 *
 * Convenção do repo: strings SDL cruas (sem tag `gql`), consumidas por
 * `gqlFetch`.
 */

/**
 * Progresso do OCR. `OCRTaskType` já existe no schema (Marco 5.A) e o
 * resolver gateia por dono-da-task-ou-editor; task inexistente ou sem
 * permissão volta como `null`.
 *
 * `resultData` é `JSON` **nulável** (corrigido no 5.A½): task `pending` ou
 * `processing` não tem resultado. Quem consome trata o nulo.
 */
export const OCR_TASK_QUERY = `
  query OcrTask($id: ID!) {
    ocrTask(id: $id) {
      id
      status
      currentPage
      totalPages
      progressPct
      errorMessage
      pdfFilename
      resultData
    }
  }
`;

/**
 * Desambiguação: hinários parecidos com o que está sendo enviado.
 *
 * O resolver **chama** `apps/hymns/disambiguation.py::find_duplicates_with_content`
 * com os thresholds do fluxo Django (nome 0.7 / conteúdo 0.8) — a regra de
 * similaridade não é reimplementada em TypeScript.
 *
 * Os nomes de campo seguem as chaves do dict devolvido por aquela função
 * (`exact_match` / `high_confidence`), em camelCase.
 *
 * ⚠️ Depende dos ciclos 5F.1–5F.3, que são **backend** e ficaram fora do
 * escopo desta frente. Enquanto `Query.ocrDuplicates` não existir no schema,
 * a consulta volta erro e o wizard degrada pra "sem duplicatas" (vai direto
 * pra conferência) — nunca trava a tela.
 */
export const OCR_DUPLICATES_QUERY = `
  query OcrDuplicates($taskId: UUID!) {
    ocrDuplicates(taskId: $taskId) {
      exactMatch {
        id
        name
        slug
        ownerName
        stats {
          hymnsTotal
        }
      }
      highConfidence {
        nameScore
        contentScore
        hymnbook {
          id
          name
          slug
          ownerName
          stats {
            hymnsTotal
          }
        }
      }
    }
  }
`;

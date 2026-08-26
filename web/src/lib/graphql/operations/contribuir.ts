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

/**
 * Fecha o fluxo "criar novo hinário": porta a `transaction.atomic()` de
 * `upload_preview_view` pro backend, com `source=OCR`, `ocr_text` e
 * `ocr_avg_confidence` preservados, e o hinário entrando como rascunho.
 *
 * Idempotente por `taskId`: uma task já consumida não cria um segundo hinário.
 *
 * O resultado segue a convenção de união do schema (ver `CreateHymnBookResult`
 * em `schema.graphql`): o tipo de sucesso ou um dos erros tipados.
 *
 * ⚠️ Ciclo 5F.2 — **backend**, fora do escopo desta frente. Até ele existir, a
 * chamada volta erro e a tela mostra a mensagem sem perder o wizard.
 */
export const CREATE_HYMNBOOK_FROM_OCR_MUTATION = `
  mutation CreateHymnBookFromOcr($taskId: UUID!) {
    createHymnBookFromOcr(taskId: $taskId) {
      __typename
      ... on HymnBookType {
        id
        name
        slug
      }
      ... on PermissionDeniedError {
        message
      }
      ... on NotFoundError {
        message
      }
      ... on ValidationError {
        message
        field
      }
    }
  }
`;

/**
 * Fecha o fluxo "adicionar como nova versão": porta `upload_confirm_view`,
 * criando uma `HymnBookVersion` com `is_primary=False`.
 *
 * Devolve o hinário de destino porque é pra ele que a tela navega — o mesmo
 * `redirect("hymns:hymnbook_detail", slug=hymnbook.slug)` do Django.
 *
 * ⚠️ Ciclo 5F.3 — **backend**, fora do escopo desta frente.
 */
export const CREATE_HYMNBOOK_VERSION_FROM_OCR_MUTATION = `
  mutation CreateHymnBookVersionFromOcr($taskId: UUID!, $hymnbookSlug: String!, $versionName: String!) {
    createHymnBookVersionFromOcr(
      taskId: $taskId
      hymnbookSlug: $hymnbookSlug
      versionName: $versionName
    ) {
      __typename
      ... on HymnBookType {
        id
        name
        slug
      }
      ... on PermissionDeniedError {
        message
      }
      ... on NotFoundError {
        message
      }
      ... on ValidationError {
        message
        field
      }
    }
  }
`;

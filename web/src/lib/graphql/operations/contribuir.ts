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

/**
 * Operações GraphQL exclusivas da tela 07 · Revisar hino (sub-marco 5.C).
 *
 * Arquivo separado de `$lib/graphql/operations.ts` por decisão anti-conflito:
 * quatro frentes editam o workspace do editor em paralelo e um `export const`
 * duplicado no arquivo compartilhado já derrubou o build uma vez.
 *
 * Nota de schema: `HymnType` não expõe um campo `text` — o resolver `body`
 * devolve `Hymn.text` cru (não renderizado). Por isso o formulário lê a letra
 * de `body` e a escreve de volta em `HymnUpdateInput.text`.
 */

/** Query do load: hino + contexto editorial completo da tela de revisão. */
export const REVISE_HYMN_QUERY = `
  query ReviseHymn($pk: ID!) {
    hymn(pk: $pk) {
      id
      number
      title
      body
      ocrText
      style
      repetitions
      extraInstructions
      offeredTo
      section
      receivedAt
      reviewStatus
      lastReviewedAt
      lastReviewedBy { id username }
      hymnBook {
        id
        name
        slug
        hymns { id number reviewStatus }
        nextPendingHymn(currentPk: $pk) { id number title }
      }
      inlineDiff {
        changes
        adds
        dels
        lines {
          kind
          tokens { kind text sub add }
        }
      }
      ocrLineConfidences
      commonStyles(top: 5)
      commonRepetitions(top: 5)
      revisions {
        id
        previousStatus
        newStatus
        changeSummary
        fieldDiff
        revisedAt
        revisedBy { id username }
      }
      audios(approvedOnly: false) {
        id
        url
        title
        waveformPeaks
        durationSeconds
        isApproved
        isMatch
        qualityRating
        qualityObservations
        mismatchReason
        reviewedAt
        reviewedBy { id username }
      }
    }
  }
`;

/** Autosave e "Salvar e voltar" — não muda `reviewStatus`. */
export const UPDATE_HYMN_MUTATION = `
  mutation UpdateHymn($pk: ID!, $input: HymnUpdateInput!) {
    updateHymn(pk: $pk, input: $input) {
      __typename
      ... on HymnType { id number title }
      ... on PermissionDeniedError { message }
      ... on NotFoundError { message }
      ... on ValidationError { message field }
    }
  }
`;

/** "Salvar e avançar" marca REVIEWED antes de navegar. */
export const SET_REVIEW_STATUS_MUTATION = `
  mutation SetReviewStatus($pk: ID!, $status: ReviewStatus!) {
    setReviewStatus(pk: $pk, status: $status) {
      __typename
      ... on HymnType { id reviewStatus }
      ... on PermissionDeniedError { message }
      ... on NotFoundError { message }
    }
  }
`;

/** Drawer de revisão de áudio. */
export const REVIEW_AUDIO_MUTATION = `
  mutation ReviewAudio($pk: ID!, $input: AudioReviewInput!) {
    reviewAudio(pk: $pk, input: $input) {
      __typename
      ... on HymnAudioType {
        id
        isMatch
        qualityRating
        qualityObservations
        mismatchReason
        isApproved
      }
      ... on PermissionDeniedError { message }
      ... on NotFoundError { message }
    }
  }
`;

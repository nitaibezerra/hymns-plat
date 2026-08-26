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

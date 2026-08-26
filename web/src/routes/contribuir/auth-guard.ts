/**
 * Sub-marco 5.F — Ciclo 5F.5.
 *
 * Helper compartilhado pelas 5 telas do wizard `/contribuir/`. Todas as views
 * Django originais são `@login_required` e os resolvers de OCR são gateados
 * por "dono da task ou editor", então cada load function precisa distinguir
 * "não autenticado / sem permissão" (→ redirect pro login) de "backend com
 * problema" (→ mensagem na tela).
 *
 * A mesma regra existe, não exportada, em `routes/notificacoes/+page.ts`
 * (4H.9). Não editamos aquele arquivo (fora do escopo desta frente); esta é
 * a versão compartilhada pelas rotas de contribuição, com o mesmo conjunto
 * de mensagens reconhecidas.
 */

/**
 * Reconhece erros de autenticação/permissão pelo texto da mensagem. Cobrimos
 * o conjunto de formas comuns em Strawberry/Graphene em vez de acoplar à
 * mensagem exata de um resolver.
 */
export function isAuthError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("authenticat") ||
    m.includes("must be logged in") ||
    m.includes("permission denied") ||
    m.includes("not allowed") ||
    m.includes("unauthorized")
  );
}

/** `true` quando a mensagem é um erro de transporte (`HTTP 500`), não de auth. */
export function isTransportError(message: string): boolean {
  return message.startsWith("HTTP ");
}

/** Destino de login que preserva o passo do wizard em que o usuário estava. */
export function loginRedirectTarget(pathname: string): string {
  return `/login?next=${pathname}`;
}

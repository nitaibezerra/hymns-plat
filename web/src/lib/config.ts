/**
 * Configuração de runtime. URL do GraphQL é resolvida em tempo de import
 * via `import.meta.env`; fallback é o dev server Django em :8000.
 */

export const GRAPHQL_URL = (import.meta.env.VITE_GRAPHQL_URL as string | undefined) ?? "http://localhost:8000/graphql/";

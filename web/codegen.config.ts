import type { CodegenConfig } from "@graphql-codegen/cli";

/**
 * graphql-codegen: lê o SDL exportado pelo Django em `../schema.graphql`
 * e gera tipos TS em `src/lib/graphql/generated.ts`.
 *
 * Quando o schema muda no backend, rodar:
 *   DJANGO_SETTINGS_MODULE=config.settings.test uv run python manage.py \
 *     export_schema apps.api.schema:schema > schema.graphql
 *   cd web && pnpm codegen
 *
 * `ignoreNoDocuments: true` permite gerar antes de existirem queries — útil
 * em CI e no scaffold inicial. Quando houver `.gql` / `gql\`...\`` no código,
 * o codegen também produz tipos das operações.
 */
const config: CodegenConfig = {
  schema: "../schema.graphql",
  documents: ["src/**/*.{ts,svelte}"],
  ignoreNoDocuments: true,
  generates: {
    "src/lib/graphql/generated.ts": {
      plugins: ["typescript", "typescript-operations"],
      config: {
        useTypeImports: true,
        skipTypename: false,
      },
    },
  },
};

export default config;

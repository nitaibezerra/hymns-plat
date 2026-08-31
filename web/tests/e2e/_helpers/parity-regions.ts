/**
 * Diff de paridade visual por REGIÃO da página.
 *
 * Por que existe: o threshold de 5% sobre a viewport inteira não distingue as
 * duas coisas que precisamos separar, e erra nas duas pontas.
 *
 * - **Passe falso.** Numa página majoritariamente fundo, a casca pode estar
 *   completamente diferente e o número total fica pequeno. Foi o caso de 4 dos
 *   7 "passes" medidos em 2026-08-27 (`hymn-detail`, `hymnbook-carrossel`,
 *   `hymnbook-corrido`, `busca`): passavam com 1,8–2,4% de diff e densidade de
 *   conteúdo desequilibrada em 5–21%.
 * - **Progresso invisível.** Medido em 2026-08-31, depois da Fase 1: em
 *   `hinarios-list` a tinta do shell saltou de 18,32% para 49,34% (o
 *   equilíbrio foi de 31,49% pra 84,53%) — a página deixou de ser um esqueleto
 *   e ganhou tipografia real — e o diff total praticamente não se moveu,
 *   de 48,49% pra 48,24%. O conteúdo passou a existir; está no lugar errado. Um
 *   número só não sabe dizer qual das duas coisas mudou.
 *
 * As regiões vêm do BOUNDING BOX real dos elementos na página do Django, que é
 * a referência, e o mesmo retângulo é aplicado aos dois lados. Recortar cada
 * lado pelo seu próprio box esconderia justamente a diferença de altura, que é
 * um dos achados (o hero do hinário tem ~470px no Django e 0 no shell).
 */

import type { Page } from "@playwright/test";

import {
  type ImageDiffResult,
  type Retangulo,
  diffPngBuffers,
  recortarPng,
} from "./image-diff";

/**
 * As regiões, na ordem de leitura da página.
 *
 * `header` e `rodape` são a CASCA — comuns a todas as rotas, e é neles que um
 * conserto de shell aparece em 11 rotas de uma vez. `corpo` é o conteúdo da
 * rota. Um seletor por região, escolhido por existir nos DOIS apps: o monolito
 * usa `<header>`/`<main>`/`<footer>` semânticos e o shell também.
 */
export const SELETORES_DE_REGIAO = {
  header: "header",
  corpo: "main",
  rodape: "footer",
} as const;

export type NomeDeRegiao = keyof typeof SELETORES_DE_REGIAO;

export type RegiaoMedida = {
  nome: NomeDeRegiao;
  /** `null` quando a região não aparece na viewport capturada. */
  resultado: ImageDiffResult | null;
  /** Retângulo usado, em coordenadas da captura. */
  rect: Retangulo | null;
};

/**
 * Lê os retângulos das regiões na página, limitados à área capturada.
 *
 * A captura é viewport-only (1280×720), então o rodapé fica fora do quadro na
 * maioria das rotas. Nesse caso a região sai como `null` — "não medida" é uma
 * resposta honesta; inventar um retângulo vazio produziria 0% de diff e um
 * falso "rodapé em paridade".
 */
export async function retangulosDeRegiao(
  page: Page,
  alturaDaCaptura: number,
  larguraDaCaptura: number,
): Promise<Partial<Record<NomeDeRegiao, Retangulo>>> {
  const rects: Partial<Record<NomeDeRegiao, Retangulo>> = {};

  for (const [nome, seletor] of Object.entries(SELETORES_DE_REGIAO)) {
    const elemento = page.locator(seletor).first();
    if ((await elemento.count()) === 0) continue;

    const box = await elemento.boundingBox();
    if (!box) continue;

    // `boundingBox` é relativo à viewport quando a página não rolou — e o
    // `captureRouteWithDiagnostics` faz `scrollTo(0, 0)` antes de capturar, de
    // propósito, justamente pra essa coordenada valer na imagem.
    const topo = Math.max(0, box.y);
    const base = Math.min(alturaDaCaptura, box.y + box.height);
    if (base - topo <= 0) continue;

    rects[nome as NomeDeRegiao] = {
      x: 0,
      y: topo,
      width: larguraDaCaptura,
      height: base - topo,
    };
  }

  return rects;
}

/** Mede o diff de cada região recortando as duas capturas pelo mesmo retângulo. */
export function medirRegioes(
  djangoShot: Buffer,
  svelteShot: Buffer,
  rects: Partial<Record<NomeDeRegiao, Retangulo>>,
): RegiaoMedida[] {
  return (Object.keys(SELETORES_DE_REGIAO) as NomeDeRegiao[]).map((nome) => {
    const rect = rects[nome];
    if (!rect) return { nome, resultado: null, rect: null };
    return {
      nome,
      rect,
      resultado: diffPngBuffers(recortarPng(djangoShot, rect), recortarPng(svelteShot, rect)),
    };
  });
}

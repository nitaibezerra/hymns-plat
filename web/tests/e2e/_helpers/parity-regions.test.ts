/**
 * Sanidade do recorte por região. Não depende de servidor nenhum.
 *
 * O que estes testes protegem: um recorte errado é a pior falha possível num
 * instrumento de medição, porque ele produz um NÚMERO — plausível, preciso e
 * sobre a área errada. É o mesmo modo de falha que fez o Sub-marco 4.I
 * comparar a SPA consigo mesma e reportar 0% de diff.
 */

import { expect, test } from "@playwright/test";

import { diffPngBuffers, recortarPng } from "./image-diff";
import { medirRegioes } from "./parity-regions";
import { BLACK, WHITE, solidPng, stackedPng } from "./png-fixtures";

const LARGURA = 40;
const ALTURA = 20;
const LINHAS_DE_TOPO = 5;

test.describe("recortarPng", () => {
  test("devolve exatamente as dimensões do retângulo pedido", () => {
    const recorte = recortarPng(solidPng(LARGURA, ALTURA, WHITE), {
      x: 0,
      y: 4,
      width: LARGURA,
      height: 6,
    });
    const medido = diffPngBuffers(recorte, solidPng(LARGURA, 6, WHITE));
    expect(medido.width).toBe(LARGURA);
    expect(medido.height).toBe(6);
    expect(medido.ratio).toBe(0);
  });

  test("recorta a FAIXA pedida, não uma faixa qualquer", () => {
    // Página sintética: 5 linhas de topo preto, 15 de fundo branco.
    const pagina = stackedPng(LARGURA, ALTURA, LINHAS_DE_TOPO, BLACK, WHITE);

    const topo = recortarPng(pagina, { x: 0, y: 0, width: LARGURA, height: LINHAS_DE_TOPO });
    expect(diffPngBuffers(topo, solidPng(LARGURA, LINHAS_DE_TOPO, BLACK)).ratio).toBe(0);

    const resto = recortarPng(pagina, {
      x: 0,
      y: LINHAS_DE_TOPO,
      width: LARGURA,
      height: ALTURA - LINHAS_DE_TOPO,
    });
    expect(diffPngBuffers(resto, solidPng(LARGURA, ALTURA - LINHAS_DE_TOPO, WHITE)).ratio).toBe(0);
  });

  test("corta o retângulo ao tamanho da imagem em vez de estourar", () => {
    const recorte = recortarPng(solidPng(LARGURA, ALTURA, WHITE), {
      x: 0,
      y: 15,
      width: LARGURA,
      height: 999,
    });
    expect(diffPngBuffers(recorte, solidPng(LARGURA, 5, WHITE)).height).toBe(5);
  });

  test("retângulo fora da imagem devolve 1×1 em vez de explodir", () => {
    const recorte = recortarPng(solidPng(LARGURA, ALTURA, WHITE), {
      x: 0,
      y: 999,
      width: LARGURA,
      height: 10,
    });
    expect(diffPngBuffers(recorte, recorte).height).toBe(1);
  });
});

test.describe("medirRegioes", () => {
  test("separa uma divergência que está SÓ na casca de uma que está no corpo", () => {
    // Os dois lados têm o corpo idêntico (branco) e o header oposto.
    // No viewport inteiro isso dá 25% de diff; por região, 100% no header e
    // 0% no corpo — que é a informação que o número único apaga.
    const django = stackedPng(LARGURA, ALTURA, LINHAS_DE_TOPO, BLACK, WHITE);
    const svelte = stackedPng(LARGURA, ALTURA, LINHAS_DE_TOPO, WHITE, WHITE);

    const inteiro = diffPngBuffers(django, svelte);
    expect(inteiro.ratio).toBeGreaterThan(0.24);
    expect(inteiro.ratio).toBeLessThan(0.26);

    const regioes = medirRegioes(django, svelte, {
      header: { x: 0, y: 0, width: LARGURA, height: LINHAS_DE_TOPO },
      corpo: { x: 0, y: LINHAS_DE_TOPO, width: LARGURA, height: ALTURA - LINHAS_DE_TOPO },
    });
    const porNome = new Map(regioes.map((r) => [r.nome, r]));
    expect(porNome.get("header")?.resultado?.ratio).toBe(1);
    expect(porNome.get("corpo")?.resultado?.ratio).toBe(0);
  });

  test("região sem retângulo sai como não medida, não como 0%", () => {
    // Rodapé fora da viewport é o caso real. Reportar 0% ali seria afirmar
    // paridade de uma área que ninguém olhou.
    const png = solidPng(LARGURA, ALTURA, WHITE);
    const regioes = medirRegioes(png, png, {
      header: { x: 0, y: 0, width: LARGURA, height: LINHAS_DE_TOPO },
    });
    const rodape = regioes.find((r) => r.nome === "rodape");
    expect(rodape?.resultado).toBeNull();
    expect(rodape?.rect).toBeNull();
  });
});

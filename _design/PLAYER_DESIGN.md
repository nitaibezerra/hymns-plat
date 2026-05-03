# Player de Áudio — Especificação de Design

> Documento de handoff para implementação. Cobre o player persistente da plataforma de hinários: estados, componentes, dados, comportamento e detalhes visuais.
> Referência visual: `Hymns Platform Fase 2.html` → seção **Player & Playback** (8 artboards).
> Código de referência: `screens/player-a.jsx` + `screens/player-scenes.jsx`.

---

## 1. Visão geral

O player é um **áudio persistente global**, no estilo Spotify: uma vez tocando, a barra fica fixa no rodapé enquanto o usuário navega por qualquer tela do app (Home, Hinário, Hino, Editor, etc). Pode ser expandido para tela cheia, abrir um drawer de fila, ou entrar em **Modo Trabalho** (uma view minimalista, sem distrações, pensada para uso durante o trabalho espiritual).

### Princípios de design

1. **Persistência** — a fila e o estado do player sobrevivem à navegação. O usuário nunca perde o ponto onde está.
2. **Hinário como álbum** — a unidade de reprodução padrão é o **hinário inteiro**, na ordem canônica. Hinos sem gravação são automaticamente pulados.
3. **Reverência > densidade** — controles discretos, tipografia serifada para letras/títulos, paleta escura no chrome do player para não competir com o conteúdo do app.
4. **Karaokê opcional** — letra acompanha a música no player expandido, sem ser intrusiva.
5. **Modo Trabalho** — escurece tudo o que não é a música. Para uso em sessões reais, projetado em telão ou no celular do dirigente.

---

## 2. Estrutura de estado (PlayerProvider)

O player é controlado por um único contexto React (`PlayerCtxA` em `screens/player-a.jsx`). Estado:

| Campo | Tipo | Default | Descrição |
|---|---|---|---|
| `visible` | bool | `false` | Player está ativo (barra visível) |
| `playing` | bool | `false` | Estado de reprodução (▶ / ⏸) |
| `book` | object | `SAMPLE_BOOK` | Hinário sendo tocado (id, título, autor, capa) |
| `queue` | array | `playable` | Fila ordenada — apenas hinos com `hasAudio: true` |
| `currentIdx` | int | `0` | Índice na fila do hino atual |
| `progress` | number 0..1 | `0` | Progresso do hino atual |
| `expanded` | bool | `false` | Player em tela cheia |
| `queueOpen` | bool | `false` | Drawer de fila aberto |
| `workMode` | bool | `false` | Modo Trabalho ativo |
| `sleepTimer` | number\|null | `null` | Timer (em minutos) — fim automático |

**API**: `set(patch)` faz merge raso ou recebe função `s => s'`.

### Filtro de fila

Quando o usuário toca um hinário, a fila é construída com:

```js
const playable = book.hymns.filter(h => h.hasAudio);
```

Hinos sem gravação **não entram na fila**, mas continuam visíveis no índice do hinário (com ícone ⊘ desabilitado e tooltip "Sem gravação ainda · Contribuir áudio").

---

## 3. Componentes (4 surfaces)

### 3.1 `PlayerBarA` — Barra compacta (rodapé, 76px)

**Sempre visível** quando `state.visible === true`. Layout em três colunas (`grid-template-columns: 320px 1fr 320px`):

**Coluna esquerda (320px)** — Now playing
- Capa quadrada 48×48px com gradiente `linear-gradient(135deg, var(--firmament), var(--gold))` e número do hino em display serif (Cormorant)
- Título do hino (serif 14px, 1 linha, ellipsis)
- Subtítulo `"O CRUZEIRO · MESTRE IRINEU"` (mono 10px, 60% opacity)

**Coluna central (1fr, max-width 520px)** — Controles
- Linha 1: ⏮ ⏯ ⏭ (botão play em círculo branco 40px, controles secundários sem fundo)
- Linha 2: timestamp atual `1:24` ── barra de progresso ── duração total `4:08`
- Barra de progresso: 3px, fundo `rgba(246,239,226,0.15)`, fill `var(--gold-soft)`, thumb circular 9px

**Coluna direita (320px)** — Ações
- Modo Trabalho (lua) · Sleep timer (relógio) · Compartilhar (nodes) · `|` divisor · Fila (lista) · Expandir (setas)
- Cada IconBtn é 30×30px, hover/active troca para `rgba(246,239,226,0.15)` + cor `var(--gold-soft)`

**Visual:**
- `background: rgba(20, 18, 26, 0.96)` + `backdrop-filter: blur(12px)`
- `border-top: 1px solid rgba(246,239,226,0.08)`
- Toda a barra é clicável → `set({ expanded: true })` (exceto controles, que param propagação)

### 3.2 `PlayerExpandedA` — Player expandido (full-screen, z-index 60)

Aparece quando `state.expanded === true`. Toma a tela inteira do app (não cobre status bar do iPhone no mobile).

**Layout:** grid `auto 1fr auto` (top bar / conteúdo / controles).

**Top bar:**
- Esquerda: `← Recolher` (texto + chevron)
- Centro: `O CRUZEIRO · 6 de 12` (mono 11px, 50% opacity, letter-spacing .15em)
- Direita: `⋯` (mais opções)

**Conteúdo (2 colunas):**

*Lado esquerdo — Capa:*
- Quadrado 320×320px, gradient firmament→gold, sombra `0 30px 80px rgba(0,0,0,0.5)`
- Topo: `O CRUZEIRO` (mono 11px tracking)
- Centro: número do hino em display 96px
- Base: estilo (`Mazurca` etc) em itálico serif 18px
- Abaixo da capa: título serif 28px + `MESTRE IRINEU · 1934` em mono

*Lado direito — Letra (karaokê):*
- Eyebrow: `LETRA · ACOMPANHAMENTO`
- Linhas em serif 22px / line-height 1.4
- Estado da linha:
  - **Atual** (`t >= line.t && t < next.t`): `color: #f6efe2`, `font-weight: 500`
  - **Já cantada**: `rgba(246,239,226,0.35)`
  - **Próxima**: `rgba(246,239,226,0.55)`
- Transição de cor: `color 200ms`
- Container scrollable, `max-height: 460px`

**Controles inferiores:**
- Linha de progresso (mais grossa, 4px) com timestamps de 36px de largura
- Botão play 60×60px branco; ⏮ ⏭ a 28px de gap

**Background:** `linear-gradient(180deg, #1a1620 0%, #14121a 60%)`.

### 3.3 `QueueDrawerA` — Drawer de fila (lateral direito, 380px)

Aparece quando `state.queueOpen && state.visible`. Sobrepõe o app, mas **não a barra** (top: 0, bottom: 76px).

**Header:**
- Eyebrow `FILA · O CRUZEIRO` (mono 10px tracking .18em)
- Título `Tocando agora` (serif 18px)
- Botão fechar `×` no canto direito
- Stats: `12 hinos · 4 sem áudio (pulados)` (mono 12px, 60% opacity)

**Lista de hinos:**
- Grid `32px 1fr auto` por linha
- Estados:
  - **Atual**: `▶` em vez do número, `var(--gold-soft)` no título, fundo `rgba(246,239,226,0.06)`, borda esquerda 2px gold
  - **Já tocados**: `opacity: 0.45`
  - **Próximos**: opacity total
- Click: `set({ currentIdx: i, progress: 0 })`

**Visual:** `background: rgba(26,24,32,0.97)` + blur 12px, borda esquerda 1px sutil.

### 3.4 `WorkModeOverlayA` — Modo Trabalho (full-screen, z-index 55)

Aparece quando `state.workMode === true`. **Sobrepõe tudo, inclusive a barra**, mas é dispensado mantendo `visible: true`.

**Filosofia:** zero distração. Sem capa, sem letra, sem fila visível. Apenas:
- Eyebrow `MODO TRABALHO` (mono 10px tracking .25em, opacity .4)
- `HINO 07 · O CRUZEIRO` (mono 11px tracking .18em)
- Título do hino em serif 36px, `rgba(246,239,226,0.92)`, weight 400
- Controles: ⏮ ⏯ ⏭ (botão play 56px com borda fina, **sem fundo branco** — diferente da barra normal)
- Linha de progresso fina (2px, 280px de largura, centralizada)
- Botão `Sair do modo trabalho` (pill com borda fina) ao final

**Background:** `rgba(8, 6, 12, 0.94)` + `backdrop-filter: blur(8px)`.

---

## 4. Integração com o resto do app

### 4.1 Hinário Detail (lista de hinos)

Quando o usuário entra em um hinário:

- **Botão principal** "Tocar hinário" no header (pill grande gold-soft sobre escuro)
  - **Idle**: `▶ Tocar hinário` → inicia do hino 0
  - **Tocando este livro**: `⏸ Pausar hinário · hino 06`
  - **Sem gravações** (todos `hasAudio: false`): `▶ Tocar hinário` desabilitado, opacidade 35%, tooltip + link inline `Sem gravações ainda. Contribuir áudio`

- **Cada linha do índice** tem ícone à esquerda (28×28 circular):
  - Com áudio: `▶` clicável → `playFrom(n)` (inicia daquele hino especificamente)
  - Sem áudio: ⊘ desabilitado, opacity 0.4
- **Linha do hino atual** (se for este livro): fundo `var(--gold-soft)` claro, ícone vira `⏸` se `playing`, peso 500 no título

### 4.2 Hino Detail (página individual)

- Letra em serif grande (ver doc de tipografia)
- Se este hino é o atual no player: indicador discreto `▶ Tocando agora` no topo, opacional sync de scroll com a letra cantada
- Botão `Tocar` no header da página (sempre — adiciona/move para esse hino)

### 4.3 Mobile (iPhone, 402×874)

- Barra do player gruda no rodapé do app, **acima do home indicator** (usar safe-area)
- Versão compacta da barra: capa 48px + título + ⏯ (controles secundários movem-se para o expandido)
- Tap na barra → expandido (mesmo conteúdo do desktop, mas em 1 coluna: capa em cima, letra embaixo)
- Modo Trabalho funciona igual (full-screen)

---

## 5. Dados — formato

### Hino
```ts
type Hymn = {
  n: number;            // número canônico (1-indexed)
  t: string;            // título
  dur: string;          // "M:SS"
  hasAudio: boolean;    // se tem gravação
  style?: string;       // "Valsa" | "Marcha" | "Mazurca" etc
  audioUrl?: string;    // URL do MP3/OGG (não no mock)
};
```

### Hinário
```ts
type Hymnbook = {
  id: string;
  title: string;
  author: string;
  cover?: string;       // URL ou null (gera fallback gradient)
  hymns: Hymn[];
};
```

### Letra (karaokê)
```ts
type LyricLine = {
  line: string;
  t: number;            // segundos a partir do início do hino
};
```

Cada hino com áudio pode ter `lyrics: LyricLine[]`. Se ausente, o player expandido mostra letra estática (sem highlight).

---

## 6. Tokens visuais relevantes

Definidos em `styles/tokens.css` — o player usa:

- `--paper`, `--paper-soft` — claros do app (não usados no chrome do player)
- `--ink`, `--ink-soft`, `--ink-mute` — pretos editoriais
- `--firmament`, `--firmament-2` — azuis profundos da identidade
- `--gold`, `--gold-soft` — dourados (acentos do player, progress fill, hover)
- `--font-display` (Cormorant Garamond) — números, capas
- `--font-serif` (Source Serif 4) — títulos de hinos, letras, copy editorial
- `--font-sans` (Inter Tight) — UI, botões, eyebrows curtos
- `--font-mono` (JetBrains Mono) — eyebrows técnicos, timestamps, contadores

**Chrome do player é sempre escuro**, independente do tema do app:
- BG primária: `rgba(20, 18, 26, 0.96)` + blur
- Texto: `#f6efe2` (paper warm) com gradações de opacity
- Acentos: `var(--gold-soft)` (#d9b06a) para progress, ativo, hover

---

## 7. Comportamentos críticos para implementação

1. **Pular automático sem áudio** — quando o player chega ao fim de um hino, avança para o próximo da `queue` (que já é filtrada). Hinos sem áudio nunca aparecem na fila.

2. **Início via "Tocar hinário"** — sempre seta `currentIdx: 0, progress: 0, playing: true, visible: true`. Substitui a fila atual.

3. **Início via `▶` em hino específico** — `currentIdx = queue.findIndex(h => h.n === n)`, mantém o resto.

4. **Continuar hinário** — se o player já está nesse livro, o botão muda para "Pausar/Continuar" e apenas alterna `playing`.

5. **Trocar de livro enquanto toca** — o player atual continua; o usuário pode navegar livremente. Para tocar outro livro, basta apertar "Tocar hinário" — substitui a fila.

6. **Persistência** — `currentIdx`, `progress`, `book`, `queue`, `playing` devem persistir entre sessões (localStorage ou backend). `expanded`, `queueOpen`, `workMode` são efêmeros.

7. **Sleep timer** — quando `sleepTimer` é setado (15/30/60min), começa countdown; ao expirar, fade-out de 4s e `set({ playing: false })`.

8. **Modo Trabalho + tela cheia do dispositivo** — no mobile, ao entrar em Modo Trabalho, considerar pedir `screen.wakeLock` para a tela não dormir durante o trabalho.

9. **Acessibilidade**:
   - Todos os IconBtns têm `aria-label` e `title`
   - Barra de progresso deve ser implementada como `<input type="range">` com label apropriado
   - Botão play tem estado anunciado por `aria-pressed`
   - Modo Trabalho: `role="dialog" aria-modal="true"`, foco preso, ESC sai

10. **Áudio real** — usar `<audio>` HTML5 com `preload="metadata"`. `mediaSession` API para controles do sistema (lockscreen, fone Bluetooth):
    ```js
    navigator.mediaSession.metadata = new MediaMetadata({
      title: cur.t,
      artist: book.author,
      album: book.title,
      artwork: [{ src: book.cover, sizes: "512x512" }],
    });
    navigator.mediaSession.setActionHandler("play", ...);
    navigator.mediaSession.setActionHandler("nexttrack", ...);
    // etc
    ```

---

## 8. O que **não** está no escopo desta versão

Removidos por simplificação:

- ❌ **Linha do Trabalho** (variação B) — substituída totalmente pela barra Spotify-style
- ❌ **Marcadores de intervalo / rezas inline** — sem prece/intervalo na fila. O hinário é tocado direto, fim. Pode ser readicionado depois com um `markers: [{ kind, label, after }]` por livro.

Funcionalidades a considerar em fases futuras:

- 🔜 Equalizador / velocidade (.5x .75x 1x 1.25x)
- 🔜 Download para offline
- 🔜 Compartilhar timestamp específico
- 🔜 Fila editável (drag-reorder, adicionar hinos avulsos)
- 🔜 Histórico ("ouvido recentemente")

---

## 9. Arquivos do protótipo (referência)

| Arquivo | Conteúdo |
|---|---|
| `screens/player-a.jsx` | PlayerProvider, PlayerBar, QueueDrawer, PlayerExpanded, WorkModeOverlay |
| `screens/player-scenes.jsx` | Cenas compostas (Scene_BookIdle, Scene_BookPlaying, Scene_QueueOpen, Scene_Expanded, Scene_WorkMode, Scene_BookNoAudio, Scene_Mobile) e o header customizado do hinário com botão Tocar |
| `screens/_shared.jsx` | `CRUZEIRO_HYMNS` (16 hinos, 4 sem áudio), `HYMN_7_LYRICS` (timestamps de exemplo), `SAMPLE_BOOK` |
| `styles/tokens.css` | Variáveis de cor, tipografia, espaço |
| `styles/components.css` | Classes utilitárias `.serif`, `.mono`, `.h-display`, `.pill`, etc |

Cenas no canvas (`Hymns Platform Fase 2.html` → seção **Player & Playback**):

1. Hinário com botão Tocar (idle)
2. Tocando · barra inferior
3. Fila aberta (drawer)
4. Player expandido (capa + karaokê)
5. Modo Trabalho
6. Hinário sem áudio (botão desabilitado)
7. Mobile · barra rodapé
8. Mobile · expandido

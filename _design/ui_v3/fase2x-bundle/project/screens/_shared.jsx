/* global React */
// Shared mini-components: AppBar, brand glyph, sample data
const { useState, useEffect, useRef, useMemo } = React;

// ===== Brand glyph: 8-pointed star + dot (firmament) =====
const BrandGlyph = ({ size = 28, color = "currentColor" }) => (
  <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
    <g fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round">
      <path d="M16 3 L16 29 M3 16 L29 16 M6.7 6.7 L25.3 25.3 M25.3 6.7 L6.7 25.3"/>
      <circle cx="16" cy="16" r="4.5" fill={color} stroke="none"/>
      <circle cx="16" cy="16" r="9" />
    </g>
  </svg>
);

// End-of-hymn glyphs (mirror PDF generator's rotation: ✡ majority, then ☀ ☾ ★)
const endGlyphFor = (n) => ["✡", "✡", "☀", "☾", "★"][n % 5];

// ===== AppBar =====
const AppBar = ({ active = "home", username = "MR" }) => (
  <div className="appbar">
    <div className="brand">
      <span className="glyph"><BrandGlyph /></span>
      <span>Hinaria</span>
    </div>
    <nav>
      <a href="#" aria-current={active === "home" ? "page" : undefined}>Início</a>
      <a href="#" aria-current={active === "list" ? "page" : undefined}>Hinários</a>
      <a href="#" aria-current={active === "search" ? "page" : undefined}>Buscar</a>
      <a href="#" aria-current={active === "contribuir" ? "page" : undefined}>Contribuir</a>
    </nav>
    <div className="spacer" />
    <div className="search-mini">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="7" cy="7" r="5"/><path d="M11 11 L14 14"/>
      </svg>
      <span>Buscar hinos…</span>
      <span className="mono" style={{marginLeft: "auto", fontSize: 10}}>⌘ K</span>
    </div>
    {/* Fila de revisão — ferramenta de trabalho do revisor, separada do nav público.
        Vive ao lado das ações da conta (notificações + avatar). */}
    <a href="#" className="editor-cta" aria-current={active === "editor" ? "page" : undefined}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2.5 3.5 H13.5 M2.5 8 H13.5 M2.5 12.5 H9"/>
        <circle cx="12" cy="12.5" r="2"/>
      </svg>
      <span>Fila de revisão</span>
      <span className="editor-cta-count">4</span>
    </a>
    <button className="icon-btn" aria-label="Notificações">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M3 11 L3 7 a5 5 0 0 1 10 0 L13 11 L14 12 L2 12 Z"/>
        <path d="M6.5 13.5 a1.5 1.5 0 0 0 3 0"/>
      </svg>
      <span className="dot" />
    </button>
    <div className="avatar">{username}</div>
  </div>
);

// ===== Sample data =====
const SAMPLE_HYMN = {
  number: 7,
  title: "Estrela Brilhante",
  bookName: "O Cruzeiro",
  bookOwner: "Mestre Irineu",
  receivedAt: "1934-05-12",
  offeredTo: "Para Nossa Senhora da Conceição",
  style: "Mazurca",
  body: [
    { text: "Estrela brilhante\nQue brilha no firmamento\nMe dai a Vossa luz\nNeste sagrado momento", rep: 0 },
    { text: "Eu peço com humildade\nÀ Virgem Mãe Soberana\nQue me dê de Sua glória\nNesta hora soberana", rep: 2 },
    { text: "Olhai para nós, Senhora\nQue estamos a Vos cantar\nDai-nos forças no caminho\nPara nunca mais errar", rep: 0 },
    { text: "Cantemos todos juntos\nCom amor e devoção\nA estrela do firmamento\nMora dentro do coração", rep: 2 },
  ],
};

const SAMPLE_BOOK = {
  name: "O Cruzeiro",
  intro: "Hinário do Mestre Irineu",
  owner: "Mestre Raimundo Irineu Serra",
  count: 132,
  reviewed: 132,
  status: "published",
  desc: "Hinário recebido pelo Mestre Irineu, fundador da doutrina do Santo Daime, ao longo de sua vida. É a base da doutrina e contém os hinos centrais cantados em todos os trabalhos.",
};

const HYMNBOOKS = [
  { name: "O Cruzeiro", owner: "Mestre Irineu", count: 132, reviewed: 132, status: "published", year: 1971, hue: 1 },
  { name: "O Justiceiro", owner: "Padrinho Sebastião", count: 152, reviewed: 152, status: "published", year: 1976, hue: 2 },
  { name: "Nova Jerusalém", owner: "Madrinha Rita", count: 87, reviewed: 87, status: "published", year: 1983, hue: 3 },
  { name: "Hinos do Sol", owner: "Padrinho Alfredo", count: 64, reviewed: 41, status: "draft", year: 2024, hue: 4 },
  { name: "Estrela do Mar", owner: "Antônio Geraldo", count: 48, reviewed: 12, status: "draft", year: 2025, hue: 5 },
  { name: "Caminho da Floresta", owner: "Maria Brilhante", count: 92, reviewed: 92, status: "published", year: 2002, hue: 6 },
];

// QUEUE: estendido com priority (P1/P2/P3), is_featured, métricas granulares (style/reps/audio %)
// e last_activity. Espelha o schema do plano-revisoes-ux-priorizacao-editorial.md.
const QUEUE = [
  {
    name: "Hinos do Sol", owner: "Padrinho Alfredo",
    total: 64, reviewed: 41, in_review: 3, uploaded: "há 2 dias",
    priority: "P1", is_featured: true,
    style_pct: 78, reps_pct: 33, audio_pct: 19,
    last_activity: { who: "Joana M.", n: 12, when: "hoje, 14:22" },
  },
  {
    name: "Estrela do Mar", owner: "Antônio Geraldo",
    total: 48, reviewed: 12, in_review: 1, uploaded: "há 5 horas",
    priority: "P1", is_featured: false,
    style_pct: 25, reps_pct: 8, audio_pct: 0,
    last_activity: { who: "Carlos B.", n: 5, when: "ontem" },
  },
  {
    name: "Hinos da Madrinha", owner: "Madrinha Júlia",
    total: 36, reviewed: 36, in_review: 0, uploaded: "há 1 semana",
    priority: "P2", is_featured: true,
    style_pct: 100, reps_pct: 89, audio_pct: 47,
    last_activity: { who: "Pedro A.", n: 3, when: "há 4 dias" },
  },
  {
    name: "O Mensageiro", owner: "Francisco Granjeiro",
    total: 78, reviewed: 0, in_review: 0, uploaded: "agora",
    priority: "P3", is_featured: false,
    style_pct: 0, reps_pct: 0, audio_pct: 0,
    last_activity: null,
  },
];

// ===== Hinário Cruzeiro: lista expandida com áudios e marcadores =====
// Estrutura: hinos com {n, t, dur, hasAudio, style?} + marcadores entre hinos
// Marcadores: { kind: "prayer"|"break", label, sub?, after: <hymn n> }
const CRUZEIRO_HYMNS = [
  {n:1, t:"Lua Branca", dur:"3:42", hasAudio:true, style:"Valsa"},
  {n:2, t:"Tuperci", dur:"2:58", hasAudio:true, style:"Mazurca"},
  {n:3, t:"O Sol, A Lua, A Estrela", dur:"4:12", hasAudio:true, style:"Marcha"},
  {n:4, t:"Pisei na Pedra", dur:"3:24", hasAudio:false},
  {n:5, t:"Cantarei", dur:"2:48", hasAudio:true, style:"Valsa"},
  {n:6, t:"Eu Vou Cantar", dur:"3:08", hasAudio:true, style:"Mazurca"},
  {n:7, t:"Estrela Brilhante", dur:"4:08", hasAudio:true, style:"Mazurca"},
  {n:8, t:"O Cruzeiro", dur:"3:36", hasAudio:true, style:"Marcha"},
  {n:9, t:"Estou Aqui", dur:"3:12", hasAudio:false},
  {n:10, t:"Eu Pisei na Estrada", dur:"4:02", hasAudio:true, style:"Valsa"},
  {n:11, t:"Tomei a Minha Bandeira", dur:"3:18", hasAudio:true, style:"Marcha"},
  {n:12, t:"Sol da Vida", dur:"2:54", hasAudio:true, style:"Mazurca"},
  {n:13, t:"Estrela do Céu", dur:"3:48", hasAudio:true, style:"Valsa"},
  {n:14, t:"Devo Amar Aquela Luz", dur:"4:24", hasAudio:false},
  {n:15, t:"O Sol, A Lua e o Mar", dur:"3:30", hasAudio:true, style:"Marcha"},
  {n:16, t:"Sol e Lua", dur:"3:06", hasAudio:true, style:"Mazurca"},
];
// Karaokê timestamps para hino 7 (segundos)
const HYMN_7_LYRICS = [
  { line: "Estrela brilhante", t: 0 },
  { line: "Que brilha no firmamento", t: 4 },
  { line: "Me dai a Vossa luz", t: 9 },
  { line: "Neste sagrado momento", t: 14 },
  { line: "Eu peço com humildade", t: 22 },
  { line: "À Virgem Mãe Soberana", t: 27 },
  { line: "Que me dê de Sua glória", t: 32 },
  { line: "Nesta hora soberana", t: 37 },
];

Object.assign(window, { BrandGlyph, AppBar, endGlyphFor, SAMPLE_HYMN, SAMPLE_BOOK, HYMNBOOKS, QUEUE, CRUZEIRO_HYMNS, HYMN_7_LYRICS });

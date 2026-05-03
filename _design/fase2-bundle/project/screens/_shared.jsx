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
      <a href="#" aria-current={active === "editor" ? "page" : undefined}>Editor</a>
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

const QUEUE = [
  { name: "Hinos do Sol", owner: "Padrinho Alfredo", total: 64, reviewed: 41, in_review: 3, source: "OCR", uploaded: "há 2 dias" },
  { name: "Estrela do Mar", owner: "Antônio Geraldo", total: 48, reviewed: 12, in_review: 1, source: "OCR", uploaded: "há 5 horas" },
  { name: "Hinos da Madrinha", owner: "Madrinha Júlia", total: 36, reviewed: 36, in_review: 0, source: "Manual", uploaded: "há 1 semana" },
  { name: "O Mensageiro", owner: "Francisco Granjeiro", total: 78, reviewed: 0, in_review: 0, source: "OCR", uploaded: "agora" },
];

Object.assign(window, { BrandGlyph, AppBar, endGlyphFor, SAMPLE_HYMN, SAMPLE_BOOK, HYMNBOOKS, QUEUE });

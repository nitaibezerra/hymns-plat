/* global React, AppBar, endGlyphFor */
const { useState: useStateB } = React;

// =====================================================
// Screen: Hymnbook DETAIL (página de detalhe do hinário)
// Mudança vs. v1: sem tab "Modo de leitura". O índice é o conteúdo direto.
// CTAs no cover: "Tocar hinário" (gold solid) + "Abrir hinário" (gold outline).
// "Abrir hinário" leva para HymnbookReadScreen (corrido | carrossel).
// =====================================================
const HymnbookDetailScreen = () => {
  const [priority, setPriority] = useStateB("P2");
  const [featured, setFeatured] = useStateB(true);

  return (
    <div className="app-shell" style={{minHeight: 1100}}>
      <AppBar active="list" />

      {/* Cover header — mesma estrutura, com os novos botões inline */}
      <header style={{
        padding: "48px 64px 32px",
        background: `linear-gradient(180deg, oklch(0.32 0.06 240) 0%, oklch(0.22 0.04 240) 100%)`,
        color: "var(--paper)",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{position: "absolute", top: -40, right: -40, fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 320, opacity: 0.06, lineHeight: 0.8}}>
          C
        </div>
        <div style={{display: "flex", alignItems: "flex-end", gap: 48, position: "relative"}}>
          <div style={{
            width: 200, aspectRatio: "3/4",
            background: `radial-gradient(ellipse at 30% 20%, oklch(0.55 0.10 35 / 0.55), transparent 60%), linear-gradient(180deg, #2a3954, #161e30)`,
            borderRadius: 8, padding: 18, display: "flex", flexDirection: "column", justifyContent: "space-between",
            border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 40px rgba(0,0,0,0.3)"
          }}>
            <div className="mono" style={{fontSize: 9, letterSpacing: ".2em", opacity: 0.6}}>EST. 1971</div>
            <div>
              <div className="display" style={{fontSize: 26, lineHeight: 1.05, marginBottom: 6}}>O Cruzeiro</div>
              <div className="mono" style={{fontSize: 9, letterSpacing: ".15em", opacity: 0.6}}>MESTRE IRINEU</div>
            </div>
          </div>
          <div style={{flex: 1, paddingBottom: 16}}>
            <div className="mono" style={{fontSize: 11, letterSpacing: ".18em", opacity: 0.6, marginBottom: 12}}>HINÁRIO COMPLETO</div>
            <h1 className="h-display" style={{fontSize: 56, margin: "0 0 12px", lineHeight: 1}}>O Cruzeiro</h1>
            <p className="serif" style={{fontSize: 18, opacity: 0.85, fontStyle: "italic", marginBottom: 20, maxWidth: 600}}>
              Hinário recebido pelo Mestre Raimundo Irineu Serra
            </p>
            {/* Linha de meta + CTAs */}
            <div style={{display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap"}}>
              <span className="mono" style={{fontSize: 12, letterSpacing: ".1em", opacity: 0.7}}>132 HINOS</span>
              <span className="mono" style={{fontSize: 12, letterSpacing: ".1em", opacity: 0.7}}>14 ÁUDIOS</span>

              {/* Tocar hinário — sólido gold-soft */}
              <button type="button" style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "8px 16px", borderRadius: 999,
                background: "var(--gold-soft)", color: "#1a1d2e",
                border: 0, fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 500,
                cursor: "pointer",
              }}>
                <svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><path d="M3 1 L12 7 L3 13 Z"/></svg>
                Tocar hinário
              </button>

              {/* Abrir hinário — outline gold-soft */}
              <a href="#" style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "8px 16px", borderRadius: 999,
                background: "transparent", color: "var(--gold-soft)",
                border: "1px solid var(--gold-soft)",
                fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 500,
                textDecoration: "none",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2z"/>
                  <path d="M22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z"/>
                </svg>
                Abrir hinário
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Painel staff — só staff vê */}
      <EditorialStaffPanel
        priority={priority} setPriority={setPriority}
        featured={featured} setFeatured={setFeatured}
      />

      {/* Índice direto — sem tab, sem switch */}
      <IndexBody />
    </div>
  );
};

// =====================================================
// Screen: Hymnbook READ (leitura · /hinarios/<slug>/ler/?modo=corrido|carrossel)
// Chrome: breadcrumb voltando ao detalhe + tabs underline minimal.
// Default modo=corrido. Carrossel é alternativa.
// =====================================================
const HymnbookReadScreen = ({initialMode = "flow"} = {}) => {
  const [mode, setMode] = useStateB(initialMode); // flow | carousel
  const [carouselIdx, setCarouselIdx] = useStateB(7);

  return (
    <div className="app-shell" style={{minHeight: 1100}}>
      <AppBar active="list" />

      {/* Header de leitura — breadcrumb + 2 tabs underline */}
      <section style={{
        maxWidth: 760, margin: "0 auto",
        padding: "28px 24px 0", textAlign: "center",
      }}>
        <a href="#" style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          fontFamily: "var(--font-sans)", fontSize: 14,
          color: "var(--ink-soft)", textDecoration: "none",
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
          <span>O Cruzeiro</span>
        </a>
        <nav role="tablist" aria-label="Modo de leitura" style={{
          marginTop: 18, display: "flex", justifyContent: "center", gap: 36,
        }}>
          {[
            {k: "flow", l: "Corrido"},
            {k: "carousel", l: "Carrossel"},
          ].map(t => {
            const active = mode === t.k;
            return (
              <a key={t.k} href="#" role="tab" aria-selected={active}
                onClick={(e) => {e.preventDefault(); setMode(t.k);}}
                style={{
                  fontFamily: "var(--font-mono)", fontSize: 12,
                  letterSpacing: ".18em", textTransform: "uppercase",
                  color: active ? "var(--ink)" : "var(--ink-mute)",
                  textDecoration: "none",
                  paddingBottom: 8,
                  borderBottom: "2px solid " + (active ? "var(--vermilion)" : "transparent"),
                  transition: "color 120ms, border-color 120ms",
                }}>
                {t.l}
              </a>
            );
          })}
        </nav>
      </section>

      {/* Body switches */}
      {mode === "flow" && <FlowBody />}
      {mode === "carousel" && <CarouselBody idx={carouselIdx} setIdx={setCarouselIdx} />}
    </div>
  );
};

// =====================================================
// Editorial staff panel (inalterado)
// =====================================================
const EditorialStaffPanel = ({priority, setPriority, featured, setFeatured}) => {
  const PRIO_ROWS = [
    { k: "P1", l: "P1 Urgente", c: "var(--vermilion)" },
    { k: "P2", l: "P2 Atenção", c: "var(--gold)" },
    { k: "P3", l: "P3",         c: "var(--ink-mute)" },
  ];
  return (
    <section style={{
      background: "var(--paper-soft)",
      borderBottom: "1px solid var(--rule)",
      padding: "12px 64px",
      display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap",
    }}>
      <span className="eyebrow" style={{margin: 0}}>STAFF</span>

      <div style={{display: "flex", alignItems: "center", gap: 8}}>
        <span className="mono muted" style={{fontSize: 11, letterSpacing: ".05em"}}>Prioridade</span>
        <div style={{display: "inline-flex", padding: 2, background: "var(--paper)", border: "1px solid var(--rule)", borderRadius: 999}}>
          {PRIO_ROWS.map(r => {
            const active = priority === r.k;
            return (
              <button key={r.k} type="button" onClick={() => setPriority(r.k)} style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "5px 12px", border: 0, borderRadius: 999,
                background: active ? r.c : "transparent",
                color: active ? (r.k === "P2" ? "#1a1d2e" : "var(--paper)") : "var(--ink-soft)",
                fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".05em",
                cursor: "pointer", transition: "background 120ms, color 120ms",
              }}>
                {!active && <span style={{width: 6, height: 6, borderRadius: "50%", background: r.c, opacity: 0.7}}/>}
                {r.l}
              </button>
            );
          })}
        </div>
      </div>

      <label style={{display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer"}}>
        <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)}
          style={{accentColor: "var(--gold)", width: 14, height: 14, margin: 0}}/>
        <span style={{fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".05em", color: "var(--ink-soft)"}}>
          Em destaque na home
        </span>
      </label>

      <div style={{flex: 1}}/>

      <button type="button" className="btn btn-ghost" style={{fontSize: 12, padding: "6px 14px"}}>
        Salvar
      </button>
    </section>
  );
};

// ----- Index list (agora é o body default do detail) -----
// Inclui botão de play (▶) por hino quando há áudio — espelhando o template real.
const HYMN_LIST = [
  {n:1, t:"Lua Branca", style:"Valsa", audio:true},
  {n:2, t:"Tuparí", style:"Marcha", audio:false},
  {n:3, t:"Sol, Lua, Estrela", style:"Mazurca", audio:true},
  {n:4, t:"Eu Sou Filho do Sol e da Lua", style:"Marcha", audio:false},
  {n:5, t:"O Cruzeiro", style:"Marcha", audio:true},
  {n:6, t:"Pisei na Terra Fria", style:"Mazurca", audio:false},
  {n:7, t:"Estrela Brilhante", style:"Mazurca", audio:true, fav: true},
  {n:8, t:"Papai Paranã", style:"Marcha", audio:false},
  {n:9, t:"Tonzinho", style:"Marcha", audio:false},
  {n:10, t:"Olhei para o Céu", style:"Mazurca", audio:true},
  {n:11, t:"Eu Vou Mostrar a Vocês", style:"Marcha", audio:false},
  {n:12, t:"Sol da Verdade", style:"Marcha", audio:false, fav: true},
];

const IndexBody = () => (
  <div style={{padding: "32px 64px"}}>
    <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, maxWidth: 1040, margin: "0 auto"}}>
      {[0, 1].map(col => (
        <div key={col}>
          {HYMN_LIST.slice(col * 6, col * 6 + 6).map((h) => (
            <div key={h.n} style={{
              display: "grid", gridTemplateColumns: "auto auto 1fr auto auto", gap: 10,
              alignItems: "center", padding: "10px 0",
              borderBottom: "1px solid var(--rule-soft)",
            }}>
              {/* Play btn (or disabled placeholder) — espelha hymnbook_detail.html */}
              {h.audio ? (
                <button type="button" aria-label={`Tocar hino ${h.n}`} style={{
                  width: 28, height: 28, borderRadius: "50%",
                  display: "grid", placeItems: "center",
                  border: "1px solid color-mix(in oklab, var(--firmament) 30%, var(--rule))",
                  background: "transparent", color: "var(--firmament)",
                  cursor: "pointer",
                }}>
                  <svg width="9" height="9" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><path d="M3 1 L12 7 L3 13 Z"/></svg>
                </button>
              ) : (
                <span aria-label="Sem gravação" title="Sem gravação ainda" style={{
                  width: 28, height: 28, display: "grid", placeItems: "center",
                  color: "var(--ink-mute)", opacity: 0.4, fontSize: 14,
                }}>⊘</span>
              )}
              <span className="mono" style={{fontSize: 12, color: "var(--ink-mute)", width: 24, textAlign: "right"}}>{String(h.n).padStart(2, "0")}</span>
              <a href="#" style={{
                display: "flex", alignItems: "baseline", overflow: "hidden", whiteSpace: "nowrap",
                textDecoration: "none", color: "var(--ink)",
                minWidth: 0,
              }}>
                <span className="serif" style={{fontSize: 17}}>{h.t}</span>
                <span className="mono" style={{flex: 1, color: "var(--rule)", letterSpacing: 4, fontSize: 11, padding: "0 8px", overflow: "hidden"}}>
                  {".".repeat(60)}
                </span>
              </a>
              <span className="mono muted" style={{fontSize: 10, letterSpacing: ".1em"}}>{h.style}</span>
              <span style={{width: 16, textAlign: "right", color: "var(--gold)"}}>{h.fav && "★"}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  </div>
);

// ----- Flow mode (PDF-like continuous) -----
const FlowBody = () => (
  <div style={{padding: "32px 24px", background: "var(--paper-deep)", minHeight: 800, marginTop: 24}}>
    <div style={{maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 32}}>
      {[
        {n: 6, t: "Pisei na Terra Fria", body: "Pisei na terra fria\nVi a Virgem Mãe Maria\nMe ensinou eu a cantar\nE me deu a Sua alegria", end: 0},
        {n: 7, t: "Estrela Brilhante", body: "Estrela brilhante\nQue brilha no firmamento\nMe dai a Vossa luz\nNeste sagrado momento", end: 1},
        {n: 8, t: "Papai Paranã", body: "Papai Paranã\nMandou me chamar\nÉ na hora certa\nQue Ele está a esperar", end: 2},
      ].map((h) => (
        <article key={h.n} className="hymn-page" style={{padding: "40px 56px", scrollSnapAlign: "start"}}>
          <h2 className="hymn-title" style={{fontSize: 26}}>{h.n} - {h.t}</h2>
          <div className="hymn-body" style={{fontSize: 16}}>
            <div className="hymn-stanza rep" data-rep="2×">{h.body}</div>
          </div>
          <div className="hymn-end">{endGlyphFor(h.end)}</div>
        </article>
      ))}
    </div>
  </div>
);

// ----- Carousel mode -----
const CarouselBody = ({idx, setIdx}) => (
  <div style={{padding: "32px 64px", background: "var(--paper-deep)", minHeight: 700, position: "relative", marginTop: 24}}>
    <div style={{position: "absolute", top: 24, left: "50%", transform: "translateX(-50%)", zIndex: 2,
      background: "var(--paper)", border: "1px solid var(--rule)", borderRadius: 999, padding: "6px 14px"}}>
      <span className="mono" style={{fontSize: 12, color: "var(--ink-soft)", letterSpacing: ".1em"}}>{String(idx).padStart(2,"0")} / 132</span>
    </div>

    <div style={{display: "flex", alignItems: "center", justifyContent: "center", gap: 24, minHeight: 600}}>
      <button onClick={() => setIdx(Math.max(1, idx - 1))} className="btn btn-ghost" style={{borderRadius: "50%", width: 48, height: 48, padding: 0, fontSize: 20}}>‹</button>

      <article className="hymn-page" style={{flex: 1, maxWidth: 640, padding: "56px 64px", boxShadow: "var(--shadow-2)"}}>
        <h2 className="hymn-title">7 - Estrela Brilhante</h2>
        <div className="hymn-body">
          <div className="hymn-stanza rep" data-rep="2×">{`Estrela brilhante\nQue brilha no firmamento\nMe dai a Vossa luz\nNeste sagrado momento`}</div>
          <div className="hymn-stanza rep" data-rep="2×">{`Eu peço com humildade\nÀ Virgem Mãe Soberana\nQue me dê de Sua glória\nNesta hora soberana`}</div>
        </div>
        <div className="hymn-end">✡</div>
      </article>

      <button onClick={() => setIdx(Math.min(132, idx + 1))} className="btn btn-ghost" style={{borderRadius: "50%", width: 48, height: 48, padding: 0, fontSize: 20}}>›</button>
    </div>

    <div style={{display: "flex", justifyContent: "center", gap: 4, marginTop: 24}}>
      {Array.from({length: 11}).map((_, i) => (
        <div key={i} style={{width: i === 5 ? 24 : 6, height: 6, borderRadius: 999, background: i === 5 ? "var(--firmament)" : "var(--rule)"}}/>
      ))}
    </div>
    <div style={{textAlign: "center", marginTop: 14}}>
      <span className="mono muted" style={{fontSize: 11, letterSpacing: ".1em"}}>← → para navegar · espaço para tocar áudio</span>
    </div>
  </div>
);

Object.assign(window, { HymnbookDetailScreen, HymnbookReadScreen });

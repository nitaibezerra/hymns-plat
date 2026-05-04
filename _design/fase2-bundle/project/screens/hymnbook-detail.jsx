/* global React, AppBar, SAMPLE_HYMN, endGlyphFor */
const { useState: useStateB } = React;

// =====================================================
// Screen: Hymnbook detail with 3 reading modes
// =====================================================
const HymnbookDetailScreen = ({initialMode = "index"} = {}) => {
  const [mode, setMode] = useStateB(initialMode); // index | flow | carousel
  const [carouselIdx, setCarouselIdx] = useStateB(7);

  return (
    <div className="app-shell" style={{minHeight: 1200}}>
      <AppBar active="list" />

      {/* Cover header */}
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
            <p className="serif" style={{fontSize: 18, opacity: 0.85, fontStyle: "italic", marginBottom: 16, maxWidth: 600}}>
              Hinário recebido pelo Mestre Raimundo Irineu Serra
            </p>
            <div style={{display: "flex", gap: 24, alignItems: "center"}}>
              <span className="mono" style={{fontSize: 12, letterSpacing: ".1em", opacity: 0.7}}>132 HINOS</span>
              <span style={{opacity: 0.3}}>·</span>
              <span className="mono" style={{fontSize: 12, letterSpacing: ".1em", opacity: 0.7}}>14 ÁUDIOS</span>
              <span style={{opacity: 0.3}}>·</span>
              <span className="pill pill-ok" style={{background: "rgba(74,106,58,0.2)", borderColor: "rgba(255,255,255,0.2)", color: "#9bc88a"}}>Publicado</span>
            </div>
          </div>
        </div>
      </header>

      {/* Mode tabs */}
      <div style={{
        padding: "16px 64px", background: "var(--paper-soft)",
        borderBottom: "1px solid var(--rule)", display: "flex", alignItems: "center", gap: 24
      }}>
        <span className="eyebrow">Modo de leitura:</span>
        <div style={{display: "flex", padding: 4, background: "var(--paper)", border: "1px solid var(--rule)", borderRadius: 999}}>
          {[
            {k: "index", label: "Índice", icon: "≣"},
            {k: "flow", label: "Corrido", icon: "≡"},
            {k: "carousel", label: "Carrossel", icon: "▭"},
          ].map(m => (
            <button key={m.k} onClick={() => setMode(m.k)}
              style={{
                padding: "8px 18px", border: 0, borderRadius: 999, cursor: "pointer",
                background: mode === m.k ? "var(--firmament)" : "transparent",
                color: mode === m.k ? "var(--paper)" : "var(--ink-soft)",
                fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500,
                display: "flex", alignItems: "center", gap: 8,
              }}>
              <span style={{fontSize: 14}}>{m.icon}</span>{m.label}
            </button>
          ))}
        </div>
        <div style={{flex: 1}} />
        <span className="mono muted" style={{fontSize: 11}}>
          {mode === "index" && "lista clicável · acesso rápido"}
          {mode === "flow" && "leitura contínua · scroll vertical"}
          {mode === "carousel" && "um por vez · swipe ou setas"}
        </span>
      </div>

      {/* Body switches */}
      {mode === "index" && <IndexBody />}
      {mode === "flow" && <FlowBody />}
      {mode === "carousel" && <CarouselBody idx={carouselIdx} setIdx={setCarouselIdx} />}
    </div>
  );
};

// ----- Index mode -----
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
    <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28}}>
      {[0, 1].map(col => (
        <div key={col}>
          {HYMN_LIST.slice(col * 6, col * 6 + 6).map((h, i) => {
            const idx = col * 6 + i;
            const dots = ".".repeat(60); // leader dots
            return (
              <a key={h.n} href="#" style={{
                display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 14,
                alignItems: "baseline", padding: "14px 0",
                borderBottom: "1px solid var(--rule-soft)",
                textDecoration: "none", color: "var(--ink)"
              }}>
                <span className="mono" style={{fontSize: 13, color: "var(--ink-mute)", width: 28, textAlign: "right"}}>{String(h.n).padStart(2, "0")}</span>
                <span style={{display: "flex", alignItems: "baseline", overflow: "hidden", whiteSpace: "nowrap"}}>
                  <span className="serif" style={{fontSize: 18, fontStyle: idx === 6 ? "italic" : "normal", color: idx === 6 ? "var(--firmament)" : "var(--ink)"}}>
                    {h.t}
                  </span>
                  <span className="mono" style={{flex: 1, color: "var(--rule)", letterSpacing: 4, fontSize: 11, padding: "0 8px", overflow: "hidden"}}>{dots}</span>
                </span>
                <span className="mono muted" style={{fontSize: 11}}>{h.style}</span>
                <span style={{width: 36, textAlign: "right", color: "var(--gold)"}}>
                  {h.fav && "★"} {h.audio && <span style={{color: "var(--firmament)"}}>♫</span>}
                </span>
              </a>
            );
          })}
        </div>
      ))}
    </div>
    <div style={{textAlign: "center", marginTop: 32}}>
      <button className="btn btn-ghost">Mostrar restantes (120)</button>
    </div>
  </div>
);

// ----- Flow mode (PDF-like continuous) -----
const FlowBody = () => (
  <div style={{padding: "32px 64px", background: "var(--paper-deep)", minHeight: 800}}>
    <div style={{maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 32}}>
      {[
        {n: 6, t: "Pisei na Terra Fria", body: "Pisei na terra fria\nVi a Virgem Mãe Maria\nMe ensinou eu a cantar\nE me deu a Sua alegria", end: 0},
        {n: 7, t: "Estrela Brilhante", body: "Estrela brilhante\nQue brilha no firmamento\nMe dai a Vossa luz\nNeste sagrado momento", end: 1},
        {n: 8, t: "Papai Paranã", body: "Papai Paranã\nMandou me chamar\nÉ na hora certa\nQue Ele está a esperar", end: 2},
      ].map((h, i) => (
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
  <div style={{padding: "32px 64px", background: "var(--paper-deep)", minHeight: 700, position: "relative"}}>
    {/* Position indicator */}
    <div style={{position: "absolute", top: 24, left: "50%", transform: "translateX(-50%)", zIndex: 2,
      background: "var(--paper)", border: "1px solid var(--rule)", borderRadius: 999, padding: "6px 14px"}}>
      <span className="mono" style={{fontSize: 12, color: "var(--ink-soft)", letterSpacing: ".1em"}}>{String(idx).padStart(2,"0")} / 132</span>
    </div>

    <div style={{display: "flex", alignItems: "center", justifyContent: "center", gap: 24, minHeight: 600}}>
      <button onClick={() => setIdx(Math.max(1, idx - 1))} className="btn btn-ghost" style={{borderRadius: "50%", width: 48, height: 48, padding: 0, fontSize: 20}}>‹</button>

      {/* Active card */}
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

    {/* Position dots */}
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

Object.assign(window, { HymnbookDetailScreen });

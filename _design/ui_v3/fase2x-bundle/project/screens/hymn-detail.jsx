/* global React, AppBar, SAMPLE_HYMN, endGlyphFor */
const { useState: useStateH } = React;

// =====================================================
// Screen: Hymn detail (PDF-faithful liturgical typesetting)
// =====================================================
const HymnDetailScreen = () => {
  const [audioPlaying, setAudioPlaying] = useStateH(false);
  const [favorited, setFavorited] = useStateH(true);

  return (
    <div className="app-shell" style={{minHeight: 1300}}>
      <AppBar active="list" />

      {/* Breadcrumb strip */}
      <div style={{padding: "16px 64px", borderBottom: "1px solid var(--rule-soft)", display: "flex", alignItems: "center", gap: 14}}>
        <a href="#" className="serif muted" style={{textDecoration: "none", fontSize: 14}}>Hinários</a>
        <span className="muted">/</span>
        <a href="#" className="serif" style={{color: "var(--firmament)", textDecoration: "none", fontSize: 14, fontStyle: "italic"}}>O Cruzeiro</a>
        <span className="muted">/</span>
        <span className="mono" style={{fontSize: 12, letterSpacing: ".1em", color: "var(--ink-mute)"}}>HINO 07</span>
        <div style={{flex: 1}} />
        <button className="btn btn-ghost" style={{padding: "6px 12px", fontSize: 13}}>← Anterior · 06</button>
        <button className="btn btn-ghost" style={{padding: "6px 12px", fontSize: 13}}>08 · Próximo →</button>
      </div>

      <div style={{display: "grid", gridTemplateColumns: "1fr 320px", gap: 40, padding: "48px 64px", maxWidth: 1280, margin: "0 auto"}}>
        {/* Left: paper page */}
        <article className="hymn-page">
          <h1 className="hymn-title">{SAMPLE_HYMN.number} - {SAMPLE_HYMN.title}</h1>

          <div className="hymn-body">
            {SAMPLE_HYMN.body.map((s, i) => (
              <div key={i} className={"hymn-stanza" + (s.rep ? " rep" : "")} data-rep={s.rep ? `${s.rep}×` : ""}>
                {s.text}
              </div>
            ))}
          </div>

          <div className="hymn-end">{endGlyphFor(SAMPLE_HYMN.number)}</div>

          <div className="hymn-meta-row">
            <span>Recebido · 12 Maio 1934</span>
            <span>Mazurca</span>
            <span>Oferecido · N. Sra. Conceição</span>
          </div>
        </article>

        {/* Right: rail */}
        <aside style={{display: "flex", flexDirection: "column", gap: 18}}>
          {/* Audio */}
          <div className="card">
            <div className="eyebrow" style={{marginBottom: 10}}>Áudio · 1 gravação</div>
            <div style={{display: "flex", alignItems: "center", gap: 12}}>
              <button onClick={() => setAudioPlaying(!audioPlaying)} style={{
                width: 44, height: 44, borderRadius: "50%", border: "1px solid var(--rule)",
                background: "var(--firmament)", color: "var(--paper)", cursor: "pointer", display: "grid", placeItems: "center"
              }}>
                {audioPlaying
                  ? <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="2" width="3" height="10"/><rect x="9" y="2" width="3" height="10"/></svg>
                  : <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 1 L12 7 L3 13 Z"/></svg>
                }
              </button>
              <div style={{flex: 1}}>
                <div className="serif" style={{fontSize: 14, fontWeight: 500}}>Trabalho de Concentração</div>
                <div className="mono muted" style={{fontSize: 11}}>2:14 · gravado por Joana M.</div>
              </div>
            </div>
            <div style={{marginTop: 14, height: 32, display: "flex", alignItems: "center", gap: 2}}>
              {Array.from({length: 64}).map((_, i) => {
                const h = 6 + (Math.sin(i * 0.5) + 1) * 12 + (i % 5) * 2;
                const played = i < 24;
                return <div key={i} style={{flex: 1, height: h, background: played ? "var(--firmament)" : "var(--rule)", borderRadius: 1}}/>;
              })}
            </div>
            <div style={{display: "flex", justifyContent: "space-between", marginTop: 6}}>
              <span className="mono muted" style={{fontSize: 10}}>0:52</span>
              <span className="mono muted" style={{fontSize: 10}}>2:14</span>
            </div>
          </div>

          {/* Actions */}
          <div className="card" style={{display: "flex", flexDirection: "column", gap: 8}}>
            <button onClick={() => setFavorited(!favorited)} className={favorited ? "btn btn-gold" : "btn btn-ghost"} style={{justifyContent: "flex-start"}}>
              <span style={{fontSize: 14}}>{favorited ? "★" : "☆"}</span>
              {favorited ? "Favoritado" : "Favoritar"}
            </button>
            <button className="btn btn-ghost" style={{justifyContent: "flex-start"}}>
              <span>♫</span> Adicionar áudio
            </button>
            <button className="btn btn-ghost" style={{justifyContent: "flex-start"}}>
              <span>⎙</span> Imprimir
            </button>
            <button className="btn btn-ghost" style={{justifyContent: "flex-start"}}>
              <span>⤴</span> Compartilhar
            </button>
          </div>

          {/* Metadata */}
          <div className="card">
            <div className="eyebrow" style={{marginBottom: 12}}>Detalhes</div>
            <MetaRow label="Estilo" value="Mazurca" />
            <MetaRow label="Recebido em" value="12 Maio 1934" />
            <MetaRow label="Oferecido a" value="N. Sra. Conceição" />
            <MetaRow label="Última revisão" value="Joana M. · há 3 dias" />
          </div>

          {/* Reading mode toggle */}
          <div className="card" style={{background: "var(--paper-deep)"}}>
            <div className="eyebrow" style={{marginBottom: 10}}>Modo de leitura</div>
            <div style={{display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, padding: 4, background: "var(--paper)", borderRadius: 8, border: "1px solid var(--rule)"}}>
              {["Único", "Corrido", "Carrossel"].map((m, i) => (
                <button key={m} style={{
                  padding: "6px 0", border: 0, borderRadius: 6,
                  background: i === 0 ? "var(--firmament)" : "transparent",
                  color: i === 0 ? "var(--paper)" : "var(--ink-soft)",
                  fontFamily: "var(--font-sans)", fontSize: 12, cursor: "pointer"
                }}>{m}</button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

const MetaRow = ({label, value}) => (
  <div style={{display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid var(--rule-soft)", fontSize: 13}}>
    <span className="muted serif">{label}</span>
    <span className="serif" style={{textAlign: "right"}}>{value}</span>
  </div>
);

Object.assign(window, { HymnDetailScreen });

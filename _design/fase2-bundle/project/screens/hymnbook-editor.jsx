/* global React, AppBar */
const { useState: useStateHE } = React;

// =====================================================
// Screen: Hymnbook editor (in-review listing)
// Inspired by hinaria.com.br/editor/hinarios/o-justiceiro/
// =====================================================
const HymnbookEditorScreen = () => {
  const HYMNS = [
    {n:1, t:"Eu Estava Num Palácio", reviewed:true},
    {n:2, t:"Estou Aqui", reviewed:true},
    {n:3, t:"Firmeza", reviewed:true},
    {n:4, t:"Eu Estou Firme Com Meu Jesus", reviewed:true},
    {n:5, t:"Eu Vivo Neste Mundo", reviewed:true},
    {n:6, t:"Eu Vivo Na Floresta", reviewed:false},
    {n:7, t:"Princesa Janaína", reviewed:false},
    {n:10, t:"A Barquinha", reviewed:true},
    {n:11, t:"Eu Vinha De Viagem", reviewed:false},
    {n:12, t:"Todos Estão Cientes", reviewed:false},
    {n:13, t:"Sou Filho da Floresta", reviewed:false},
    {n:14, t:"O Sol da Verdade", reviewed:false},
  ];
  const reviewed = HYMNS.filter(h => h.reviewed).length;
  const total = 124;
  const pct = Math.round((reviewed / total) * 100);

  return (
    <div className="app-shell" style={{minHeight: 1400, background: "var(--paper)"}}>
      <AppBar active="editor" />

      <div style={{padding: "32px 80px 64px", maxWidth: 1280, margin: "0 auto"}}>
        {/* Back link */}
        <a href="#" style={{
          fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".15em",
          color: "var(--ink-mute)", textDecoration: "none",
        }}>← FILA DE REVISÃO</a>

        {/* Header */}
        <div style={{display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 32, marginTop: 36}}>
          <div>
            <div className="eyebrow" style={{marginBottom: 12}}>HINÁRIO EM REVISÃO</div>
            <h1 className="h-display" style={{fontSize: 56, margin: 0, lineHeight: 1}}>O Justiceiro</h1>
            <p className="serif" style={{fontSize: 18, marginTop: 10, color: "var(--ink-soft)"}}>
              Padrinho Sebastião Mota de Melo
            </p>
          </div>
          <div style={{display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end"}}>
            <button className="btn btn-primary">Revisar próximo →</button>
            <button className="btn btn-ghost" style={{
              borderColor: "var(--gold)", color: "var(--gold)",
            }}>⚡ Revisão ágil · Estilo & Repetições</button>
          </div>
        </div>

        {/* Progress */}
        <div style={{marginTop: 48}}>
          <div style={{display: "flex", justifyContent: "space-between", marginBottom: 10}}>
            <span style={{fontFamily: "var(--font-serif)", fontSize: 18}}>{reviewed}/{total} revisados</span>
            <span className="mono" style={{fontSize: 12, color: "var(--ink-soft)"}}>{pct}%</span>
          </div>
          <div style={{height: 3, background: "var(--paper-deep)", borderRadius: 999, position: "relative"}}>
            <div style={{position: "absolute", top: 0, left: 0, bottom: 0, width: pct + "%", background: "var(--firmament)", borderRadius: 999}}/>
          </div>
        </div>

        {/* Hymn list */}
        <div style={{marginTop: 36}}>
          {HYMNS.map((h, i) => (
            <div key={h.n} style={{
              display: "grid",
              gridTemplateColumns: "60px 1fr auto auto",
              alignItems: "center",
              gap: 24,
              padding: "20px 0",
              borderBottom: "1px solid var(--rule-soft)",
            }}>
              <span className="mono" style={{fontSize: 13, color: "var(--ink-mute)", letterSpacing: ".05em"}}>
                {String(h.n).padStart(2, "0")}
              </span>
              <span className="serif" style={{fontSize: 18, color: "var(--ink)"}}>{h.t}</span>
              <span style={{display: "flex", alignItems: "center", gap: 8}}>
                <span style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: h.reviewed ? "var(--moss)" : "var(--vermilion)",
                  display: "inline-block",
                }}/>
                <span className="mono" style={{
                  fontSize: 11, letterSpacing: ".15em",
                  color: h.reviewed ? "var(--moss)" : "var(--vermilion)",
                }}>{h.reviewed ? "REVISADO" : "NÃO REVISADO"}</span>
              </span>
              <button style={{
                padding: "6px 18px", borderRadius: 999,
                border: "1px solid var(--rule)", background: "var(--paper)",
                fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".12em",
                color: "var(--ink-soft)", cursor: "pointer",
              }}>REVISAR</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { HymnbookEditorScreen });

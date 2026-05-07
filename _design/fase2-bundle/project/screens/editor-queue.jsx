/* global React, AppBar, QUEUE */
const { useState: useStateE, useEffect: useEffectE } = React;

// =====================================================
// Screen: Editor queue (workspace)
// =====================================================
const EditorQueueScreen = () => {
  const [sort, setSort] = useStateE("least_reviewed");
  return (
    <div className="app-shell" style={{minHeight: 1100}}>
      <AppBar active="editor" />

      <header style={{padding: "40px 64px 24px", borderBottom: "1px solid var(--rule)"}}>
        <div className="eyebrow" style={{marginBottom: 10}}>WORKSPACE EDITORIAL</div>
        <div style={{display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24}}>
          <div>
            <h1 className="h-display" style={{fontSize: 44, margin: 0}}>Fila de revisão</h1>
            <p className="serif muted" style={{fontSize: 16, marginTop: 8, maxWidth: 520}}>
              Hinários aguardando revisão hino-a-hino. Comece pelo de menor progresso ou volte ao que você estava revisando.
            </p>
          </div>
          <div style={{display: "flex", gap: 24, textAlign: "right"}}>
            <div>
              <div className="display" style={{fontSize: 32, color: "var(--firmament)"}}>4</div>
              <div className="mono muted" style={{fontSize: 10, letterSpacing: ".1em"}}>HINÁRIOS</div>
            </div>
            <div>
              <div className="display" style={{fontSize: 32, color: "var(--gold)"}}>173</div>
              <div className="mono muted" style={{fontSize: 10, letterSpacing: ".1em"}}>HINOS PENDENTES</div>
            </div>
            <div>
              <div className="display" style={{fontSize: 32, color: "var(--moss)"}}>89</div>
              <div className="mono muted" style={{fontSize: 10, letterSpacing: ".1em"}}>REVISADOS · 7 DIAS</div>
            </div>
          </div>
        </div>
      </header>

      {/* Resume bar */}
      <section style={{padding: "20px 64px", background: "var(--paper-soft)", borderBottom: "1px solid var(--rule-soft)", display: "flex", alignItems: "center", gap: 16}}>
        <div style={{width: 40, height: 40, borderRadius: 8, background: "var(--firmament)", display: "grid", placeItems: "center", color: "var(--paper)", fontSize: 18}}>↩</div>
        <div style={{flex: 1}}>
          <div className="serif" style={{fontSize: 15, fontWeight: 500}}>Continuar revisão</div>
          <div className="mono muted" style={{fontSize: 11}}>
            Hinos do Sol · você parou no hino 42 · "Sol da Manhã"
          </div>
        </div>
        <a href="#" className="mono muted" style={{fontSize: 11, textDecoration: "underline", letterSpacing: ".05em"}}>
          ver lista do hinário →
        </a>
        <button className="btn btn-primary">Retomar →</button>
      </section>

      {/* Filters */}
      <section style={{padding: "20px 64px", display: "flex", gap: 12, alignItems: "center"}}>
        <span className="eyebrow">ORDENAR:</span>
        {[
          {k: "least_reviewed", l: "Menos revisados"},
          {k: "most_reviewed", l: "Mais revisados"},
          {k: "recent", l: "Recém adicionados"},
        ].map(o => (
          <button key={o.k} onClick={() => setSort(o.k)} className="pill" style={{
            cursor: "pointer", border: 0, padding: "6px 14px",
            background: sort === o.k ? "var(--ink)" : "var(--paper-soft)",
            color: sort === o.k ? "var(--paper)" : "var(--ink-soft)",
          }}>{o.l}</button>
        ))}
        <div style={{flex: 1}}/>
        <span className="mono muted" style={{fontSize: 11}}>4 hinários</span>
      </section>

      {/* Queue list */}
      <section style={{padding: "8px 64px 64px"}}>
        <div style={{display: "flex", flexDirection: "column", gap: 12}}>
          {QUEUE.map((q, i) => <QueueRow key={i} q={q} idx={i} />)}
        </div>
      </section>
    </div>
  );
};

const QueueRow = ({q, idx}) => {
  const pct = Math.round((q.reviewed / q.total) * 100);
  const remaining = q.total - q.reviewed;
  const stop = (e) => e.stopPropagation();
  return (
    <a href="#" onClick={(e) => e.preventDefault()} className="card queue-row" style={{
      textDecoration: "none", color: "inherit",
      display: "grid", gridTemplateColumns: "auto 1fr auto auto auto", alignItems: "center", gap: 24, padding: "20px 24px",
      cursor: "pointer", transition: "background 120ms, box-shadow 120ms",
    }}>
      {/* number badge */}
      <div style={{
        width: 56, height: 56, borderRadius: 8,
        background: idx === 0 ? "var(--gold)" : "var(--paper-deep)",
        color: idx === 0 ? "var(--ink)" : "var(--ink-mute)",
        display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontSize: 26
      }}>
        {String(idx + 1).padStart(2, "0")}
      </div>

      {/* identity */}
      <div>
        <div style={{display: "flex", alignItems: "center", gap: 10, marginBottom: 4}}>
          <span className="display" style={{fontSize: 22, lineHeight: 1.1}}>{q.name}</span>
          <span className="pill" style={{fontSize: 9, padding: "2px 8px"}}>{q.source}</span>
        </div>
        <div className="serif muted" style={{fontSize: 13}}>
          {q.owner} · subido {q.uploaded}
        </div>
      </div>

      {/* progress */}
      <div style={{minWidth: 220}}>
        <div style={{display: "flex", justifyContent: "space-between", marginBottom: 6}}>
          <span className="mono" style={{fontSize: 11, color: "var(--ink-soft)"}}>{q.reviewed}/{q.total} revisados</span>
          <span className="mono" style={{fontSize: 11, color: "var(--ink-mute)"}}>{pct}%</span>
        </div>
        <div className="progress gold"><i style={{width: pct + "%"}}/></div>
        {q.in_review > 0 && (
          <div className="mono" style={{fontSize: 10, color: "var(--gold)", marginTop: 6}}>{q.in_review} em revisão</div>
        )}
      </div>

      {/* status */}
      <div>
        {pct === 100
          ? <span className="pill pill-ok">Completo</span>
          : pct === 0
          ? <span className="pill pill-not">Não iniciado</span>
          : <span className="pill pill-mid">Em andamento</span>}
      </div>

      {/* actions */}
      <div style={{display: "flex", flexDirection: "column", gap: 6}} onClick={stop}>
        <button className={remaining ? "btn btn-primary" : "btn btn-gold"}>
          {remaining ? `Revisar próximo →` : `Publicar hinário ✓`}
        </button>
        <button className="btn btn-ghost" style={{
          fontSize: 11, padding: "6px 10px",
          borderColor: "var(--gold)", color: "var(--gold)",
        }}>⚡ Revisão ágil</button>
      </div>
    </a>
  );
};

Object.assign(window, { EditorQueueScreen });

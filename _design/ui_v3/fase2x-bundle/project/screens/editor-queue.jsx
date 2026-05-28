/* global React, AppBar, BrandGlyph, QUEUE */
const { useState: useStateE, useMemo: useMemoE } = React;

// =====================================================
// Screen: Workspace Editorial (Fila de revisão)
// =====================================================
// Mudanças vs. v1:
// - Cards verticais em grid 2-col (era linha horizontal)
// - 4 micro-barras (REV / EST / REP / AUD) ao invés de barra única
// - Badge de prioridade P1/P2/P3 no canto superior direito
// - Glifo de "em destaque" ao lado do nome quando is_featured
// - Linha de última atividade na base do card
// - Filtros: ordenação + prioridade (combináveis)
// - Sort novo: "menos áudios"
const SORT_OPTS = [
  { k: "least_reviewed", l: "Menos revisados" },
  { k: "most_reviewed",  l: "Mais revisados" },
  { k: "least_audios",   l: "Menos áudios" },
  { k: "recent",         l: "Recém adicionados" },
];
const PRIO_OPTS = [
  { k: "all", l: "Todas" },
  { k: "P1",  l: "P1 Urgente" },
  { k: "P2",  l: "P2 Atenção" },
  { k: "P3",  l: "P3" },
];

const EditorQueueScreen = () => {
  const [sort, setSort] = useStateE("least_reviewed");
  const [prio, setPrio] = useStateE("all");

  const rows = useMemoE(() => {
    let r = QUEUE.map(q => ({...q, review_pct: Math.round(q.reviewed / q.total * 100)}));
    if (prio !== "all") r = r.filter(q => q.priority === prio);
    const cmp = {
      least_reviewed: (a,b) => a.review_pct - b.review_pct,
      most_reviewed:  (a,b) => b.review_pct - a.review_pct,
      least_audios:   (a,b) => a.audio_pct - b.audio_pct,
      recent:         (a,b) => 0, // mock: ordem original
    }[sort];
    return [...r].sort(cmp);
  }, [sort, prio]);

  return (
    <div className="app-shell" style={{minHeight: 1100}}>
      <AppBar active="editor" />

      <header style={{padding: "40px 64px 24px", borderBottom: "1px solid var(--rule)"}}>
        <div className="eyebrow" style={{marginBottom: 10}}>WORKSPACE EDITORIAL</div>
        <div style={{display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24}}>
          <div>
            <h1 className="h-display" style={{fontSize: 44, margin: 0}}>Fila de revisão</h1>
            <p className="serif muted" style={{fontSize: 16, marginTop: 8, maxWidth: 520}}>
              Hinários aguardando revisão. Priorize pelo que está urgente, ou pelo que tem menos áudio aprovado.
            </p>
          </div>
          <div style={{display: "flex", gap: 24, textAlign: "right"}}>
            <KpiNum n="2" l="P1 URGENTE" tone="rust" />
            <KpiNum n="4" l="HINÁRIOS" tone="firmament" />
            <KpiNum n="173" l="HINOS PENDENTES" tone="gold" />
            <KpiNum n="89" l="REVISADOS · 7 DIAS" tone="moss" />
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

      {/* Filters — duas dimensões independentes, combináveis */}
      <section style={{padding: "20px 64px 8px", display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 18, alignItems: "center"}}>
        <span className="eyebrow">ORDENAR:</span>
        <div style={{display: "flex", gap: 8, flexWrap: "wrap"}}>
          {SORT_OPTS.map(o => (
            <FilterChip key={o.k} active={sort === o.k} onClick={() => setSort(o.k)}>{o.l}</FilterChip>
          ))}
        </div>
        <span className="mono muted" style={{fontSize: 11}}>{rows.length} hinário{rows.length === 1 ? "" : "s"}</span>
      </section>
      <section style={{padding: "0 64px 16px", display: "grid", gridTemplateColumns: "auto 1fr", gap: 18, alignItems: "center"}}>
        <span className="eyebrow">PRIORIDADE:</span>
        <div style={{display: "flex", gap: 8, flexWrap: "wrap"}}>
          {PRIO_OPTS.map(o => (
            <FilterChip key={o.k} active={prio === o.k} onClick={() => setPrio(o.k)} tone={o.k}>{o.l}</FilterChip>
          ))}
        </div>
      </section>

      {/* Grid de cards verticais — 2 colunas */}
      <section style={{padding: "8px 64px 64px"}}>
        <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20}}>
          {rows.map((q, i) => <QueueCard key={q.name} q={q} idx={i} />)}
          {rows.length === 0 && (
            <div className="serif muted" style={{gridColumn: "1 / -1", textAlign: "center", padding: 48, fontStyle: "italic"}}>
              Nenhum hinário com essa prioridade.
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

// ===== Sub-componentes =====

const KpiNum = ({n, l, tone}) => {
  const color = {
    rust: "var(--vermilion)", firmament: "var(--firmament)",
    gold: "var(--gold)", moss: "var(--moss)",
  }[tone] || "var(--ink)";
  return (
    <div>
      <div className="display" style={{fontSize: 32, color, lineHeight: 1}}>{n}</div>
      <div className="mono muted" style={{fontSize: 10, letterSpacing: ".1em", marginTop: 4}}>{l}</div>
    </div>
  );
};

const FilterChip = ({active, onClick, children, tone}) => {
  // Quando inativa e tone="P1"/"P2", mostra um dot colorido para hint visual
  const dotColor = active ? null : ({P1: "var(--vermilion)", P2: "var(--gold)"}[tone]);
  return (
    <button onClick={onClick} className="pill" style={{
      cursor: "pointer", border: "1px solid " + (active ? "var(--ink)" : "var(--rule)"),
      padding: "6px 12px", fontSize: 11, letterSpacing: ".08em",
      background: active ? "var(--ink)" : "var(--paper)",
      color: active ? "var(--paper)" : "var(--ink-soft)",
    }}>
      {dotColor && <span style={{
        width: 6, height: 6, borderRadius: "50%", background: dotColor,
        marginLeft: -2,
      }}/>}
      {!dotColor && active && <span style={{
        width: 6, height: 6, borderRadius: "50%",
        background: "var(--paper)",
        marginLeft: -2,
      }}/>}
      {children}
    </button>
  );
};

// Card vertical: header / métricas / atividade / ações
const QueueCard = ({q, idx}) => {
  const remaining = q.total - q.reviewed;
  const stop = (e) => e.stopPropagation();
  return (
    <a href="#" onClick={(e) => e.preventDefault()} className="card queue-row" style={{
      textDecoration: "none", color: "inherit",
      display: "flex", flexDirection: "column", gap: 18,
      padding: "22px 24px 20px",
      cursor: "pointer",
      borderColor: q.priority === "P1" ? "color-mix(in oklab, var(--vermilion) 25%, var(--rule))" : "var(--rule)",
    }}>
      {/* Header */}
      <div style={{display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 14, alignItems: "flex-start"}}>
        <div style={{
          width: 48, height: 48, borderRadius: 8,
          background: idx === 0 ? "var(--gold)" : "var(--paper-deep)",
          color: idx === 0 ? "var(--ink)" : "var(--ink-mute)",
          display: "grid", placeItems: "center",
          fontFamily: "var(--font-display)", fontSize: 22,
        }}>{String(idx + 1).padStart(2, "0")}</div>

        <div style={{minWidth: 0}}>
          <div style={{display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap"}}>
            <span className="display" style={{fontSize: 22, lineHeight: 1.1}}>{q.name}</span>
            {q.is_featured && <FeaturedGlyph />}
          </div>
          <div className="serif muted" style={{fontSize: 13}}>
            {q.owner} · subido {q.uploaded}
          </div>
        </div>

        <PriorityPill level={q.priority} />
      </div>

      {/* Métricas — 4 micro-barras */}
      <div style={{display: "flex", flexDirection: "column", gap: 8}}>
        <MetricBar label="REV" pct={Math.round(q.reviewed / q.total * 100)} tone="firmament" />
        <MetricBar label="EST" pct={q.style_pct} />
        <MetricBar label="REP" pct={q.reps_pct} />
        <MetricBar label="AUD" pct={q.audio_pct} />
      </div>

      {/* Última atividade — strip discreta */}
      {q.last_activity ? (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          paddingTop: 14, borderTop: "1px solid var(--rule-soft)",
          fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-mute)",
          letterSpacing: ".02em",
        }}>
          <Sparkline activity={q.last_activity} />
          <span style={{flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>
            <strong style={{color: "var(--ink-soft)", fontWeight: 500}}>{q.last_activity.who}</strong>
            {" "}revisou {q.last_activity.n} {q.last_activity.n === 1 ? "hino" : "hinos"}
          </span>
          <span>{q.last_activity.when}</span>
        </div>
      ) : (
        <div style={{
          paddingTop: 14, borderTop: "1px solid var(--rule-soft)",
          fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-mute)",
          fontStyle: "italic",
        }}>
          Sem atividade ainda
        </div>
      )}

      {/* Ações */}
      <div style={{display: "grid", gridTemplateColumns: "1fr auto", gap: 10}} onClick={stop}>
        <button className={remaining ? "btn btn-primary" : "btn btn-gold"} style={{justifyContent: "center"}}>
          {remaining ? `Revisar próximo →` : `Publicar hinário ✓`}
        </button>
        <button className="btn btn-ghost" style={{
          fontSize: 12, padding: "8px 14px",
          borderColor: "var(--gold)", color: "var(--gold)",
        }}>⚡ Revisão ágil</button>
      </div>
    </a>
  );
};

// ===== Priority pill =====
// P1: rust solid (urgência alta · alto contraste)
// P2: gold solid (atenção · cálido)
// P3: outline + ink-mute (estado default · quase invisível)
const PriorityPill = ({level}) => {
  const styles = {
    P1: { bg: "var(--vermilion)", fg: "var(--paper)", border: "var(--vermilion)", label: "P1 Urgente" },
    P2: { bg: "var(--gold)",      fg: "#1a1d2e",      border: "var(--gold)",      label: "P2 Atenção" },
    P3: { bg: "transparent",      fg: "var(--ink-mute)", border: "var(--rule)",   label: "P3" },
  }[level] || {};
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 10px",
      borderRadius: 999,
      background: styles.bg,
      color: styles.fg,
      border: "1px solid " + styles.border,
      fontFamily: "var(--font-mono)", fontSize: 10,
      letterSpacing: ".12em", textTransform: "uppercase",
      whiteSpace: "nowrap",
      fontWeight: level === "P3" ? 400 : 600,
    }}>
      {styles.label}
    </span>
  );
};

// ===== Micro-barra =====
const MetricBar = ({label, pct, tone}) => {
  const fill = pct === 0 ? "var(--rule)" : (tone === "firmament" ? "var(--firmament)" : "var(--gold)");
  const empty = pct === 0;
  return (
    <div style={{display: "grid", gridTemplateColumns: "32px 1fr 36px", gap: 10, alignItems: "center"}}>
      <span className="mono" style={{fontSize: 10, letterSpacing: ".12em", color: "var(--ink-mute)"}}>{label}</span>
      <div style={{height: 6, borderRadius: 3, background: "color-mix(in oklab, var(--rule) 50%, var(--paper))", overflow: "hidden"}}>
        <div style={{width: pct + "%", height: "100%", background: fill, transition: "width 200ms"}}/>
      </div>
      <span className="mono" style={{fontSize: 10, color: empty ? "var(--ink-mute)" : "var(--ink-soft)", textAlign: "right"}}>{pct}%</span>
    </div>
  );
};

// ===== Featured glyph (8-pointed star, miniatura do BrandGlyph) =====
const FeaturedGlyph = () => (
  <span title="Em destaque na home" style={{
    display: "inline-grid", placeItems: "center",
    width: 18, height: 18, color: "var(--gold)",
  }}>
    <svg viewBox="0 0 32 32" width={18} height={18} aria-label="Em destaque">
      <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M16 5 L16 27 M5 16 L27 16 M8 8 L24 24 M24 8 L8 24"/>
        <circle cx="16" cy="16" r="3" fill="currentColor" stroke="none"/>
      </g>
    </svg>
  </span>
);

// ===== Sparkline (mini representação da atividade — 7 dias de revisões) =====
// Sequência mock que diverge por hinário (deterministicamente por nome).
const Sparkline = ({activity}) => {
  const seed = (activity.who.charCodeAt(0) + activity.n) % 7;
  const bars = [2, 0, 3, 1, 4, 2, activity.n > 5 ? 6 : 3];
  const rotated = [...bars.slice(seed), ...bars.slice(0, seed)];
  const max = Math.max(...rotated, 1);
  return (
    <svg width={56} height={16} viewBox="0 0 56 16" style={{flexShrink: 0}}>
      {rotated.map((v, i) => {
        const h = Math.max(1, (v / max) * 14);
        return (
          <rect key={i} x={i * 8} y={16 - h} width={5} height={h} rx={1}
            fill={v === 0 ? "var(--rule)" : "var(--gold)"} opacity={v === 0 ? 0.6 : 0.85}/>
        );
      })}
    </svg>
  );
};

Object.assign(window, { EditorQueueScreen });

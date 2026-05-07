/* global React, CRUZEIRO_HYMNS */
const { useState: useStateQ, useEffect: useEffectQ, useRef: useRefQ } = React;

// =====================================================
// Screen: Quick review (Estilo + Repetições only)
// Foco: revisão ágil dos 2 parâmetros objetivos.
// Atalhos de teclado:
//   M / V / Z          → Marcha / Valsa / Mazurca
//   1 / 2 / 3 / 4      → Repetições (presets)
//   ← / →              → Navegar entre hinos
//   ⏎                  → Salvar e ir para o próximo
// =====================================================
const QuickReviewScreen = () => {
  const [idx, setIdx] = useStateQ(5);
  const hymns = CRUZEIRO_HYMNS;
  const cur = hymns[idx];

  const [style, setStyle] = useStateQ(cur.style || "");
  const [reps, setReps] = useStateQ("1-2,3-4");
  const [flash, setFlash] = useStateQ(null); // { kind: "style" | "reps", value: string }
  const repsInputRef = useRefQ(null);

  const STYLE_OPTS = [
    { key: "M", label: "Marcha" },
    { key: "V", label: "Valsa" },
    { key: "Z", label: "Mazurca" },
  ];
  const REP_OPTS = [
    { key: "1", value: "1-2,3-4" },
    { key: "2", value: "1-4" },
    { key: "3", value: "1-2,3-4,1-4" },
    { key: "4", value: "3-4,1-4" },
  ];

  const triggerFlash = (kind, value) => {
    setFlash({ kind, value });
    setTimeout(() => setFlash(null), 350);
  };

  const go = (delta) => {
    const next = Math.max(0, Math.min(hymns.length - 1, idx + delta));
    setIdx(next);
    setStyle(hymns[next].style || "");
  };

  // Keyboard shortcuts
  useEffectQ(() => {
    const onKey = (e) => {
      if (document.activeElement === repsInputRef.current) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();

      const styleHit = STYLE_OPTS.find(o => o.key.toLowerCase() === k);
      if (styleHit) { setStyle(styleHit.label); triggerFlash("style", styleHit.label); e.preventDefault(); return; }

      const repHit = REP_OPTS.find(o => o.key === k);
      if (repHit) { setReps(repHit.value); triggerFlash("reps", repHit.value); e.preventDefault(); return; }

      if (e.key === "ArrowRight") { go(1); e.preventDefault(); }
      if (e.key === "ArrowLeft")  { go(-1); e.preventDefault(); }
      if (e.key === "Enter")      { go(1); e.preventDefault(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx]);

  const SAMPLE_BODY = `Estrela brilhante
Que brilha no firmamento
Me dai a Vossa luz
Neste sagrado momento

Eu peço com humildade
À Virgem Mãe Soberana
Que me dê de Sua glória
Nesta hora soberana`;

  const lines = SAMPLE_BODY.split("\n");
  const stanzas = [];
  let curS = [];
  lines.forEach((l) => {
    if (l.trim() === "") { if (curS.length) { stanzas.push(curS); curS = []; } }
    else curS.push(l);
  });
  if (curS.length) stanzas.push(curS);

  return (
    <div className="app-shell" style={{minHeight: 1100, background: "var(--paper-soft)"}}>
      {/* Topbar */}
      <div style={{
        padding: "12px 32px", borderBottom: "1px solid var(--rule)",
        background: "var(--paper)", display: "flex", alignItems: "center", gap: 18
      }}>
        <a href="#" className="serif muted" style={{textDecoration: "none", fontSize: 14}}>← O Cruzeiro</a>
        <div style={{flex: 1, textAlign: "center"}}>
          <div className="display" style={{fontSize: 16, lineHeight: 1}}>Revisão ágil · Estilo & Repetições</div>
          <div className="mono muted" style={{fontSize: 10, letterSpacing: ".15em", marginTop: 2}}>
            {String(idx + 1).padStart(2, "0")} DE {String(hymns.length).padStart(2, "0")}
          </div>
        </div>
        <a href="#" className="mono muted" style={{fontSize: 11, textDecoration: "none"}}>
          Ir para revisão completa →
        </a>
      </div>

      {/* Progress strip */}
      <div style={{height: 4, background: "var(--paper-deep)", position: "relative"}}>
        <div style={{position: "absolute", top: 0, left: 0, bottom: 0, width: ((idx+1)/hymns.length*100) + "%", background: "linear-gradient(90deg, var(--gold), var(--gold-soft))"}}/>
      </div>

      <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, minHeight: 900}}>
        {/* LEFT: Preview */}
        <div style={{padding: "40px 48px", borderRight: "1px solid var(--rule)", background: "var(--paper-soft)"}}>
          <div className="eyebrow" style={{marginBottom: 20}}>PRÉVIA · COMO O LEITOR VAI VER</div>

          <article className="hymn-page" style={{
            background: "var(--paper)",
            padding: "52px 60px", boxShadow: "var(--shadow-2)",
            borderRadius: 4, maxWidth: 620, margin: "0 auto",
          }}>
            <h2 style={{
              textAlign: "center", marginBottom: 36,
              fontFamily: "var(--font-serif)", fontSize: 26, fontWeight: 500,
              letterSpacing: ".005em", color: "var(--ink)"
            }}>{cur.n} - {cur.t}</h2>

            <div style={{
              width: "max-content", maxWidth: "100%", margin: "0 auto",
              fontFamily: "var(--font-serif)", fontSize: 17, lineHeight: 1.55,
              color: "var(--ink)",
            }}>
              {stanzas.map((stanza, si) => (
                <QuickStanza key={si} stanza={stanza} si={si} reps={reps} stanzas={stanzas} last={si === stanzas.length - 1}/>
              ))}
            </div>
            <div style={{textAlign: "center", marginTop: 32, color: "var(--gold)", fontSize: 18, fontStyle: "italic", fontFamily: "var(--font-display)"}}>✡</div>
          </article>
        </div>

        {/* RIGHT: Two fields */}
        <div style={{padding: "40px 48px", background: "var(--paper)", display: "flex", flexDirection: "column"}}>
          <div style={{display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20}}>
            <div className="eyebrow">PARÂMETROS OBJETIVOS</div>
            <span className="mono" style={{fontSize: 10, color: "var(--ink-mute)", letterSpacing: ".1em"}}>
              ATALHOS DE TECLADO ATIVOS
            </span>
          </div>

          {/* Estilo */}
          <div style={{marginBottom: 36}}>
            <div className="eyebrow" style={{fontSize: 9, marginBottom: 12}}>ESTILO</div>
            <div style={{display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8}}>
              {STYLE_OPTS.map(o => (
                <StyleTile key={o.key}
                  active={style === o.label}
                  flash={flash && flash.kind === "style" && flash.value === o.label}
                  shortcut={o.key}
                  label={o.label}
                  onClick={() => setStyle(o.label)}
                />
              ))}
            </div>
          </div>

          {/* Repetições */}
          <div style={{marginBottom: 24}}>
            <div className="eyebrow" style={{fontSize: 9, marginBottom: 12}}>REPETIÇÕES</div>
            <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10}}>
              {REP_OPTS.map(o => (
                <RepTile key={o.key}
                  active={reps === o.value}
                  flash={flash && flash.kind === "reps" && flash.value === o.value}
                  shortcut={o.key}
                  value={o.value}
                  onClick={() => setReps(o.value)}
                />
              ))}
            </div>
            <input ref={repsInputRef} value={reps} onChange={e => setReps(e.target.value)} placeholder="Ou digite manualmente"
              style={{
                marginTop: 12, width: "100%", padding: "8px 12px",
                fontFamily: "var(--font-mono)", fontSize: 12,
                border: "1px solid var(--rule)", borderRadius: 6, background: "var(--paper-soft)",
                outline: "none", color: "var(--ink-soft)",
              }}/>
          </div>

          <div style={{flex: 1}}/>

          {/* Hint */}
          <div style={{
            padding: 14, background: "var(--paper-soft)", border: "1px solid var(--rule-soft)",
            borderRadius: 6, fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ink-mute)",
            marginBottom: 16,
          }}>
            <strong style={{color: "var(--ink-soft)"}}>Esta tela não conclui a revisão.</strong> Para marcar o
            hino como revisado é preciso passar pela revisão completa (texto + áudio).
          </div>

          {/* Navigation buttons */}
          <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10}}>
            <button onClick={() => go(-1)} disabled={idx === 0} className="btn btn-ghost" style={{
              opacity: idx === 0 ? 0.4 : 1,
            }}><kbd>←</kbd> Anterior</button>
            <button onClick={() => go(1)} disabled={idx === hymns.length - 1} className="btn btn-ghost" style={{
              opacity: idx === hymns.length - 1 ? 0.4 : 1,
            }}>Próximo <kbd>→</kbd></button>
            <button onClick={() => go(1)} className="btn btn-primary" style={{gridColumn: "1 / -1"}}>
              Salvar e ir para o próximo <kbd style={{background: "rgba(255,255,255,0.15)", borderColor: "rgba(255,255,255,0.3)", color: "var(--paper)"}}>⏎</kbd>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ===== Tiles =====

const StyleTile = ({ active, flash, shortcut, label, onClick }) => (
  <button onClick={onClick} style={{
    position: "relative",
    padding: "16px 14px",
    borderRadius: 10,
    border: "1px solid " + (active ? "var(--ink)" : "var(--rule)"),
    background: active ? "var(--ink)" : "var(--paper-soft)",
    color: active ? "var(--paper)" : "var(--ink)",
    fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 500,
    cursor: "pointer",
    transition: "transform 100ms, background 120ms",
    transform: flash ? "scale(0.97)" : "scale(1)",
  }}>
    {label}
    <KbdMark active={active}>{shortcut}</KbdMark>
  </button>
);

const RepTile = ({ active, flash, shortcut, value, onClick }) => {
  // Parse "1-2,3-4" into ranges (1-indexed line numbers)
  const ranges = value.split(",").map(r => {
    const m = r.trim().match(/(\d+)\s*-\s*(\d+)/);
    return m ? { start: parseInt(m[1], 10), end: parseInt(m[2], 10) } : null;
  }).filter(Boolean);

  return (
    <button onClick={onClick} style={{
      position: "relative",
      padding: "14px 16px",
      borderRadius: 10,
      border: "1px solid " + (active ? "var(--ink)" : "var(--rule)"),
      background: active ? "var(--ink)" : "var(--paper-soft)",
      color: active ? "var(--paper)" : "var(--ink)",
      cursor: "pointer", textAlign: "left",
      display: "grid", gridTemplateColumns: "auto 1fr", gap: 14, alignItems: "center",
      transition: "transform 100ms, background 120ms",
      transform: flash ? "scale(0.97)" : "scale(1)",
    }}>
      <RepDiagram ranges={ranges} active={active}/>
      <div>
        <div style={{fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: ".02em"}}>{value}</div>
        <div style={{fontFamily: "var(--font-sans)", fontSize: 11, opacity: 0.55, marginTop: 4}}>
          {describe(ranges)}
        </div>
      </div>
      <KbdMark active={active}>{shortcut}</KbdMark>
    </button>
  );
};

// Mini sketch of how the repetition looks in print: 4 mute lines + thin
// vertical bars on the left for each range. Overlapping ranges get their own
// column so they sit side-by-side (matching how Daime hymnbooks print them).
const RepDiagram = ({ ranges, active }) => {
  const W = 60, H = 50;
  const LINE_GAP = 11;
  const LINE_LEN = 30;
  const TOP = 7;
  const lineColor = active ? "rgba(246,239,226,0.55)" : "var(--ink-mute)";
  const barColor = active ? "var(--paper)" : "var(--ink)";
  const maxLine = 4;

  // Assign each range to a column so overlapping ranges don't collide.
  // Greedy column packing: try columns 0,1,2,... use first that doesn't overlap.
  const cols = []; // cols[c] = array of {start,end} placed in that column
  const placed = ranges.map(r => {
    let c = 0;
    while (cols[c] && cols[c].some(x => !(r.end < x.start || r.start > x.end))) c++;
    if (!cols[c]) cols[c] = [];
    cols[c].push(r);
    return { ...r, col: c };
  });
  const totalCols = Math.max(1, cols.length);
  const COL_GAP = 3;
  const FIRST_COL_X = 14 - 6 - (totalCols - 1) * COL_GAP;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{flexShrink: 0}}>
      {/* mute text lines */}
      {Array.from({length: maxLine}).map((_, i) => (
        <rect key={i}
          x={14} y={TOP + i * LINE_GAP}
          width={LINE_LEN} height={2}
          rx={1}
          fill={lineColor}/>
      ))}
      {/* repetition bars — one per range, each in its own column.
          Outer (more recent / longer-spanning) columns sit to the LEFT,
          inner ones to the right, matching how Daime hymnbooks print them. */}
      {placed.map((r, i) => {
        const y = TOP + (r.start - 1) * LINE_GAP - 2;
        const h = (r.end - r.start) * LINE_GAP + 6;
        const colFromRight = (totalCols - 1) - r.col;
        const x = FIRST_COL_X + colFromRight * COL_GAP;
        return (
          <rect key={i}
            x={x} y={y}
            width={1.6} height={h}
            rx={0.8}
            fill={barColor}/>
        );
      })}
    </svg>
  );
};

const describe = (ranges) => {
  if (ranges.length === 1) {
    if (ranges[0].start === 1 && ranges[0].end === 4) return "estrofe inteira";
    return "1 grupo";
  }
  return ranges.length + " grupos";
};

const KbdMark = ({ active, children }) => (
  <span style={{
    position: "absolute",
    top: 8, right: 10,
    fontFamily: "var(--font-mono)", fontSize: 10,
    padding: "1px 6px", borderRadius: 3,
    border: "1px solid " + (active ? "rgba(246,239,226,0.35)" : "var(--rule)"),
    background: active ? "rgba(246,239,226,0.08)" : "var(--paper)",
    color: active ? "rgba(246,239,226,0.7)" : "var(--ink-mute)",
    letterSpacing: ".05em",
  }}>{children}</span>
);

// Stanza with optional repetition bar on the left. Overlapping ranges get
// their own column so 1-2 + 1-4 sit side-by-side instead of stacking.
const QuickStanza = ({ stanza, si, reps, stanzas, last }) => {
  const flat = [];
  stanzas.forEach((st, sIdx) => st.forEach((_, lIdx) => flat.push({ sIdx, lIdx })));

  const ranges = (reps || "").split(",").map(r => {
    const m = r.trim().match(/(\d+)\s*-\s*(\d+)/);
    return m ? { start: parseInt(m[1], 10), end: parseInt(m[2], 10) } : null;
  }).filter(Boolean);

  // Assign columns so overlapping ranges don't sit on top of each other
  const cols = [];
  const placed = ranges.map(r => {
    let c = 0;
    while (cols[c] && cols[c].some(x => !(r.end < x.start || r.start > x.end))) c++;
    if (!cols[c]) cols[c] = [];
    cols[c].push(r);
    return { ...r, col: c };
  });

  const localBars = [];
  placed.forEach((r) => {
    const startPos = flat[r.start - 1];
    const endPos = flat[r.end - 1];
    if (!startPos || !endPos) return;
    if (startPos.sIdx === si && endPos.sIdx === si) {
      localBars.push({ from: startPos.lIdx, to: endPos.lIdx, col: r.col });
    }
  });
  const totalColsLocal = Math.max(1, cols.length);

  const LINE_H = 26.35;
  const COL_GAP = 5;

  return (
    <div style={{position: "relative", marginBottom: last ? 0 : 22, paddingLeft: 22}}>
      {stanza.map((text, li) => (
        <div key={li} style={{padding: "1px 8px"}}>{text}</div>
      ))}
      {localBars.map((b, bi) => {
        const colFromRight = (totalColsLocal - 1) - b.col;
        return (
          <div key={bi} style={{
            position: "absolute",
            left: 4 + colFromRight * COL_GAP,
            top: b.from * LINE_H + 4,
            width: 2,
            height: (b.to - b.from + 1) * LINE_H - 8,
            background: "var(--ink-soft)", borderRadius: 1,
          }}/>
        );
      })}
    </div>
  );
};

Object.assign(window, { QuickReviewScreen });

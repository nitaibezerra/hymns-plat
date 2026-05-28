/* global React */
const { useState: useStateRM, useRef: useRefRM } = React;

// =====================================================
// Screen: Revise hymn — MOBILE / responsive (compact)
// 3 tabs (Texto · Áudio · Detalhes), sticky top + bottom.
// Designed for ~390-430px wide phone, but works up to ~640.
// =====================================================
const ReviseHymnMobileScreen = () => {
  const [tab, setTab] = useStateRM("texto");
  const [number, setNumber] = useStateRM(42);
  const [title, setTitle] = useStateRM("Sol da Manhã");
  const [body, setBody] = useStateRM(`Sol da manhã
Que ilumina
O meu coração
Na hora da oração

Sol da manhã
Que brilha o caminho
Para nunca eu errar
No meu caminho`);
  const [reps, setReps] = useStateRM("1-2,3-4");
  const [style, setStyle] = useStateRM("Marcha");
  const [status, setStatus] = useStateRM("in_review");
  const [textMode, setTextMode] = useStateRM("preview"); // preview | edit
  const [activeLine, setActiveLine] = useStateRM(2);

  // Audio review state
  const [playing, setPlaying] = useStateRM(false);
  const [progress, setProgress] = useStateRM(0.42);
  const [isMatch, setIsMatch] = useStateRM(null);
  const [quality, setQuality] = useStateRM(null);

  const STYLE_PRESETS = ["Marcha", "Valsa", "Mazurca"];
  const REP_PRESETS = ["1-2,3-4", "1-4", "1-2,3-4,1-4", "3-4,1-4"];

  const stripBlanks = () => setBody(body.split("\n").filter(l => l.trim() !== "").join("\n"));
  const groupEvery = (n) => {
    const lines = body.split("\n").filter(l => l.trim() !== "");
    const out = [];
    lines.forEach((l, i) => {
      out.push(l);
      if ((i + 1) % n === 0 && i !== lines.length - 1) out.push("");
    });
    setBody(out.join("\n"));
  };

  const onCaret = (e) => {
    const pos = e.target.selectionStart;
    const lineIdx = e.target.value.slice(0, pos).split("\n").length - 1;
    setActiveLine(lineIdx);
  };

  // Audio review status badge
  const audioStatus = isMatch === null ? "pending" : isMatch === false ? "flagged" : (quality ? "ok" : "pending");

  return (
    <div style={{
      width: "100%", minHeight: 874, background: "var(--paper-soft)",
      display: "flex", flexDirection: "column",
      fontFamily: "var(--font-sans)", color: "var(--ink)",
    }}>
      {/* ===== STICKY TOP ===== */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "var(--paper)", borderBottom: "1px solid var(--rule)",
      }}>
        <div style={{padding: "10px 16px", display: "flex", alignItems: "center", gap: 10}}>
          <a href="#" style={{
            display: "grid", placeItems: "center",
            width: 32, height: 32, borderRadius: 999,
            color: "var(--ink-soft)", textDecoration: "none", flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M9 2 L4 7 L9 12"/></svg>
          </a>
          <div style={{flex: 1, minWidth: 0}}>
            <div className="serif" style={{fontSize: 14, lineHeight: 1.1, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>
              {number} · {title}
            </div>
            <div className="mono" style={{fontSize: 9, letterSpacing: ".12em", color: "var(--ink-mute)", marginTop: 2}}>
              HINOS DO SOL · 42/64
            </div>
          </div>
          <button style={{
            padding: "6px 10px", borderRadius: 999,
            border: "1px solid var(--rule)", background: "var(--paper-soft)",
            fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-soft)",
            cursor: "pointer",
          }}>···</button>
        </div>

        {/* Progress bar */}
        <div style={{height: 2, background: "var(--paper-deep)", position: "relative"}}>
          <div style={{position: "absolute", top: 0, left: 0, bottom: 0, width: "65.6%", background: "linear-gradient(90deg, var(--gold), var(--gold-soft))"}}/>
        </div>

        {/* Tabs */}
        <div style={{display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderTop: "1px solid var(--rule-soft)"}}>
          {[
            {k: "texto", l: "Texto", badge: null},
            {k: "audio", l: "Áudio", badge: audioStatus},
            {k: "detalhes", l: "Detalhes", badge: null},
          ].map(t => (
            <button key={t.k} onClick={() => setTab(t.k)} style={{
              padding: "12px 0", border: 0,
              background: "transparent",
              borderBottom: "2px solid " + (tab === t.k ? "var(--ink)" : "transparent"),
              fontFamily: "var(--font-sans)", fontSize: 13,
              fontWeight: tab === t.k ? 600 : 400,
              color: tab === t.k ? "var(--ink)" : "var(--ink-mute)",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              {t.l}
              {t.badge && <TabBadge kind={t.badge}/>}
            </button>
          ))}
        </div>
      </div>

      {/* ===== CONTENT ===== */}
      <div style={{flex: 1, padding: "16px 16px 96px"}}>
        {tab === "texto" && (
          <TextoTab
            number={number} setNumber={setNumber}
            title={title} setTitle={setTitle}
            body={body} setBody={setBody}
            textMode={textMode} setTextMode={setTextMode}
            stripBlanks={stripBlanks} groupEvery={groupEvery}
            activeLine={activeLine} onCaret={onCaret}
            reps={reps}
          />
        )}

        {tab === "audio" && (
          <AudioTab
            title={title}
            playing={playing} setPlaying={setPlaying}
            progress={progress} setProgress={setProgress}
            isMatch={isMatch} setIsMatch={setIsMatch}
            quality={quality} setQuality={setQuality}
          />
        )}

        {tab === "detalhes" && (
          <DetalhesTab
            reps={reps} setReps={setReps}
            style={style} setStyle={setStyle}
            status={status} setStatus={setStatus}
            STYLE_PRESETS={STYLE_PRESETS} REP_PRESETS={REP_PRESETS}
          />
        )}
      </div>

      {/* ===== STICKY BOTTOM ===== */}
      <div style={{
        position: "sticky", bottom: 0, zIndex: 10,
        background: "var(--paper)", borderTop: "1px solid var(--rule)",
        padding: "12px 16px 14px",
        display: "flex", flexDirection: "column", gap: 8,
        boxShadow: "0 -8px 20px rgba(0,0,0,0.04)",
      }}>
        <div style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
          <span className="mono" style={{fontSize: 10, color: "var(--ink-mute)"}}>Salvo · há 3s</span>
          <a href="#" style={{fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--ink-soft)", textDecoration: "underline"}}>
            pular sem salvar
          </a>
        </div>
        <button style={{
          width: "100%", padding: "14px 0", border: 0, borderRadius: 8,
          background: "var(--ink)", color: "var(--paper)",
          fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 500,
          cursor: "pointer",
        }}>
          Marcar revisado e avançar →
        </button>
      </div>
    </div>
  );
};

// ===== Tabs =====

const TextoTab = ({ number, setNumber, title, setTitle, body, setBody, textMode, setTextMode, stripBlanks, groupEvery, activeLine, onCaret, reps }) => (
  <div style={{display: "flex", flexDirection: "column", gap: 16}}>
    {/* Number + title */}
    <div style={{display: "flex", gap: 8}}>
      <input type="number" value={number} onChange={e => setNumber(e.target.value)} style={{
        width: 64, padding: "10px 8px", fontFamily: "var(--font-display)", fontSize: 18,
        border: "1px solid var(--rule)", borderRadius: 6, background: "var(--paper)",
        textAlign: "center", outline: "none", color: "var(--ink)",
      }}/>
      <input type="text" value={title} onChange={e => setTitle(e.target.value)} style={{
        flex: 1, minWidth: 0, padding: "10px 12px", fontFamily: "var(--font-display)", fontSize: 18,
        border: "1px solid var(--rule)", borderRadius: 6, background: "var(--paper)",
        outline: "none", color: "var(--ink)",
      }}/>
    </div>

    {/* Mode toggle */}
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, padding: 4,
      background: "var(--paper-deep)", border: "1px solid var(--rule)", borderRadius: 8,
    }}>
      {[
        {k: "preview", l: "Prévia"},
        {k: "edit", l: "Editar"},
      ].map(m => (
        <button key={m.k} onClick={() => setTextMode(m.k)} style={{
          padding: "9px 0", border: 0, borderRadius: 6, cursor: "pointer",
          background: textMode === m.k ? "var(--paper)" : "transparent",
          color: textMode === m.k ? "var(--ink)" : "var(--ink-mute)",
          fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: textMode === m.k ? 600 : 400,
          boxShadow: textMode === m.k ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
        }}>{m.l}</button>
      ))}
    </div>

    {textMode === "preview" ? (
      <article className="hymn-page" style={{
        background: "var(--paper)", padding: "32px 24px",
        boxShadow: "var(--shadow-2)", borderRadius: 4,
      }}>
        <h2 style={{
          textAlign: "center", marginBottom: 22,
          fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 500,
          letterSpacing: ".005em", color: "var(--ink)",
        }}>{number} - {title}</h2>
        <RenderedBodyM body={body} reps={reps} activeLine={activeLine}/>
        <div style={{textAlign: "center", marginTop: 22, color: "var(--gold)", fontSize: 16, fontFamily: "var(--font-display)"}}>✡</div>
      </article>
    ) : (
      <>
        {/* Shortcut chips — horizontal scroll on tight screens */}
        <div style={{display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginLeft: -4, marginRight: -4, paddingLeft: 4, paddingRight: 4}}>
          <ChipS onClick={stripBlanks}>⊘ Sem linhas em branco</ChipS>
          <ChipS onClick={() => groupEvery(4)}>¶ a cada 4</ChipS>
          <ChipS onClick={() => groupEvery(3)}>¶ a cada 3</ChipS>
        </div>

        <textarea value={body} onChange={e => { setBody(e.target.value); onCaret(e); }} onKeyUp={onCaret} onClick={onCaret}
          style={{
            width: "100%", minHeight: 320, padding: 16,
            fontFamily: "var(--font-serif)", fontSize: 15, lineHeight: 1.55,
            border: "1px solid var(--rule)", borderRadius: 8, background: "var(--paper)",
            color: "var(--ink)", outline: "none", resize: "vertical",
          }}/>
        <div className="mono" style={{fontSize: 10, color: "var(--ink-mute)"}}>
          Linha {activeLine + 1} de {body.split("\n").length}
        </div>
      </>
    )}
  </div>
);

const AudioTab = ({ title, playing, setPlaying, progress, setProgress, isMatch, setIsMatch, quality, setQuality }) => (
  <div style={{display: "flex", flexDirection: "column", gap: 18}}>
    <div>
      <div className="eyebrow" style={{marginBottom: 8}}>REVISÃO DE ÁUDIO</div>
      <div className="mono" style={{fontSize: 10, color: "var(--ink-mute)"}}>arquivo · sol-da-manha-001.mp3 · 4:08</div>
    </div>

    {/* Player card */}
    <div style={{
      background: "var(--paper)", border: "1px solid var(--rule)", borderRadius: 12,
      padding: "20px 16px",
    }}>
      {/* Big play button + waveform */}
      <div style={{display: "flex", flexDirection: "column", gap: 14}}>
        <div style={{display: "flex", alignItems: "center", gap: 12}}>
          <button onClick={() => setPlaying(!playing)} style={{
            width: 56, height: 56, borderRadius: "50%",
            border: 0, background: "var(--firmament)", color: "var(--paper)",
            cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0,
          }}>
            {playing
              ? <svg width="18" height="18" viewBox="0 0 14 14" fill="currentColor"><rect x="3" y="2" width="3" height="10"/><rect x="8" y="2" width="3" height="10"/></svg>
              : <svg width="18" height="18" viewBox="0 0 14 14" fill="currentColor"><path d="M3 1 L12 7 L3 13 Z"/></svg>}
          </button>
          <div style={{flex: 1, minWidth: 0}}>
            <div className="serif" style={{fontSize: 15, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>{title}</div>
            <div className="mono" style={{fontSize: 11, color: "var(--ink-mute)", marginTop: 2}}>
              {fmtM(progress * 248)} / 4:08
            </div>
          </div>
        </div>

        {/* Waveform */}
        <div style={{display: "flex", alignItems: "center", gap: 2, height: 40, cursor: "pointer"}}
             onClick={(e) => {
               const r = e.currentTarget.getBoundingClientRect();
               setProgress((e.clientX - r.left) / r.width);
             }}>
          {Array.from({length: 48}).map((_, i) => {
            const h = 8 + Math.abs(Math.sin(i * 0.7) * 22) + Math.abs(Math.cos(i * 0.31) * 10);
            const passed = i / 48 < progress;
            return <div key={i} style={{flex: 1, height: h, background: passed ? "var(--firmament)" : "var(--rule)", borderRadius: 1}}/>;
          })}
        </div>

        {/* Transport */}
        <div style={{display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6}}>
          <SmallBtnM>« 10s</SmallBtnM>
          <SmallBtnM>1× velocidade</SmallBtnM>
          <SmallBtnM>10s »</SmallBtnM>
        </div>
      </div>
    </div>

    {/* Match question */}
    <div>
      <div style={{fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--ink)", fontWeight: 500, marginBottom: 4}}>
        É mesmo a gravação de <em>{`"${title}"`}</em>?
      </div>
      <div style={{fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ink-mute)", marginBottom: 12}}>
        Confirma se o áudio corresponde ao hino e à letra.
      </div>
      <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8}}>
        <YesNoM active={isMatch === true} kind="yes" onClick={() => setIsMatch(true)}>✓ Confere</YesNoM>
        <YesNoM active={isMatch === false} kind="no" onClick={() => setIsMatch(false)}>✗ Não confere</YesNoM>
      </div>
    </div>

    {isMatch === true && (
      <div style={{
        padding: 16, background: "var(--paper)",
        border: "1px solid var(--rule)", borderRadius: 8,
      }}>
        <div style={{fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 500, marginBottom: 4}}>
          Qualidade da gravação
        </div>
        <div style={{fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--ink-mute)", marginBottom: 12}}>
          Toque para avaliar.
        </div>
        <div style={{display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6}}>
          {[1,2,3,4,5].map(n => (
            <button key={n} onClick={() => setQuality(n)} style={{
              padding: "12px 0", borderRadius: 6,
              border: "1px solid " + (quality && n <= quality ? "var(--gold)" : "var(--rule)"),
              background: quality && n <= quality ? "var(--gold)" : "var(--paper-soft)",
              color: quality && n <= quality ? "var(--paper)" : "var(--ink-mute)",
              cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600,
            }}>{n}</button>
          ))}
        </div>
        {quality && (
          <div style={{marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap"}}>
            {["Ruído de fundo", "Voz baixa", "Cortes", "Excelente captação"].map(t => (
              <span key={t} style={{
                padding: "6px 10px", borderRadius: 999,
                border: "1px solid var(--rule)", background: "var(--paper-soft)",
                color: "var(--ink-soft)", fontFamily: "var(--font-sans)", fontSize: 11,
                cursor: "pointer",
              }}>{t}</span>
            ))}
          </div>
        )}
      </div>
    )}

    {isMatch === false && (
      <div style={{
        background: "rgba(177, 62, 46, 0.06)", border: "1px solid rgba(177, 62, 46, 0.3)",
        borderRadius: 8, padding: 14,
      }}>
        <div style={{color: "var(--vermilion)", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, marginBottom: 4}}>
          Áudio sinalizado
        </div>
        <div style={{color: "var(--vermilion)", fontFamily: "var(--font-sans)", fontSize: 11, marginBottom: 10, opacity: 0.9}}>
          Vai para a fila do moderador. Marque o motivo:
        </div>
        <div style={{display: "flex", gap: 6, flexWrap: "wrap"}}>
          {["É outro hino", "Cortado", "Letra diferente", "Inaudível", "Outro"].map(t => (
            <span key={t} style={{
              padding: "6px 10px", borderRadius: 999,
              border: "1px solid var(--vermilion)", background: "var(--paper)",
              color: "var(--vermilion)", fontFamily: "var(--font-sans)", fontSize: 11,
              cursor: "pointer",
            }}>{t}</span>
          ))}
        </div>
      </div>
    )}
  </div>
);

const DetalhesTab = ({ reps, setReps, style, setStyle, status, setStatus, STYLE_PRESETS, REP_PRESETS }) => (
  <div style={{display: "flex", flexDirection: "column", gap: 22}}>
    {/* Estilo */}
    <div>
      <div className="eyebrow" style={{marginBottom: 10}}>ESTILO</div>
      <div style={{display: "flex", gap: 6, flexWrap: "wrap"}}>
        {STYLE_PRESETS.map(p => (
          <button key={p} onClick={() => setStyle(p)} style={{
            flex: 1, minWidth: 0, padding: "11px 10px", borderRadius: 8,
            border: "1px solid " + (style === p ? "var(--ink)" : "var(--rule)"),
            background: style === p ? "var(--ink)" : "var(--paper)",
            color: style === p ? "var(--paper)" : "var(--ink-soft)",
            fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500,
            cursor: "pointer",
          }}>{p}</button>
        ))}
      </div>
    </div>

    {/* Repetições */}
    <div>
      <div className="eyebrow" style={{marginBottom: 10}}>REPETIÇÕES</div>
      <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8}}>
        {REP_PRESETS.map(p => (
          <button key={p} onClick={() => setReps(p)} style={{
            padding: "11px 8px", borderRadius: 8,
            border: "1px solid " + (reps === p ? "var(--ink)" : "var(--rule)"),
            background: reps === p ? "var(--ink)" : "var(--paper)",
            color: reps === p ? "var(--paper)" : "var(--ink-soft)",
            fontFamily: "var(--font-mono)", fontSize: 12,
            cursor: "pointer",
          }}>{p}</button>
        ))}
      </div>
      <input value={reps} onChange={e => setReps(e.target.value)} placeholder="Ou digite manualmente"
        style={{
          width: "100%", padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 12,
          border: "1px solid var(--rule)", borderRadius: 6, background: "var(--paper)",
          outline: "none", color: "var(--ink-soft)",
        }}/>
    </div>

    {/* Recebido em */}
    <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12}}>
      <FieldM label="RECEBIDO EM" value="1998-04-12"/>
      <FieldM label="OFERECIDO PARA" value="" placeholder="—"/>
    </div>

    {/* Status segmented */}
    <div>
      <div className="eyebrow" style={{marginBottom: 10}}>STATUS DE REVISÃO</div>
      <div style={{display: "flex", flexDirection: "column", gap: 6, padding: 4,
        background: "var(--paper-deep)", border: "1px solid var(--rule)", borderRadius: 8}}>
        {[
          {k: "not_reviewed", l: "Não revisado", c: "var(--vermilion)"},
          {k: "in_review", l: "Em revisão", c: "var(--gold)"},
          {k: "reviewed", l: "Revisado ✓", c: "var(--moss)"},
        ].map(s => (
          <button key={s.k} onClick={() => setStatus(s.k)} style={{
            padding: "11px 0", border: 0, borderRadius: 6, cursor: "pointer",
            background: status === s.k ? s.c : "transparent",
            color: status === s.k ? "var(--paper)" : "var(--ink-soft)",
            fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500,
          }}>{s.l}</button>
        ))}
      </div>
    </div>
  </div>
);

// ===== Mobile-specific helpers =====

const TabBadge = ({ kind }) => {
  const c = kind === "ok" ? "var(--moss)" : kind === "flagged" ? "var(--vermilion)" : "var(--gold)";
  return <span style={{width: 6, height: 6, borderRadius: "50%", background: c, display: "inline-block"}}/>;
};

const ChipS = ({ children, onClick }) => (
  <button onClick={onClick} style={{
    padding: "8px 14px", borderRadius: 999,
    border: "1px solid var(--rule)", background: "var(--paper)",
    color: "var(--ink-soft)", fontFamily: "var(--font-sans)", fontSize: 12,
    cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
  }}>{children}</button>
);

const SmallBtnM = ({ children }) => (
  <button style={{
    padding: "9px 0", borderRadius: 6,
    border: "1px solid var(--rule)", background: "var(--paper-soft)",
    color: "var(--ink-soft)", fontFamily: "var(--font-mono)", fontSize: 11,
    cursor: "pointer",
  }}>{children}</button>
);

const YesNoM = ({ active, kind, onClick, children }) => {
  const c = kind === "yes" ? "var(--moss)" : "var(--vermilion)";
  return (
    <button onClick={onClick} style={{
      padding: "13px 0", borderRadius: 8, cursor: "pointer",
      border: "1px solid " + (active ? c : "var(--rule)"),
      background: active ? c : "var(--paper)",
      color: active ? "var(--paper)" : "var(--ink-soft)",
      fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500,
    }}>{children}</button>
  );
};

const FieldM = ({ label, value, placeholder }) => (
  <div>
    <div className="eyebrow" style={{fontSize: 9, marginBottom: 4}}>{label}</div>
    <input defaultValue={value} placeholder={placeholder} style={{
      width: "100%", padding: "10px 12px", fontFamily: "var(--font-sans)", fontSize: 13,
      border: "1px solid var(--rule)", borderRadius: 6, background: "var(--paper)",
      outline: "none", color: "var(--ink)",
    }}/>
  </div>
);

const fmtM = (sec) => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};

// ----- Rendered preview body for mobile (compact) -----
const RenderedBodyM = ({ body, reps, activeLine }) => {
  const lines = body.split("\n");
  const stanzas = [];
  let cur = [];
  lines.forEach((l, i) => {
    if (l.trim() === "") { if (cur.length) { stanzas.push(cur); cur = []; } }
    else cur.push({ idx: i, text: l });
  });
  if (cur.length) stanzas.push(cur);

  const ranges = (reps || "").split(",").map(r => {
    const m = r.trim().match(/(\d+)\s*-\s*(\d+)/);
    return m ? { start: parseInt(m[1], 10), end: parseInt(m[2], 10) } : null;
  }).filter(Boolean);

  const flat = [];
  stanzas.forEach((st, si) => st.forEach((_, li) => flat.push({ si, li })));

  const LINE_H = 23.25; // 15px * 1.55

  return (
    <div style={{
      width: "max-content", maxWidth: "100%", margin: "0 auto",
      fontFamily: "var(--font-serif)", fontSize: 15, lineHeight: 1.55, color: "var(--ink)",
    }}>
      {stanzas.map((stanza, si) => {
        const localBars = [];
        ranges.forEach((r) => {
          const a = flat[r.start - 1];
          const b = flat[r.end - 1];
          if (a && b && a.si === si && b.si === si) localBars.push({ from: a.li, to: b.li });
        });
        return (
          <div key={si} style={{position: "relative", marginBottom: si < stanzas.length - 1 ? 16 : 0, paddingLeft: 14}}>
            {stanza.map((ln) => {
              const isActive = ln.idx === activeLine;
              return (
                <div key={ln.idx} style={{
                  background: isActive ? "rgba(217, 176, 106, 0.22)" : "transparent",
                  borderLeft: isActive ? "2px solid var(--gold)" : "2px solid transparent",
                  padding: "1px 6px",
                  borderRadius: 2,
                }}>{ln.text}</div>
              );
            })}
            {localBars.map((b, bi) => (
              <div key={bi} style={{
                position: "absolute", left: 4,
                top: b.from * LINE_H + 3,
                width: 2,
                height: (b.to - b.from + 1) * LINE_H - 6,
                background: "var(--ink-soft)", borderRadius: 1,
              }}/>
            ))}
          </div>
        );
      })}
    </div>
  );
};

Object.assign(window, { ReviseHymnMobileScreen });

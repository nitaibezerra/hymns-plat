/* global React */
const { useState: useStateR, useRef: useRefR } = React;

// =====================================================
// Screen: Revise hymn
// LEFT: editor (number/title, body textarea, meta) — primary focus
// RIGHT: rendered hymn preview (as in Carrossel mode) + audio review
// Active line is highlighted on both sides.
// OCR / Diff are now optional alternative views inside the editor side.
// =====================================================
const ReviseHymnScreen = () => {
  const [status, setStatus] = useStateR("in_review");
  const [number, setNumber] = useStateR(42);
  const [title, setTitle] = useStateR("Sol da Manhã");
  const [body, setBody] = useStateR(`Sol da manhã
Que ilumina
O meu coração
Na hora da oração

Sol da manhã
Que brilha o caminho
Para nunca eu errar
No meu caminho`);
  const [reps, setReps] = useStateR("1-2,3-4");
  const [style, setStyle] = useStateR("Marcha");
  const [activeLine, setActiveLine] = useStateR(2); // index of cursor line, for cross-pane highlight
  const textareaRef = useRefR(null);

  // ----- Shortcuts: text formatting -----
  const stripBlanks = () => {
    setBody(body.split("\n").filter((l) => l.trim() !== "").join("\n"));
  };
  const groupEvery = (n) => {
    const lines = body.split("\n").filter((l) => l.trim() !== "");
    const out = [];
    lines.forEach((l, i) => {
      out.push(l);
      if ((i + 1) % n === 0 && i !== lines.length - 1) out.push("");
    });
    setBody(out.join("\n"));
  };

  // Track caret line in textarea
  const onCaret = (e) => {
    const value = e.target.value;
    const pos = e.target.selectionStart;
    const before = value.slice(0, pos);
    const lineIdx = before.split("\n").length - 1;
    setActiveLine(lineIdx);
  };

  const REP_PRESETS = ["1-2,3-4", "1-4", "1-2,3-4,1-4", "3-4,1-4"];
  const STYLE_PRESETS = ["Marcha", "Valsa", "Mazurca"];

  return (
    <div className="app-shell" style={{ minHeight: 1280, background: "var(--paper-soft)" }}>
      {/* Slim editor topbar */}
      <div style={{
        padding: "12px 32px", borderBottom: "1px solid var(--rule)",
        background: "var(--paper)", display: "flex", alignItems: "center", gap: 18
      }}>
        <a href="#" className="serif muted" style={{ textDecoration: "none", fontSize: 14 }}>← Hinos do Sol</a>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div className="display" style={{ fontSize: 16, lineHeight: 1 }}>Revisar hino</div>
          <div className="mono muted" style={{ fontSize: 10, letterSpacing: ".15em", marginTop: 2 }}>42 DE 64 · 23 RESTANTES</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="pill pill-mid">Em revisão</span>
        </div>
      </div>

      {/* Progress strip across the top */}
      <div style={{ height: 4, background: "var(--paper-deep)", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: "65.6%", background: "linear-gradient(90deg, var(--gold), var(--gold-soft))" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, minHeight: 1100 }}>
        {/* LEFT: Editor (primary) */}
        <div style={{ padding: "32px 40px", borderRight: "1px solid var(--rule)", background: "var(--paper)" }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>EDITOR · TEXTO</div>

          {/* Number + title (always visible) */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <input type="number" value={number} onChange={(e) => setNumber(e.target.value)} style={{
              width: 80, padding: "12px 14px", fontFamily: "var(--font-display)", fontSize: 22,
              border: "1px solid var(--rule)", borderRadius: 8, background: "var(--paper-soft)",
              textAlign: "center", outline: "none", color: "var(--ink)"
            }} />
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} style={{
              flex: 1, padding: "12px 16px", fontFamily: "var(--font-display)", fontSize: 22,
              border: "1px solid var(--rule)", borderRadius: 8, background: "var(--paper-soft)",
              outline: "none", color: "var(--ink)"
            }} />
          </div>

          {/* Shortcuts row */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <span className="eyebrow" style={{ fontSize: 9, marginRight: 4 }}>ATALHOS</span>
            <ShortcutPill onClick={stripBlanks} title="Remove todas as linhas em branco">
              <BlankIcon /> Sem linhas em branco
            </ShortcutPill>
            <ShortcutPill onClick={() => groupEvery(4)} title="Agrupar em estrofes de 4 linhas">
              ¶ a cada 4 linhas
            </ShortcutPill>
            <ShortcutPill onClick={() => groupEvery(3)} title="Agrupar em estrofes de 3 linhas">
              ¶ a cada 3 linhas
            </ShortcutPill>
          </div>

          <textarea ref={textareaRef} value={body} onChange={(e) => {setBody(e.target.value);onCaret(e);}}
            onKeyUp={onCaret} onClick={onCaret}
            style={{
              width: "100%", minHeight: 280, padding: 20,
              fontFamily: "var(--font-serif)", fontSize: 16, lineHeight: 1.6,
              border: "1px solid var(--rule)", borderRadius: 8, background: "var(--paper-soft)",
              color: "var(--ink)", outline: "none", resize: "vertical"
            }} />
          <div style={{ marginTop: 6, fontSize: 11, color: "var(--ink-mute)" }} className="mono">
            Linha {activeLine + 1} de {body.split("\n").length} · destaque sincronizado com a prévia →
          </div>

          {/* Meta grid — always visible */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 20 }}>
            <div>
              <div className="eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>REPETIÇÕES</div>
              <input value={reps} onChange={(e) => setReps(e.target.value)} style={inputStyle("mono")} />
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                {REP_PRESETS.map((p) =>
                <PresetPill key={p} active={reps === p} onClick={() => setReps(p)} mono>{p}</PresetPill>
                )}
              </div>
            </div>
            <div>
              <div className="eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>ESTILO</div>
              <input value={style} onChange={(e) => setStyle(e.target.value)} style={inputStyle("sans")} />
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                {STYLE_PRESETS.map((p) =>
                <PresetPill key={p} active={style === p} onClick={() => setStyle(p)}>{p}</PresetPill>
                )}
              </div>
            </div>
            <Field label="Recebido em" value="1998-04-12" />
            <Field label="Oferecido para" value="" placeholder="—" />
          </div>

          {/* Status segmented */}
          <div style={{ marginTop: 24 }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>STATUS DE REVISÃO</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, padding: 4,
              background: "var(--paper-soft)", border: "1px solid var(--rule)", borderRadius: 8 }}>
              {[
              { k: "not_reviewed", l: "Não revisado", c: "var(--vermilion)" },
              { k: "in_review", l: "Em revisão", c: "var(--gold)" },
              { k: "reviewed", l: "Revisado ✓", c: "var(--moss)" }].
              map((s) =>
              <button key={s.k} onClick={() => setStatus(s.k)} style={{
                padding: "10px 0", border: 0, borderRadius: 6, cursor: "pointer",
                background: status === s.k ? s.c : "transparent",
                color: status === s.k ? "var(--paper)" : "var(--ink-soft)",
                fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500
              }}>{s.l}</button>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Preview + audio review */}
        <div style={{ padding: "32px 40px", background: "var(--paper-soft)" }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>PRÉVIA · COMO O LEITOR VAI VER</div>

          {/* Rendered hymn page (Carrossel-style) */}
          <article className="hymn-page" style={{
            background: "var(--paper)",
            padding: "48px 56px", boxShadow: "var(--shadow-2)",
            borderRadius: 4
          }}>
            <h2 className="hymn-title" style={{ textAlign: "center", marginBottom: 32, fontFamily: "var(--font-serif)", fontSize: 24, fontWeight: 500, letterSpacing: ".005em", color: "var(--ink)" }}>
              {number} - {title}
            </h2>
            <RenderedBody body={body} reps={reps} activeLine={activeLine} />
            <div style={{ textAlign: "center", marginTop: 28, color: "var(--gold)", fontSize: 18, fontStyle: "italic", fontFamily: "var(--font-display)" }}>✡</div>
          </article>

          {/* Audio review */}
          <AudioReview />
        </div>
      </div>

      {/* Bottom action bar — sticky */}
      <div style={{
        position: "sticky", bottom: 0,
        background: "var(--paper)", borderTop: "1px solid var(--rule)",
        padding: "14px 32px",
        display: "flex", alignItems: "center", gap: 16,
        boxShadow: "0 -8px 20px rgba(0,0,0,0.04)"
      }}>
        <button className="btn btn-ghost"><kbd>←</kbd> Voltar</button>
        <button className="btn btn-ghost">Pular sem salvar <kbd>Esc</kbd></button>
        <div style={{ flex: 1 }} />
        <span className="mono muted" style={{ fontSize: 11 }}>Salvo automaticamente · há 3s</span>
        <button className="btn btn-ghost">Salvar rascunho</button>
        <button className="btn btn-primary">
          Marcar revisado e avançar <kbd style={{ background: "rgba(255,255,255,0.15)", borderColor: "rgba(255,255,255,0.3)", color: "var(--paper)" }}>⏎</kbd>
        </button>
      </div>
    </div>);

};

// ===== Helpers =====

const inputStyle = (font) => ({
  width: "100%", padding: "10px 12px",
  fontFamily: `var(--font-${font})`, fontSize: 13,
  border: "1px solid var(--rule)", borderRadius: 6, background: "var(--paper-soft)",
  outline: "none", color: "var(--ink)"
});

const PresetPill = ({ active, onClick, children, mono }) =>
<button onClick={onClick} style={{
  padding: "4px 10px", borderRadius: 999,
  border: "1px solid " + (active ? "var(--ink)" : "var(--rule)"),
  background: active ? "var(--ink)" : "var(--paper)",
  color: active ? "var(--paper)" : "var(--ink-soft)",
  fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
  fontSize: 11, cursor: "pointer"
}}>{children}</button>;


// ----- Rendered preview (groups stanzas by blank lines, draws rep brackets per `reps`) -----
const RenderedBody = ({ body, reps, activeLine }) => {
  // Build stanzas: each stanza is an array of {globalLineIdx, text}
  const lines = body.split("\n");
  const stanzas = [];
  let cur = [];
  lines.forEach((l, i) => {
    if (l.trim() === "") {
      if (cur.length) {stanzas.push(cur);cur = [];}
    } else {
      cur.push({ idx: i, text: l });
    }
  });
  if (cur.length) stanzas.push(cur);

  // Build flat list of non-blank lines, with each stanza's local position
  // For each stanza, we render <div> per line and wrap groups of lines per
  // `reps` ranges with a right-side bracket (║ + small "2×" label).
  // `reps` indexes are 1-based and refer to non-blank line numbers within
  // the WHOLE hymn (matching Hinario's convention).
  const ranges = parseReps(reps);

  // Map each non-blank line's running index → {stanzaIdx, lineInStanza}
  const flatPositions = [];
  stanzas.forEach((st, si) => {
    st.forEach((ln, li) => flatPositions.push({ stanzaIdx: si, lineInStanza: li, idx: ln.idx }));
  });

  return (
    <div style={{
      width: "max-content", maxWidth: "100%",
      margin: "0 auto",
      fontFamily: "var(--font-serif)", fontSize: 17, lineHeight: 1.55,
      color: "var(--ink)"
    }}>
      {stanzas.map((stanza, si) => {
        // Find ranges that fall ENTIRELY within this stanza, expressed in
        // local line indices (0-based within stanza).
        const localBrackets = [];
        ranges.forEach((r) => {
          const startPos = flatPositions[r.start - 1];
          const endPos = flatPositions[r.end - 1];
          if (!startPos || !endPos) return;
          if (startPos.stanzaIdx === si && endPos.stanzaIdx === si) {
            localBrackets.push({
              from: startPos.lineInStanza,
              to: endPos.lineInStanza,
              label: "2×"
            });
          }
        });

        return (
          <div key={si} style={{
            position: "relative",
            marginBottom: si < stanzas.length - 1 ? 22 : 0,
            paddingLeft: 18
          }}>
            {stanza.map((ln, li) => {
              const isActive = ln.idx === activeLine;
              return (
                <div key={ln.idx} data-line={li} style={{
                  background: isActive ? "rgba(217, 176, 106, 0.22)" : "transparent",
                  borderLeft: isActive ? "2px solid var(--gold)" : "2px solid transparent",
                  padding: "1px 8px 1px 8px",
                  borderRadius: 2,
                  transition: "background 120ms"
                }}>{ln.text}</div>);

            })}

            {/* Repetition bars on the left edge — one thin vertical line per range */}
            {localBrackets.map((b, bi) =>
            <RepBar key={bi} from={b.from} to={b.to} />
            )}
          </div>);

      })}
    </div>);

};

// Parse reps like "1-2,3-4" → [{start:1,end:2},{start:3,end:4}]
const parseReps = (reps) => {
  if (!reps || !reps.trim()) return [];
  const out = [];
  reps.split(",").forEach((r) => {
    const m = r.trim().match(/(\d+)\s*-\s*(\d+)/);
    if (!m) return;
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    if (a > 0 && b >= a) out.push({ start: a, end: b });
  });
  return out;
};

// Thin vertical bar to the left of a range of lines [from..to], indicating
// they are sung as a repeated group. Style matches Hinario.com.br: a single
// 1.5px ink line, slightly inset top/bottom of the line-box.
const RepBar = ({ from, to }) => {
  const LINE_H = 26.35; // matches body line-height (1.55 × 17px)
  const top = from * LINE_H + 4;
  const height = (to - from + 1) * LINE_H - 8;
  return (
    <div style={{
      position: "absolute",
      left: 4,
      top,
      width: 2,
      height,
      background: "var(--ink-soft)",
      borderRadius: 1
    }} />);

};

// ----- Audio review block -----
const AudioReview = () => {
  const [hasAudio] = useStateR(true);
  const [playing, setPlaying] = useStateR(false);
  const [progress, setProgress] = useStateR(0.42);
  const [isMatch, setIsMatch] = useStateR(null); // null | true | false
  const [quality, setQuality] = useStateR(null); // 1..5

  if (!hasAudio) {
    return (
      <div style={{
        marginTop: 24, padding: 20,
        background: "var(--paper)", border: "1px dashed var(--rule)", borderRadius: 8,
        textAlign: "center", color: "var(--ink-mute)"
      }}>
        <span className="serif" style={{ fontStyle: "italic" }}>Sem gravação para este hino. </span>
        <a href="#" style={{ color: "var(--firmament)", textDecoration: "underline" }}>Contribuir áudio</a>
      </div>);

  }

  return (
    <div style={{
      marginTop: 24, padding: 20,
      background: "var(--paper)", border: "1px solid var(--rule)", borderRadius: 8
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div className="eyebrow">REVISÃO DE ÁUDIO</div>
        <span className="mono muted" style={{ fontSize: 10 }}>arquivo · sol-da-manha-001.mp3 · 4:08</span>
      </div>

      {/* Player row */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
        <button onClick={() => setPlaying(!playing)} style={{
          width: 44, height: 44, borderRadius: "50%",
          border: 0, background: "var(--firmament)", color: "var(--paper)",
          cursor: "pointer", display: "grid", placeItems: "center",
          flexShrink: 0
        }}>
          {playing ?
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="3" y="2" width="3" height="10" /><rect x="8" y="2" width="3" height="10" /></svg> :
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 1 L12 7 L3 13 Z" /></svg>}
        </button>
        <div style={{ flex: 1 }}>
          {/* Waveform stub */}
          <div style={{ display: "flex", alignItems: "center", gap: 2, height: 32, position: "relative", cursor: "pointer" }}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setProgress((e.clientX - r.left) / r.width);
          }}>
            {Array.from({ length: 64 }).map((_, i) => {
              const h = 6 + Math.abs(Math.sin(i * 0.7) * 16) + Math.abs(Math.cos(i * 0.31) * 8);
              const passed = i / 64 < progress;
              return <div key={i} style={{ flex: 1, height: h, background: passed ? "var(--firmament)" : "var(--rule)", borderRadius: 1 }} />;
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span className="mono" style={{ fontSize: 10, color: "var(--ink-mute)" }}>{fmt(progress * 248)}</span>
            <span className="mono" style={{ fontSize: 10, color: "var(--ink-mute)" }}>4:08</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <SmallIcon title="−10s">«10</SmallIcon>
          <SmallIcon title="+10s">10»</SmallIcon>
          <SmallIcon title="velocidade">1×</SmallIcon>
        </div>
      </div>

      {/* Match question */}
      <div style={{ padding: "12px 0", borderTop: "1px solid var(--rule-soft)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>
              É mesmo a gravação de <em>{`"Sol da Manhã"`}</em>?
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--ink-mute)", marginTop: 2 }}>
              Confirma se o áudio corresponde ao hino e à letra acima.
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <YesNoBtn active={isMatch === true} kind="yes" onClick={() => setIsMatch(true)}>✓ Confere</YesNoBtn>
            <YesNoBtn active={isMatch === false} kind="no" onClick={() => setIsMatch(false)}>✗ Não confere</YesNoBtn>
          </div>
        </div>
      </div>

      {/* Quality (only when match) */}
      {isMatch === true &&
      <div style={{ padding: "12px 0", borderTop: "1px solid var(--rule-soft)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>
                Qualidade da gravação
              </div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--ink-mute)", marginTop: 2 }}>
                Ajuda a priorizar uploads melhores no futuro.
              </div>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {[1, 2, 3, 4, 5].map((n) =>
            <button key={n} onClick={() => setQuality(n)} style={{
              width: 26, height: 26, borderRadius: 4,
              border: "1px solid " + (quality && n <= quality ? "var(--gold)" : "var(--rule)"),
              background: quality && n <= quality ? "var(--gold)" : "var(--paper-soft)",
              color: quality && n <= quality ? "var(--paper)" : "var(--ink-mute)",
              cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11
            }}>{n}</button>
            )}
            </div>
          </div>
          {quality &&
        <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span className="eyebrow" style={{ fontSize: 9, marginRight: 4, alignSelf: "center" }}>OBSERVAÇÕES</span>
              {["Ruído de fundo", "Voz baixa", "Cortes", "Excelente captação", "Mestre de cerimônias"].map((t) =>
          <span key={t} style={{
            padding: "3px 9px", borderRadius: 999,
            border: "1px solid var(--rule)", background: "var(--paper-soft)",
            color: "var(--ink-soft)", fontFamily: "var(--font-sans)", fontSize: 11,
            cursor: "pointer"
          }}>{t}</span>
          )}
            </div>
        }
        </div>
      }

      {/* Mismatch — escalate */}
      {isMatch === false &&
      <div style={{ padding: "12px 0", borderTop: "1px solid var(--rule-soft)" }}>
          <div style={{
          background: "rgba(177, 62, 46, 0.06)", border: "1px solid rgba(177, 62, 46, 0.3)",
          borderRadius: 6, padding: 12, color: "var(--vermilion)", fontFamily: "var(--font-sans)", fontSize: 12
        }}>
            <strong>Áudio sinalizado.</strong> Vai para a fila de revisão de moderador. Marque o motivo:
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {["É outro hino", "Áudio cortado/incompleto", "Letra diferente", "Áudio inaudível", "Outro"].map((t) =>
            <span key={t} style={{
              padding: "3px 9px", borderRadius: 999,
              border: "1px solid var(--vermilion)", background: "var(--paper)",
              color: "var(--vermilion)", fontFamily: "var(--font-sans)", fontSize: 11,
              cursor: "pointer"
            }}>{t}</span>
            )}
            </div>
          </div>
        </div>
      }
    </div>);

};

const fmt = (sec) => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};

const SmallIcon = ({ children, title }) =>
<button title={title} style={{
  width: 36, height: 32, borderRadius: 4,
  border: "1px solid var(--rule)", background: "var(--paper)",
  color: "var(--ink-soft)", fontFamily: "var(--font-mono)", fontSize: 10,
  cursor: "pointer"
}}>{children}</button>;


const YesNoBtn = ({ active, kind, onClick, children }) => {
  const c = kind === "yes" ? "var(--moss)" : "var(--vermilion)";
  return (
    <button onClick={onClick} style={{
      padding: "8px 14px", borderRadius: 6, cursor: "pointer",
      border: "1px solid " + (active ? c : "var(--rule)"),
      background: active ? c : "var(--paper)",
      color: active ? "var(--paper)" : "var(--ink-soft)",
      fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 500
    }}>{children}</button>);

};

const ShortcutPill = ({ children, onClick, title }) =>
<button onClick={onClick} title={title} style={{
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "6px 12px", borderRadius: 999,
  border: "1px solid var(--rule)", background: "var(--paper-soft)",
  color: "var(--ink-soft)", fontFamily: "var(--font-sans)", fontSize: 12,
  cursor: "pointer"
}}>{children}</button>;


const BlankIcon = () =>
<svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3">
    <path d="M1 2 L11 2 M1 6 L11 6 M1 10 L11 10" />
    <path d="M2 4.5 L10 7.5" stroke="var(--vermilion)" strokeWidth="1.4" />
  </svg>;


const Field = ({ label, value, placeholder }) =>
<div>
    <div className="eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>{label.toUpperCase()}</div>
    <input defaultValue={value} placeholder={placeholder} style={inputStyle("sans")} />
  </div>;


const DiffLine = ({ before, after }) =>
<div style={{ margin: "2px 0" }}>
    <div style={{ background: "rgba(177, 62, 46, 0.10)", padding: "2px 6px", borderRadius: 3 }}>
      <span style={{ color: "var(--vermilion)" }}>−</span> {before}
    </div>
    <div style={{ background: "rgba(74, 106, 58, 0.12)", padding: "2px 6px", borderRadius: 3, marginTop: 2 }}>
      <span style={{ color: "var(--moss)" }}>+</span> {after}
    </div>
  </div>;

const DiffInline = ({ sub, add }) =>
<span>
    <span style={{ textDecoration: "line-through", background: "rgba(177, 62, 46, 0.15)", padding: "0 3px", borderRadius: 2, color: "var(--vermilion)" }}>{sub}</span>
    <span style={{ background: "rgba(74, 106, 58, 0.15)", padding: "0 3px", borderRadius: 2, color: "var(--moss)", marginLeft: 2 }}>{add}</span>
  </span>;


Object.assign(window, { ReviseHymnScreen });
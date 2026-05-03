/* global React */
const { useState: useStateR, useEffect: useEffectR } = React;

// =====================================================
// Screen: Revise hymn (THE HERO of editor workspace)
// =====================================================
const ReviseHymnScreen = () => {
  const [status, setStatus] = useStateR("in_review");
  const [showDiff, setShowDiff] = useStateR(true);

  return (
    <div className="app-shell" style={{minHeight: 1200, background: "var(--paper-soft)"}}>
      {/* Slim editor topbar */}
      <div style={{
        padding: "12px 32px", borderBottom: "1px solid var(--rule)",
        background: "var(--paper)", display: "flex", alignItems: "center", gap: 18
      }}>
        <a href="#" className="serif muted" style={{textDecoration: "none", fontSize: 14}}>← Hinos do Sol</a>
        <div style={{flex: 1, textAlign: "center"}}>
          <div className="display" style={{fontSize: 16, lineHeight: 1}}>Revisar hino</div>
          <div className="mono muted" style={{fontSize: 10, letterSpacing: ".15em", marginTop: 2}}>42 DE 64 · 23 RESTANTES</div>
        </div>
        <div style={{display: "flex", alignItems: "center", gap: 12}}>
          <span className="pill pill-mid">Em revisão</span>
          <span className="mono muted" style={{fontSize: 11}}>fonte · OCR</span>
        </div>
      </div>

      {/* Progress strip across the top */}
      <div style={{height: 4, background: "var(--paper-deep)", position: "relative"}}>
        <div style={{position: "absolute", top: 0, left: 0, bottom: 0, width: "65.6%", background: "linear-gradient(90deg, var(--gold), var(--gold-soft))"}}/>
      </div>

      <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, minHeight: 900}}>
        {/* LEFT: OCR source / previous version */}
        <div style={{padding: "32px 40px", borderRight: "1px solid var(--rule)", background: "var(--paper-soft)"}}>
          <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16}}>
            <div className="eyebrow">FONTE ORIGINAL · OCR</div>
            <div style={{display: "flex", gap: 6, padding: 3, background: "var(--paper)", border: "1px solid var(--rule)", borderRadius: 999, fontSize: 11}}>
              {["OCR", "PDF página", "Diff"].map((t, i) => (
                <button key={t} style={{
                  padding: "4px 12px", border: 0, borderRadius: 999, cursor: "pointer",
                  background: i === (showDiff ? 2 : 0) ? "var(--ink)" : "transparent",
                  color: i === (showDiff ? 2 : 0) ? "var(--paper)" : "var(--ink-soft)",
                  fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".1em"
                }} onClick={() => setShowDiff(t === "Diff")}>{t}</button>
              ))}
            </div>
          </div>

          {showDiff ? (
            <div style={{
              fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.7,
              background: "var(--paper)", border: "1px solid var(--rule)",
              borderRadius: 8, padding: 24, whiteSpace: "pre-wrap"
            }}>
              <div style={{color: "var(--ink-mute)"}}>Sol da manhã{"\n"}</div>
              <DiffLine sub="rn" add="m" before="Que iluminna" after="Que ilumina"/>
              <div>{"\nO meu coraç"}<DiffInline sub="ao" add="ão"/>{"\nNa hora da oraç"}<DiffInline sub="ao" add="ão"/></div>
              <div>{"\nQue brilha o "}<DiffInline sub="canninho" add="caminho"/></div>
              <div style={{marginTop: 14, fontSize: 11, color: "var(--ink-mute)", borderTop: "1px solid var(--rule-soft)", paddingTop: 10}}>
                4 alterações · 0 acréscimos · 0 remoções de linha
              </div>
            </div>
          ) : (
            <pre style={{
              fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.7,
              background: "var(--paper)", border: "1px solid var(--rule)",
              borderRadius: 8, padding: 24, whiteSpace: "pre-wrap", margin: 0,
              color: "var(--ink-mute)"
            }}>{`Sol da manhã
Que iluminna
O meu coraçao
Na hora da oraçao

Sol da manhã
Que brilha o canninho
Para nunca eu errar
No meu camninho`}</pre>
          )}

          {/* OCR confidence sparkline */}
          <div style={{marginTop: 20, padding: 16, background: "var(--paper-deep)", borderRadius: 8}}>
            <div style={{display: "flex", justifyContent: "space-between", marginBottom: 8}}>
              <span className="eyebrow">CONFIANÇA OCR · POR LINHA</span>
              <span className="mono" style={{fontSize: 11, color: "var(--ink-soft)"}}>87% médio</span>
            </div>
            <div style={{display: "flex", alignItems: "flex-end", gap: 4, height: 36}}>
              {[92, 78, 65, 88, 95, 72, 58, 90].map((c, i) => (
                <div key={i} style={{
                  flex: 1, height: c + "%",
                  background: c < 70 ? "var(--vermilion)" : c < 85 ? "var(--gold)" : "var(--moss)",
                  borderRadius: "2px 2px 0 0", opacity: 0.85
                }}/>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Editor */}
        <div style={{padding: "32px 40px", background: "var(--paper)"}}>
          <div className="eyebrow" style={{marginBottom: 16}}>VERSÃO REVISADA</div>

          {/* Number + title */}
          <div style={{display: "flex", gap: 12, marginBottom: 16}}>
            <input type="number" defaultValue={42} style={{
              width: 80, padding: "12px 14px", fontFamily: "var(--font-display)", fontSize: 22,
              border: "1px solid var(--rule)", borderRadius: 8, background: "var(--paper-soft)",
              textAlign: "center", outline: "none", color: "var(--ink)"
            }}/>
            <input type="text" defaultValue="Sol da Manhã" style={{
              flex: 1, padding: "12px 16px", fontFamily: "var(--font-display)", fontSize: 22,
              border: "1px solid var(--rule)", borderRadius: 8, background: "var(--paper-soft)",
              outline: "none", color: "var(--ink)"
            }}/>
          </div>

          {/* Body editor */}
          <textarea defaultValue={`Sol da manhã
Que ilumina
O meu coração
Na hora da oração

Sol da manhã
Que brilha o caminho
Para nunca eu errar
No meu caminho`} style={{
            width: "100%", minHeight: 280, padding: 20,
            fontFamily: "var(--font-serif)", fontSize: 16, lineHeight: 1.6,
            border: "1px solid var(--rule)", borderRadius: 8, background: "var(--paper-soft)",
            color: "var(--ink)", outline: "none", resize: "vertical"
          }}/>

          {/* Meta grid */}
          <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16}}>
            <Field label="Repetições" value="2" />
            <Field label="Estilo" value="Marcha" />
            <Field label="Recebido em" value="1998-04-12" />
            <Field label="Oferecido para" value="" placeholder="—" />
          </div>

          {/* Status segmented */}
          <div style={{marginTop: 24}}>
            <div className="eyebrow" style={{marginBottom: 10}}>STATUS DE REVISÃO</div>
            <div style={{display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, padding: 4,
              background: "var(--paper-soft)", border: "1px solid var(--rule)", borderRadius: 8}}>
              {[
                {k: "not_reviewed", l: "Não revisado", c: "var(--vermilion)"},
                {k: "in_review", l: "Em revisão", c: "var(--gold)"},
                {k: "reviewed", l: "Revisado ✓", c: "var(--moss)"},
              ].map(s => (
                <button key={s.k} onClick={() => setStatus(s.k)} style={{
                  padding: "10px 0", border: 0, borderRadius: 6, cursor: "pointer",
                  background: status === s.k ? s.c : "transparent",
                  color: status === s.k ? "var(--paper)" : "var(--ink-soft)",
                  fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500
                }}>{s.l}</button>
              ))}
            </div>
          </div>

          {/* Change summary */}
          <div style={{marginTop: 16}}>
            <div className="eyebrow" style={{marginBottom: 8}}>RESUMO DA MUDANÇA · OPCIONAL</div>
            <input type="text" placeholder="Ex.: Corrigi typos do OCR" defaultValue="Corrigi 4 typos do OCR (rn→m, ao→ão)" style={{
              width: "100%", padding: "10px 14px", fontFamily: "var(--font-sans)", fontSize: 13,
              border: "1px solid var(--rule)", borderRadius: 8, background: "var(--paper-soft)",
              outline: "none", color: "var(--ink)"
            }}/>
          </div>
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
        <div style={{flex: 1}}/>
        <span className="mono muted" style={{fontSize: 11}}>Salvo automaticamente · há 3s</span>
        <button className="btn btn-ghost">Salvar rascunho</button>
        <button className="btn btn-primary">
          Marcar revisado e avançar <kbd style={{background: "rgba(255,255,255,0.15)", borderColor: "rgba(255,255,255,0.3)", color: "var(--paper)"}}>⏎</kbd>
        </button>
      </div>
    </div>
  );
};

const Field = ({label, value, placeholder}) => (
  <div>
    <div className="eyebrow" style={{fontSize: 9, marginBottom: 4}}>{label.toUpperCase()}</div>
    <input defaultValue={value} placeholder={placeholder} style={{
      width: "100%", padding: "10px 12px", fontFamily: "var(--font-sans)", fontSize: 13,
      border: "1px solid var(--rule)", borderRadius: 6, background: "var(--paper-soft)",
      outline: "none", color: "var(--ink)"
    }}/>
  </div>
);

const DiffLine = ({sub, add, before, after}) => (
  <div style={{margin: "2px 0"}}>
    <div style={{background: "rgba(177, 62, 46, 0.10)", padding: "2px 6px", borderRadius: 3}}>
      <span style={{color: "var(--vermilion)"}}>−</span> {before}
    </div>
    <div style={{background: "rgba(74, 106, 58, 0.12)", padding: "2px 6px", borderRadius: 3, marginTop: 2}}>
      <span style={{color: "var(--moss)"}}>+</span> {after}
    </div>
  </div>
);
const DiffInline = ({sub, add}) => (
  <span>
    <span style={{textDecoration: "line-through", background: "rgba(177, 62, 46, 0.15)", padding: "0 3px", borderRadius: 2, color: "var(--vermilion)"}}>{sub}</span>
    <span style={{background: "rgba(74, 106, 58, 0.15)", padding: "0 3px", borderRadius: 2, color: "var(--moss)", marginLeft: 2}}>{add}</span>
  </span>
);

Object.assign(window, { ReviseHymnScreen });

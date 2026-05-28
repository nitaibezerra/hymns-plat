/* global React, AppBar */
const { useState: useStateO } = React;

// =====================================================
// Screen: OCR Wizard / Contribuir
// =====================================================
const OcrWizardScreen = () => {
  const [step, setStep] = useStateO(2); // 0..3
  return (
    <div className="app-shell" style={{minHeight: 1000}}>
      <AppBar active="contribuir" />

      <header style={{padding: "32px 64px 0"}}>
        <div className="eyebrow">CONTRIBUIR · NOVO HINÁRIO</div>
        <h1 className="h-display" style={{fontSize: 38, margin: "10px 0 4px"}}>Subir um PDF para OCR</h1>
        <p className="serif muted" style={{fontSize: 15, marginBottom: 28}}>
          Vamos extrair os hinos automaticamente. Você confere antes de salvar.
        </p>

        {/* Stepper */}
        <div style={{display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0, marginBottom: 32, position: "relative"}}>
          {["Upload", "Processando", "Conferir", "Confirmar"].map((s, i) => (
            <div key={s} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
              opacity: i > step ? 0.4 : 1, position: "relative"
            }}>
              {i > 0 && <div style={{
                position: "absolute", top: 14, right: "50%", left: "-50%", height: 1,
                background: i <= step ? "var(--firmament)" : "var(--rule)"
              }}/>}
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: i < step ? "var(--firmament)" : i === step ? "var(--gold)" : "var(--paper-soft)",
                color: i <= step ? "var(--paper)" : "var(--ink-mute)",
                border: i === step ? "none" : "1px solid var(--rule)",
                display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: 12,
                position: "relative", zIndex: 1
              }}>
                {i < step ? "✓" : i + 1}
              </div>
              <div className="mono" style={{fontSize: 11, letterSpacing: ".1em", color: i === step ? "var(--ink)" : "var(--ink-mute)"}}>{s.toUpperCase()}</div>
            </div>
          ))}
        </div>
      </header>

      {/* Step content */}
      <section style={{padding: "0 64px 64px"}}>
        {step === 2 && <PreviewStep />}
      </section>
    </div>
  );
};

const PreviewStep = () => (
  <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32}}>
    {/* PDF preview side */}
    <div className="card" style={{padding: 0, overflow: "hidden"}}>
      <div style={{padding: "12px 18px", borderBottom: "1px solid var(--rule-soft)", display: "flex", justifyContent: "space-between", alignItems: "center"}}>
        <span className="eyebrow">PDF · página 7 de 84</span>
        <div style={{display: "flex", gap: 6}}>
          <button className="btn btn-ghost" style={{padding: "4px 10px", fontSize: 11}}>‹</button>
          <button className="btn btn-ghost" style={{padding: "4px 10px", fontSize: 11}}>›</button>
        </div>
      </div>
      <div style={{aspectRatio: "3/4", background: "var(--paper-deep)", padding: 32, display: "flex", flexDirection: "column", gap: 14}}>
        <div className="display" style={{textAlign: "center", fontSize: 18}}>5 — Sol da Manhã</div>
        <div style={{height: 1, background: "var(--rule)", margin: "0 60px"}}/>
        <div className="serif" style={{fontSize: 14, lineHeight: 1.7, textAlign: "center", color: "var(--ink-soft)"}}>
          Sol da manhã<br/>
          Que ilumina<br/>
          O meu coração<br/>
          Na hora da oração<br/>
          <br/>
          Sol da manhã<br/>
          Que brilha o caminho<br/>
          Para nunca eu errar<br/>
          No meu caminho
        </div>
        <div style={{textAlign: "center", color: "var(--gold)", marginTop: 12}}>✡</div>
      </div>
    </div>

    {/* Extracted side */}
    <div>
      <div className="card" style={{marginBottom: 16, background: "rgba(184, 137, 58, 0.08)", borderColor: "var(--gold-soft)"}}>
        <div style={{display: "flex", gap: 12, alignItems: "flex-start"}}>
          <div style={{width: 24, height: 24, borderRadius: "50%", background: "var(--gold)", color: "var(--paper)", display: "grid", placeItems: "center", fontSize: 12, flexShrink: 0}}>!</div>
          <div>
            <div className="serif" style={{fontWeight: 500, marginBottom: 4}}>Será criado como rascunho</div>
            <div className="serif muted" style={{fontSize: 13, lineHeight: 1.5}}>
              O hinário entra como <strong style={{color: "var(--ink)"}}>não publicado</strong> e cada hino como <strong style={{color: "var(--ink)"}}>não revisado</strong>. Use o workspace do editor para revisar antes de publicar.
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14}}>
          <h3 className="display" style={{fontSize: 22, margin: 0}}>Hinos do Sol</h3>
          <span className="pill pill-mid">Detectado · 64 hinos</span>
        </div>
        <div className="serif muted" style={{fontSize: 14, marginBottom: 18}}>
          Padrinho Alfredo · Confiança média do OCR: 87%
        </div>

        {/* table */}
        <table style={{width: "100%", borderCollapse: "collapse", fontSize: 13}}>
          <thead>
            <tr style={{textAlign: "left", color: "var(--ink-mute)"}}>
              <th className="mono" style={{fontSize: 10, letterSpacing: ".1em", padding: "6px 0", fontWeight: 400}}>Nº</th>
              <th className="mono" style={{fontSize: 10, letterSpacing: ".1em", padding: "6px 0", fontWeight: 400}}>TÍTULO</th>
              <th className="mono" style={{fontSize: 10, letterSpacing: ".1em", padding: "6px 0", fontWeight: 400, textAlign: "right"}}>OCR</th>
            </tr>
          </thead>
          <tbody>
            {[
              {n:1, t:"Lua Branca", c:94},
              {n:2, t:"Sol da Manhã", c:87},
              {n:3, t:"Caminho da Floresta", c:79},
              {n:4, t:"O Mensageiro", c:65},
              {n:5, t:"Estrela d'Alva", c:91},
            ].map(h => (
              <tr key={h.n} style={{borderTop: "1px solid var(--rule-soft)"}}>
                <td style={{padding: "8px 0", fontFamily: "var(--font-mono)", color: "var(--ink-mute)"}}>{String(h.n).padStart(2, "0")}</td>
                <td className="serif" style={{padding: "8px 0"}}>{h.t}</td>
                <td style={{padding: "8px 0", textAlign: "right"}}>
                  <span className="mono" style={{fontSize: 11, color: h.c < 70 ? "var(--vermilion)" : h.c < 85 ? "var(--gold)" : "var(--moss)"}}>{h.c}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mono muted" style={{fontSize: 11, textAlign: "center", marginTop: 12}}>… e mais 59 hinos</div>

        <div style={{display: "flex", gap: 10, marginTop: 24}}>
          <button className="btn btn-ghost" style={{flex: 1}}>← Voltar</button>
          <button className="btn btn-primary" style={{flex: 2}}>Confirmar e criar rascunho</button>
        </div>
      </div>
    </div>
  </div>
);

// =====================================================
// Screen: Publish confirmation modal
// =====================================================
const PublishConfirmScreen = () => (
  <div className="app-shell" style={{minHeight: 800, position: "relative"}}>
    <AppBar active="editor" />
    <div style={{padding: 64, opacity: 0.4, filter: "blur(2px)"}}>
      <h1 className="h-display" style={{fontSize: 36, marginBottom: 16}}>Hinos do Sol</h1>
      <p className="serif">…</p>
    </div>

    {/* Modal */}
    <div style={{
      position: "absolute", inset: 0,
      background: "rgba(26, 29, 46, 0.5)",
      display: "grid", placeItems: "center"
    }}>
      <div style={{
        width: 540, background: "var(--paper)",
        borderRadius: 12, border: "1px solid var(--rule)",
        boxShadow: "var(--shadow-2)", overflow: "hidden"
      }}>
        <div style={{padding: "32px 32px 24px", textAlign: "center", background: "var(--paper-soft)", borderBottom: "1px solid var(--rule-soft)"}}>
          <div style={{fontSize: 36, color: "var(--gold)", marginBottom: 12, letterSpacing: ".4em"}}>✡</div>
          <h2 className="h-display" style={{fontSize: 28, margin: "0 0 8px"}}>Publicar Hinos do Sol?</h2>
          <p className="serif muted" style={{fontSize: 14, margin: 0}}>
            O hinário ficará visível para todos os usuários e aparecerá na busca pública.
          </p>
        </div>

        <div style={{padding: 32}}>
          <div style={{marginBottom: 18}}>
            <div style={{display: "flex", justifyContent: "space-between", marginBottom: 8}}>
              <span className="eyebrow">PROGRESSO DE REVISÃO</span>
              <span className="mono" style={{fontSize: 11, color: "var(--moss)"}}>64 / 64 · 100%</span>
            </div>
            <div className="progress"><i style={{width: "100%", background: "linear-gradient(90deg, var(--moss), #6c8a55)"}}/></div>
          </div>

          <ul style={{listStyle: "none", padding: 0, margin: "0 0 28px", display: "flex", flexDirection: "column", gap: 10}}>
            <Check ok>Todos os 64 hinos revisados</Check>
            <Check ok>Capa e descrição preenchidas</Check>
            <Check ok>Dono do hinário identificado</Check>
            <Check ok>Auditoria registrada · 4 revisores</Check>
          </ul>

          <div style={{display: "flex", gap: 10}}>
            <button className="btn btn-ghost" style={{flex: 1}}>Cancelar</button>
            <button className="btn btn-primary" style={{flex: 2}}>Publicar agora</button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const Check = ({ok, children}) => (
  <li style={{display: "flex", gap: 12, alignItems: "center"}}>
    <span style={{
      width: 20, height: 20, borderRadius: "50%",
      background: ok ? "var(--moss)" : "var(--rule)",
      color: "var(--paper)", display: "grid", placeItems: "center", fontSize: 11, flexShrink: 0
    }}>{ok ? "✓" : "·"}</span>
    <span className="serif" style={{fontSize: 14}}>{children}</span>
  </li>
);

// =====================================================
// Screen: Search results
// =====================================================
const SearchScreen = () => (
  <div className="app-shell" style={{minHeight: 1000}}>
    <AppBar active="search" />
    <div style={{padding: "40px 64px"}}>
      <div className="eyebrow" style={{marginBottom: 12}}>BUSCA</div>
      <div style={{
        display: "flex", gap: 0, maxWidth: 720,
        background: "var(--paper-soft)", border: "1px solid var(--rule)",
        borderRadius: 999, padding: "6px 6px 6px 22px", alignItems: "center"
      }}>
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="var(--ink-mute)" strokeWidth="1.6">
          <circle cx="7" cy="7" r="5"/><path d="M11 11 L14 14"/>
        </svg>
        <input type="text" defaultValue="estrela brilhante" style={{flex: 1, padding: "12px 14px", border: 0, background: "transparent", fontSize: 16, fontFamily: "var(--font-sans)", color: "var(--ink)", outline: "none"}}/>
        <button className="btn btn-primary">Buscar</button>
      </div>

      <div style={{display: "flex", gap: 8, marginTop: 18, alignItems: "center"}}>
        <span className="mono" style={{fontSize: 12, color: "var(--ink)"}}>23 resultados</span>
        <span style={{color: "var(--rule)"}}>·</span>
        {["Tudo (23)", "Em hinos (18)", "Em hinários (5)"].map((f, i) => (
          <button key={f} className="pill" style={{
            cursor: "pointer", border: 0,
            background: i === 0 ? "var(--ink)" : "var(--paper-soft)",
            color: i === 0 ? "var(--paper)" : "var(--ink-soft)",
          }}>{f}</button>
        ))}
        <div style={{flex: 1}}/>
        <span className="mono muted" style={{fontSize: 11}}>filtrado por: <strong style={{color: "var(--firmament)"}}>O Cruzeiro ×</strong></span>
      </div>

      <div style={{marginTop: 24, display: "flex", flexDirection: "column", gap: 8}}>
        {[
          {n: 7, t: "Estrela Brilhante", book: "O Cruzeiro", snippet: "...que brilha no firmamento\nMe dai a Vossa luz neste sagrado momento..."},
          {n: 23, t: "Estrela do Norte", book: "O Cruzeiro", snippet: "...minha estrela brilhante guia o caminho..."},
          {n: 5, t: "Estrela Guia", book: "O Justiceiro", snippet: "...estrela brilhante na noite escura..."},
          {n: 12, t: "Brilha Estrela", book: "Hinos do Sol", snippet: "...brilha estrela do oriente..."},
        ].map((r, i) => (
          <a key={i} href="#" style={{
            display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 24,
            padding: "20px 24px", background: "var(--paper-soft)",
            border: "1px solid var(--rule)", borderRadius: 8,
            textDecoration: "none", color: "var(--ink)"
          }}>
            <div style={{textAlign: "center", borderRight: "1px solid var(--rule)", paddingRight: 24}}>
              <div className="mono muted" style={{fontSize: 9, letterSpacing: ".15em"}}>HINO</div>
              <div className="display" style={{fontSize: 28, color: "var(--firmament)"}}>{String(r.n).padStart(2,"0")}</div>
            </div>
            <div>
              <div className="display" style={{fontSize: 19, marginBottom: 4}}>{r.t}</div>
              <div className="serif muted" style={{fontSize: 13, marginBottom: 8, fontStyle: "italic"}}>{r.book}</div>
              <div className="serif" style={{fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.6, whiteSpace: "pre-wrap"}}>
                {r.snippet.split("estrela brilhante").map((part, idx, arr) => (
                  <React.Fragment key={idx}>
                    {part}
                    {idx < arr.length - 1 && <mark style={{background: "var(--gold-soft)", color: "var(--ink)", padding: "0 2px", borderRadius: 2}}>estrela brilhante</mark>}
                  </React.Fragment>
                ))}
              </div>
            </div>
            <div style={{display: "flex", alignItems: "center"}}>
              <span style={{color: "var(--ink-mute)", fontSize: 18}}>→</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  </div>
);

Object.assign(window, { OcrWizardScreen, PublishConfirmScreen, SearchScreen });

/* global React, IOSDevice, AppBar, endGlyphFor */
const { useState: useStateM } = React;

// =====================================================
// Mobile: Carousel reading mode (for trabalhos)
// =====================================================
const MobileCarouselScreen = () => (
  <div style={{display: "flex", gap: 32, padding: 32, background: "var(--paper-deep)", justifyContent: "center"}}>
    {/* Day */}
    <div>
      <div className="mono" style={{fontSize: 10, letterSpacing: ".2em", color: "var(--ink-mute)", textAlign: "center", marginBottom: 12}}>DIA · CARROSSEL</div>
      <IOSDevice width={390} height={844}>
        <MobileCarouselInner theme="dia"/>
      </IOSDevice>
    </div>
    {/* Night */}
    <div>
      <div className="mono" style={{fontSize: 10, letterSpacing: ".2em", color: "var(--ink-mute)", textAlign: "center", marginBottom: 12}}>NOITE · TRABALHO</div>
      <IOSDevice width={390} height={844}>
        <MobileCarouselInner theme="noite"/>
      </IOSDevice>
    </div>
  </div>
);

const MobileCarouselInner = ({theme}) => {
  const dark = theme === "noite";
  const paper = dark ? "#0e1320" : "#f6efe2";
  const ink = dark ? "#f0e7d2" : "#1a1d2e";
  const inkMute = dark ? "#8a8a9c" : "#6b6f85";
  const rule = dark ? "#2a3450" : "#c8bda1";
  const gold = dark ? "#e0b87a" : "#b8893a";

  return (
    <div style={{height: "100%", background: paper, color: ink, display: "flex", flexDirection: "column", fontFamily: "var(--font-serif)"}}>
      {/* Top bar — minimal, no nav distractions */}
      <div style={{padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${rule}`}}>
        <span style={{fontSize: 18, color: inkMute}}>‹</span>
        <span className="mono" style={{fontSize: 11, letterSpacing: ".15em", color: inkMute}}>07 / 132</span>
        <span style={{fontSize: 14, color: inkMute}}>⋯</span>
      </div>

      {/* Hymn page — fills view */}
      <div style={{flex: 1, padding: "32px 28px", display: "flex", flexDirection: "column", justifyContent: "center", overflow: "hidden"}}>
        <div className="mono" style={{fontSize: 9, letterSpacing: ".2em", color: inkMute, textAlign: "center", marginBottom: 8}}>HINO 07 · O CRUZEIRO</div>
        <h1 className="display" style={{fontSize: 26, textAlign: "center", color: ink, margin: "0 0 10px", lineHeight: 1.1, fontWeight: 500}}>Estrela Brilhante</h1>
        <div style={{width: "60%", height: 1, background: rule, margin: "0 auto 24px"}}/>

        {/* Body with rep bar */}
        <div style={{position: "relative", paddingLeft: 18, fontSize: 17, lineHeight: 1.6, color: ink}}>
          <div style={{position: "absolute", left: 0, top: 4, bottom: 4, width: 1, background: dark ? "#c9c2b0" : "#3a3f57"}}/>
          <div style={{position: "absolute", left: -18, top: 0, fontFamily: "var(--font-mono)", fontSize: 9, color: inkMute}}>2×</div>
          Estrela brilhante<br/>
          Que brilha no firmamento<br/>
          Me dai a Vossa luz<br/>
          Neste sagrado momento
        </div>
        <div style={{position: "relative", paddingLeft: 18, fontSize: 17, lineHeight: 1.6, color: ink, marginTop: 22}}>
          <div style={{position: "absolute", left: 0, top: 4, bottom: 4, width: 1, background: dark ? "#c9c2b0" : "#3a3f57"}}/>
          <div style={{position: "absolute", left: -18, top: 0, fontFamily: "var(--font-mono)", fontSize: 9, color: inkMute}}>2×</div>
          Eu peço com humildade<br/>
          À Virgem Mãe Soberana<br/>
          Que me dê de Sua glória<br/>
          Nesta hora soberana
        </div>

        <div style={{textAlign: "center", marginTop: 28, color: gold, fontSize: 22, letterSpacing: ".4em"}}>✡</div>
      </div>

      {/* Tap zones hint — subtle */}
      <div style={{padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${rule}`}}>
        <span className="mono" style={{fontSize: 10, color: inkMute}}>← anterior</span>
        {/* dots */}
        <div style={{display: "flex", gap: 4}}>
          {[0,1,2,3,4,5,6].map(i => (
            <div key={i} style={{width: i === 3 ? 18 : 5, height: 5, borderRadius: 999, background: i === 3 ? gold : rule}}/>
          ))}
        </div>
        <span className="mono" style={{fontSize: 10, color: inkMute}}>próximo →</span>
      </div>

      {/* Bottom action — audio play */}
      <div style={{padding: "14px 16px 28px", borderTop: `1px solid ${rule}`}}>
        <div style={{display: "flex", alignItems: "center", gap: 12}}>
          <button style={{
            width: 42, height: 42, borderRadius: "50%", border: 0,
            background: gold, color: paper, display: "grid", placeItems: "center"
          }}>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor"><path d="M3 1 L12 7 L3 13 Z"/></svg>
          </button>
          <div style={{flex: 1}}>
            <div style={{fontSize: 13, fontWeight: 500}}>Trabalho de Concentração</div>
            <div className="mono" style={{fontSize: 10, color: inkMute}}>2:14 · Joana M.</div>
          </div>
          <span style={{color: gold, fontSize: 18}}>★</span>
        </div>
      </div>
    </div>
  );
};

// =====================================================
// Profile + Notifications
// =====================================================
const ProfileScreen = () => (
  <div className="app-shell" style={{minHeight: 1000}}>
    <AppBar active="profile" />

    {/* Profile header */}
    <header style={{
      padding: "48px 64px 32px",
      borderBottom: "1px solid var(--rule)",
      display: "flex", gap: 32, alignItems: "flex-end"
    }}>
      <div style={{
        width: 120, height: 120, borderRadius: "50%",
        background: "linear-gradient(135deg, var(--firmament-2), var(--firmament))",
        display: "grid", placeItems: "center", color: "var(--paper)",
        fontFamily: "var(--font-display)", fontSize: 48, fontWeight: 500
      }}>JM</div>
      <div style={{flex: 1}}>
        <div className="eyebrow" style={{marginBottom: 6}}>EDITOR · MEMBRO HÁ 2 ANOS</div>
        <h1 className="h-display" style={{fontSize: 40, margin: "0 0 4px"}}>Joana Marques</h1>
        <p className="serif muted" style={{fontSize: 16, fontStyle: "italic", margin: 0}}>"Sigo a estrela do firmamento"</p>
        <div style={{display: "flex", gap: 24, marginTop: 16}}>
          <div><span className="display" style={{fontSize: 22, color: "var(--firmament)"}}>247</span> <span className="mono muted" style={{fontSize: 11, marginLeft: 4}}>HINOS REVISADOS</span></div>
          <div><span className="display" style={{fontSize: 22, color: "var(--firmament)"}}>14</span> <span className="mono muted" style={{fontSize: 11, marginLeft: 4}}>HINÁRIOS</span></div>
          <div><span className="display" style={{fontSize: 22, color: "var(--gold)"}}>84</span> <span className="mono muted" style={{fontSize: 11, marginLeft: 4}}>SEGUIDORES</span></div>
        </div>
      </div>
      <div style={{display: "flex", gap: 8}}>
        <button className="btn btn-ghost">Editar perfil</button>
        <button className="btn btn-primary">Seguir</button>
      </div>
    </header>

    <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, padding: "40px 64px"}}>
      {/* Activity heatmap */}
      <section className="card">
        <div style={{display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18}}>
          <h2 className="display" style={{fontSize: 22, margin: 0}}>Trabalho editorial</h2>
          <span className="mono muted" style={{fontSize: 11}}>último ano</span>
        </div>
        {/* Calendar heatmap */}
        <div style={{display: "grid", gridTemplateColumns: "repeat(53, 1fr)", gap: 3}}>
          {Array.from({length: 53 * 7}).map((_, i) => {
            const v = (i * 17) % 100;
            const op = v < 60 ? 0.05 : v < 75 ? 0.25 : v < 88 ? 0.5 : 1;
            return <div key={i} style={{aspectRatio: 1, background: "var(--firmament)", opacity: op, borderRadius: 1.5}}/>;
          })}
        </div>
        <div style={{display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 11, color: "var(--ink-mute)"}}>
          <span className="mono">menos</span>
          <div style={{display: "flex", gap: 3}}>
            {[0.05, 0.25, 0.5, 1].map((o, i) => (
              <div key={i} style={{width: 10, height: 10, background: "var(--firmament)", opacity: o, borderRadius: 1.5}}/>
            ))}
          </div>
          <span className="mono">mais</span>
        </div>
      </section>

      {/* Notifications */}
      <section className="card" style={{padding: 0}}>
        <div style={{padding: "18px 20px", borderBottom: "1px solid var(--rule-soft)", display: "flex", justifyContent: "space-between", alignItems: "center"}}>
          <h2 className="display" style={{fontSize: 22, margin: 0}}>Notificações</h2>
          <span className="pill pill-pub">3 novas</span>
        </div>
        {[
          {who: "Carlos B.", what: "revisou um hino que você havia editado", target: "Sol da Manhã · Hinos do Sol", when: "há 12 min", unread: true},
          {who: "Sistema", what: "OCR finalizado", target: "O Mensageiro · 78 hinos extraídos", when: "há 2 horas", unread: true},
          {who: "Pedro A.", what: "começou a seguir você", target: "", when: "ontem", unread: true},
          {who: "Maria L.", what: "publicou um hinário que você revisou", target: "Caminho da Floresta", when: "há 3 dias", unread: false},
          {who: "Sistema", what: "Você recebeu o papel de Editor", target: "", when: "há 1 mês", unread: false},
        ].map((n, i) => (
          <div key={i} style={{
            padding: "14px 20px", display: "flex", gap: 12, alignItems: "flex-start",
            borderTop: i ? "1px solid var(--rule-soft)" : "none",
            background: n.unread ? "rgba(184, 137, 58, 0.06)" : "transparent"
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
              background: n.who === "Sistema" ? "var(--gold)" : "var(--firmament)",
              color: "var(--paper)", display: "grid", placeItems: "center",
              fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 500
            }}>{n.who[0]}</div>
            <div style={{flex: 1}}>
              <div className="serif" style={{fontSize: 14}}>
                <strong>{n.who}</strong> {n.what}
                {n.target && <> · <em style={{color: "var(--firmament)"}}>{n.target}</em></>}
              </div>
              <div className="mono muted" style={{fontSize: 11, marginTop: 3}}>{n.when}</div>
            </div>
            {n.unread && <div style={{width: 8, height: 8, borderRadius: "50%", background: "var(--vermilion)", marginTop: 6}}/>}
          </div>
        ))}
      </section>

      {/* Recently revised */}
      <section className="card" style={{gridColumn: "1 / -1"}}>
        <h2 className="display" style={{fontSize: 22, margin: "0 0 18px"}}>Revisões recentes</h2>
        <div style={{display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16}}>
          {[
            {n: 42, t: "Sol da Manhã", book: "Hinos do Sol", changes: "4 typos OCR", when: "há 8 min"},
            {n: 41, t: "Brilho da Aurora", book: "Hinos do Sol", changes: "1 estrofe", when: "há 22 min"},
            {n: 7,  t: "Estrela Brilhante", book: "O Cruzeiro", changes: "metadata", when: "ontem"},
          ].map((r, i) => (
            <div key={i} style={{padding: 16, background: "var(--paper)", border: "1px solid var(--rule-soft)", borderRadius: 8}}>
              <div className="mono muted" style={{fontSize: 10, letterSpacing: ".1em", marginBottom: 6}}>HINO {String(r.n).padStart(2,"0")}</div>
              <div className="display" style={{fontSize: 18, marginBottom: 4}}>{r.t}</div>
              <div className="serif muted" style={{fontSize: 12, fontStyle: "italic", marginBottom: 10}}>{r.book}</div>
              <div style={{display: "flex", justifyContent: "space-between", fontSize: 11}}>
                <span style={{color: "var(--moss)"}}>{r.changes}</span>
                <span className="mono muted">{r.when}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  </div>
);

// =====================================================
// Revision history overlay (HymnRevision browser)
// =====================================================
const RevisionHistoryScreen = () => (
  <div className="app-shell" style={{minHeight: 900, position: "relative"}}>
    <AppBar active="list" />
    <div style={{padding: 64, opacity: 0.3, filter: "blur(2px)"}}>
      <h1 className="h-display" style={{fontSize: 36}}>Estrela Brilhante</h1>
    </div>

    <div style={{
      position: "absolute", inset: 0,
      background: "rgba(26, 29, 46, 0.55)",
      display: "flex", alignItems: "stretch"
    }}>
      <div style={{flex: 1}}/>
      <aside style={{
        width: 720, background: "var(--paper)",
        borderLeft: "1px solid var(--rule)",
        display: "flex", flexDirection: "column",
        boxShadow: "var(--shadow-2)"
      }}>
        <div style={{padding: "20px 28px", borderBottom: "1px solid var(--rule)", display: "flex", justifyContent: "space-between", alignItems: "center"}}>
          <div>
            <div className="eyebrow">HISTÓRICO DE REVISÕES</div>
            <h2 className="display" style={{fontSize: 22, margin: "4px 0 0"}}>Estrela Brilhante</h2>
          </div>
          <button className="btn btn-ghost" style={{padding: "6px 12px"}}>×</button>
        </div>

        {/* timeline + diff side by side */}
        <div style={{flex: 1, display: "grid", gridTemplateColumns: "240px 1fr", gap: 0}}>
          {/* timeline */}
          <div style={{padding: "20px 0", borderRight: "1px solid var(--rule-soft)", background: "var(--paper-soft)", overflowY: "auto"}}>
            {[
              {who: "Joana M.", when: "há 8 min", action: "marcou como revisado", active: true, status: "ok"},
              {who: "Joana M.", when: "há 14 min", action: "editou texto · 4 mudanças", status: "mid"},
              {who: "Sistema", when: "há 2 dias", action: "criado via OCR", status: "not"},
            ].map((e, i) => (
              <div key={i} style={{padding: "12px 20px", position: "relative", background: e.active ? "var(--paper)" : "transparent", borderLeft: e.active ? "2px solid var(--gold)" : "2px solid transparent", cursor: "pointer"}}>
                <div style={{display: "flex", alignItems: "center", gap: 8, marginBottom: 4}}>
                  <span className={`pill pill-${e.status}`} style={{fontSize: 9, padding: "2px 6px"}}/>
                  <span className="serif" style={{fontSize: 13, fontWeight: e.active ? 500 : 400}}>{e.who}</span>
                </div>
                <div className="serif" style={{fontSize: 12, color: "var(--ink-soft)", marginBottom: 2}}>{e.action}</div>
                <div className="mono muted" style={{fontSize: 10}}>{e.when}</div>
              </div>
            ))}
          </div>

          {/* diff body */}
          <div style={{padding: 24, overflowY: "auto"}}>
            <div className="eyebrow" style={{marginBottom: 12}}>MUDANÇAS · 14 MIN ATRÁS</div>
            <div className="serif" style={{fontSize: 13, marginBottom: 16, padding: 12, background: "var(--paper-soft)", borderLeft: "2px solid var(--gold)", borderRadius: 4}}>
              "Corrigi 4 typos do OCR (rn→m, ao→ão)"
            </div>

            {/* Field diffs */}
            <FieldDiff field="title" before="Estrella Brilhantte" after="Estrela Brilhante"/>
            <FieldDiff field="text · linha 2" before="Que brilha no firmameennto" after="Que brilha no firmamento"/>
            <FieldDiff field="text · linha 5" before="Eu peço com humilldade" after="Eu peço com humildade"/>

            <div style={{marginTop: 20, padding: 14, background: "var(--paper-deep)", borderRadius: 6, fontSize: 12}}>
              <span className="mono muted">3 campos · </span>
              <span style={{color: "var(--vermilion)"}}>−4 chars</span>
              <span className="mono muted"> · </span>
              <span style={{color: "var(--moss)"}}>+1 char</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>
);

const FieldDiff = ({field, before, after}) => (
  <div style={{marginBottom: 16}}>
    <div className="mono" style={{fontSize: 10, letterSpacing: ".1em", color: "var(--ink-mute)", marginBottom: 6}}>{field.toUpperCase()}</div>
    <div style={{fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.6, padding: "6px 10px", background: "rgba(177, 62, 46, 0.08)", borderLeft: "2px solid var(--vermilion)", borderRadius: "0 4px 4px 0", marginBottom: 3}}>
      <span style={{color: "var(--vermilion)"}}>−</span> {before}
    </div>
    <div style={{fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.6, padding: "6px 10px", background: "rgba(74, 106, 58, 0.10)", borderLeft: "2px solid var(--moss)", borderRadius: "0 4px 4px 0"}}>
      <span style={{color: "var(--moss)"}}>+</span> {after}
    </div>
  </div>
);

Object.assign(window, { MobileCarouselScreen, ProfileScreen, RevisionHistoryScreen });

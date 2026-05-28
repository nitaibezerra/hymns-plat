/* global React, AppBar, CRUZEIRO_HYMNS, SAMPLE_BOOK,
   PlayerProviderA, PlayerBarA, QueueDrawerA, PlayerExpandedA, WorkModeOverlayA, usePlayerA,
   IOSDevice */

// =====================================================
// Hymnbook page tailored for player demos.
// =====================================================

const HymnbookWithPlayerHeader = ({ hasAudio = true }) => {
  const { state, set } = usePlayerA();
  const audioCount = CRUZEIRO_HYMNS.filter(h => h.hasAudio).length;
  const totalSec = CRUZEIRO_HYMNS.filter(h => h.hasAudio).reduce((acc, h) => {
    const [m, s] = h.dur.split(":").map(Number); return acc + m * 60 + s;
  }, 0);
  const totalMin = Math.round(totalSec / 60);
  const isPlayingThisBook = state.visible;
  const currentN = state.queue[state.currentIdx]?.n;

  const startBook = () => set({ visible: true, playing: true, currentIdx: 0, progress: 0 });
  const playFrom = (n) => {
    const idx = state.queue.findIndex(h => h.n === n);
    if (idx >= 0) set({ visible: true, playing: true, currentIdx: idx, progress: 0 });
  };

  return (
    <div className="app-shell" style={{minHeight: 1100, position: "relative", overflow: "hidden"}}>
      <AppBar active="list" />

      <header style={{
        padding: "48px 64px 32px",
        background: `linear-gradient(180deg, oklch(0.32 0.06 240) 0%, oklch(0.22 0.04 240) 100%)`,
        color: "var(--paper)",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{position: "absolute", top: -40, right: -40, fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 320, opacity: 0.06, lineHeight: 0.8}}>C</div>
        <div style={{display: "flex", alignItems: "flex-end", gap: 48, position: "relative"}}>
          <div style={{
            width: 200, aspectRatio: "3/4",
            background: `radial-gradient(ellipse at 30% 20%, oklch(0.55 0.10 35 / 0.55), transparent 60%), linear-gradient(180deg, #2a3954, #161e30)`,
            borderRadius: 8, padding: 18, display: "flex", flexDirection: "column", justifyContent: "space-between",
            border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
          }}>
            <div className="mono" style={{fontSize: 9, letterSpacing: ".2em", opacity: 0.6}}>EST. 1971</div>
            <div>
              <div className="display" style={{fontSize: 26, lineHeight: 1.05, marginBottom: 6}}>O Cruzeiro</div>
              <div className="mono" style={{fontSize: 9, letterSpacing: ".15em", opacity: 0.6}}>MESTRE IRINEU</div>
            </div>
          </div>
          <div style={{flex: 1, paddingBottom: 16}}>
            <div className="mono" style={{fontSize: 11, letterSpacing: ".18em", opacity: 0.6, marginBottom: 12}}>HINÁRIO COMPLETO</div>
            <h1 className="h-display" style={{fontSize: 56, margin: "0 0 12px", lineHeight: 1}}>O Cruzeiro</h1>
            <p className="serif" style={{fontSize: 18, opacity: 0.85, fontStyle: "italic", marginBottom: 20, maxWidth: 600}}>
              Hinário recebido pelo Mestre Raimundo Irineu Serra
            </p>

            <div style={{display: "flex", gap: 12, alignItems: "center", marginBottom: 16}}>
              {hasAudio ? (
                isPlayingThisBook ? (
                  <button onClick={() => set(s => ({ playing: !s.playing }))} style={primaryBtn}>
                    <PlaySvg playing={state.playing}/>
                    <span>{state.playing ? "Pausar hinário" : "Continuar hinário"}</span>
                    <span style={{opacity: 0.7, fontSize: 12, marginLeft: 6}}>· hino {String(currentN).padStart(2,"0")}</span>
                  </button>
                ) : (
                  <button onClick={startBook} style={primaryBtn}>
                    <PlaySvg/>
                    <span>Tocar hinário</span>
                  </button>
                )
              ) : (
                <button disabled style={{...primaryBtn, opacity: 0.4, cursor: "not-allowed"}} title="Nenhum hino tem gravação ainda">
                  <PlaySvg/>
                  <span>Tocar hinário</span>
                </button>
              )}
              <button style={ghostBtn}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 8 L8 13 L13 8 M8 13 L8 1"/></svg>
                Baixar PDF
              </button>
              <button style={ghostBtn}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 5 a3 3 0 1 0 0 6 M5 5 a3 3 0 1 1 0 6 M2 8 L14 8"/></svg>
                Compartilhar
              </button>
            </div>

            <div style={{display: "flex", gap: 24, alignItems: "center"}}>
              <span className="mono" style={{fontSize: 12, letterSpacing: ".1em", opacity: 0.7}}>132 HINOS</span>
              <span style={{opacity: 0.3}}>·</span>
              <span className="mono" style={{fontSize: 12, letterSpacing: ".1em", opacity: 0.7}}>
                {hasAudio ? `${audioCount} GRAVAÇÕES · ${totalMin} MIN` : "SEM GRAVAÇÕES"}
              </span>
              <span style={{opacity: 0.3}}>·</span>
              <span className="pill pill-ok" style={{background: "rgba(74,106,58,0.2)", borderColor: "rgba(255,255,255,0.2)", color: "#9bc88a"}}>Publicado</span>
            </div>
          </div>
        </div>
      </header>

      <div style={{padding: "16px 64px", background: "var(--paper-soft)", borderBottom: "1px solid var(--rule)", display: "flex", alignItems: "center", gap: 24}}>
        <span className="eyebrow">Modo de leitura:</span>
        <div style={{display: "flex", padding: 4, background: "var(--paper)", border: "1px solid var(--rule)", borderRadius: 999}}>
          {[{k:"index", label:"Índice"},{k:"flow", label:"Corrido"},{k:"carousel", label:"Carrossel"}].map(m => (
            <span key={m.k} style={{
              padding: "8px 18px", borderRadius: 999,
              background: m.k === "index" ? "var(--firmament)" : "transparent",
              color: m.k === "index" ? "var(--paper)" : "var(--ink-soft)",
              fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500,
            }}>{m.label}</span>
          ))}
        </div>
        <div style={{flex: 1}}/>
        <span className="mono muted" style={{fontSize: 11}}>lista clicável · acesso rápido</span>
      </div>

      <div style={{padding: "32px 64px"}}>
        <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28}}>
          {[0, 1].map(col => (
            <div key={col}>
              {CRUZEIRO_HYMNS.slice(col * 8, col * 8 + 8).map((h) => {
                const isCurrent = isPlayingThisBook && h.n === currentN;
                return (
                  <div key={h.n} style={{
                    display: "grid", gridTemplateColumns: "32px 28px 1fr auto auto", gap: 14,
                    alignItems: "center", padding: "12px 4px",
                    borderBottom: "1px solid var(--rule-soft)",
                    background: isCurrent ? "var(--gold-soft)" : "transparent",
                    borderRadius: 4,
                  }}>
                    {h.hasAudio ? (
                      <button onClick={() => playFrom(h.n)} aria-label="Tocar a partir daqui" title="Tocar a partir daqui" style={{
                        width: 28, height: 28, borderRadius: "50%",
                        border: "1px solid var(--rule)",
                        background: isCurrent ? "var(--firmament)" : "transparent",
                        color: isCurrent ? "var(--paper)" : "var(--firmament)",
                        cursor: "pointer", display: "grid", placeItems: "center",
                      }}>
                        {isCurrent && state.playing
                          ? <svg width="9" height="9" viewBox="0 0 14 14" fill="currentColor"><rect x="3" y="2" width="3" height="10"/><rect x="8" y="2" width="3" height="10"/></svg>
                          : <svg width="9" height="9" viewBox="0 0 14 14" fill="currentColor"><path d="M3 1 L12 7 L3 13 Z"/></svg>}
                      </button>
                    ) : (
                      <span style={{width: 28, height: 28, display: "grid", placeItems: "center", color: "var(--ink-mute)", opacity: 0.4}}>
                        <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M2 7 a5 5 0 0 1 10 0 a5 5 0 0 1 -10 0 Z M3 3 L11 11"/></svg>
                      </span>
                    )}
                    <span className="mono" style={{fontSize: 13, color: isCurrent ? "var(--ink)" : "var(--ink-mute)", textAlign: "right"}}>{String(h.n).padStart(2, "0")}</span>
                    <span className="serif" style={{fontSize: 17, color: "var(--ink)", fontWeight: isCurrent ? 500 : 400}}>{h.t}</span>
                    <span className="mono muted" style={{fontSize: 11}}>{h.style || ""}</span>
                    <span className="mono" style={{fontSize: 11, color: "var(--ink-mute)", minWidth: 38, textAlign: "right"}}>{h.dur}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const primaryBtn = {
  display: "inline-flex", alignItems: "center", gap: 10,
  padding: "11px 22px", borderRadius: 999, border: 0,
  background: "var(--gold-soft)", color: "#2a1818", cursor: "pointer",
  fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600,
  boxShadow: "0 6px 14px rgba(0,0,0,0.25)",
};
const ghostBtn = {
  display: "inline-flex", alignItems: "center", gap: 8,
  padding: "10px 16px", borderRadius: 999,
  background: "transparent", border: "1px solid rgba(255,255,255,0.2)",
  color: "rgba(255,255,255,0.85)", cursor: "pointer",
  fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500,
};
const PlaySvg = ({ playing }) => playing
  ? <svg width="11" height="11" viewBox="0 0 14 14" fill="currentColor"><rect x="3" y="2" width="3" height="10"/><rect x="8" y="2" width="3" height="10"/></svg>
  : <svg width="11" height="11" viewBox="0 0 14 14" fill="currentColor"><path d="M3 1 L12 7 L3 13 Z"/></svg>;

// ===== Composed scenes =====

const PlayerScene = ({ initial = {}, children, height }) => (
  <PlayerProviderA initial={initial}>
    <div style={{position: "relative", height, overflow: "hidden", background: "var(--paper)"}}>
      {children}
      <PlayerBarA/>
      <QueueDrawerA/>
      <PlayerExpandedA/>
      <WorkModeOverlayA/>
    </div>
  </PlayerProviderA>
);

const Scene_BookIdle = () => (
  <PlayerScene height={1100}>
    <HymnbookWithPlayerHeader hasAudio={true} />
  </PlayerScene>
);

const Scene_BookPlaying = () => (
  <PlayerScene height={1100} initial={{ visible: true, playing: true, currentIdx: 5, progress: 0.34 }}>
    <HymnbookWithPlayerHeader hasAudio={true} />
  </PlayerScene>
);

const Scene_BookNoAudio = () => (
  <PlayerScene height={1100}>
    <NoAudioBookHeader/>
  </PlayerScene>
);

const NoAudioBookHeader = () => (
  <div className="app-shell" style={{minHeight: 1100, position: "relative", overflow: "hidden"}}>
    <AppBar active="list" />
    <header style={{padding: "48px 64px 32px", background: `linear-gradient(180deg, oklch(0.32 0.06 240) 0%, oklch(0.22 0.04 240) 100%)`, color: "var(--paper)", position: "relative", overflow: "hidden"}}>
      <div style={{display: "flex", alignItems: "flex-end", gap: 48, position: "relative"}}>
        <div style={{width: 200, aspectRatio: "3/4", background: "linear-gradient(180deg, #2a3954, #161e30)", borderRadius: 8, padding: 18, display: "flex", flexDirection: "column", justifyContent: "space-between", border: "1px solid rgba(255,255,255,0.08)"}}>
          <div className="mono" style={{fontSize: 9, letterSpacing: ".2em", opacity: 0.6}}>EST. 2024</div>
          <div>
            <div className="display" style={{fontSize: 22, lineHeight: 1.1, marginBottom: 6}}>O Mensageiro</div>
            <div className="mono" style={{fontSize: 9, letterSpacing: ".15em", opacity: 0.6}}>F. GRANJEIRO</div>
          </div>
        </div>
        <div style={{flex: 1, paddingBottom: 16}}>
          <div className="mono" style={{fontSize: 11, letterSpacing: ".18em", opacity: 0.6, marginBottom: 12}}>HINÁRIO COMPLETO</div>
          <h1 className="h-display" style={{fontSize: 56, margin: "0 0 12px", lineHeight: 1}}>O Mensageiro</h1>
          <p className="serif" style={{fontSize: 18, opacity: 0.85, fontStyle: "italic", marginBottom: 20, maxWidth: 600}}>Hinário recebido por Francisco Granjeiro</p>
          <div style={{display: "flex", gap: 12, alignItems: "center", marginBottom: 16}}>
            <button disabled style={{...primaryBtn, opacity: 0.35, cursor: "not-allowed"}}>
              <PlaySvg/>
              <span>Tocar hinário</span>
            </button>
            <span className="serif" style={{fontSize: 13, fontStyle: "italic", opacity: 0.6, marginLeft: 4}}>
              Sem gravações ainda. <a href="#" style={{color: "var(--gold-soft)", textDecoration: "underline"}}>Contribuir áudio</a>
            </span>
          </div>
          <div style={{display: "flex", gap: 24, alignItems: "center"}}>
            <span className="mono" style={{fontSize: 12, letterSpacing: ".1em", opacity: 0.7}}>78 HINOS</span>
            <span style={{opacity: 0.3}}>·</span>
            <span className="mono" style={{fontSize: 12, letterSpacing: ".1em", opacity: 0.7}}>0 GRAVAÇÕES</span>
          </div>
        </div>
      </div>
    </header>
    <div style={{padding: 48, textAlign: "center", color: "var(--ink-mute)"}}>
      <span className="serif" style={{fontStyle: "italic"}}>(índice abaixo · sem indicadores ♫)</span>
    </div>
  </div>
);

const Scene_Expanded = () => (
  <PlayerScene height={900} initial={{ visible: true, playing: true, currentIdx: 5, progress: 0.34, expanded: true }}>
    <HymnbookWithPlayerHeader/>
  </PlayerScene>
);

const Scene_QueueOpen = () => (
  <PlayerScene height={1000} initial={{ visible: true, playing: true, currentIdx: 5, progress: 0.34, queueOpen: true }}>
    <HymnbookWithPlayerHeader/>
  </PlayerScene>
);

const Scene_WorkMode = () => (
  <PlayerScene height={760} initial={{ visible: true, playing: true, currentIdx: 5, progress: 0.42, workMode: true }}>
    <HymnbookWithPlayerHeader/>
  </PlayerScene>
);

const Scene_Mobile = ({ expanded = false, workMode = false }) => (
  <IOSDevice width={402} height={874} dark>
    <PlayerScene height={874} initial={{ visible: true, playing: true, currentIdx: 5, progress: 0.34, expanded, workMode }}>
      <MobileHymnList/>
    </PlayerScene>
  </IOSDevice>
);

const MobileHymnList = () => {
  const { state, set } = usePlayerA();
  const playFrom = (n) => {
    const idx = state.queue.findIndex(h => h.n === n);
    if (idx >= 0) set({ visible: true, playing: true, currentIdx: idx });
  };
  return (
    <div style={{padding: "20px 18px 200px", background: "var(--paper)", minHeight: "100%", color: "var(--ink)"}}>
      <div style={{padding: "10px 0 18px"}}>
        <div className="mono" style={{fontSize: 9, letterSpacing: ".22em", color: "var(--ink-mute)"}}>HINÁRIO</div>
        <h1 className="h-display" style={{fontSize: 32, margin: "6px 0 4px"}}>O Cruzeiro</h1>
        <div className="serif muted" style={{fontSize: 13, fontStyle: "italic"}}>Mestre Irineu</div>
      </div>
      <button onClick={() => set({ visible: true, playing: true, currentIdx: 0, progress: 0 })} style={{
        width: "100%", marginBottom: 18,
        padding: "12px 18px", borderRadius: 12, border: 0,
        background: "var(--firmament)", color: "var(--paper)",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 600, cursor: "pointer",
      }}>
        <PlaySvg/>
        Tocar hinário
      </button>
      {CRUZEIRO_HYMNS.slice(0, 10).map(h => {
        const isCurrent = state.queue[state.currentIdx]?.n === h.n;
        return (
          <div key={h.n} style={{
            display: "grid", gridTemplateColumns: "32px 26px 1fr auto", gap: 12, alignItems: "center",
            padding: "11px 4px", borderBottom: "1px solid var(--rule-soft)",
            background: isCurrent ? "var(--gold-soft)" : "transparent",
          }}>
            {h.hasAudio ? (
              <button onClick={() => playFrom(h.n)} style={{
                width: 28, height: 28, borderRadius: "50%",
                border: "1px solid var(--rule)",
                background: isCurrent ? "var(--firmament)" : "transparent",
                color: isCurrent ? "var(--paper)" : "var(--firmament)",
                cursor: "pointer", display: "grid", placeItems: "center",
              }}>
                <svg width="9" height="9" viewBox="0 0 14 14" fill="currentColor"><path d="M3 1 L12 7 L3 13 Z"/></svg>
              </button>
            ) : <span style={{width: 28}}/>}
            <span className="mono" style={{fontSize: 12, color: "var(--ink-mute)", textAlign: "right"}}>{String(h.n).padStart(2,"0")}</span>
            <span className="serif" style={{fontSize: 16, fontWeight: isCurrent ? 500 : 400}}>{h.t}</span>
            <span className="mono" style={{fontSize: 10, color: "var(--ink-mute)"}}>{h.dur}</span>
          </div>
        );
      })}
    </div>
  );
};

Object.assign(window, { Scene_BookIdle, Scene_BookPlaying, Scene_BookNoAudio, Scene_Expanded, Scene_QueueOpen, Scene_WorkMode, Scene_Mobile });

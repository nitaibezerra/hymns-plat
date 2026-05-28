/* global React, CRUZEIRO_HYMNS, HYMN_7_LYRICS, SAMPLE_BOOK */
// =====================================================
// PLAYER — Variation A: Convencional (Spotify-style)
// Compact bar bottom, expandable fullscreen, queue drawer, work mode
// =====================================================

const PlayerCtxA = React.createContext(null);
const usePlayerA = () => React.useContext(PlayerCtxA);

const PlayerProviderA = ({ initial = {}, children }) => {
  const playable = CRUZEIRO_HYMNS.filter(h => h.hasAudio);
  const [state, setState] = React.useState({
    visible: initial.visible ?? false,
    playing: initial.playing ?? false,
    book: SAMPLE_BOOK,
    queue: playable,
    currentIdx: initial.currentIdx ?? 5, // index in playable; idx 5 = hymn 7 "Estrela Brilhante"
    progress: initial.progress ?? 0.34,  // 0..1 of current hymn
    expanded: initial.expanded ?? false,
    queueOpen: initial.queueOpen ?? false,
    workMode: initial.workMode ?? false,
    sleepTimer: initial.sleepTimer ?? null,
    ...initial,
  });
  const set = (patch) => setState(s => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) }));
  return <PlayerCtxA.Provider value={{ state, set }}>{children}</PlayerCtxA.Provider>;
};

// ----- Compact bar -----
const PlayerBarA = () => {
  const { state, set } = usePlayerA();
  if (!state.visible) return null;
  const cur = state.queue[state.currentIdx];
  const next = state.queue[state.currentIdx + 1];
  return (
    <div style={{
      position: "absolute", left: 0, right: 0, bottom: 0, height: 76,
      background: "rgba(20, 18, 26, 0.96)", color: "#f6efe2",
      borderTop: "1px solid rgba(246,239,226,0.08)",
      display: "grid", gridTemplateColumns: "320px 1fr 320px", alignItems: "center",
      padding: "0 22px", gap: 24, zIndex: 50,
      backdropFilter: "blur(12px)",
      cursor: "pointer",
    }} onClick={() => set({ expanded: true })}>
      {/* Now playing */}
      <div style={{display: "flex", alignItems: "center", gap: 14, minWidth: 0}}>
        <div style={{
          width: 48, height: 48, borderRadius: 4,
          background: "linear-gradient(135deg, var(--firmament) 0%, var(--gold) 100%)",
          display: "grid", placeItems: "center",
          fontFamily: "var(--font-display)", fontSize: 20, color: "#f0e7d2", fontWeight: 600,
          boxShadow: "0 4px 12px rgba(0,0,0,.3)",
        }}>{String(cur.n).padStart(2, "0")}</div>
        <div style={{minWidth: 0, flex: 1}}>
          <div className="serif" style={{fontSize: 14, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>{cur.t}</div>
          <div className="mono" style={{fontSize: 10, opacity: 0.6, letterSpacing: ".08em", marginTop: 2}}>O CRUZEIRO · MESTRE IRINEU</div>
        </div>
      </div>

      {/* Center: controls + progress */}
      <div style={{display: "flex", flexDirection: "column", alignItems: "center", gap: 6}} onClick={e => e.stopPropagation()}>
        <div style={{display: "flex", alignItems: "center", gap: 18}}>
          <IconBtn label="Anterior" onClick={() => set(s => ({ currentIdx: Math.max(0, s.currentIdx - 1), progress: 0 }))}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 2 L3 12 M5 7 L13 1 L13 13 Z"/></svg>
          </IconBtn>
          <button onClick={() => set(s => ({ playing: !s.playing }))} style={{
            width: 40, height: 40, borderRadius: "50%", border: 0,
            background: "#f6efe2", color: "#14121a", cursor: "pointer",
            display: "grid", placeItems: "center",
          }}>
            {state.playing
              ? <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="3" y="2" width="3" height="10"/><rect x="8" y="2" width="3" height="10"/></svg>
              : <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 1 L12 7 L3 13 Z"/></svg>}
          </button>
          <IconBtn label="Próximo" onClick={() => set(s => ({ currentIdx: Math.min(s.queue.length - 1, s.currentIdx + 1), progress: 0 }))}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M11 2 L11 12 M9 7 L1 1 L1 13 Z"/></svg>
          </IconBtn>
        </div>
        <div style={{display: "flex", alignItems: "center", gap: 10, width: "100%", maxWidth: 520}}>
          <span className="mono" style={{fontSize: 10, opacity: 0.6, minWidth: 32, textAlign: "right"}}>1:24</span>
          <div style={{flex: 1, height: 3, background: "rgba(246,239,226,0.15)", borderRadius: 2, position: "relative"}}>
            <div style={{position: "absolute", left: 0, top: 0, bottom: 0, width: `${state.progress * 100}%`, background: "var(--gold-soft)", borderRadius: 2}}/>
            <div style={{position: "absolute", left: `${state.progress * 100}%`, top: -3, width: 9, height: 9, borderRadius: "50%", background: "var(--gold-soft)", transform: "translateX(-50%)"}}/>
          </div>
          <span className="mono" style={{fontSize: 10, opacity: 0.6, minWidth: 32}}>{cur.dur}</span>
        </div>
      </div>

      {/* Right: secondary actions */}
      <div style={{display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8}} onClick={e => e.stopPropagation()}>
        <IconBtn label="Modo trabalho" active={state.workMode} onClick={() => set(s => ({ workMode: !s.workMode }))}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M13 9 a5 5 0 0 1 -7 -7 a6 6 0 1 0 7 7 Z"/></svg>
        </IconBtn>
        <IconBtn label="Sleep timer">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="8" cy="9" r="5"/><path d="M6 9 L8 9 L8 6 M5 1 L3 3 M11 1 L13 3"/></svg>
        </IconBtn>
        <IconBtn label="Compartilhar">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="3.5" cy="8" r="2"/><circle cx="12" cy="3.5" r="2"/><circle cx="12" cy="12.5" r="2"/><path d="M5.2 7 L10.3 4.5 M5.2 9 L10.3 11.5"/></svg>
        </IconBtn>
        <div style={{width: 1, height: 22, background: "rgba(246,239,226,0.14)", margin: "0 4px"}}/>
        <IconBtn label="Fila" active={state.queueOpen} onClick={() => set(s => ({ queueOpen: !s.queueOpen }))}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M2 4 L11 4 M2 8 L11 8 M2 12 L8 12 M13 11 L15 13 L13 15"/></svg>
        </IconBtn>
        <IconBtn label="Expandir" onClick={() => set({ expanded: true })}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M2 6 L2 2 L6 2 M8 2 L12 2 L12 6 M2 8 L2 12 L6 12 M8 12 L12 12 L12 8"/></svg>
        </IconBtn>
      </div>
    </div>
  );
};

const IconBtn = ({ children, label, onClick, active }) => (
  <button onClick={onClick} aria-label={label} title={label} style={{
    width: 30, height: 30, border: 0, borderRadius: 6, cursor: "pointer",
    background: active ? "rgba(246,239,226,0.15)" : "transparent",
    color: active ? "var(--gold-soft)" : "rgba(246,239,226,0.75)",
    display: "grid", placeItems: "center",
  }}>{children}</button>
);

// ----- Queue drawer -----
const QueueDrawerA = () => {
  const { state, set } = usePlayerA();
  if (!state.visible || !state.queueOpen) return null;
  return (
    <div style={{
      position: "absolute", right: 0, top: 0, bottom: 76, width: 380,
      background: "rgba(26,24,32,0.97)", color: "#f6efe2",
      borderLeft: "1px solid rgba(246,239,226,0.08)",
      backdropFilter: "blur(12px)",
      display: "flex", flexDirection: "column",
      zIndex: 49,
    }}>
      <div style={{padding: "18px 22px", borderBottom: "1px solid rgba(246,239,226,0.08)"}}>
        <div style={{display: "flex", justifyContent: "space-between", alignItems: "baseline"}}>
          <div>
            <div className="mono" style={{fontSize: 10, letterSpacing: ".18em", opacity: 0.55}}>FILA · O CRUZEIRO</div>
            <div className="serif" style={{fontSize: 18, marginTop: 4}}>Tocando agora</div>
          </div>
          <button onClick={() => set({ queueOpen: false })} style={{
            background: "transparent", border: 0, color: "rgba(246,239,226,0.7)", cursor: "pointer", fontSize: 18,
          }}>×</button>
        </div>
        <div style={{display: "flex", gap: 14, marginTop: 12, fontSize: 12}} className="mono">
          <span style={{opacity: 0.6}}>{state.queue.length} hinos</span>
          <span style={{opacity: 0.4}}>·</span>
          <span style={{opacity: 0.6}}>{CRUZEIRO_HYMNS.length - state.queue.length} sem áudio (pulados)</span>
        </div>
      </div>
      <div style={{flex: 1, overflowY: "auto", padding: "8px 0"}}>
        {state.queue.map((h, i) => {
          const isCurrent = i === state.currentIdx;
          const isPast = i < state.currentIdx;
          return (
            <div key={h.n} onClick={() => set({ currentIdx: i, progress: 0 })} style={{
              padding: "12px 22px", display: "grid",
              gridTemplateColumns: "32px 1fr auto", alignItems: "center", gap: 14,
              cursor: "pointer",
              background: isCurrent ? "rgba(246,239,226,0.06)" : "transparent",
              opacity: isPast ? 0.45 : 1,
              borderLeft: isCurrent ? "2px solid var(--gold-soft)" : "2px solid transparent",
            }}>
              <div className="mono" style={{fontSize: 11, color: isCurrent ? "var(--gold-soft)" : "rgba(246,239,226,0.5)", textAlign: "right"}}>
                {isCurrent ? "▶" : String(h.n).padStart(2, "0")}
              </div>
              <div style={{minWidth: 0}}>
                <div className="serif" style={{fontSize: 14, color: isCurrent ? "var(--gold-soft)" : "#f6efe2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>{h.t}</div>
                <div className="mono" style={{fontSize: 10, opacity: 0.5, marginTop: 2}}>{h.style || "—"}</div>
              </div>
              <div className="mono" style={{fontSize: 11, opacity: 0.55}}>{h.dur}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ----- Expanded full-screen player -----
const PlayerExpandedA = () => {
  const { state, set } = usePlayerA();
  if (!state.visible || !state.expanded) return null;
  const cur = state.queue[state.currentIdx];
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 60,
      background: "linear-gradient(180deg, #1a1620 0%, #14121a 60%)",
      color: "#f6efe2",
      display: "grid", gridTemplateRows: "auto 1fr auto",
    }}>
      {/* Top bar */}
      <div style={{padding: "20px 28px", display: "flex", alignItems: "center", justifyContent: "space-between"}}>
        <button onClick={() => set({ expanded: false })} style={{background: "transparent", border: 0, color: "rgba(246,239,226,0.7)", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 8}}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M9 2 L4 7 L9 12"/></svg>
          Recolher
        </button>
        <div className="mono" style={{fontSize: 11, opacity: 0.5, letterSpacing: ".15em"}}>O CRUZEIRO · {state.currentIdx + 1} de {state.queue.length}</div>
        <button style={{background: "transparent", border: 0, color: "rgba(246,239,226,0.7)", cursor: "pointer", fontSize: 18}}>⋯</button>
      </div>

      {/* Content: cover + lyrics */}
      <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, padding: "20px 80px", alignItems: "center"}}>
        <div style={{display: "flex", flexDirection: "column", alignItems: "center", gap: 28}}>
          <div style={{
            width: 320, height: 320, borderRadius: 6,
            background: "linear-gradient(135deg, var(--firmament) 0%, var(--gold) 100%)",
            display: "grid", placeItems: "center",
            boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
            position: "relative",
          }}>
            <div style={{position: "absolute", top: 24, left: 0, right: 0, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".25em", color: "rgba(246,239,226,0.55)"}}>O CRUZEIRO</div>
            <div style={{fontFamily: "var(--font-display)", fontSize: 96, color: "#f0e7d2", fontWeight: 500, lineHeight: 1}}>{String(cur.n).padStart(2, "0")}</div>
            <div style={{position: "absolute", bottom: 24, left: 0, right: 0, textAlign: "center", fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 18, color: "rgba(246,239,226,0.7)"}}>{cur.style}</div>
          </div>
          <div style={{textAlign: "center"}}>
            <div className="serif" style={{fontSize: 28, fontWeight: 500}}>{cur.t}</div>
            <div className="mono" style={{fontSize: 11, opacity: 0.55, letterSpacing: ".15em", marginTop: 6}}>MESTRE IRINEU · 1934</div>
          </div>
        </div>

        {/* Karaoke lyrics */}
        <div style={{maxHeight: 460, overflowY: "auto", padding: "20px 0"}}>
          <div className="mono" style={{fontSize: 10, opacity: 0.4, letterSpacing: ".2em", marginBottom: 24}}>LETRA · ACOMPANHAMENTO</div>
          {HYMN_7_LYRICS.map((l, i) => {
            const t = state.progress * 42; // 42s simulado
            const isCurrent = t >= l.t && (i === HYMN_7_LYRICS.length - 1 || t < HYMN_7_LYRICS[i+1].t);
            const isPast = t > l.t;
            return (
              <div key={i} className="serif" style={{
                fontSize: 22, lineHeight: 1.4, marginBottom: 10,
                color: isCurrent ? "#f6efe2" : (isPast ? "rgba(246,239,226,0.35)" : "rgba(246,239,226,0.55)"),
                fontWeight: isCurrent ? 500 : 400,
                transition: "color 200ms",
              }}>{l.line}</div>
            );
          })}
        </div>
      </div>

      {/* Bottom controls */}
      <div style={{padding: "24px 80px 36px"}}>
        <div style={{display: "flex", alignItems: "center", gap: 12, marginBottom: 14}}>
          <span className="mono" style={{fontSize: 11, opacity: 0.55, minWidth: 36}}>1:24</span>
          <div style={{flex: 1, height: 4, background: "rgba(246,239,226,0.12)", borderRadius: 2, position: "relative"}}>
            <div style={{position: "absolute", left: 0, top: 0, bottom: 0, width: `${state.progress * 100}%`, background: "var(--gold-soft)", borderRadius: 2}}/>
            <div style={{position: "absolute", left: `${state.progress * 100}%`, top: -4, width: 12, height: 12, borderRadius: "50%", background: "var(--gold-soft)", transform: "translateX(-50%)"}}/>
          </div>
          <span className="mono" style={{fontSize: 11, opacity: 0.55, minWidth: 36}}>{cur.dur}</span>
        </div>
        <div style={{display: "flex", justifyContent: "center", alignItems: "center", gap: 28}}>
          <IconBtn label="Anterior"><svg width="16" height="16" viewBox="0 0 14 14" fill="currentColor"><path d="M3 2 L3 12 M5 7 L13 1 L13 13 Z"/></svg></IconBtn>
          <button onClick={() => set(s => ({ playing: !s.playing }))} style={{
            width: 60, height: 60, borderRadius: "50%", border: 0,
            background: "#f6efe2", color: "#14121a", cursor: "pointer",
            display: "grid", placeItems: "center",
          }}>
            {state.playing
              ? <svg width="20" height="20" viewBox="0 0 14 14" fill="currentColor"><rect x="3" y="2" width="3" height="10"/><rect x="8" y="2" width="3" height="10"/></svg>
              : <svg width="20" height="20" viewBox="0 0 14 14" fill="currentColor"><path d="M3 1 L12 7 L3 13 Z"/></svg>}
          </button>
          <IconBtn label="Próximo"><svg width="16" height="16" viewBox="0 0 14 14" fill="currentColor"><path d="M11 2 L11 12 M9 7 L1 1 L1 13 Z"/></svg></IconBtn>
        </div>
      </div>
    </div>
  );
};

// ----- Work mode overlay -----
const WorkModeOverlayA = () => {
  const { state, set } = usePlayerA();
  if (!state.visible || !state.workMode) return null;
  const cur = state.queue[state.currentIdx];
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 55,
      background: "rgba(8, 6, 12, 0.94)",
      backdropFilter: "blur(8px)",
      display: "grid", placeItems: "center",
      color: "#f6efe2",
    }}>
      <div style={{textAlign: "center", maxWidth: 480}}>
        <div className="mono" style={{fontSize: 10, opacity: 0.4, letterSpacing: ".25em", marginBottom: 32}}>MODO TRABALHO</div>
        <div className="mono" style={{fontSize: 11, opacity: 0.5, letterSpacing: ".18em"}}>HINO {String(cur.n).padStart(2, "0")} · O CRUZEIRO</div>
        <div className="serif" style={{fontSize: 36, marginTop: 16, fontWeight: 400, color: "rgba(246,239,226,0.92)"}}>{cur.t}</div>
        <div style={{marginTop: 60, display: "flex", justifyContent: "center", alignItems: "center", gap: 28}}>
          <IconBtn label="Anterior"><svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 2 L3 12 M5 7 L13 1 L13 13 Z"/></svg></IconBtn>
          <button onClick={() => set(s => ({ playing: !s.playing }))} style={{
            width: 56, height: 56, borderRadius: "50%", border: "1px solid rgba(246,239,226,0.25)",
            background: "transparent", color: "#f6efe2", cursor: "pointer",
            display: "grid", placeItems: "center",
          }}>
            {state.playing
              ? <svg width="16" height="16" viewBox="0 0 14 14" fill="currentColor"><rect x="3" y="2" width="3" height="10"/><rect x="8" y="2" width="3" height="10"/></svg>
              : <svg width="16" height="16" viewBox="0 0 14 14" fill="currentColor"><path d="M3 1 L12 7 L3 13 Z"/></svg>}
          </button>
          <IconBtn label="Próximo"><svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M11 2 L11 12 M9 7 L1 1 L1 13 Z"/></svg></IconBtn>
        </div>
        <div style={{marginTop: 60, display: "flex", justifyContent: "center", gap: 14, width: 280, height: 2, margin: "60px auto 0"}}>
          <div style={{flex: 1, background: "rgba(246,239,226,0.12)", borderRadius: 1, position: "relative"}}>
            <div style={{position: "absolute", left: 0, top: 0, bottom: 0, width: `${state.progress * 100}%`, background: "var(--gold-soft)"}}/>
          </div>
        </div>
        <button onClick={() => set({ workMode: false })} style={{marginTop: 60, background: "transparent", border: "1px solid rgba(246,239,226,0.2)", color: "rgba(246,239,226,0.6)", padding: "10px 22px", borderRadius: 999, cursor: "pointer", fontSize: 12, fontFamily: "var(--font-sans)", letterSpacing: ".05em"}}>
          Sair do modo trabalho
        </button>
      </div>
    </div>
  );
};

Object.assign(window, { PlayerProviderA, PlayerBarA, QueueDrawerA, PlayerExpandedA, WorkModeOverlayA, usePlayerA });

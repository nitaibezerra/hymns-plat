/* global React, AppBar, BrandGlyph, HYMNBOOKS, SAMPLE_BOOK */

// =====================================================
// Screen: Home
// =====================================================
const HomeScreen = () => (
  <div className="app-shell" style={{minHeight: 1100}}>
    <AppBar active="home" />

    {/* Hero — liturgical paper banner */}
    <section style={{
      padding: "80px 64px 64px",
      background: `
        radial-gradient(ellipse at 80% 20%, rgba(184, 137, 58, 0.14), transparent 50%),
        radial-gradient(ellipse at 10% 90%, rgba(29, 59, 106, 0.10), transparent 60%),
        var(--paper)
      `,
      borderBottom: "1px solid var(--rule)",
      position: "relative",
    }}>
      <div className="eyebrow" style={{marginBottom: 18}}>Hinaria · hinaria.com.br</div>
      <h1 className="h-display" style={{fontSize: 64, lineHeight: 1.05, margin: "0 0 18px", maxWidth: 820}}>
        Hinários para ler, ouvir e<br/>
        <em style={{color: "var(--firmament)", fontStyle: "italic"}}>guardar com cuidado</em>.
      </h1>
      <p className="serif" style={{fontSize: 19, color: "var(--ink-soft)", maxWidth: 620, margin: 0, lineHeight: 1.5}}>
        Uma biblioteca aberta de hinos recebidos, com revisão editorial cuidadosa e três modos de leitura — pensada para uso durante os trabalhos.
      </p>

      {/* Search */}
      <div style={{
        marginTop: 36, display: "flex", gap: 0, maxWidth: 680,
        background: "var(--paper-soft)", border: "1px solid var(--rule)",
        borderRadius: 999, padding: "6px 6px 6px 22px", alignItems: "center",
      }}>
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="var(--ink-mute)" strokeWidth="1.6">
          <circle cx="7" cy="7" r="5"/><path d="M11 11 L14 14"/>
        </svg>
        <input type="text" placeholder="Buscar por título, letra ou hinário…"
          style={{flex: 1, padding: "12px 14px", border: 0, background: "transparent", fontSize: 15, fontFamily: "var(--font-sans)", color: "var(--ink)", outline: "none"}}
          defaultValue="estrela brilhante" />
        <button className="btn btn-primary">Buscar</button>
      </div>

      {/* Stats */}
      <div style={{display: "flex", gap: 56, marginTop: 56, alignItems: "baseline"}}>
        <Stat n="142" label="hinários" />
        <Stat n="9.408" label="hinos" />
        <Stat n="1.273" label="áudios" />
        <Stat n="6" label="revisores ativos" />
      </div>
    </section>

    {/* Featured hymnbooks — letterpress card grid */}
    <section style={{padding: "64px"}}>
      <div style={{display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 28}}>
        <h2 className="h-display" style={{fontSize: 34, margin: 0}}>Em destaque</h2>
        <a href="#" className="mono muted" style={{fontSize: 12, letterSpacing: ".15em", textDecoration: "none"}}>VER TODOS →</a>
      </div>
      <div style={{display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24}}>
        {HYMNBOOKS.slice(0, 6).map((b, i) => <HymnBookCard key={i} book={b} />)}
      </div>
    </section>

    {/* Recently revised — editorial activity strip */}
    <section style={{padding: "0 64px 64px"}}>
      <div style={{display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20}}>
        <h2 className="h-display" style={{fontSize: 28, margin: 0}}>Recentemente revisados</h2>
        <span className="eyebrow">trabalho editorial · esta semana</span>
      </div>
      <div className="card" style={{padding: 0, background: "var(--paper-soft)"}}>
        {[
          {who: "Joana M.", n: 12, book: "Hinos do Sol", when: "agora há pouco"},
          {who: "Carlos B.", n: 5, book: "Estrela do Mar", when: "hoje, 14:22"},
          {who: "Joana M.", n: 8, book: "Hinos do Sol", when: "ontem"},
          {who: "Pedro A.", n: 3, book: "O Mensageiro", when: "há 2 dias"},
        ].map((row, i) => (
          <div key={i} style={{display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 24, padding: "14px 24px", alignItems: "center", borderTop: i ? "1px solid var(--rule-soft)" : "none"}}>
            <div className="serif" style={{fontSize: 15}}>
              <strong>{row.who}</strong> revisou {row.n} hino{row.n > 1 ? "s" : ""} de <em style={{color: "var(--firmament)"}}>{row.book}</em>
            </div>
            <span className="pill pill-ok">Revisado</span>
            <span className="mono muted" style={{fontSize: 12}}>{row.when}</span>
          </div>
        ))}
      </div>
    </section>
  </div>
);

const Stat = ({n, label}) => (
  <div>
    <div className="h-display" style={{fontSize: 42, color: "var(--firmament)", lineHeight: 1}}>{n}</div>
    <div className="mono" style={{fontSize: 11, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--ink-mute)", marginTop: 6}}>{label}</div>
  </div>
);

// Card with engraved cover (letterpress feel)
const HymnBookCard = ({ book }) => {
  const hues = [200, 25, 270, 340, 160, 40];
  const hue = hues[book.hue - 1] || 200;
  const isPub = book.status === "published";
  const pct = Math.round((book.reviewed / book.count) * 100);
  return (
    <div className="card" style={{padding: 0, overflow: "hidden", display: "flex", flexDirection: "column"}}>
      {/* engraved cover */}
      <div style={{
        position: "relative",
        aspectRatio: "4 / 3",
        background: `
          radial-gradient(ellipse at 30% 20%, oklch(0.58 0.10 ${hue} / 0.6), transparent 60%),
          linear-gradient(180deg, oklch(0.32 0.08 ${hue}), oklch(0.22 0.06 ${hue}))
        `,
        color: "var(--paper)",
        padding: 22,
        display: "flex", flexDirection: "column", justifyContent: "space-between",
      }}>
        <div className="mono" style={{fontSize: 10, letterSpacing: ".2em", opacity: 0.7}}>EST. {book.year}</div>
        {/* engraved initial */}
        <div style={{position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontFamily: "var(--font-display)", fontSize: 96, fontStyle: "italic", opacity: 0.18, letterSpacing: "-0.04em"}}>
          {book.name[0]}
        </div>
        <div>
          <div className="display" style={{fontSize: 22, fontWeight: 500, lineHeight: 1.1, marginBottom: 4}}>{book.name}</div>
          <div className="mono" style={{fontSize: 10, letterSpacing: ".15em", opacity: 0.75}}>{book.owner.toUpperCase()}</div>
        </div>
      </div>
      {/* base */}
      <div style={{padding: 16, display: "flex", flexDirection: "column", gap: 10, flex: 1}}>
        <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
          <span className="mono muted" style={{fontSize: 12}}>{book.count} hinos</span>
          {isPub
            ? <span className="pill pill-pub">Publicado</span>
            : <span className="pill pill-mid">Em revisão · {pct}%</span>}
        </div>
        {!isPub && (
          <div className="progress gold"><i style={{width: pct + "%"}}/></div>
        )}
      </div>
    </div>
  );
};

Object.assign(window, { HomeScreen, HymnBookCard, Stat });

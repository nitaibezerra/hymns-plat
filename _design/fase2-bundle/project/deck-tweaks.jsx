/* global React, ReactDOM */

const DECK_TWEAKS = /*EDITMODE-BEGIN*/{
  "palette": "luz-firmamento"
}/*EDITMODE-END*/;

const DECK_PALETTES = {
  "luz-firmamento": {
    "--paper": "#f6efe2", "--paper-soft": "#efe6d2", "--paper-deep": "#e6dcc4",
    "--ink": "#1a1d2e", "--ink-soft": "#3a3f57", "--ink-mute": "#6b6f85",
    "--rule": "#c8bda1", "--rule-soft": "#d9cfb6",
    "--firmament": "#1d3b6a", "--gold": "#b8893a", "--gold-soft": "#d9b06a",
    "--moss": "#4a6a3a", "--vermilion": "#b13e2e",
  },
  "floresta": {
    "--paper": "#f1ede2", "--paper-soft": "#e6e2d3", "--paper-deep": "#d8d4c2",
    "--ink": "#1c2417", "--ink-soft": "#3a4530", "--ink-mute": "#6b745f",
    "--rule": "#b8b39e", "--rule-soft": "#cfcab5",
    "--firmament": "#3d5a3a", "--gold": "#a47432", "--gold-soft": "#c89954",
    "--moss": "#4a6a3a", "--vermilion": "#b13e2e",
  },
  "vermelhao": {
    "--paper": "#f6ecdf", "--paper-soft": "#ede0cd", "--paper-deep": "#e0d2bb",
    "--ink": "#2a1818", "--ink-soft": "#4a2c2c", "--ink-mute": "#7a5e5e",
    "--rule": "#c8b5a0", "--rule-soft": "#d4c2ad",
    "--firmament": "#7a2418", "--gold": "#b8893a", "--gold-soft": "#d9b06a",
    "--moss": "#4a6a3a", "--vermilion": "#b13e2e",
  },
};

function DeckTweaksApp() {
  const [t, setTweak] = window.useTweaks(DECK_TWEAKS);
  React.useEffect(() => {
    const root = document.documentElement;
    const pal = DECK_PALETTES[t.palette] || DECK_PALETTES["luz-firmamento"];
    Object.entries(pal).forEach(([k, v]) => root.style.setProperty(k, v));
  }, [t.palette]);

  const TP = window.TweaksPanel;
  const TS = window.TweakSection;
  const TR = window.TweakRadio;
  return (
    <TP title="Tweaks">
      <TS title="Identidade">
        <TR label="Paleta" value={t.palette} onChange={(v) => setTweak("palette", v)}
          options={[
            {value: "luz-firmamento", label: "Luz do Firmamento"},
            {value: "floresta", label: "Floresta"},
            {value: "vermelhao", label: "Vermelhão"},
          ]}/>
      </TS>
    </TP>
  );
}

const tweaksMount = document.createElement("div");
document.body.appendChild(tweaksMount);

function tryMount() {
  if (typeof window.useTweaks === "function" && typeof window.TweaksPanel === "function") {
    ReactDOM.createRoot(tweaksMount).render(<DeckTweaksApp/>);
  } else {
    setTimeout(tryMount, 50);
  }
}
tryMount();

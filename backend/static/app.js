const API_URL = "";

// ===== Elementos del DOM =====
const form       = document.getElementById("predictForm");
const leagueSel  = document.getElementById("league");
const homeSel    = document.getElementById("home");
const awaySel    = document.getElementById("away");
const marketSel  = document.getElementById("market");
const oddsInput  = document.getElementById("odds");
const probValue  = document.getElementById("probValue");
const evValue    = document.getElementById("evValue");
const pickValue  = document.getElementById("pickValue");
const resetBtn   = document.getElementById("resetBtn");

const selectionSel   = document.getElementById("selection");
const selectionField = document.getElementById("selectionField");



// Última probabilidad conocida (para mercados no-1X2) y para 1X2 (vector)
let lastProb = null; // 0..1 para mercados simples
let lastProbs1x2 = null; // {home:0..1, draw:0..1, away:0..1}

// =========================================================================
// 1) CONFIG: Umbrales automáticos por mercado y liga
//    (se usan SOLO cuando no hay cuotas para decidir por probabilidad)
// =========================================================================
const THRESHOLDS = {
  defaults: {
    "1x2":   0.50, // umbral general cuando no hay cuotas (se usa sobre la prob. del pick ganador)
    "over25":0.53,
    "btts":  0.52
  },
  leagues: {
    "LaLiga":          { "1x2": 0.52, "over25":0.54, "btts":0.53 },
    "Premier League":  { "1x2": 0.51, "over25":0.55, "btts":0.52 },
    "Liga MX":         { "1x2": 0.53, "over25":0.54, "btts":0.53 },
  }
};

function getThreshold(market, league) {
  const d = THRESHOLDS.defaults[market] ?? 0.50;
  const leagueCfg = THRESHOLDS.leagues[league];
  if (leagueCfg && typeof leagueCfg[market] === "number") return leagueCfg[market];
  return d;
}

// =========================================================================
// 2) Helpers generales
// =========================================================================
function clamp01(x) { return Math.max(0, Math.min(1, x)); }

// Lee cuota simple (para mercados no-1X2)
function readSingleOdds() {
  const v = parseFloat(oddsInput?.value);
  return (isNaN(v) || v <= 1.01) ? null : v;
}

// Lee 1, 2 o 3 cuotas en el mismo input; separadores: / , ; espacio
// Devuelve: null (sin cuotas válidas), [n] o [n1,n2,n3]
function readMultiOdds() {
  if (!oddsInput || !oddsInput.value) return null;
  const raw = oddsInput.value.trim();
  if (!raw) return null;
  const parts = raw.split(/[\/,\s;]+/).map(x => parseFloat(x.replace(',', '.'))).filter(n => !isNaN(n) && n > 1.01);
  if (parts.length === 0) return null;
  return parts.slice(0, 3);
}

function computeEV(prob, odds) {
  if (prob == null || odds == null) return null;
  return (prob * odds) - 1; // decimal: 0.08 => +8%
}

function formatEV(ev) {
  if (ev == null) return "N/A";
  const pct = ev * 100;
  const sign = ev > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

function setEvTone(ev) {
  const evKpi = document.getElementById("evKpi");
  if (!evKpi) return;
  evKpi.classList.remove("positive", "negative");
  if (ev == null) return;
  evKpi.classList.add(ev >= 0 ? "positive" : "negative");
}

// =========================================================================
// 3) Lógica de PICK por mercado
// =========================================================================

// ---- No-1X2 (over, btts, etc.): usa lastProb + cuota simple (si hay)
function refreshKPIs_SimpleMarkets() {
  const odds = readSingleOdds();
  const ev   = computeEV(lastProb, odds);
  evValue.textContent   = formatEV(ev);
  setEvTone(ev);

  // si hay cuota -> Back si EV>=0; sin cuota -> umbral por mercado/liga
  const mk = marketSel.value;
  const th = getThreshold(mk, leagueSel.value);
  let pick;
  if (ev != null) pick = ev >= 0 ? "Back" : "Lay";
  else if (lastProb == null) pick = "—";
  else pick = (lastProb >= th ? "Back" : "Lay");

  pickValue.textContent = pick;
}

// ---- 1X2: acepta probabilidades home/draw/away + 3 cuotas opcionales
function refreshKPIs_1x2() {
  // Necesitamos probabilidades para 1,X,2
  if (!lastProbs1x2) {
    // Si no hay, no podemos elegir correctamente
    probValue.textContent = "N/A";
    evValue.textContent   = "N/A";
    pickValue.textContent = "—";
    setEvTone(null);
    return;
  }

  const probs = [
    { key: "1", label: "1",   prob: clamp01(lastProbs1x2.home) },
    { key: "X", label: "X",   prob: clamp01(lastProbs1x2.draw) },
    { key: "2", label: "2",   prob: clamp01(lastProbs1x2.away) },
  ];

  const oddsArr = readMultiOdds(); // null, [o], o [o1,o2,o3]
  let best = null;

  if (oddsArr && oddsArr.length === 3) {
    // Tenemos 3 cuotas -> decidir por mejor EV
    const evs = probs.map((p, i) => ({ ...p, odds: oddsArr[i], ev: computeEV(p.prob, oddsArr[i]) }));
    best = evs.reduce((a, b) => (a.ev ?? -Infinity) >= (b.ev ?? -Infinity) ? a : b);
    probValue.textContent = (best.prob * 100).toFixed(2) + "%";
    evValue.textContent   = formatEV(best.ev);
    pickValue.textContent = best.label; // "1", "X" o "2"
    setEvTone(best.ev);
  } else {
    // No hay 3 cuotas -> decidir por mayor probabilidad (y umbral)
    best = probs.reduce((a, b) => (a.prob >= b.prob ? a : b));
    const th = getThreshold("1x2", leagueSel.value);
    probValue.textContent = (best.prob * 100).toFixed(2) + "%";
    evValue.textContent   = "N/A";
    setEvTone(null);
    pickValue.textContent = (best.prob >= th ? best.label : "—"); // si no supera el umbral, no recomendar
  }
}

// Orquestador según mercado
function refreshClientKPIs() {
  if (marketSel.value === "1x2") refreshKPIs_1x2();
  else refreshKPIs_SimpleMarkets();
}

// =========================================================================
// 4) API: Carga equipos por liga
// =========================================================================
async function loadTeams() {
  try {
    const res = await fetch(`${API_URL}/api/markets?league=${encodeURIComponent(leagueSel.value)}`);
    const data = await res.json();
    populateTeams(data.teams || []);
  } catch (err) {
    console.error("Error cargando equipos:", err);
    populateTeams([]);
  }
}

function populateTeams(teams) {
  const opts = (teams || []).map(t => `<option value="${t}">${t}</option>`).join("");
  homeSel.innerHTML = opts;
  awaySel.innerHTML = opts;
}

// =========================================================================
 // 5) Eventos
// =========================================================================
leagueSel.addEventListener("change", () => {
  loadTeams();
  refreshClientKPIs(); // por si cambia el umbral de liga
});

marketSel.addEventListener("change", () => {
  refreshClientKPIs(); // redecidir por lógica del mercado
});

// Cambiar la cuota (único input) -> soporta 1, 2 o 3 valores
oddsInput?.addEventListener("input", () => {
  refreshClientKPIs();
});

// Submit: pide predicción y actualiza UI
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    sport: "futbol",
    league: leagueSel.value,
    home: homeSel.value,
    away: awaySel.value,
    market: marketSel.value,
    // para el backend envía lo que elijas: simple o la 1ª cuota
    odds: readSingleOdds()
  };

  // Estado de carga
  probValue.textContent = "⏳";
  evValue.textContent   = "⏳";
  pickValue.textContent = "⏳";

  try {
    const res  = await fetch(`${API_URL}/api/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    // --- Normalizar prob(s) desde backend ---
    // CASO 1: mercados simples -> data.prob (0..1)
    // CASO 2: 1X2 -> puede venir como:
    //   - data.probs = { home, draw, away }
    //   - o bien data.p1, data.px, data.p2
    lastProb = null;
    lastProbs1x2 = null;

    if (marketSel.value === "1x2") {
      let h, d, a;
      if (data?.probs && typeof data.probs === "object") {
        h = data.probs.home; d = data.probs.draw; a = data.probs.away;
      } else {
        h = data.p1; d = data.px ?? data.pX ?? data.draw; a = data.p2;
      }
      if ([h, d, a].every(v => typeof v === "number")) {
        lastProbs1x2 = { home: clamp01(h), draw: clamp01(d), away: clamp01(a) };
      }
    } else {
      if (typeof data.prob === "number") lastProb = clamp01(data.prob);
    }

    // Pintar probabilidad “principal” en el KPI:
    if (marketSel.value === "1x2") {
      // Se pintará la prob del pick elegido en refreshClientKPIs()
      // (mientras tanto deja un placeholder)
      probValue.textContent = "—";
    } else {
      probValue.textContent = (lastProb != null) ? ((lastProb * 100).toFixed(2) + "%") : "N/A";
    }

    // EV / Pick en cliente
    refreshClientKPIs();

  } catch (err) {
    console.error("Error en predicción:", err);
    probValue.textContent = "Error";
    evValue.textContent   = "Error";
    pickValue.textContent = "Error";
    lastProb = null;
    lastProbs1x2 = null;
  }
});

// Reset
resetBtn.addEventListener("click", () => {
  form.reset();
  loadTeams();
  lastProb = null;
  lastProbs1x2 = null;
  probValue.textContent = "—";
  evValue.textContent   = "—";
  pickValue.textContent = "—";
  setEvTone(null);
});

// Inicializar
loadTeams();



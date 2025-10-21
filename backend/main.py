from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, Literal
from backend.services.datacenter import DataCenter
import os

app = FastAPI(title="clientePredict - Sports AI", version="0.1.0")

# Static files (served from backend/static)
static_dir = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/", include_in_schema=False)
async def root():
    return FileResponse(os.path.join(static_dir, "index.html"))

# CORS (kept permissive for local testing)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

dc = DataCenter()

class PredictRequest(BaseModel):
    sport: str = Field(default="futbol")
    league: str = Field(default="LaLiga")
    home: str
    away: str
    market: Literal["1x2", "over25", "btts", "spread"] = "1x2"
    selection: Optional[Literal["home","draw","away"]] = "home"
    odds: Optional[float] = None

class PredictResponse(BaseModel):
    prob: float
    ev: Optional[float] = None
    pick: str

@app.get("/health")
def health():
    return {"ok": True}

@app.get("/api/markets")
def markets(league: str = "LaLiga"):
    return {
        "league": league,
        "teams": dc.teams(league),
        "markets": ["1x2","over25","btts","spread"]
    }

@app.post("/api/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    mu_h, mu_a = dc.expected_goals(req.league, req.home, req.away)

    if req.market == "1x2":
        probs = dc.probabilities_1x2(mu_h, mu_a)
        p = probs[(req.selection or "home").lower()]
    elif req.market == "over25":
        p = dc.prob_over_under(mu_h, mu_a, threshold=2.5, side="over")
    elif req.market == "btts":
        p = dc.prob_btts(mu_h, mu_a)
    else:
        probs = dc.probabilities_1x2(mu_h, mu_a)
        p = probs["home"]

    ev = (p * req.odds - 1) if (req.odds and req.odds > 0) else None
    pick = "A favor" if ((ev is not None and ev > 0) or p >= 0.52) else ("En contra" if p <= 0.40 else "No apostar")
    return PredictResponse(prob=round(p,4), ev=round(ev,3) if ev is not None else None, pick=pick)

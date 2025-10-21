import pandas as pd
import numpy as np
from math import exp, factorial
import os

class DataCenter:
    """DataCenter adaptado a FMEL_Dataset.csv (dataset de fútbol)."""

    def __init__(self):
        dataset_path = os.path.join(os.path.dirname(__file__), "../../FMEL_Dataset.csv")
        self.df = pd.read_csv(dataset_path)

        # Limpieza básica con los nombres correctos
        self.df = self.df.dropna(subset=["localTeam", "visitorTeam", "localGoals", "visitorGoals"])
        self.df["localGoals"] = self.df["localGoals"].astype(float)
        self.df["visitorGoals"] = self.df["visitorGoals"].astype(float)

        # Cálculo de medias por equipo
        self.home_means = self.df.groupby("localTeam")["localGoals"].mean().to_dict()
        self.away_means = self.df.groupby("visitorTeam")["visitorGoals"].mean().to_dict()

    def _team_mean(self, team, is_home=True):
        if is_home:
            return self.home_means.get(team, np.mean(list(self.home_means.values())))
        else:
            return self.away_means.get(team, np.mean(list(self.away_means.values())))

    def expected_goals(self, league, home, away):
        mu_h = self._team_mean(home, True)
        mu_a = self._team_mean(away, False)
        return float(mu_h), float(mu_a)

    def _poisson_pmf(self, k, mu):
        return (mu ** k) * exp(-mu) / factorial(k)

    def probabilities_1x2(self, mu_h, mu_a, max_goals=6):
        home_win = draw = away_win = 0.0
        for gh in range(max_goals + 1):
            ph = self._poisson_pmf(gh, mu_h)
            for ga in range(max_goals + 1):
                pa = self._poisson_pmf(ga, mu_a)
                prob = ph * pa
                if gh > ga:
                    home_win += prob
                elif gh == ga:
                    draw += prob
                else:
                    away_win += prob
        total = home_win + draw + away_win
        return {"home": home_win / total, "draw": draw / total, "away": away_win / total}

    def prob_over_under(self, mu_h, mu_a, threshold=2.5, side="over", max_goals=6):
        prob_sum_leq = 0.0
        for gh in range(max_goals + 1):
            ph = self._poisson_pmf(gh, mu_h)
            for ga in range(max_goals + 1):
                pa = self._poisson_pmf(ga, mu_a)
                if gh + ga <= int(threshold):
                    prob_sum_leq += ph * pa
        prob_over = 1 - prob_sum_leq
        return prob_over if side == "over" else 1 - prob_over

    def prob_btts(self, mu_h, mu_a, max_goals=6):
        prob_both = 0.0
        for gh in range(1, max_goals + 1):
            ph = self._poisson_pmf(gh, mu_h)
            for ga in range(1, max_goals + 1):
                pa = self._poisson_pmf(ga, mu_a)
                prob_both += ph * pa
        return prob_both

    def teams(self, league="FMEL"):
        """Devuelve lista única de equipos del dataset."""
        teams = sorted(set(self.df["localTeam"]).union(set(self.df["visitorTeam"])))
        return teams

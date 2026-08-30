"""Explainable warehouse location ranking for BrewSmart.

The operational model is intentionally transparent. Mandatory warehouse safety rules
are applied before this module is called; this module ranks only safe candidates.
A supervised model can optionally be loaded when enough reviewed historical decisions
exist, but the deterministic weighted model remains the auditable fallback.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional
import json

try:
    import joblib  # type: ignore
except Exception:  # pragma: no cover - optional at runtime
    joblib = None

MODEL_VERSION = "BREWSMART-MCDM-2026.3"
DEFAULT_WEIGHTS = {
    "capacity_fit": 0.28,
    "weight_fit": 0.17,
    "consolidation": 0.20,
    "rack_balance": 0.13,
    "accessibility": 0.10,
    "adjacency": 0.07,
    "fragmentation": 0.05,
}


def _clip01(value: Any, default: float = 0.0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        number = default
    return max(0.0, min(1.0, number))


def _normalize_weights(weights: Dict[str, float]) -> Dict[str, float]:
    positive = {k: max(0.0, float(v)) for k, v in weights.items()}
    total = sum(positive.values()) or 1.0
    return {k: v / total for k, v in positive.items()}


def load_weights(model_dir: Optional[Path] = None) -> Dict[str, float]:
    model_dir = model_dir or Path(__file__).resolve().parents[1] / "model"
    path = model_dir / "weights.json"
    if path.exists():
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            values = payload.get("weights", payload)
            if isinstance(values, dict):
                merged = {**DEFAULT_WEIGHTS, **{k: float(v) for k, v in values.items() if k in DEFAULT_WEIGHTS}}
                return _normalize_weights(merged)
        except Exception:
            pass
    return _normalize_weights(DEFAULT_WEIGHTS)


def score_candidate(candidate: Dict[str, Any], weights: Optional[Dict[str, float]] = None) -> Dict[str, Any]:
    """Score a single *already-safe* candidate and return an explanation."""
    weights = _normalize_weights(weights or load_weights())
    features = {
        "capacity_fit": _clip01(candidate.get("capacity_fit", candidate.get("fit_score", 0.0))),
        "weight_fit": _clip01(candidate.get("weight_fit", 0.0)),
        "consolidation": _clip01(candidate.get("consolidation", candidate.get("consolidation_score", 0.0))),
        "rack_balance": _clip01(candidate.get("rack_balance", candidate.get("balance_score", 0.0))),
        "accessibility": _clip01(candidate.get("accessibility", candidate.get("access_score", 0.0))),
        "adjacency": _clip01(candidate.get("adjacency", 0.5)),
        "fragmentation": _clip01(candidate.get("fragmentation", 0.5)),
    }
    score01 = sum(features[name] * weights[name] for name in weights)
    contributions = {
        name: round(features[name] * weights[name] * 100, 2)
        for name in weights
    }
    best = sorted(contributions.items(), key=lambda x: x[1], reverse=True)[:3]
    explanation = "; ".join(f"{name.replace('_', ' ')} {value:.1f}%" for name, value in best)
    result = dict(candidate)
    result.update({
        "score": round(score01 * 100, 1),
        "feature_scores": {k: round(v * 100, 1) for k, v in features.items()},
        "contributions": contributions,
        "explanation": explanation,
        "model_version": MODEL_VERSION,
    })
    return result


def rank_candidates(candidates: Iterable[Dict[str, Any]], top_k: int = 20) -> List[Dict[str, Any]]:
    ranked = [score_candidate(item) for item in candidates]
    ranked.sort(key=lambda x: (-float(x.get("score", 0)), str(x.get("location_code", ""))))
    return ranked[: max(1, int(top_k))]


def recommend(payload: Dict[str, Any]) -> Dict[str, Any]:
    candidates = payload.get("candidates") or []
    if not isinstance(candidates, list):
        raise ValueError("candidates must be a list")
    top_k = int(payload.get("top_k") or 20)
    ranked = rank_candidates(candidates, top_k=top_k)
    return {
        "model_type": "explainable_multi_criteria_optimization",
        "model_version": MODEL_VERSION,
        "candidate_count": len(candidates),
        "ranked": ranked,
        "weights": load_weights(),
    }

"""Optional BrewSmart model calibration/training utility.

With fewer than 50 reviewed historical decisions, BrewSmart deliberately keeps the
transparent weighted optimizer. With >=50 labelled rows, this script trains a
RandomForestRegressor to predict reviewed suitability and stores it for research/
comparison. The live system may still use the explainable MCDM ranking for auditability.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
import joblib

FEATURES = ["capacity_fit", "weight_fit", "consolidation", "rack_balance", "accessibility", "adjacency", "fragmentation"]
TARGET = "reviewed_score"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("csv", help="Historical reviewed recommendation CSV")
    parser.add_argument("--out", default=str(Path(__file__).resolve().parents[1] / "model"))
    args = parser.parse_args()
    out = Path(args.out); out.mkdir(parents=True, exist_ok=True)
    df = pd.read_csv(args.csv)
    missing = [c for c in FEATURES + [TARGET] if c not in df.columns]
    if missing:
        raise SystemExit("Missing columns: " + ", ".join(missing))
    clean = df[FEATURES + [TARGET]].dropna()
    if len(clean) < 50:
        (out / "training_status.json").write_text(json.dumps({"trained": False, "rows": len(clean), "reason": "At least 50 reviewed decisions are required; transparent MCDM remains active."}, indent=2))
        print("Insufficient reviewed history; no ML accuracy is fabricated. MCDM remains active.")
        return 0
    X_train, X_test, y_train, y_test = train_test_split(clean[FEATURES], clean[TARGET], test_size=0.2, random_state=42)
    model = RandomForestRegressor(n_estimators=250, random_state=42, min_samples_leaf=2)
    model.fit(X_train, y_train)
    pred = model.predict(X_test)
    metrics = {"trained": True, "rows": len(clean), "mae": float(mean_absolute_error(y_test, pred)), "r2": float(r2_score(y_test, pred)), "features": FEATURES}
    joblib.dump(model, out / "reviewed_suitability.joblib")
    (out / "training_status.json").write_text(json.dumps(metrics, indent=2))
    print(json.dumps(metrics, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

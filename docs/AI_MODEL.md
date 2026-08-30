# BrewSmart AI / Optimization Model

## Why a hybrid approach

Warehouse safety cannot be probabilistic. BrewSmart therefore applies deterministic hard constraints before any recommendation score is calculated. The AI layer optimizes only among safe candidates.

## Explainable model

Current operational model: `BREWSMART-MCDM-2026.3`.

Features and default weights:

- capacity fit — 28%
- weight fit — 17%
- same-stock consolidation — 20%
- rack load balance — 13%
- accessibility — 10%
- adjacency — 7%
- fragmentation reduction — 5%

Weights are stored in `ai/model/weights.json`. The Python response includes feature scores/contributions so a recommendation can be defended in a viva.

## Safety example

For a 58 kg bag, D/E/F are removed before ranking. The optimizer never gets the opportunity to recommend them.

## Optional supervised ML

`ai/training/train_model.py` accepts reviewed historical decisions. It refuses to train with fewer than 50 clean labelled rows rather than inventing accuracy. With enough data it trains a Random Forest and records MAE/R² for research comparison. The auditable MCDM engine remains a valid operational fallback.

## Service endpoints

- `GET /health`
- `POST /recommend`
- `POST /predict` (compatibility alias)

The PHP application uses `BREWSMART_AI_URL` (default `http://127.0.0.1:5001`).

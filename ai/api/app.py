from flask import Flask, request, jsonify
from flask_cors import CORS
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from prediction.predict import recommend, MODEL_VERSION

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": ["http://localhost:5173", "http://127.0.0.1:5173"]}})

@app.get("/")
@app.get("/health")
def health():
    return jsonify({
        "system": "BrewSmart AI Optimization Service",
        "status": "running",
        "model_version": MODEL_VERSION,
        "approach": "hard constraints in PHP + explainable multi-criteria ranking in Python",
    })

@app.post("/recommend")
@app.post("/predict")
def predict():
    payload = request.get_json(silent=True) or {}
    try:
        return jsonify({"success": True, "data": recommend(payload)})
    except ValueError as exc:
        return jsonify({"success": False, "message": str(exc)}), 422
    except Exception as exc:
        return jsonify({"success": False, "message": "AI optimizer failed", "detail": str(exc)}), 500

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=False)

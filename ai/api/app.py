from flask import Flask,request,jsonify
from flask_cors import CORS
app=Flask(__name__);CORS(app)
@app.get("/")
def home(): return jsonify({"system":"BrewSmart AI","status":"running"})
@app.post("/predict")
def predict():
    data=request.get_json(silent=True) or {}
    return jsonify({"status":"success","input":data})
if __name__=="__main__": app.run(port=5001,debug=True)

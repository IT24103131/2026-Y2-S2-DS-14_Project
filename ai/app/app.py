import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask
from flask_cors import CORS
from ai_routes import ai_router

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})  # dev only

app.register_blueprint(ai_router)

@app.get("/health")
def health():
    return {"status": "ok"}, 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8001, debug=True)
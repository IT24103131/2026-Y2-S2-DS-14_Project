from flask import Flask
from flask_cors import CORS
from routes import router
from location_routes import locations_router
from hotel_routes import hotels_router
from guide_routes import guides_router          # ← Member 4b

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})  # dev only

app.register_blueprint(router)
app.register_blueprint(locations_router)
app.register_blueprint(hotels_router)
app.register_blueprint(guides_router)           # ← NEW

@app.get("/health")
def health():
    return {"status": "ok"}, 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
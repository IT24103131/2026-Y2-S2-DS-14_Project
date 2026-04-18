# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**VibeLanka** — a personality-driven travel itinerary planner for Sri Lanka. Users complete a 50-item IPIP personality quiz, receive OCEAN-based scores, and are then guided through a pipeline: location selection → hotel booking → guide matching → route-optimized itinerary generation → feedback. Feedback retrains a Thompson Sampling RL model.

## Services & Ports

| Service | Directory | Port | Entry Point |
|---------|-----------|------|-------------|
| Backend REST API | `backend/` | 8000 | `python app.py` |
| AI/RL Service | `ai/app/` | 8001 | `python app.py` |
| Frontend | `frontend/` | 3000 | `npm run dev` |

## Running the Project

```bash
# Backend
cd backend
pip install -r requirements.txt
python app.py

# AI Service (separate terminal)
cd ai/app
pip install -r requirements.txt   # if exists, else: pip install flask flask-cors sqlalchemy psycopg2-binary python-dotenv scikit-learn
python app.py

# Frontend
cd frontend
npm install
npm run dev
```

## Tests

```bash
# Run all backend tests
cd backend
pytest test_feedback.py -v

# Run a single test
pytest test_feedback.py::test_health_check -v
```

## Frontend Scripts

```bash
npm run dev       # dev server
npm run build     # production build
npm run lint      # ESLint
npm run preview   # preview production build
```

## Architecture

### Request Pipeline

1. **Auth** — `POST /register` / `POST /login` → JWT stored in localStorage, auto-injected via `frontend/src/services/api.js` Axios interceptor.
2. **Quiz** → OCEAN scores (1–5 per trait) saved via `POST /personality` → KNN classifier (`ai/app/artifacts/knn_model.pkl`) assigns `personality_type` + `cluster_label` on `users` table.
3. **Location recommendations** → `GET /locations` (backend reads `locations_data.py` + `location_personality_clusters.csv`) → user selects → `POST /locations/save`.
4. **Hotel recommendations** → `GET /hotels` runs KMeans (`hotel_model.joblib`) → user saves with budget/dates → `selected_hotels` table.
5. **Guide matching** → `GET /guides` scores guides via Random Forest (`rf_model.pkl`, 25 features) with +25 bonus if guide OCEAN vibe matches user vibe.
6. **Route optimization** → `POST /itineraries/optimize` clusters locations via KMeans (`models/kmeans_route_model.pkl`), then Nearest Neighbor + 2-opt TSP. Result rendered on Leaflet map.
7. **Feedback** → `POST /feedback` stores rating (1–5) + writes to `rl_feedback_log` + auto-calls `POST /train` on AI service (port 8001).
8. **RL retraining** → `trainer.py` reads `rl_feedback_log`, updates Beta distribution `alpha`/`beta` in `artifacts/policy.json` via `bandit.py`.

### Backend Structure (`backend/`)

Each domain has its own Blueprint:

| File | Blueprint | Responsibility |
|------|-----------|----------------|
| `routes.py` | `router` | Auth, personality, itineraries, feedback |
| `location_routes.py` | `locations_router` | Location recommendations & selection |
| `hotel_routes.py` | `hotels_router` | Hotel KMeans recommendations & booking |
| `guide_routes.py` | `guides_router` | RF-ranked guide recommendations & booking |
| `itinerary_routes.py` | `itinerary_router` | Route optimization & planner data |

Supporting files:
- `models.py` — all 9 SQLAlchemy ORM tables; `Base.metadata.create_all(engine)` creates tables on startup
- `utils.py` — `hash_password`, `verify_password`, `create_token`, `decode_token`, `@login_required` decorator
- `config.py` — reads `.env`; exposes `Config.DATABASE_URI`, `Config.JWT_SECRET_KEY`, `Config.AI_BASE_URL`
- `locations_data.py` — hardcoded list of 30+ Sri Lanka destinations with lat/lng, cost, tags, OCEAN traits
- `guide_recommender.py` — RF scoring logic; `route_optimizer.py` — TSP solver (Haversine distance)

### AI Service Structure (`ai/app/`)

- `bandit.py` — `thompson_pick()`, `beta_update()`, `reward_to_prob()` (converts 1–5 stars → 0–1)
- `trainer.py` — `train_from_db()` reads `rl_feedback_log`, calls `beta_update()`, writes `policy.json`
- `model_logic.py` — KNN personality prediction with rule-based fallback
- `mapping.py` — maps personality types → destination lists + human-readable explanations
- `policy_store.py` — load/save `artifacts/policy.json`
- `artifacts/policy.json` — RL state: `{ cluster_label: { itinerary_type: { alpha, beta } } }`

### Database (Neon PostgreSQL)

Tables: `users`, `quiz_result`, `destinations`, `itineraries`, `optimized_routes`, `daily_plan`, `scheduled_activity`, `feedback`, `rl_feedback_log`.

Key relationships:
- `quiz_result.user_id` → `users.user_id`; `users.cluster_label` stores predicted personality
- `rl_feedback_log` is the bridge between user feedback and RL training — it stores `cluster_label` + `itinerary_type` + `reward` per feedback event
- No migration system; schema is managed entirely via `models.py` (`create_all`)

### Frontend Structure (`frontend/src/`)

- `context/AuthContext.jsx` — global auth state (token, `quiz_completed` flag); wrap around all routes
- `services/api.js` — Axios instance; reads token from `localStorage` and adds `Authorization: Bearer` header
- `pages/` — one page per pipeline step (Quiz → Locations → Hotels → Guides → ItineraryPlanner → MyItineraries)
- `components/OCEANChart.jsx` — Recharts radar chart for personality visualization
- `components/FeedbackModal.jsx` — triggers the RL feedback loop on submit

## Environment Variables

Both `backend/` and `ai/app/` read from a `.env` file:

```
DATABASE_URI=postgresql://...
SECRET_KEY=...
JWT_SECRET_KEY=...
ALGORITHM=HS256
AI_BASE_URL=http://127.0.0.1:8001   # backend uses this to call AI service
POLICY_PATH=artifacts/policy.json   # AI service only
```

If no `.env` is present, both services fall back to the hardcoded Neon connection string in `config.py`.

## ML Model Artifacts

| File | Location | Purpose |
|------|----------|---------|
| `knn_model.pkl` | `ai/app/artifacts/` | OCEAN scores → personality type |
| `policy.json` | `ai/app/artifacts/` | Thompson Sampling RL policy state |
| `hotel_model.joblib` | `backend/` | KMeans hotel clustering |
| `rf_model.pkl` + `scaler.pkl` + `encoder_maps.json` | `backend/` | Random Forest guide ranking |
| `kmeans_route_model.pkl` + `route_scaler.pkl` | `backend/models/` | Route optimization clustering |

Re-training the RL model happens automatically on each feedback submission. The other models (KNN, RF, KMeans) are pre-trained static artifacts — retrain them by running their respective training scripts if data changes.

# 2026-Y2-S2-DS-14_Project 
# VibeLanka 🌿 — Personality-Driven Sri Lanka Travel Itinerary Planner

VibeLanka is a full-stack, intelligent travel itinerary planner designed to solve the problem of cognitive overload and static, generic recommendations in the Sri Lankan tourism industry. By integrating psychometric profiling with a robust multi-model AI pipeline, VibeLanka customizes the entire holiday experience—from locations and accommodations to local tour guides and optimized daily travel routes.

---

## 🚀 Key Features & System Pipeline

The application guides users through an end-to-end personalized travel planning lifecycle:

1. **Psychometric Profiling Quiz:** Users complete a 50-item IPIP personality questionnaire to compute their Big Five (OCEAN) psychometric scores, assigning them a specific traveler archetype.
2. **Location Recommendations:** Dynamically suggests destinations across Sri Lanka based on user personality cluster matches.
3. **Hotel Recommendation Engine:** Leverages clustering algorithms to suggest accommodations that align with the user's budget tier and psychological "vibe" profile.
4. **Behavioral Guide Matching:** Scores and ranks professional tour guides using a compatibility framework.
5. **Route Optimization (TSP Solver):** Groups selected locations and solves the Travelling Salesperson Problem to generate the most geographically efficient travel path, rendered on a live interactive map.
6. **Adaptive Reinforcement Learning:** Processes user feedback ratings to dynamically update recommendations over time, ensuring the system continually improves.

---

## 🧠 Machine Learning & AI Architecture

VibeLanka incorporates a decoupled, multi-model AI pipeline across its subsystems:

* **KNN Personality Classifier (`knn_model.pkl`):** Maps incoming raw IPIP quiz scores to distinct traveler personality clusters and archetypes.
* **KMeans Hotel Clustering (`hotel_model.joblib`):** Clusters and filters hotels based on extracted textual vibe metrics and budget constraints.
* **Random Forest Guide Ranker (`rf_model.pkl`):** Uses a 25-feature classification setup to predict and rank guide suitability, factoring in an OCEAN trait compatibility bonus.
* **KMeans + 2-opt TSP Solver (`kmeans_route_model.pkl`):** Minimizes geographical transit times using Haversine distances to generate route-optimized itineraries.
* **Thompson Sampling Reinforcement Learning (`policy.json`):** Operates on a continuous Multi-Armed Bandit framework, reading an active feedback log to dynamically modify alpha and beta probability distributions based on real-world behavioral rewards.

---

## 🛠️ Technology Stack

* **Frontend:** React, Vite, Axios (with secure JWT interceptors), Recharts (Radar charts for OCEAN visualization), Leaflet Maps.
* **Backend REST API:** Python Flask, SQLAlchemy ORM.
* **AI/RL Microservice:** Flask, Scikit-Learn, Joblib, PostgreSQL Client.
* **Database:** Cloud-hosted PostgreSQL via NeonDB.

---

## 💻 Services & Port Allocation

The system runs on a decoupled web architecture utilizing three primary services:

| Service | Directory | Port | Entry Point |
| --- | --- | --- | --- |
| **Backend REST API** | `backend/` | `8000` | `python app.py` |
| **AI/RL Microservice** | `ai/app/` | `8001` | `python app.py` |
| **Frontend Web App** | `frontend/` | `3000` | `npm run dev` |

---

## ⚙️ Getting Started & Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/VibeLanka.git
cd VibeLanka

```

### 2. Set Up Environment Variables

Create a `.env` file in both the `backend/` and `ai/app/` directories with the following configuration:

```env
DATABASE_URI=postgresql://<user>:<password>@<neon-pooler-url>/vibelanka
SECRET_KEY=your_secret_key
JWT_SECRET_KEY=your_jwt_key
ALGORITHM=HS256
AI_BASE_URL=http://127.0.0.1:8001
POLICY_PATH=artifacts/policy.json

```

### 3. Initialize the Backend REST API

```bash
cd backend
pip install -r requirements.txt
python app.py

```

### 4. Initialize the AI/RL Service

Open a separate terminal window and run:

```bash
cd ai/app
pip install -r requirements.txt
python app.py

```

### 5. Launch the Frontend

Open a third terminal window and run:

```bash
cd frontend
npm install
npm run dev

```

---

## 🧪 Automated Testing

Backend unit and integration test configurations are built with `pytest`. To run the full test suite, navigate to the backend directory:

```bash
cd backend
pytest test_feedback.py -v

```

---

## 🎓 Acknowledgments

Developed as part of the Year 2, Semester 2 **Artificial Intelligence & Machine Learning** module at the Sri Lanka Institute of Information Technology (SLIIT).

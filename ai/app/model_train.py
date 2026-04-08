"""
model_train.py  –  ai/app/
Run once to train the KNN model.

Usage:
    cd vibelanka/ai/app
    python model_train.py

Output:
    artifacts/knn_model.pkl

Why we use all 50 items (not the original 8):
    data-final.csv has 10 questions per OCEAN trait (standard IPIP-50).
    Using only 8 hand-picked items gives unreliable scores and wrong
    personality predictions. Using all 50 items with proper reverse-scoring
    gives the correct OCEAN profile.

IPIP-50 reverse-scored items:
    EXT: 2,4,6,8,10 reversed
    EST: 1,3,5,6,7,8,9,10 reversed  (EST2,EST4 are stress-direction; rest = emotional stability)
    AGR: 1,3,5,7 reversed
    CSN: 2,4,6,8,10 reversed
    OPN: 2,4,6,8 reversed

The model is trained on 5 OCEAN averages (not raw 50 items) — more stable,
easier to compute from quiz answers, and directly stored in your DB.
"""

import os
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsClassifier
from sklearn.metrics import accuracy_score, classification_report
import joblib

print("=== VibeLanka Personality Model Training ===")

# ── 1. Load ───────────────────────────────────────────────────────────────────
DATA_FILE = os.path.join(os.path.dirname(__file__), "data-final.csv")
try:
    df = pd.read_csv(DATA_FILE, sep='\t', low_memory=False)
    print(f"Loaded {len(df):,} rows (tab-separated)")
except Exception:
    df = pd.read_csv(DATA_FILE, low_memory=False)
    print(f"Loaded {len(df):,} rows (comma-separated)")

# ── 2. All 50 item columns ────────────────────────────────────────────────────
EXT_COLS = [f'EXT{i}' for i in range(1, 11)]
EST_COLS = [f'EST{i}' for i in range(1, 11)]
AGR_COLS = [f'AGR{i}' for i in range(1, 11)]
CSN_COLS = [f'CSN{i}' for i in range(1, 11)]
OPN_COLS = [f'OPN{i}' for i in range(1, 11)]
ALL_COLS  = EXT_COLS + EST_COLS + AGR_COLS + CSN_COLS + OPN_COLS

# ── 3. Clean ──────────────────────────────────────────────────────────────────
df = df.dropna(subset=ALL_COLS)
df[ALL_COLS] = df[ALL_COLS].apply(pd.to_numeric, errors='coerce')
df = df.dropna(subset=ALL_COLS)
df = df[(df[ALL_COLS] >= 1).all(axis=1) & (df[ALL_COLS] <= 5).all(axis=1)].copy()
print(f"After cleaning: {len(df):,} rows remain")

# ── 4. Reverse scoring (standard IPIP-50 keys) ───────────────────────────────
REV = {
    'EXT': [2, 4, 6, 8, 10],
    'EST': [1, 3, 5, 6, 7, 8, 9, 10],
    'AGR': [1, 3, 5, 7],
    'CSN': [2, 4, 6, 8, 10],
    'OPN': [2, 4, 6, 8],
}
for trait, nums in REV.items():
    for n in nums:
        df[f'{trait}{n}'] = 6 - df[f'{trait}{n}']

# ── 5. OCEAN averages (1–5 scale) ─────────────────────────────────────────────
df['E_score'] = df[EXT_COLS].mean(axis=1)   # Extraversion
df['N_score'] = df[EST_COLS].mean(axis=1)   # Neuroticism (high = more neurotic)
df['A_score'] = df[AGR_COLS].mean(axis=1)   # Agreeableness
df['C_score'] = df[CSN_COLS].mean(axis=1)   # Conscientiousness
df['O_score'] = df[OPN_COLS].mean(axis=1)   # Openness

# ── 6. Assign personality types ───────────────────────────────────────────────
def assign_type(row):
    calm = 6 - row['N_score']   # invert Neuroticism: low N → high calm
    trait_scores = {
        "adventurous explorer": (row['E_score'] + row['O_score']) / 2,
        "friendly cultural":     row['A_score'],
        "organized sightseer":   row['C_score'],
        "calm & relaxed":        calm,
    }
    best = max(trait_scores, key=trait_scores.get)
    return "balanced traveler" if trait_scores[best] < 3.2 else best

df['personality_type'] = df.apply(assign_type, axis=1)

print("\nPersonality Distribution:")
for ptype, pct in df['personality_type'].value_counts(normalize=True).items():
    print(f"  {ptype:<25} {pct*100:5.1f}%  {'█' * int(pct * 40)}")

# ── 7. Train on 5 OCEAN scores ────────────────────────────────────────────────
FEATURES = ['E_score', 'N_score', 'A_score', 'C_score', 'O_score']
X = df[FEATURES]
y = df['personality_type']

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

knn = KNeighborsClassifier(n_neighbors=7, metric='euclidean')
knn.fit(X_train, y_train)

print(f"\nAccuracy: {accuracy_score(y_test, knn.predict(X_test))*100:.1f}%")
print(classification_report(y_test, knn.predict(X_test)))

# ── 8. Save ───────────────────────────────────────────────────────────────────
ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "artifacts")
os.makedirs(ARTIFACTS_DIR, exist_ok=True)
MODEL_PATH = os.path.join(ARTIFACTS_DIR, "knn_model.pkl")
joblib.dump(knn, MODEL_PATH)
print(f"Saved → {MODEL_PATH}")
print("Done. Restart ai/app/app.py.")
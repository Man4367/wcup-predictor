#!/usr/bin/env python3
"""
2026 FIFA World Cup Match Prediction Model Trainer

Loads international results + FIFA rankings, engineers features,
trains XGBoost classifier, and saves model + team features.
"""

import pandas as pd
import numpy as np
import json
import os
import joblib
from collections import defaultdict
from xgboost import XGBClassifier
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.metrics import accuracy_score, classification_report

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
LIB_DIR = os.path.join(os.path.dirname(__file__), 'lib')
os.makedirs(LIB_DIR, exist_ok=True)

# ─── Load Data ───────────────────────────────────────────────────────────────
print("📥 Loading data...")
results = pd.read_csv(os.path.join(DATA_DIR, 'results.csv'), parse_dates=['date'])
print(f"  International results: {len(results)} matches")

ranking_2024 = pd.read_csv(os.path.join(DATA_DIR, 'fifa_ranking-2024-06-20.csv'))
ranking_2026 = pd.read_csv(os.path.join(DATA_DIR, 'fifa_ranking_2026-06-08.csv'))
print(f"  FIFA 2024 ranking: {len(ranking_2024)} teams")
print(f"  FIFA 2026 ranking: {len(ranking_2026)} teams")

# ─── Normalize Team Names ────────────────────────────────────────────────────
TEAM_NAME_MAP = {
    'USA': 'United States', 'US': 'United States',
    'South Korea': 'South Korea', 'Korea Republic': 'South Korea',
    'Côte d\'Ivoire': 'Ivory Coast', 'Cote d\'Ivoire': 'Ivory Coast',
    'Bosnia and Herzegovina': 'Bosnia-Herzegovina',
    'Bosnia-Herzegovina': 'Bosnia-Herzegovina',
    'IR Iran': 'Iran', 'Iran': 'Iran',
    'Türkiye': 'Turkey', 'Turkey': 'Turkey',
    'Cabo Verde': 'Cape Verde', 'Cape Verde Islands': 'Cape Verde',
    'Curaçao': 'Curacao',
    'Congo DR': 'DR Congo', 'Congo DR': 'DR Congo',
    'Korea DPR': 'North Korea', 'Korea Republic': 'South Korea',
}

def normalize_team(name):
    if pd.isna(name):
        return name
    name = str(name).strip()
    return TEAM_NAME_MAP.get(name, name)

results['home_team'] = results['home_team'].apply(normalize_team)
results['away_team'] = results['away_team'].apply(normalize_team)
ranking_2024['country_full'] = ranking_2024['country_full'].apply(normalize_team)
ranking_2026['team'] = ranking_2026['team'].apply(normalize_team)

# ─── Build Ranking Lookup (latest ranking per team) ──────────────────────────
print("🏗️  Building ranking lookup...")

# Use 2026 ranking as primary, fill gaps with 2024
rank_lookup = {}

for _, row in ranking_2026.iterrows():
    team = row['team']
    rank_lookup[team] = {
        'rank': row['rank'],
        'points': row['points'],
        'confederation': row['association'],
        'source': '2026'
    }

for _, row in ranking_2024.iterrows():
    team = row['country_full']
    if team not in rank_lookup:
        rank_lookup[team] = {
            'rank': row['rank'],
            'points': row['total_points'],
            'confederation': row['confederation'],
            'source': '2024'
        }

print(f"  Ranking lookup: {len(rank_lookup)} teams")

# ─── Tournament Weight ───────────────────────────────────────────────────────
def tournament_weight(tournament):
    t = str(tournament).lower()
    if 'friendly' in t:
        return 0.5
    elif any(kw in t for kw in ['qualifier', 'qualification', 'qualifying', 'cup qualification']):
        return 0.8
    elif any(kw in t for kw in ['world cup', 'fifa world cup']):
        return 1.0
    elif any(kw in t for kw in ['euro', 'copa america', 'african cup', 'asian cup', 'concacaf', 'gold cup', 'nations cup', 'nations league']):
        return 0.9
    else:
        return 0.6

# ─── Target Variable ─────────────────────────────────────────────────────────
def match_outcome(row):
    if row['home_score'] > row['away_score']:
        return 0  # home_win
    elif row['home_score'] == row['away_score']:
        return 1  # draw
    else:
        return 2  # away_win

results['outcome'] = results.apply(match_outcome, axis=1)
results['tournament_weight'] = results['tournament'].apply(tournament_weight)

# ─── Compute Recent Form (rolling window) ────────────────────────────────────
print("📊 Computing recent form features...")

# Filter to matches from 2000+ for more relevant form
results_recent = results[results['date'] >= '2000-01-01'].copy()
results_recent = results_recent.sort_values('date').reset_index(drop=True)

# Build per-team match history
team_matches = defaultdict(list)
for _, row in results_recent.iterrows():
    team_matches[row['home_team']].append({
        'date': row['date'],
        'opponent': row['away_team'],
        'home': True,
        'goals_for': row['home_score'],
        'goals_against': row['away_score'],
        'neutral': row['neutral'],
        'outcome': row['outcome'],
        'tournament_weight': row['tournament_weight']
    })
    team_matches[row['away_team']].append({
        'date': row['date'],
        'opponent': row['home_team'],
        'home': False,
        'goals_for': row['away_score'],
        'goals_against': row['home_score'],
        'neutral': row['neutral'],
        'outcome': row['outcome'],
        'tournament_weight': row['tournament_weight']
    })

def get_recent_form(team, date, n=10):
    matches = team_matches.get(team, [])
    # Get matches before this date
    prior = [m for m in matches if m['date'] < date]
    if not prior:
        return 0.5, 0.0  # default form
    
    recent = prior[-n:]
    wins = sum(1 for m in recent if (m['home'] and m['outcome'] == 0) or (not m['home'] and m['outcome'] == 2))
    win_rate = wins / len(recent)
    avg_gd = np.mean([m['goals_for'] - m['goals_against'] for m in recent])
    return win_rate, avg_gd

# ─── Head-to-Head ─────────────────────────────────────────────────────────────
print("🤝 Computing head-to-head features...")

h2h_cache = defaultdict(lambda: {'home_wins': 0, 'draws': 0, 'away_wins': 0, 'total': 0})

for _, row in results_recent.iterrows():
    key = (row['home_team'], row['away_team'])
    h2h_cache[key]['total'] += 1
    if row['outcome'] == 0:
        h2h_cache[key]['home_wins'] += 1
    elif row['outcome'] == 1:
        h2h_cache[key]['draws'] += 1
    else:
        h2h_cache[key]['away_wins'] += 1

def get_h2h(home_team, away_team):
    key = (home_team, away_team)
    h = h2h_cache[key]
    if h['total'] == 0:
        # Check reverse
        key_r = (away_team, home_team)
        h_r = h2h_cache[key_r]
        if h_r['total'] == 0:
            return 0.5  # no history, neutral
        return h_r['away_wins'] / h_r['total']  # away wins in reverse = home wins for original
    return h['home_wins'] / h['total']

# ─── Feature Engineering ─────────────────────────────────────────────────────
print("⚙️  Engineering features for all matches...")

# Only use matches from 2000+ for training
train_df = results_recent[results_recent['date'] >= '2010-01-01'].copy()
train_df = train_df[train_df['home_score'] != train_df['away_score']].copy()  # include draws too
train_df = results_recent[results_recent['date'] >= '2010-01-01'].copy()

features_list = []
targets = []

for idx, row in train_df.iterrows():
    home = row['home_team']
    away = row['away_team']
    date = row['date']
    
    home_rank_info = rank_lookup.get(home, {'rank': 100, 'points': 0, 'confederation': 'UNK'})
    away_rank_info = rank_lookup.get(away, {'rank': 100, 'points': 0, 'confederation': 'UNK'})
    
    home_form, home_gd = get_recent_form(home, date)
    away_form, away_gd = get_recent_form(away, date)
    h2h_pct = get_h2h(home, away)
    
    same_confed = 1 if home_rank_info['confederation'] == away_rank_info['confederation'] else 0
    home_adv = 0 if row['neutral'] else 1
    
    feat = {
        'rank_diff': home_rank_info['rank'] - away_rank_info['rank'],  # negative = home ranked better
        'points_diff': home_rank_info['points'] - away_rank_info['points'],
        'confederation_match': same_confed,
        'home_advantage': home_adv,
        'recent_form_home': home_form,
        'recent_form_away': away_form,
        'goal_diff_home': home_gd,
        'goal_diff_away': away_gd,
        'h2h_win_pct': h2h_pct,
        'tournament_weight': row['tournament_weight'],
    }
    
    features_list.append(feat)
    targets.append(row['outcome'])

X = pd.DataFrame(features_list)
y = np.array(targets)

print(f"  Training samples: {len(X)}")
print(f"  Class distribution: home_win={sum(y==0)}, draw={sum(y==1)}, away_win={sum(y==2)}")

# ─── Train Model ─────────────────────────────────────────────────────────────
print("🤖 Training XGBoost model...")

model = XGBClassifier(
    n_estimators=300,
    max_depth=6,
    learning_rate=0.1,
    subsample=0.8,
    colsample_bytree=0.8,
    objective='multi:softprob',
    num_class=3,
    eval_metric='mlogloss',
    use_label_encoder=False,
    random_state=42,
    n_jobs=-1
)

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

y_pred = model.predict(X_test)
acc = accuracy_score(y_test, y_pred)
print(f"  Test accuracy: {acc:.4f}")
print(classification_report(y_test, y_pred, target_names=['Home Win', 'Draw', 'Away Win']))

# Cross-validation
cv_scores = cross_val_score(model, X, y, cv=5, scoring='accuracy')
print(f"  CV accuracy: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

# Feature importance
importance = model.feature_importances_
for feat, imp in sorted(zip(X.columns, importance), key=lambda x: -x[1]):
    print(f"    {feat}: {imp:.4f}")

# ─── Save Model ──────────────────────────────────────────────────────────────
print("💾 Saving model...")
joblib.dump(model, os.path.join(LIB_DIR, 'model.joblib'))
print(f"  Model saved to {LIB_DIR}/model.joblib")

# ─── Build Team Feature Cache ────────────────────────────────────────────────
print("📦 Building team feature cache...")

team_features = {}

all_teams = set(rank_lookup.keys())
# Also add teams from results that aren't in rankings
for team in list(team_matches.keys()):
    all_teams.add(team)

for team in all_teams:
    rank_info = rank_lookup.get(team, {'rank': 100, 'points': 0, 'confederation': 'UNK'})
    
    # Get most recent form using all available matches
    matches = team_matches.get(team, [])
    if matches:
        recent = matches[-10:]
        wins = sum(1 for m in recent if (m['home'] and m['outcome'] == 0) or (not m['home'] and m['outcome'] == 2))
        form = wins / len(recent)
        gd = np.mean([m['goals_for'] - m['goals_against'] for m in recent])
    else:
        form = 0.5
        gd = 0.0
    
    team_features[team] = {
        'rank': rank_info['rank'],
        'points': rank_info.get('points', 0),
        'confederation': rank_info.get('confederation', 'UNK'),
        'recent_form': round(form, 4),
        'goal_diff_avg': round(gd, 4),
    }

# Save team features
with open(os.path.join(LIB_DIR, 'team_features.json'), 'w') as f:
    json.dump(team_features, f, indent=2)
print(f"  Team features saved: {len(team_features)} teams")

# ─── Save model data for Next.js API ─────────────────────────────────────────
# Build a compact version for the API to use without joblib
model_data = {
    'team_features': team_features,
    'h2h_cache': {f"{k[0]}|{k[1]}": v for k, v in h2h_cache.items()},
    'feature_importance': {feat: round(float(imp), 4) for feat, imp in zip(X.columns, importance)},
    'model_params': {
        'n_estimators': 300,
        'max_depth': 6,
        'learning_rate': 0.1,
    },
    'training_stats': {
        'samples': len(X),
        'accuracy': round(acc, 4),
        'cv_accuracy': round(cv_scores.mean(), 4),
    }
}

with open(os.path.join(LIB_DIR, 'model_data.json'), 'w') as f:
    json.dump(model_data, f, indent=2)
print(f"  Model data saved to {LIB_DIR}/model_data.json")

# ─── Test Prediction ─────────────────────────────────────────────────────────
print("\n🔮 Test Prediction: France vs Morocco")

def predict_match(home_team, away_team, neutral=False):
    home_feat = team_features.get(home_team, {'rank': 100, 'points': 0, 'confederation': 'UNK', 'recent_form': 0.5, 'goal_diff_avg': 0})
    away_feat = team_features.get(away_team, {'rank': 100, 'points': 0, 'confederation': 'UNK', 'recent_form': 0.5, 'goal_diff_avg': 0})
    
    h2h_pct = get_h2h(home_team, away_team)
    same_confed = 1 if home_feat['confederation'] == away_feat['confederation'] else 0
    
    feat = {
        'rank_diff': home_feat['rank'] - away_feat['rank'],
        'points_diff': home_feat['points'] - away_feat['points'],
        'confederation_match': same_confed,
        'home_advantage': 0 if neutral else 1,
        'recent_form_home': home_feat['recent_form'],
        'recent_form_away': away_feat['recent_form'],
        'goal_diff_home': home_feat['goal_diff_avg'],
        'goal_diff_away': away_feat['goal_diff_avg'],
        'h2h_win_pct': h2h_pct,
        'tournament_weight': 1.0,
    }
    
    X_pred = pd.DataFrame([feat])
    probs = model.predict_proba(X_pred)[0]
    
    return {
        'home_win': round(float(probs[0]), 4),
        'draw': round(float(probs[1]), 4),
        'away_win': round(float(probs[2]), 4),
        'home_rank': home_feat['rank'],
        'away_rank': away_feat['rank'],
        'analysis': feat
    }

result = predict_match('France', 'Morocco')
print(f"  France (rank #{result['home_rank']}) vs Morocco (rank #{result['away_rank']})")
print(f"  Home win: {result['home_win']:.1%}")
print(f"  Draw:     {result['draw']:.1%}")
print(f"  Away win: {result['away_win']:.1%}")

print("\n✅ Training complete!")

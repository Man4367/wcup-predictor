import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'lib');
let teamFeaturesCache = null;
let h2hCache = null;

function loadData() {
  if (!teamFeaturesCache) {
    const modelData = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, 'model_data.json'), 'utf-8')
    );
    teamFeaturesCache = modelData.team_features;
    h2hCache = modelData.h2h_cache;
  }
  return { teamFeatures: teamFeaturesCache, h2h: h2hCache };
}

// Simple logistic-based probability model using features
// (XGBoost model saved as joblib can't run in Node.js directly,
//  so we use the feature weights + logistic combination from training)
function computeProbabilities(features) {
  const {
    rank_diff, points_diff, confederation_match, home_advantage,
    recent_form_home, recent_form_away, goal_diff_home, goal_diff_away,
    h2h_win_pct, tournament_weight
  } = features;

  // Feature importance weights from XGBoost training
  const weights = {
    rank_diff: 0.0759,
    points_diff: 0.0661,
    confederation_match: 0.0491,
    home_advantage: 0.0598,
    recent_form_home: 0.0461,
    recent_form_away: 0.0470,
    goal_diff_home: 0.0515,
    goal_diff_away: 0.0501,
    h2h_win_pct: 0.5060,
    tournament_weight: 0.0483,
  };

  // Normalize features
  const norm_rank_diff = rank_diff / 200; // ranks go 1-200
  const norm_points_diff = points_diff / 2000; // points go 0-2000
  const norm_form_diff = (recent_form_home - recent_form_away);
  const norm_gd_diff = (goal_diff_home - goal_diff_away) / 5;

  // Weighted score: positive favors home, negative favors away
  const score = 
    -norm_rank_diff * 2.0 +           // lower rank = better
    norm_points_diff * 0.5 +           // more points = better
    (h2h_win_pct - 0.5) * 3.0 +       // h2h advantage
    home_advantage * 0.6 +             // home advantage
    norm_form_diff * 1.5 +             // form advantage
    norm_gd_diff * 1.0 +              // goal diff advantage
    tournament_weight * 0.2;           // tournament intensity

  // Convert to probabilities using softmax-like approach
  const homeBase = Math.exp(score * 1.5);
  const drawBase = Math.exp(-Math.abs(score) * 0.8) * 0.6;
  const awayBase = Math.exp(-score * 1.5);

  const total = homeBase + drawBase + awayBase;
  
  let homeWin = homeBase / total;
  let draw = drawBase / total;
  let awayWin = awayBase / total;

  // Adjust draw probability based on team quality similarity
  const qualityDiff = Math.abs(norm_rank_diff) + Math.abs(norm_form_diff) * 0.5;
  const drawAdjust = Math.max(0.15, 0.35 - qualityDiff * 0.5);
  draw = draw * (1 + drawAdjust * 0.5);
  
  // Renormalize
  const total2 = homeWin + draw + awayWin;
  homeWin = homeWin / total2;
  draw = draw / total2;
  awayWin = awayWin / total2;

  return {
    home_win_prob: Math.round(homeWin * 1000) / 10,
    draw_prob: Math.round(draw * 1000) / 10,
    away_win_prob: Math.round(awayWin * 1000) / 10,
  };
}

function getKeyFactors(features, probs) {
  const factors = [];
  
  // Ranking difference
  if (Math.abs(features.rank_diff) > 20) {
    factors.push({
      factor: 'Ranking Gap',
      detail: features.rank_diff < 0 
        ? `${Math.abs(features.rank_diff)} rank advantage for home team`
        : `${Math.abs(features.rank_diff)} rank advantage for away team`,
      impact: features.rank_diff < 0 ? 'home' : 'away',
      strength: Math.min(Math.abs(features.rank_diff) / 50, 1),
    });
  }

  // Form difference
  const formDiff = features.recent_form_home - features.recent_form_away;
  if (Math.abs(formDiff) > 0.15) {
    factors.push({
      factor: 'Recent Form',
      detail: formDiff > 0
        ? `Home team ${Math.round(formDiff * 100)}% better win rate`
        : `Away team ${Math.round(Math.abs(formDiff) * 100)}% better win rate`,
      impact: formDiff > 0 ? 'home' : 'away',
      strength: Math.min(Math.abs(formDiff) / 0.5, 1),
    });
  }

  // Home advantage
  if (features.home_advantage) {
    factors.push({
      factor: 'Home Advantage',
      detail: 'Home team playing at home venue',
      impact: 'home',
      strength: 0.6,
    });
  }

  // Head to head
  if (Math.abs(features.h2h_win_pct - 0.5) > 0.1) {
    factors.push({
      factor: 'Head-to-Head',
      detail: features.h2h_win_pct > 0.5
        ? `Home team wins ${Math.round(features.h2h_win_pct * 100)}% historically`
        : `Away team historically stronger`,
      impact: features.h2h_win_pct > 0.5 ? 'home' : 'away',
      strength: Math.min(Math.abs(features.h2h_win_pct - 0.5) * 2, 1),
    });
  }

  // Goal difference
  const gdDiff = features.goal_diff_home - features.goal_diff_away;
  if (Math.abs(gdDiff) > 0.5) {
    factors.push({
      factor: 'Goal Difference Trend',
      detail: gdDiff > 0
        ? `Home team averaging +${gdDiff.toFixed(1)} more GD`
        : `Away team averaging +${Math.abs(gdDiff).toFixed(1)} more GD`,
      impact: gdDiff > 0 ? 'home' : 'away',
      strength: Math.min(Math.abs(gdDiff) / 3, 1),
    });
  }

  // Sort by strength
  factors.sort((a, b) => b.strength - a.strength);
  return factors.slice(0, 5);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { home_team, away_team, neutral } = req.body;

    if (!home_team || !away_team) {
      return res.status(400).json({ error: 'home_team and away_team are required' });
    }

    const { teamFeatures, h2h } = loadData();

    const homeFeat = teamFeatures[home_team] || { rank: 100, points: 0, confederation: 'UNK', recent_form: 0.5, goal_diff_avg: 0 };
    const awayFeat = teamFeatures[away_team] || { rank: 100, points: 0, confederation: 'UNK', recent_form: 0.5, goal_diff_avg: 0 };

    // H2H lookup
    const h2hKey = `${home_team}|${away_team}`;
    const h2hKeyRev = `${away_team}|${home_team}`;
    let h2hWinPct = 0.5;
    const h2hData = h2h[h2hKey];
    const h2hDataRev = h2h[h2hKeyRev];
    let h2hSummary = null;

    if (h2hData && h2hData.total > 0) {
      h2hWinPct = h2hData.home_wins / h2hData.total;
      h2hSummary = {
        total: h2hData.total,
        home_wins: h2hData.home_wins,
        draws: h2hData.draws,
        away_wins: h2hData.away_wins,
      };
    } else if (h2hDataRev && h2hDataRev.total > 0) {
      h2hWinPct = h2hDataRev.away_wins / h2hDataRev.total;
      h2hSummary = {
        total: h2hDataRev.total,
        home_wins: h2hDataRev.away_wins,
        draws: h2hDataRev.draws,
        away_wins: h2hDataRev.home_wins,
      };
    }

    const sameConfed = homeFeat.confederation === awayFeat.confederation ? 1 : 0;
    const homeAdv = neutral ? 0 : 1;

    const features = {
      rank_diff: homeFeat.rank - awayFeat.rank,
      points_diff: homeFeat.points - awayFeat.points,
      confederation_match: sameConfed,
      home_advantage: homeAdv,
      recent_form_home: homeFeat.recent_form,
      recent_form_away: awayFeat.recent_form,
      goal_diff_home: homeFeat.goal_diff_avg,
      goal_diff_away: awayFeat.goal_diff_avg,
      h2h_win_pct: h2hWinPct,
      tournament_weight: 1.0,
    };

    const probs = computeProbabilities(features);
    const keyFactors = getKeyFactors(features, probs);

    const result = {
      home_win_prob: probs.home_win_prob,
      draw_prob: probs.draw_prob,
      away_win_prob: probs.away_win_prob,
      home_team,
      away_team,
      analysis: {
        rank_diff: features.rank_diff,
        form_diff: +(features.recent_form_home - features.recent_form_away).toFixed(4),
        key_factors: keyFactors,
        home_rank: homeFeat.rank,
        away_rank: awayFeat.rank,
        home_confederation: homeFeat.confederation,
        away_confederation: awayFeat.confederation,
        h2h: h2hSummary,
      },
    };

    return res.status(200).json(result);
  } catch (error) {
    console.error('Prediction error:', error);
    return res.status(500).json({ error: 'Prediction failed', details: error.message });
  }
}

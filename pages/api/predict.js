const { teamFeatures, h2hCache, featureImportance } = require('../../lib/data');

function computeProbabilities(features) {
  const {
    rank_diff, points_diff, confederation_match, home_advantage,
    recent_form_home, recent_form_away, goal_diff_home, goal_diff_away,
    h2h_win_pct, tournament_weight
  } = features;

  const norm_rank_diff = rank_diff / 200;
  const norm_points_diff = points_diff / 2000;
  const norm_form_diff = (recent_form_home - recent_form_away);
  const norm_gd_diff = (goal_diff_home - goal_diff_away) / 5;

  const score =
    -norm_rank_diff * 2.0 +
    norm_points_diff * 0.5 +
    (h2h_win_pct - 0.5) * 3.0 +
    home_advantage * 0.6 +
    norm_form_diff * 1.5 +
    norm_gd_diff * 1.0 +
    tournament_weight * 0.2;

  const homeBase = Math.exp(score * 1.5);
  const drawBase = Math.exp(-Math.abs(score) * 0.8) * 0.6;
  const awayBase = Math.exp(-score * 1.5);

  let homeWin = homeBase / (homeBase + drawBase + awayBase);
  let draw = drawBase / (homeBase + drawBase + awayBase);
  let awayWin = awayBase / (homeBase + drawBase + awayBase);

  const qualityDiff = Math.abs(norm_rank_diff) + Math.abs(norm_form_diff) * 0.5;
  const drawAdjust = Math.max(0.15, 0.35 - qualityDiff * 0.5);
  draw = draw * (1 + drawAdjust * 0.5);

  const total = homeWin + draw + awayWin;
  homeWin = homeWin / total;
  draw = draw / total;
  awayWin = awayWin / total;

  return {
    home_win_prob: Math.round(homeWin * 1000) / 10,
    draw_prob: Math.round(draw * 1000) / 10,
    away_win_prob: Math.round(awayWin * 1000) / 10,
  };
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

    const homeFeat = teamFeatures[home_team] || { rank: 200, points: 0, confederation: 'UNK', recent_form: 0.5, goal_diff_avg: 0 };
    const awayFeat = teamFeatures[away_team] || { rank: 200, points: 0, confederation: 'UNK', recent_form: 0.5, goal_diff_avg: 0 };

    const h2hKey = `${home_team}|${away_team}`;
    const h2hKeyRev = `${away_team}|${home_team}`;
    let h2hWinPct = 0.5;
    let h2hSummary = null;

    const h2hData = h2hCache[h2hKey];
    const h2hDataRev = h2hCache[h2hKeyRev];

    if (h2hData && h2hData.total > 0) {
      h2hWinPct = h2hData.home_wins / h2hData.total;
      h2hSummary = { total: h2hData.total, home_wins: h2hData.home_wins, draws: h2hData.draws, away_wins: h2hData.away_wins };
    } else if (h2hDataRev && h2hDataRev.total > 0) {
      h2hWinPct = h2hDataRev.away_wins / h2hDataRev.total;
      h2hSummary = { total: h2hDataRev.total, home_wins: h2hDataRev.away_wins, draws: h2hDataRev.draws, away_wins: h2hDataRev.home_wins };
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

    return res.status(200).json({
      home_win_prob: probs.home_win_prob,
      draw_prob: probs.draw_prob,
      away_win_prob: probs.away_win_prob,
      home_team,
      away_team,
      analysis: {
        rank_diff: features.rank_diff,
        points_diff: features.points_diff,
        recent_form_home: features.recent_form_home,
        recent_form_away: features.recent_form_away,
        home_rank: homeFeat.rank,
        away_rank: awayFeat.rank,
        home_confederation: homeFeat.confederation,
        away_confederation: awayFeat.confederation,
        h2h: h2hSummary,
      },
    });
  } catch (error) {
    console.error('Prediction error:', error);
    return res.status(500).json({ error: 'Prediction failed', details: error.message });
  }
}

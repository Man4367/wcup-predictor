import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

const FLAG_MAP = {
  'Argentina':'🇦🇷','Australia':'🇦🇺','Austria':'🇦🇹','Belgium':'🇧🇪','Brazil':'🇧🇷',
  'Cameroon':'🇨🇲','Canada':'🇨🇦','Chile':'🇨🇱','Colombia':'🇨🇴','Costa Rica':'🇨🇷',
  'Croatia':'🇭🇷','Czechia':'🇨🇿','Denmark':'🇩🇰','Ecuador':'🇪🇨','Egypt':'🇪🇬',
  'England':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','France':'🇫🇷','Germany':'🇩🇪','Ghana':'🇬🇭','Greece':'🇬🇷',
  'Iceland':'🇮🇸','Iran':'🇮🇷','Iraq':'🇮🇶','Italy':'🇮🇹','Japan':'🇯🇵',
  'Mexico':'🇲🇽','Morocco':'🇲🇦','Netherlands':'🇳🇱','Nigeria':'🇳🇬','Norway':'🇳🇴',
  'Panama':'🇵🇦','Paraguay':'🇵🇾','Peru':'🇵🇪','Poland':'🇵🇱','Portugal':'🇵🇹',
  'Romania':'🇷🇴','Russia':'🇷🇺','Saudi Arabia':'🇸🇦','Scotland':'🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'Senegal':'🇸🇳','Serbia':'🇷🇸','South Korea':'🇰🇷','Spain':'🇪🇸','Sweden':'🇸🇪',
  'Switzerland':'🇨🇭','Tunisia':'🇹🇳','Turkey':'🇹🇷','Ukraine':'🇺🇦','Uruguay':'🇺🇾',
  'USA':'🇺🇸','United States':'🇺🇸','Wales':'🏴󠁧󠁢󠁷󠁬󠁳󠁿','China PR':'🇨🇳',
  'Algeria':'🇩🇿','South Africa':'🇿🇦','Qatar':'🇶🇦',
};
function getFlag(n){return FLAG_MAP[n]||'⚽'}
function getTeamName(t) { return typeof t === 'string' ? t : t.name; }

function ProbabilityBar({ label, pct, color, delay = 0 }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(pct), 100 + delay);
    return () => clearTimeout(t);
  }, [pct, delay]);
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-semibold text-gray-300">{label}</span>
        <span className="text-lg font-bold" style={{color}}>{pct.toFixed(1)}%</span>
      </div>
      <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: Math.min(w, 100) + '%', backgroundColor: color, boxShadow: '0 0 10px ' + color + '40' }} />
      </div>
    </div>
  );
}

function TeamSelector({ teams, value, onChange, label }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const teamNames = teams.map(getTeamName);
  const filtered = teamNames.filter(t => t.toLowerCase().includes(query.toLowerCase())).slice(0, 20);

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="flex-1 min-w-[200px]" ref={ref}>
      <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">{label}</label>
      <div className="relative">
        <div className="flex items-center bg-gray-800 border border-gray-700 rounded-lg px-3 py-3 cursor-pointer"
          onClick={() => setOpen(!open)}>
          <span className="text-2xl mr-2">{getFlag(value)}</span>
          <input type="text" value={open ? query : value}
            onChange={e => { setQuery(e.target.value); setOpen(true); onChange(''); }}
            onFocus={() => setOpen(true)}
            placeholder="Select team..."
            className="bg-transparent text-white text-lg font-semibold outline-none flex-1 placeholder-gray-600" />
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        {open && filtered.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
            {filtered.map(team => (
              <div key={team} className="flex items-center px-3 py-2 hover:bg-orange-900/40 cursor-pointer transition-colors"
                onClick={() => { onChange(team); setQuery(''); setOpen(false); }}>
                <span className="text-xl mr-2">{getFlag(team)}</span>
                <span className="text-white">{team}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [teams, setTeams] = useState([]);
  const [home, setHome] = useState('France');
  const [away, setAway] = useState('Morocco');
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/teams').then(r => r.json()).then(d => setTeams(d.teams || [])).catch(() => {});
  }, []);

  const predict = async () => {
    if (!home || !away) return;
    setLoading(true); setError(null); setPrediction(null);
    try {
      const res = await fetch('/api/predict', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ home_team: home, away_team: away })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPrediction(data);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <Head>
        <title>2026 FIFA World Cup Predictor</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-900/20 to-transparent" />
        <div className="relative max-w-4xl mx-auto px-4 pt-8 pb-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-900/30 border border-orange-700/30 rounded-full mb-3">
            <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
            <span className="text-xs text-orange-300 uppercase tracking-wider">Live • FIFA World Cup 2026</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-orange-400 via-yellow-300 to-orange-500 bg-clip-text text-transparent">
            Match Predictor
          </h1>
          <p className="text-gray-400 mt-2">AI-powered match outcome predictions using XGBoost</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pb-16">
        <div className="bg-gray-900/80 backdrop-blur border border-gray-800 rounded-2xl p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <TeamSelector teams={teams} value={home} onChange={setHome} label="Home Team" />
            <div className="flex-shrink-0 flex items-center justify-center py-3">
              <span className="text-2xl font-black text-gray-600">VS</span>
            </div>
            <TeamSelector teams={teams} value={away} onChange={setAway} label="Away Team" />
          </div>
          <button onClick={predict} disabled={loading || !home || !away}
            className="w-full mt-4 py-3 rounded-xl font-bold text-lg transition-all bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-orange-900/30 hover:shadow-orange-800/50">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Analyzing...
              </span>
            ) : '⚡ Predict Match'}
          </button>
        </div>

        {prediction && (
          <div className="bg-gray-900/80 backdrop-blur border border-gray-800 rounded-2xl p-6 mb-6 animate-fade-in">
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="text-center">
                <span className="text-4xl">{getFlag(home)}</span>
                <p className="font-bold mt-1">{home}</p>
                <p className="text-xs text-gray-500">Rank #{prediction.analysis?.home_rank || '?'}</p>
              </div>
              <div className="text-center px-4">
                <span className="text-3xl font-black text-gray-600">VS</span>
              </div>
              <div className="text-center">
                <span className="text-4xl">{getFlag(away)}</span>
                <p className="font-bold mt-1">{away}</p>
                <p className="text-xs text-gray-500">Rank #{prediction.analysis?.away_rank || '?'}</p>
              </div>
            </div>

            <ProbabilityBar label={home + ' Win'} pct={prediction.home_win_prob} color="#f97316" delay={0} />
            <ProbabilityBar label="Draw" pct={prediction.draw_prob} color="#6b7280" delay={200} />
            <ProbabilityBar label={away + ' Win'} pct={prediction.away_win_prob} color="#3b82f6" delay={400} />

            {prediction.analysis && (
              <div className="mt-6 pt-4 border-t border-gray-800">
                <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-3">Key Factors</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Rank Gap', value: '#' + (prediction.analysis.home_rank || '?') + ' vs #' + (prediction.analysis.away_rank || '?') },
                    { label: 'Points Diff', value: '' + (prediction.analysis.points_diff || 0).toFixed(0) },
                    { label: 'Home Form', value: '' + ((prediction.analysis.recent_form_home || 0) * 100).toFixed(0) + '%' },
                    { label: 'Away Form', value: '' + ((prediction.analysis.recent_form_away || 0) * 100).toFixed(0) + '%' },
                  ].map(f => (
                    <div key={f.label} className="bg-gray-800/50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">{f.label}</p>
                      <p className="font-bold text-sm">{f.value}</p>
                    </div>
                  ))}
                </div>
                {prediction.analysis.h2h && (
                  <div className="mt-3 text-center">
                    <p className="text-xs text-gray-500">Head-to-Head: {prediction.analysis.h2h.total} matches &bull; {home} {prediction.analysis.h2h.home_wins}W &bull; Draw {prediction.analysis.h2h.draws}D &bull; {away} {prediction.analysis.h2h.away_wins}W</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-center">
            ⚠️ {error}
          </div>
        )}

        <div className="bg-gray-900/40 border border-gray-800/50 rounded-xl p-4 mt-6">
          <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-2">Model Info</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div><p className="text-2xl font-bold text-orange-400">66.2%</p><p className="text-xs text-gray-500">Accuracy</p></div>
            <div><p className="text-2xl font-bold text-orange-400">15,905</p><p className="text-xs text-gray-500">Training Samples</p></div>
            <div><p className="text-2xl font-bold text-orange-400">100</p><p className="text-xs text-gray-500">Teams Covered</p></div>
          </div>
          <p className="text-xs text-gray-600 text-center mt-3">XGBoost Classifier • 300 estimators • 10 engineered features • H2H weighted at 50.6%</p>
        </div>
      </main>

      <style jsx>{`@keyframes fade-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}.animate-fade-in{animation:fade-in .5s ease-out}`}</style>
    </div>
  );
}

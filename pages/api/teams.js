const { teamFeatures } = require('../../lib/data');

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
  'Algeria':'🇩🇿','South Africa':'🇿🇦','Jamaica':'🇯🇲','Qatar':'🇶🇦',
  'Côte d\'Ivoire':'🇨🇮','DR Congo':'🇨🇩','Mali':'🇲🇱','Zambia':'🇿🇲',
  'Slovakia':'🇸🇰','Slovenia':'🇸🇮','Hungary':'🇭🇺','Finland':'🇫🇮',
  'Ireland':'🇮🇪','Bulgaria':'🇧🇬','Israel':'🇮🇱','Montenegro':'🇲🇪',
  'Albania':'🇦🇱','Georgia':'🇬🇪','North Macedonia':'🇲🇰',
};

export default async function handler(req, res) {
  try {
    const teams = Object.entries(teamFeatures)
      .map(([name, feat]) => ({
        name,
        flag: FLAG_MAP[name] || '⚽',
        rank: feat.rank,
        confederation: feat.confederation,
        form: feat.recent_form,
      }))
      .sort((a, b) => a.rank - b.rank);

    return res.status(200).json({ teams, total: teams.length });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load teams' });
  }
}

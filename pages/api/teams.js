import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'lib');

// Country flag emoji mapping
const FLAG_MAP = {
  'Argentina': '🇦🇷', 'Algeria': '🇩🇿', 'Australia': '🇦🇺', 'Austria': '🇦🇹',
  'Belgium': '🇧🇪', 'Brazil': '🇧🇷', 'Bosnia-Herzegovina': '🇧🇦',
  'Canada': '🇨🇦', 'Cabo Verde': '🇨🇻', 'Colombia': '🇨🇴', 'Croatia': '🇭🇷',
  'Czechia': '🇨🇿', 'Congo DR': '🇨🇩', 'Côte d\'Ivoire': '🇨🇮', 'Curaçao': '🇨🇼',
  'Ecuador': '🇪🇨', 'Egypt': '🇪🇬', 'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'France': '🇫🇷',
  'Germany': '🇩🇪', 'Ghana': '🇬🇭', 'Haiti': '🇭🇹', 'IR Iran': '🇮🇷',
  'Iraq': '🇮🇶', 'Ivory Coast': '🇨🇮', 'Japan': '🇯🇵', 'Jordan': '🇯🇴',
  'Mexico': '🇲🇽', 'Morocco': '🇲🇦', 'Netherlands': '🇳🇱', 'New Zealand': '🇳🇿',
  'Norway': '🇳🇴', 'Panama': '🇵🇦', 'Paraguay': '🇵🇾', 'Portugal': '🇵🇹',
  'Qatar': '🇶🇦', 'Saudi Arabia': '🇸🇦', 'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'Senegal': '🇸🇳', 'South Africa': '🇿🇦', 'South Korea': '🇰🇷', 'Spain': '🇪🇸',
  'Sweden': '🇸🇪', 'Switzerland': '🇨🇭', 'Tunisia': '🇹🇳', 'Türkiye': '🇹🇷',
  'Uruguay': '🇺🇾', 'USA': '🇺🇸', 'Uzbekistan': '🇺🇿',
  'China PR': '🇨🇳', 'Chile': '🇨🇱', 'Costa Rica': '🇨🇷', 'Denmark': '🇩🇰',
  'Finland': '🇫🇮', 'Greece': '🇬🇷', 'Hungary': '🇭🇺', 'Iceland': '🇮🇸',
  'India': '🇮🇳', 'Israel': '🇮🇱', 'Italy': '🇮🇹', 'Kenya': '🇰🇪',
  'Malaysia': '🇲🇾', 'Nigeria': '🇳🇬', 'Peru': '🇵🇪', 'Poland': '🇵🇱',
  'Romania': '🇷🇴', 'Russia': '🇷🇺', 'Serbia': '🇷🇸', 'Slovakia': '🇸🇰',
  'Slovenia': '🇸🇮', 'Thailand': '🇹🇭', 'Ukraine': '🇺🇦', 'Venezuela': '🇻🇪',
  'Wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿', 'Cameroon': '🇨🇲', 'Mali': '🇲🇱', 'Zambia': '🇿🇲',
  'United States': '🇺🇸', 'Iran': '🇮🇷', 'Turkey': '🇹🇷', 'Ireland': '🇮🇪',
  'Northern Ireland': '🇬🇧', 'Cape Verde': '🇨🇻', 'Curacao': '🇨🇼',
  'DR Congo': '🇨🇩', 'North Korea': '🇰🇵',
};

export default async function handler(req, res) {
  try {
    const modelData = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, 'model_data.json'), 'utf-8')
    );
    const teamFeatures = modelData.team_features;

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
    console.error('Teams API error:', error);
    return res.status(500).json({ error: 'Failed to load teams' });
  }
}

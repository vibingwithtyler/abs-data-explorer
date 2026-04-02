export const COLORS = {
  bg1: '#06090f',
  bg2: '#0d1117',
  bg3: '#161b22',
  border: '#30363d',
  text: '#c9d1d9',
  textMuted: '#8b949e',
  accent: '#58a6ff',
  green: '#3fb950',
  red: '#f85149',
  orange: '#d29922',
  purple: '#bc8cff',
};

export const TEAM_COLORS = {
  ARI: { primary: '#A71930', secondary: '#E3D4AD' },
  ATL: { primary: '#CE1141', secondary: '#13274F' },
  BAL: { primary: '#DF4601', secondary: '#000000' },
  BOS: { primary: '#BD3039', secondary: '#0C2340' },
  CHC: { primary: '#0E3386', secondary: '#CC3433' },
  CHW: { primary: '#27251F', secondary: '#C4CED4' },
  CIN: { primary: '#C6011F', secondary: '#000000' },
  CLE: { primary: '#00385D', secondary: '#E50022' },
  COL: { primary: '#33006F', secondary: '#C4CED4' },
  DET: { primary: '#0C2340', secondary: '#FA4616' },
  HOU: { primary: '#002D62', secondary: '#EB6E1F' },
  KC: { primary: '#004687', secondary: '#BD9B60' },
  LAA: { primary: '#BA0021', secondary: '#003263' },
  LAD: { primary: '#005A9C', secondary: '#EF3E42' },
  MIA: { primary: '#00A3E0', secondary: '#EF3340' },
  MIL: { primary: '#FFC52F', secondary: '#12284B' },
  MIN: { primary: '#002B5C', secondary: '#D31145' },
  NYM: { primary: '#002D72', secondary: '#FF5910' },
  NYY: { primary: '#003087', secondary: '#C4CED4' },
  OAK: { primary: '#003831', secondary: '#EFB21E' },
  PHI: { primary: '#E81828', secondary: '#002D72' },
  PIT: { primary: '#27251F', secondary: '#FDB827' },
  SD: { primary: '#2F241D', secondary: '#FFC425' },
  SF: { primary: '#FD5A1E', secondary: '#27251F' },
  SEA: { primary: '#0C2C56', secondary: '#005C5C' },
  STL: { primary: '#C41E3A', secondary: '#0C2340' },
  TB: { primary: '#092C5C', secondary: '#8FBCE6' },
  TEX: { primary: '#003278', secondary: '#C0111F' },
  TOR: { primary: '#134A8E', secondary: '#1D2D5C' },
  WSH: { primary: '#AB0003', secondary: '#14225A' },
};

export const TEAM_NAMES = {
  ARI: 'D-backs', ATL: 'Braves', BAL: 'Orioles', BOS: 'Red Sox',
  CHC: 'Cubs', CHW: 'White Sox', CIN: 'Reds', CLE: 'Guardians',
  COL: 'Rockies', DET: 'Tigers', HOU: 'Astros', KC: 'Royals',
  LAA: 'Angels', LAD: 'Dodgers', MIA: 'Marlins', MIL: 'Brewers',
  MIN: 'Twins', NYM: 'Mets', NYY: 'Yankees', OAK: 'Athletics',
  PHI: 'Phillies', PIT: 'Pirates', SD: 'Padres', SF: 'Giants',
  SEA: 'Mariners', STL: 'Cardinals', TB: 'Rays', TEX: 'Rangers',
  TOR: 'Blue Jays', WSH: 'Nationals',
};

export const TEAM_DIVISIONS = {
  ARI: 'NL West', ATL: 'NL East', BAL: 'AL East', BOS: 'AL East',
  CHC: 'NL Central', CHW: 'AL Central', CIN: 'NL Central', CLE: 'AL Central',
  COL: 'NL West', DET: 'AL Central', HOU: 'AL West', KC: 'AL Central',
  LAA: 'AL West', LAD: 'NL West', MIA: 'NL East', MIL: 'NL Central',
  MIN: 'AL Central', NYM: 'NL East', NYY: 'AL East', OAK: 'AL West',
  PHI: 'NL East', PIT: 'NL Central', SD: 'NL West', SF: 'NL West',
  SEA: 'AL West', STL: 'NL Central', TB: 'AL East', TEX: 'AL West',
  TOR: 'AL East', WSH: 'NL East',
};

export const PITCH_TYPES = {
  FF: '4-Seam Fastball', SI: 'Sinker', FC: 'Cutter', SL: 'Slider',
  CU: 'Curveball', CH: 'Changeup', FS: 'Splitter', KC: 'Knuckle Curve',
  ST: 'Sweeper', SV: 'Screwball', KN: 'Knuckleball',
};

export const CHART_THEME = {
  tooltip: {
    contentStyle: {
      backgroundColor: '#161b22',
      border: '1px solid #30363d',
      borderRadius: 6,
      color: '#c9d1d9',
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 12,
    },
    itemStyle: { color: '#c9d1d9' },
    labelStyle: { color: '#8b949e' },
  },
  grid: { stroke: '#21262d', strokeDasharray: '3 3' },
  axis: { stroke: '#30363d', tick: { fill: '#8b949e', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' } },
};

export const ALL_TEAMS = Object.keys(TEAM_COLORS).sort();

// Baseball physical radius: ~1.45 inches (2.9" diameter)
export const BALL_RADIUS_INCHES = 1.45;
export const BALL_RADIUS_FEET = BALL_RADIUS_INCHES / 12;

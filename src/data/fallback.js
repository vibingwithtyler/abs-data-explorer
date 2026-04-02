// Seeded PRNG (mulberry32) for deterministic mock data
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(42);

function randInt(min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randFloat(min, max) {
  return rng() * (max - min) + min;
}

function pick(arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// ── Player pools ──

const BATTERS = [
  "Aaron Judge", "Shohei Ohtani", "Mookie Betts", "Juan Soto", "Ronald Acuna Jr.",
  "Freddie Freeman", "Trea Turner", "Corey Seager", "Marcus Semien", "Jose Ramirez",
  "Yordan Alvarez", "Kyle Tucker", "Julio Rodriguez", "Bobby Witt Jr.", "Gunnar Henderson",
  "Wander Franco", "Vladimir Guerrero Jr.", "Bo Bichette", "Rafael Devers", "Adley Rutschman",
  "Mike Trout", "Bryce Harper", "Fernando Tatis Jr.", "Manny Machado", "Pete Alonso",
  "Matt Olson", "Austin Riley", "Dansby Swanson", "Elly De La Cruz", "Corbin Carroll",
  "Spencer Torkelson", "CJ Abrams", "Anthony Volpe", "Masataka Yoshida", "Lars Nootbaar",
  "Cedric Mullins", "Luis Robert Jr.", "Eloy Jimenez", "Alex Bregman", "Nolan Arenado",
];

const PITCHERS = [
  "Spencer Strider", "Gerrit Cole", "Zack Wheeler", "Corbin Burnes", "Kevin Gausman",
  "Logan Webb", "Framber Valdez", "Justin Verlander", "Max Scherzer", "Jacob deGrom",
  "Shota Imanaga", "Yoshinobu Yamamoto", "Blake Snell", "Tyler Glasnow", "Pablo Lopez",
  "Sonny Gray", "Zac Gallen", "Luis Castillo", "Dylan Cease", "Joe Ryan",
  "Tarik Skubal", "Bryce Miller", "Seth Lugo", "Tanner Bibee", "Hunter Brown",
  "Ranger Suarez", "Chris Sale", "Max Fried", "Charlie Morton", "Nestor Cortes",
  "Brandon Woodruff", "Shane McClanahan", "Sandy Alcantara", "Yu Darvish", "Kodai Senga",
  "Nathan Eovaldi", "Jordan Montgomery", "Marcus Stroman", "Kyle Hendricks", "Aaron Nola",
];

const CATCHERS = [
  "Adley Rutschman", "J.T. Realmuto", "Will Smith", "Sean Murphy", "Salvador Perez",
  "Willson Contreras", "Cal Raleigh", "Jonah Heim", "William Contreras", "Gabriel Moreno",
  "Patrick Bailey", "Travis d'Arnaud", "Alejandro Kirk", "MJ Melendez", "Logan O'Hoppe",
];

const UMPIRES = [
  "Angel Hernandez", "CB Bucknor", "Joe West", "Doug Eddings", "Laz Diaz",
  "Greg Gibson", "Mark Carlson", "Dan Bellino", "Ron Kulpa", "Marvin Hudson",
  "James Hoye", "Vic Carapazza", "Bill Miller", "Todd Tichenor", "Andy Fletcher",
];

const TEAMS = [
  { abbr: "NYY", name: "New York Yankees" },
  { abbr: "BOS", name: "Boston Red Sox" },
  { abbr: "LAD", name: "Los Angeles Dodgers" },
  { abbr: "HOU", name: "Houston Astros" },
  { abbr: "ATL", name: "Atlanta Braves" },
  { abbr: "NYM", name: "New York Mets" },
  { abbr: "PHI", name: "Philadelphia Phillies" },
  { abbr: "SD", name: "San Diego Padres" },
  { abbr: "SF", name: "San Francisco Giants" },
  { abbr: "CHC", name: "Chicago Cubs" },
  { abbr: "SEA", name: "Seattle Mariners" },
  { abbr: "MIN", name: "Minnesota Twins" },
  { abbr: "TEX", name: "Texas Rangers" },
  { abbr: "TB", name: "Tampa Bay Rays" },
  { abbr: "BAL", name: "Baltimore Orioles" },
  { abbr: "TOR", name: "Toronto Blue Jays" },
  { abbr: "CLE", name: "Cleveland Guardians" },
  { abbr: "MIL", name: "Milwaukee Brewers" },
  { abbr: "ARI", name: "Arizona Diamondbacks" },
  { abbr: "MIA", name: "Miami Marlins" },
  { abbr: "CIN", name: "Cincinnati Reds" },
  { abbr: "STL", name: "St. Louis Cardinals" },
  { abbr: "PIT", name: "Pittsburgh Pirates" },
  { abbr: "DET", name: "Detroit Tigers" },
  { abbr: "KC", name: "Kansas City Royals" },
  { abbr: "CHW", name: "Chicago White Sox" },
  { abbr: "LAA", name: "Los Angeles Angels" },
  { abbr: "OAK", name: "Oakland Athletics" },
  { abbr: "COL", name: "Colorado Rockies" },
  { abbr: "WSH", name: "Washington Nationals" },
];

const PITCH_TYPES = [
  { code: "FF", name: "Four-Seam Fastball", vMin: 92, vMax: 98 },
  { code: "SI", name: "Sinker", vMin: 90, vMax: 96 },
  { code: "SL", name: "Slider", vMin: 82, vMax: 89 },
  { code: "CU", name: "Curveball", vMin: 76, vMax: 84 },
  { code: "CH", name: "Changeup", vMin: 83, vMax: 90 },
  { code: "FC", name: "Cutter", vMin: 86, vMax: 93 },
  { code: "ST", name: "Sweeper", vMin: 78, vMax: 86 },
  { code: "FS", name: "Splitter", vMin: 84, vMax: 91 },
];

const ZONE_HALF_WIDTH = 0.708;

const DATES = [
  "2026-03-25",
  "2026-03-26",
  "2026-03-27",
  "2026-03-28",
  "2026-03-29",
  "2026-03-30",
  "2026-03-31",
];

// ── Generate pitch location clustered near zone edges ──

function generatePitchLocation(szBot, szTop) {
  // Most pitches cluster within 0-3 inches (~0-0.25 ft) of zone boundary
  const edgeOffset = randFloat(0, 0.25);
  // Occasionally allow up to ~6 inches off edge
  const extraSpread = rng() < 0.15 ? randFloat(0, 0.25) : 0;
  const offset = edgeOffset + extraSpread;

  let px, pz;

  // Pick which edge to cluster near for x
  if (rng() < 0.5) {
    // Near left/right edge
    const sign = rng() < 0.5 ? 1 : -1;
    px = sign * (ZONE_HALF_WIDTH + (rng() < 0.5 ? offset : -offset));
  } else {
    // Random x but still somewhat near edges
    px = randFloat(-ZONE_HALF_WIDTH - 0.3, ZONE_HALF_WIDTH + 0.3);
  }

  // Pick which edge to cluster near for z
  const zOffset = randFloat(0, 0.25) + (rng() < 0.15 ? randFloat(0, 0.25) : 0);
  if (rng() < 0.5) {
    // Near top
    pz = szTop + (rng() < 0.5 ? zOffset : -zOffset);
  } else {
    // Near bottom
    pz = szBot + (rng() < 0.5 ? zOffset : -zOffset);
  }

  return {
    px: Math.round(px * 1000) / 1000,
    pz: Math.round(pz * 1000) / 1000,
  };
}

// ── Build challenges ──

function generateChallenges() {
  const challenges = [];
  let id = 1;

  // ~400 total, ~57 per day
  const perDay = [57, 57, 57, 58, 57, 57, 57]; // sums to 400

  for (let d = 0; d < DATES.length; d++) {
    const date = DATES[d];
    const count = perDay[d];
    // Generate several gamePks per day (about 8 games)
    const dayGamePks = [];
    for (let g = 0; g < 8; g++) {
      dayGamePks.push(700000 + d * 100 + g);
    }

    for (let i = 0; i < count; i++) {
      const gamePk = pick(dayGamePks);
      const batter = pick(BATTERS);
      const pitcher = pick(PITCHERS);
      const catcher = pick(CATCHERS);
      const umpire = pick(UMPIRES);

      const teamIdx = randInt(0, TEAMS.length - 1);
      let oppIdx = randInt(0, TEAMS.length - 2);
      if (oppIdx >= teamIdx) oppIdx++;
      const team = TEAMS[teamIdx];
      const opponent = TEAMS[oppIdx];

      const pitch = pick(PITCH_TYPES);
      const velocity = randFloat(pitch.vMin, pitch.vMax);

      // Per-batter zone
      const szBot = randFloat(1.5, 1.7);
      const szTop = randFloat(3.2, 3.6);

      const { px, pz } = generatePitchLocation(szBot, szTop);

      // Determine if in zone
      const inZone =
        Math.abs(px) <= ZONE_HALF_WIDTH && pz >= szBot && pz <= szTop;

      // Miss distance
      const dx = Math.max(0, Math.abs(px) - ZONE_HALF_WIDTH);
      const dz = Math.max(
        0,
        pz > szTop ? pz - szTop : szBot > pz ? szBot - pz : 0
      );
      const missDistance = Math.sqrt(dx * dx + dz * dz);
      const missDistanceInches = missDistance * 12;

      // Challenger type: ~57% fielder, ~43% batter
      const isFielder = rng() < 0.57;
      const challengerType = isFielder ? "Fielder" : "Batter";

      // ABS is deterministic — the system sees the true zone.
      // The umpire's original call may be right or wrong.
      // To get realistic overturn rates (~50-58%), we decide whether
      // the ump got it wrong (overturned) or right (confirmed), then
      // set the original call accordingly.
      const overturnRate = isFielder ? 0.58 : 0.50;
      const overturned = rng() < overturnRate;

      let originalCall;
      if (overturned) {
        // Ump was wrong — ABS corrects it
        // Pitch outside zone + ump called strike → overturned to ball
        // Pitch inside zone + ump called ball → overturned to strike
        originalCall = inZone ? "Ball" : "Called Strike";
      } else {
        // Ump was right — challenge fails
        // Pitch outside zone + ump called ball → confirmed (challenger was wrong)
        // Pitch inside zone + ump called strike → confirmed (challenger was wrong)
        originalCall = inZone ? "Called Strike" : "Ball";
      }
      const result = overturned ? "Overturned" : "Confirmed";

      challenges.push({
        id: id++,
        date,
        gamePk,
        inning: randInt(1, 9),
        balls: randInt(0, 3),
        strikes: randInt(0, 2),
        outs: randInt(0, 2),
        batter,
        batterId: 100000 + BATTERS.indexOf(batter),
        pitcher,
        pitcherId: 200000 + PITCHERS.indexOf(pitcher),
        catcher,
        team: team.abbr,
        teamName: team.name,
        opponent: opponent.abbr,
        umpire,
        challengerType,
        pitchType: pitch.code,
        pitchName: pitch.name,
        velocity: Math.round(velocity * 10) / 10,
        px,
        pz,
        zoneTop: Math.round(szTop * 1000) / 1000,
        zoneBot: Math.round(szBot * 1000) / 1000,
        inZone,
        missDistance: Math.round(missDistance * 10000) / 10000,
        missDistanceInches: Math.round(missDistanceInches * 100) / 100,
        originalCall,
        overturned,
        result,
      });
    }
  }

  return challenges;
}

const fallbackData = {
  lastUpdated: "2026-03-31T12:00:00Z",
  season: 2026,
  challenges: generateChallenges(),
};

export default fallbackData;

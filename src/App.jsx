import React, { useState, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, ComposedChart, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Cell, ReferenceLine
} from 'recharts';
import { AlertTriangle, TrendingUp, Target, Users, Shield, Activity } from 'lucide-react';

import useABSData from './hooks/useABSData';
import StatCard from './components/StatCard';
import FilterBar from './components/FilterBar';
import DataTable from './components/DataTable';
import StrikeZone from './components/StrikeZone';
import PitchDetailModal from './components/PitchDetailModal';
import {
  aggregateByField, getMissDistanceBuckets, getDailyTotals,
  getMissDistanceHistogram, feetToInches
} from './utils/calculations';
import { CHART_THEME, PITCH_TYPES, TEAM_DIVISIONS, COLORS, BALL_RADIUS_INCHES, BALL_RADIUS_FEET } from './utils/constants';

const TABS = [
  { key: 'overview', label: 'Overview', icon: Activity },
  { key: 'missDistance', label: 'Miss Distance', icon: Target },
  { key: 'players', label: 'Players', icon: Users },
  { key: 'teams', label: 'Teams', icon: Shield },
  { key: 'umpires', label: 'Umpires', icon: AlertTriangle },
  { key: 'pitchLog', label: 'Pitch Log', icon: TrendingUp },
];

const tooltipStyle = {
  contentStyle: {
    background: COLORS.bg3,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    color: COLORS.text,
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 12,
  },
  itemStyle: { color: COLORS.text },
  labelStyle: { color: COLORS.textMuted },
  cursor: { fill: 'rgba(88,166,255,0.08)' },
};

const chartCardStyle = {
  background: COLORS.bg3,
  borderRadius: 12,
  border: `1px solid ${COLORS.border}`,
  padding: 20,
};

const chartTitleStyle = {
  color: COLORS.text,
  fontSize: 14,
  fontWeight: 600,
  marginBottom: 16,
  fontFamily: 'Inter, sans-serif',
};

function pct(num, denom) {
  if (!denom) return '0.0';
  return ((num / denom) * 100).toFixed(1);
}

function Badge({ label, color }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 12,
      fontSize: 11,
      fontWeight: 600,
      fontFamily: 'JetBrains Mono, monospace',
      color,
      background: `${color}22`,
      letterSpacing: 0.3,
    }}>
      {label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  OVERVIEW TAB
// ═══════════════════════════════════════════════════════════════════════════════

function OverviewTab({ challenges, onPitchClick }) {
  const stats = useMemo(() => {
    const total = challenges.length;
    const overturned = challenges.filter(c => c.overturned).length;
    const avgMiss = total > 0
      ? challenges.reduce((sum, c) => sum + (c.missDistanceInches || 0), 0) / total
      : 0;
    const batterCh = challenges.filter(c => c.challengerType === 'Batter');
    const fielderCh = challenges.filter(c => c.challengerType === 'Fielder');
    return {
      total,
      overturnRate: pct(overturned, total),
      avgMiss: avgMiss.toFixed(1),
      batterSuccess: pct(batterCh.filter(c => c.overturned).length, batterCh.length),
      fielderSuccess: pct(fielderCh.filter(c => c.overturned).length, fielderCh.length),
    };
  }, [challenges]);

  const dailyData = useMemo(() => getDailyTotals(challenges), [challenges]);

  const pitchTypeData = useMemo(() =>
    aggregateByField(challenges, 'pitchType').map(d => ({
      ...d,
      name: PITCH_TYPES[d.name] || d.name,
    })).slice(0, 10),
    [challenges]
  );

  const inningData = useMemo(() => {
    const byInning = aggregateByField(challenges, 'inning');
    const map = {};
    byInning.forEach(d => { map[d.name] = d; });
    return Array.from({ length: 9 }, (_, i) => {
      const n = i + 1;
      const d = map[n] || map[String(n)];
      return { inning: String(n), total: d?.total || 0, overturned: d?.overturned || 0 };
    });
  }, [challenges]);

  const comparison = useMemo(() => {
    const batter = challenges.filter(c => c.challengerType === 'Batter');
    const fielder = challenges.filter(c => c.challengerType === 'Fielder');
    return {
      batter: { total: batter.length, overturned: batter.filter(c => c.overturned).length },
      fielder: { total: fielder.length, overturned: fielder.filter(c => c.overturned).length },
    };
  }, [challenges]);

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard label="Total Challenges" value={stats.total} icon={Activity} color={COLORS.accent} />
        <StatCard label="Overturn Rate" value={`${stats.overturnRate}%`} icon={TrendingUp} color={COLORS.green} />
        <StatCard label="Avg Miss Distance" value={`${stats.avgMiss}"`} icon={Target} color={COLORS.orange} />
        <StatCard label="Batter Success" value={`${stats.batterSuccess}%`} icon={Users} color={COLORS.purple} />
        <StatCard label="Fielder Success" value={`${stats.fielderSuccess}%`} icon={Shield} color={COLORS.red} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 24 }}>
        <div style={chartCardStyle}>
          <div style={chartTitleStyle}>Challenge Locations</div>
          <StrikeZone pitches={challenges} width={360} height={420} onPitchClick={onPitchClick} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 16 }}>
          <div style={chartCardStyle}>
            <div style={chartTitleStyle}>Daily Trend</div>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                <XAxis dataKey="date" stroke={COLORS.border} tick={{ fill: COLORS.textMuted, fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                <YAxis yAxisId="left" stroke={COLORS.border} tick={{ fill: COLORS.textMuted, fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" stroke={COLORS.border} tick={{ fill: COLORS.textMuted, fontSize: 10 }} domain={[0, 100]} />
                <Tooltip {...tooltipStyle} />
                <Bar yAxisId="left" dataKey="total" fill={COLORS.accent} opacity={0.6} radius={[2, 2, 0, 0]} name="Challenges" />
                <Bar yAxisId="left" dataKey="overturned" fill={COLORS.green} radius={[2, 2, 0, 0]} name="Overturned" />
                <Line yAxisId="right" dataKey="overturnRate" stroke={COLORS.orange} strokeWidth={2} dot={false} name="Overturn %" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div style={chartCardStyle}>
            <div style={chartTitleStyle}>By Pitch Type</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={pitchTypeData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" horizontal={false} />
                <XAxis type="number" stroke={COLORS.border} tick={{ fill: COLORS.textMuted, fontSize: 10 }} />
                <YAxis type="category" dataKey="name" stroke={COLORS.border} tick={{ fill: COLORS.textMuted, fontSize: 9 }} width={100} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="total" fill={COLORS.accent} opacity={0.6} radius={[0, 2, 2, 0]} name="Total" />
                <Bar dataKey="overturned" fill={COLORS.green} radius={[0, 2, 2, 0]} name="Overturned" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={chartCardStyle}>
            <div style={chartTitleStyle}>By Inning</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={inningData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                <XAxis dataKey="inning" stroke={COLORS.border} tick={{ fill: COLORS.textMuted, fontSize: 10 }} />
                <YAxis stroke={COLORS.border} tick={{ fill: COLORS.textMuted, fontSize: 10 }} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="total" name="Total" radius={[2, 2, 0, 0]}>
                  {inningData.map((entry, idx) => (
                    <Cell key={idx} fill={parseInt(entry.inning) >= 7 ? COLORS.purple : COLORS.accent} opacity={0.7} />
                  ))}
                </Bar>
                <Bar dataKey="overturned" fill={COLORS.green} radius={[2, 2, 0, 0]} name="Overturned" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={chartCardStyle}>
            <div style={chartTitleStyle}>Batter vs Fielder</div>
            <div style={{ display: 'flex', gap: 16, height: 200, alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ flex: 1, background: COLORS.bg2, borderRadius: 10, padding: 20, textAlign: 'center', border: `1px solid ${COLORS.border}` }}>
                <div style={{ color: COLORS.purple, fontSize: 12, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Batter</div>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 36, fontWeight: 600, color: COLORS.purple }}>
                  {pct(comparison.batter.overturned, comparison.batter.total)}%
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: COLORS.textMuted, marginTop: 4 }}>
                  {comparison.batter.overturned} / {comparison.batter.total}
                </div>
              </div>
              <div style={{ flex: 1, background: COLORS.bg2, borderRadius: 10, padding: 20, textAlign: 'center', border: `1px solid ${COLORS.border}` }}>
                <div style={{ color: COLORS.orange, fontSize: 12, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Fielder</div>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 36, fontWeight: 600, color: COLORS.orange }}>
                  {pct(comparison.fielder.overturned, comparison.fielder.total)}%
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: COLORS.textMuted, marginTop: 4 }}>
                  {comparison.fielder.overturned} / {comparison.fielder.total}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MISS DISTANCE TAB
// ═══════════════════════════════════════════════════════════════════════════════

function MissDistanceTab({ challenges, onPitchClick }) {
  const bucketData = useMemo(() => getMissDistanceBuckets(challenges), [challenges]);
  const histogramData = useMemo(() => getMissDistanceHistogram(challenges), [challenges]);

  const dailyAvgMiss = useMemo(() => {
    const byDay = {};
    challenges.forEach(c => {
      if (!byDay[c.date]) byDay[c.date] = [];
      byDay[c.date].push(c.missDistanceInches || 0);
    });
    return Object.entries(byDay)
      .map(([date, dists]) => ({
        date,
        avgMiss: dists.reduce((a, b) => a + b, 0) / dists.length,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [challenges]);

  const scatterData = useMemo(() =>
    challenges.filter(c => c.px != null && c.pz != null).map(c => ({
      x: c.px, z: c.pz,
      missDistance: c.missDistanceInches || 0,
      overturned: c.overturned, id: c.id,
    })),
    [challenges]
  );

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={{ ...chartCardStyle, marginBottom: 24 }}>
        <div style={chartTitleStyle}>Overturn Rate by Miss Distance Bucket</div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={bucketData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis dataKey="label" stroke={COLORS.border} tick={{ fill: COLORS.textMuted, fontSize: 11 }} />
            <YAxis stroke={COLORS.border} tick={{ fill: COLORS.textMuted, fontSize: 11 }} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="total" fill={COLORS.accent} opacity={0.5} radius={[2, 2, 0, 0]} name="Total" />
            <Bar dataKey="overturned" fill={COLORS.green} radius={[2, 2, 0, 0]} name="Overturned" />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 12, paddingTop: 12, borderTop: `1px solid ${COLORS.border}` }}>
          {bucketData.map((b, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', color: COLORS.textMuted, fontSize: 10 }}>{b.label}</div>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 28, fontWeight: 600, color: b.overturnRate > 50 ? COLORS.green : COLORS.accent }}>
                {b.overturnRate.toFixed(0)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={chartCardStyle}>
          <div style={chartTitleStyle}>Overturned - Miss Distance Distribution</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={histogramData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis dataKey="label" stroke={COLORS.border} tick={{ fill: COLORS.textMuted, fontSize: 9 }} angle={-45} textAnchor="end" height={50} />
              <YAxis stroke={COLORS.border} tick={{ fill: COLORS.textMuted, fontSize: 10 }} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="overturned" fill={COLORS.green} radius={[2, 2, 0, 0]} name="Overturned" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={chartCardStyle}>
          <div style={chartTitleStyle}>Confirmed - Miss Distance Distribution</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={histogramData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis dataKey="label" stroke={COLORS.border} tick={{ fill: COLORS.textMuted, fontSize: 9 }} angle={-45} textAnchor="end" height={50} />
              <YAxis stroke={COLORS.border} tick={{ fill: COLORS.textMuted, fontSize: 10 }} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="confirmed" fill={COLORS.red} radius={[2, 2, 0, 0]} name="Confirmed" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ ...chartCardStyle, marginBottom: 24 }}>
        <div style={chartTitleStyle}>Average Miss Distance Over Time</div>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={dailyAvgMiss}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis dataKey="date" stroke={COLORS.border} tick={{ fill: COLORS.textMuted, fontSize: 10 }} tickFormatter={v => v.slice(5)} />
            <YAxis stroke={COLORS.border} tick={{ fill: COLORS.textMuted, fontSize: 10 }} label={{ value: 'Inches', angle: -90, position: 'insideLeft', fill: COLORS.textMuted, fontSize: 11 }} />
            <Tooltip {...tooltipStyle} formatter={val => [`${val.toFixed(2)}"`, 'Avg Miss']} />
            <Line dataKey="avgMiss" stroke={COLORS.orange} strokeWidth={2} dot={{ fill: COLORS.orange, r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={chartCardStyle}>
        <div style={chartTitleStyle}>Pitch Locations (size = miss distance)</div>
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis type="number" dataKey="x" name="Plate X" stroke={COLORS.border} tick={{ fill: COLORS.textMuted, fontSize: 10 }} domain={[-2, 2]} />
            <YAxis type="number" dataKey="z" name="Plate Z" stroke={COLORS.border} tick={{ fill: COLORS.textMuted, fontSize: 10 }} domain={[0, 5]} />
            <Tooltip {...tooltipStyle} formatter={(val, name) => name === 'missDistance' ? [`${val.toFixed(1)}"`, 'Miss'] : [val.toFixed(3), name]} />
            <Scatter data={scatterData} shape="circle">
              {scatterData.map((entry, idx) => (
                <Cell key={idx} fill={entry.overturned ? COLORS.green : COLORS.red} opacity={0.7} r={Math.max(3, Math.min(entry.missDistance * 1.5, 12))} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: COLORS.textMuted }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS.green, display: 'inline-block' }} /> Overturned
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: COLORS.textMuted }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS.red, display: 'inline-block' }} /> Confirmed
          </span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PLAYERS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function PlayersTab({ challenges }) {
  const playerData = useMemo(() => {
    const byBatter = {};
    challenges.forEach(c => {
      const name = c.batter || 'Unknown';
      if (!byBatter[name]) byBatter[name] = { player: name, challenges: 0, overturned: 0, challengedAgainst: 0, overturnedAgainst: 0 };
      if (c.challengerType === 'Batter') {
        byBatter[name].challenges++;
        if (c.overturned) byBatter[name].overturned++;
      } else {
        byBatter[name].challengedAgainst++;
        if (c.overturned) byBatter[name].overturnedAgainst++;
      }
    });
    return Object.values(byBatter)
      .map(p => ({ ...p, successPct: p.challenges > 0 ? parseFloat(pct(p.overturned, p.challenges)) : 0 }))
      .sort((a, b) => (b.challenges + b.challengedAgainst) - (a.challenges + a.challengedAgainst));
  }, [challenges]);

  const columns = [
    { key: 'player', label: 'Player' },
    { key: 'challenges', label: 'Challenges' },
    { key: 'overturned', label: 'Overturned' },
    { key: 'successPct', label: 'Success %', render: v => <span style={{ color: v > 50 ? COLORS.green : COLORS.text }}>{v > 0 ? `${v}%` : '—'}</span> },
    { key: 'challengedAgainst', label: 'Challenged Against' },
    { key: 'overturnedAgainst', label: 'OT Against' },
  ];

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={chartCardStyle}>
        <div style={chartTitleStyle}>Player Challenge Summary</div>
        <DataTable columns={columns} data={playerData} defaultSort={{ key: 'challenges', dir: 'desc' }} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TEAMS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function TeamsTab({ challenges }) {
  const teamData = useMemo(() => {
    const byTeam = {};
    challenges.forEach(c => {
      const team = c.team || 'UNK';
      if (!byTeam[team]) byTeam[team] = { team, challenges: 0, overturned: 0, missDists: [] };
      byTeam[team].challenges++;
      if (c.overturned) byTeam[team].overturned++;
      byTeam[team].missDists.push(c.missDistanceInches || 0);
    });
    return Object.values(byTeam).map(t => ({
      ...t,
      overturnPct: t.challenges > 0 ? (t.overturned / t.challenges) * 100 : 0,
      avgMissDistance: (t.missDists.reduce((a, b) => a + b, 0) / t.missDists.length).toFixed(1),
      division: TEAM_DIVISIONS[t.team] || '—',
    })).sort((a, b) => b.overturnPct - a.overturnPct);
  }, [challenges]);

  const leagueAvg = useMemo(() => {
    const ov = challenges.filter(c => c.overturned).length;
    return challenges.length > 0 ? (ov / challenges.length) * 100 : 0;
  }, [challenges]);

  const columns = [
    { key: 'team', label: 'Team' },
    { key: 'division', label: 'Division' },
    { key: 'challenges', label: 'Challenges' },
    { key: 'overturned', label: 'Overturned' },
    { key: 'overturnPct', label: 'Overturn %', render: v => <span style={{ color: v > leagueAvg ? COLORS.green : COLORS.text }}>{v.toFixed(1)}%</span> },
    { key: 'avgMissDistance', label: 'Avg Miss Dist' },
  ];

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={{ ...chartCardStyle, marginBottom: 24 }}>
        <div style={chartTitleStyle}>Team Overturn Rate Ranking</div>
        <ResponsiveContainer width="100%" height={Math.max(400, teamData.length * 28)}>
          <BarChart data={teamData} layout="vertical" margin={{ left: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" horizontal={false} />
            <XAxis type="number" stroke={COLORS.border} tick={{ fill: COLORS.textMuted, fontSize: 10 }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
            <YAxis type="category" dataKey="team" stroke={COLORS.border} tick={{ fill: COLORS.textMuted, fontSize: 11 }} width={45} />
            <Tooltip {...tooltipStyle} formatter={val => [`${val.toFixed(1)}%`, 'Overturn Rate']} />
            <ReferenceLine x={leagueAvg} stroke={COLORS.orange} strokeDasharray="5 5" />
            <Bar dataKey="overturnPct" radius={[0, 4, 4, 0]} name="Overturn %">
              {teamData.map((entry, idx) => (
                <Cell key={idx} fill={entry.overturnPct > leagueAvg ? COLORS.green : COLORS.accent} opacity={0.75} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={chartCardStyle}>
        <div style={chartTitleStyle}>Team Details</div>
        <DataTable columns={columns} data={teamData} defaultSort={{ key: 'overturnPct', dir: 'desc' }} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  UMPIRES TAB
// ═══════════════════════════════════════════════════════════════════════════════

function UmpiresTab({ challenges }) {
  const umpireData = useMemo(() => {
    const byUmp = {};
    challenges.forEach(c => {
      const ump = c.umpire || 'Unknown';
      if (!byUmp[ump]) byUmp[ump] = { umpire: ump, challenged: 0, overturned: 0, missDists: [] };
      byUmp[ump].challenged++;
      if (c.overturned) {
        byUmp[ump].overturned++;
        byUmp[ump].missDists.push(c.missDistanceInches || 0);
      }
    });
    return Object.values(byUmp).map(u => ({
      ...u,
      overturnRate: u.challenged > 0 ? (u.overturned / u.challenged) * 100 : 0,
      accuracyPct: u.challenged > 0 ? ((u.challenged - u.overturned) / u.challenged) * 100 : 100,
      avgMissOnOverturned: u.missDists.length > 0 ? (u.missDists.reduce((a, b) => a + b, 0) / u.missDists.length).toFixed(1) : '—',
    })).filter(u => u.challenged >= 2).sort((a, b) => b.overturnRate - a.overturnRate);
  }, [challenges]);

  const getBarColor = (value, isAccuracy) => {
    if (isAccuracy) return value >= 75 ? COLORS.green : value >= 50 ? COLORS.orange : COLORS.red;
    return value <= 25 ? COLORS.green : value <= 50 ? COLORS.orange : COLORS.red;
  };

  const overturnRanking = useMemo(() => [...umpireData].sort((a, b) => b.overturnRate - a.overturnRate), [umpireData]);
  const accuracyRanking = useMemo(() => [...umpireData].sort((a, b) => b.accuracyPct - a.accuracyPct), [umpireData]);

  const columns = [
    { key: 'umpire', label: 'Umpire' },
    { key: 'challenged', label: 'Challenged' },
    { key: 'overturned', label: 'Overturned' },
    { key: 'overturnRate', label: 'Overturn Rate', render: v => <span style={{ color: v > 50 ? COLORS.red : v > 25 ? COLORS.orange : COLORS.green }}>{v.toFixed(1)}%</span> },
    { key: 'accuracyPct', label: 'Accuracy %', render: v => <span style={{ color: v >= 75 ? COLORS.green : v >= 50 ? COLORS.orange : COLORS.red }}>{v.toFixed(1)}%</span> },
    { key: 'avgMissOnOverturned', label: 'Avg Miss (OT)' },
  ];

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={chartCardStyle}>
          <div style={chartTitleStyle}>Highest Overturn Rate</div>
          <ResponsiveContainer width="100%" height={Math.max(300, overturnRanking.length * 26)}>
            <BarChart data={overturnRanking} layout="vertical" margin={{ left: 100 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" horizontal={false} />
              <XAxis type="number" stroke={COLORS.border} tick={{ fill: COLORS.textMuted, fontSize: 10 }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
              <YAxis type="category" dataKey="umpire" stroke={COLORS.border} tick={{ fill: COLORS.textMuted, fontSize: 10 }} width={95} />
              <Tooltip {...tooltipStyle} formatter={val => [`${val.toFixed(1)}%`, 'Overturn Rate']} />
              <Bar dataKey="overturnRate" radius={[0, 4, 4, 0]}>
                {overturnRanking.map((entry, idx) => (<Cell key={idx} fill={getBarColor(entry.overturnRate, false)} opacity={0.8} />))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={chartCardStyle}>
          <div style={chartTitleStyle}>Highest Accuracy Rate</div>
          <ResponsiveContainer width="100%" height={Math.max(300, accuracyRanking.length * 26)}>
            <BarChart data={accuracyRanking} layout="vertical" margin={{ left: 100 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" horizontal={false} />
              <XAxis type="number" stroke={COLORS.border} tick={{ fill: COLORS.textMuted, fontSize: 10 }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
              <YAxis type="category" dataKey="umpire" stroke={COLORS.border} tick={{ fill: COLORS.textMuted, fontSize: 10 }} width={95} />
              <Tooltip {...tooltipStyle} formatter={val => [`${val.toFixed(1)}%`, 'Accuracy']} />
              <Bar dataKey="accuracyPct" radius={[0, 4, 4, 0]}>
                {accuracyRanking.map((entry, idx) => (<Cell key={idx} fill={getBarColor(entry.accuracyPct, true)} opacity={0.8} />))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div style={chartCardStyle}>
        <div style={chartTitleStyle}>Umpire Details</div>
        <DataTable columns={columns} data={umpireData} defaultSort={{ key: 'overturnRate', dir: 'desc' }} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PITCH LOG TAB
// ═══════════════════════════════════════════════════════════════════════════════

function PitchLogTab({ challenges, onPitchClick }) {
  const tableData = useMemo(() =>
    challenges.map(c => ({
      ...c,
      count: `${c.balls}-${c.strikes}`,
      missInches: c.missDistanceInches != null ? `${c.missDistanceInches.toFixed(1)}"` : '—',
    })),
    [challenges]
  );

  const columns = [
    { key: 'date', label: 'Date' },
    { key: 'team', label: 'Team' },
    { key: 'inning', label: 'Inn' },
    { key: 'count', label: 'Count' },
    { key: 'batter', label: 'Batter' },
    { key: 'pitcher', label: 'Pitcher' },
    { key: 'challengerType', label: 'Challenger', render: v => <Badge label={v.toUpperCase()} color={v === 'Batter' ? COLORS.purple : COLORS.orange} /> },
    { key: 'pitchName', label: 'Pitch' },
    { key: 'velocity', label: 'Velo', render: v => v ? `${v}` : '—' },
    { key: 'missInches', label: 'Miss Dist' },
    { key: 'overturned', label: 'Result', render: (v) => <Badge label={v ? 'OVERTURNED' : 'CONFIRMED'} color={v ? COLORS.green : COLORS.red} /> },
    { key: 'umpire', label: 'Umpire' },
  ];

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={chartCardStyle}>
        <div style={chartTitleStyle}>All Challenges ({challenges.length})</div>
        <DataTable columns={columns} data={tableData} onRowClick={onPitchClick} defaultSort={{ key: 'date', dir: 'desc' }} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════

export default function App() {
  const { data, loading, error, isDemo } = useABSData();
  const [activeTab, setActiveTab] = useState('overview');
  const [filters, setFilters] = useState({ challengerType: 'All', result: 'All', team: 'All', search: '' });
  const [selectedChallenge, setSelectedChallenge] = useState(null);

  // Adjust miss distances: show gap from zone edge to ball edge (not center)
  const adjustedChallenges = useMemo(() => {
    if (!data?.challenges) return [];
    return data.challenges.map(c => ({
      ...c,
      missDistance: Math.max(0, (c.missDistance || 0) - BALL_RADIUS_FEET),
      missDistanceInches: Math.max(0, (c.missDistanceInches || 0) - BALL_RADIUS_INCHES),
    }));
  }, [data]);

  const filteredData = useMemo(() => {
    if (!adjustedChallenges.length) return [];
    return adjustedChallenges.filter(c => {
      if (filters.challengerType !== 'All') {
        const match = filters.challengerType === 'Batters' ? 'Batter' : 'Fielder';
        if (c.challengerType !== match) return false;
      }
      if (filters.result !== 'All') {
        if (filters.result === 'Overturned' && !c.overturned) return false;
        if (filters.result === 'Confirmed' && c.overturned) return false;
      }
      if (filters.team !== 'All' && c.team !== filters.team) return false;
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const fields = [c.batter, c.pitcher, c.umpire, c.team, c.teamName, c.catcher].filter(Boolean);
        if (!fields.some(f => f.toLowerCase().includes(s))) return false;
      }
      return true;
    });
  }, [adjustedChallenges, filters]);

  const handlePitchClick = useCallback((challenge) => {
    setSelectedChallenge(challenge);
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: COLORS.bg1 }}>
        <div style={{ width: 40, height: 40, border: `3px solid ${COLORS.border}`, borderTopColor: COLORS.accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <div style={{ marginTop: 16, color: COLORS.textMuted, fontSize: 14 }}>Loading ABS Challenge data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: COLORS.bg1 }}>
        <AlertTriangle size={48} color={COLORS.red} />
        <div style={{ marginTop: 16, color: COLORS.red, fontSize: 16, fontWeight: 600 }}>Failed to load data</div>
        <div style={{ marginTop: 8, color: COLORS.textMuted, fontSize: 13 }}>{error}</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg1, fontFamily: 'Inter, sans-serif' }}>
      {isDemo && (
        <div style={{ background: `${COLORS.orange}18`, borderBottom: `1px solid ${COLORS.orange}44`, padding: '8px 24px', textAlign: 'center', fontSize: 13, color: COLORS.orange, fontWeight: 500 }}>
          Demo Mode — Displaying sample data. Connect to live data source for the full dataset.
        </div>
      )}

      <header style={{ padding: '20px 32px 0', background: COLORS.bg1, position: 'sticky', top: 0, zIndex: 100, borderBottom: `1px solid ${COLORS.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: COLORS.text, letterSpacing: -0.5, margin: 0 }}>ABS Challenge Explorer</h1>
            <p style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 2 }}>MLB Automated Ball-Strike System — 2026 Season</p>
          </div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: COLORS.textMuted }}>
            {filteredData.length} challenge{filteredData.length !== 1 ? 's' : ''}
            {data?.lastUpdated && <span> | Updated {new Date(data.lastUpdated).toLocaleDateString()}</span>}
          </div>
        </div>

        <FilterBar filters={filters} onFilterChange={setFilters} />

        <nav style={{ display: 'flex', gap: 4, paddingTop: 12, overflowX: 'auto' }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                  borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: isActive ? 600 : 400, fontFamily: 'Inter, sans-serif',
                  color: isActive ? COLORS.accent : COLORS.textMuted,
                  background: isActive ? COLORS.bg3 : 'transparent',
                  borderBottom: isActive ? `2px solid ${COLORS.accent}` : '2px solid transparent',
                  transition: 'all 0.15s ease', whiteSpace: 'nowrap',
                }}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </header>

      <main style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
        {activeTab === 'overview' && <OverviewTab challenges={filteredData} onPitchClick={handlePitchClick} />}
        {activeTab === 'missDistance' && <MissDistanceTab challenges={filteredData} onPitchClick={handlePitchClick} />}
        {activeTab === 'players' && <PlayersTab challenges={filteredData} />}
        {activeTab === 'teams' && <TeamsTab challenges={filteredData} />}
        {activeTab === 'umpires' && <UmpiresTab challenges={filteredData} />}
        {activeTab === 'pitchLog' && <PitchLogTab challenges={filteredData} onPitchClick={handlePitchClick} />}
      </main>

      <PitchDetailModal challenge={selectedChallenge} onClose={() => setSelectedChallenge(null)} />
    </div>
  );
}

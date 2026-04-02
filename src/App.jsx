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
  const [tableFilter, setTableFilter] = useState({ type: null, value: null, inverted: false });

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
      rawType: d.name,
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

  // Build a reverse map: display name → raw pitchType code
  const pitchNameToRaw = useMemo(() => {
    const m = {};
    Object.entries(PITCH_TYPES).forEach(([code, name]) => { m[name] = code; });
    return m;
  }, []);

  // Apply the active table filter
  const tableChallenges = useMemo(() => {
    if (!tableFilter.type) return challenges;
    let result;
    const inv = tableFilter.inverted;
    switch (tableFilter.type) {
      case 'total':
        return challenges;
      case 'batterSuccess':
        result = challenges.filter(c => c.challengerType === 'Batter' && (inv ? !c.overturned : c.overturned));
        return result;
      case 'fielderSuccess':
        result = challenges.filter(c => c.challengerType === 'Fielder' && (inv ? !c.overturned : c.overturned));
        return result;
      case 'date':
        result = challenges.filter(c => inv ? c.date !== tableFilter.value : c.date === tableFilter.value);
        return result;
      case 'pitchType': {
        const raw = pitchNameToRaw[tableFilter.value] || tableFilter.value;
        result = challenges.filter(c => inv ? c.pitchType !== raw : c.pitchType === raw);
        return result;
      }
      case 'inning':
        result = challenges.filter(c => inv ? String(c.inning) !== tableFilter.value : String(c.inning) === tableFilter.value);
        return result;
      default:
        return challenges;
    }
  }, [challenges, tableFilter, pitchNameToRaw]);

  const tableData = useMemo(() =>
    tableChallenges.map(c => ({
      ...c,
      count: `${c.balls}-${c.strikes}`,
      missInches: c.missDistanceInches != null ? `${c.missDistanceInches.toFixed(1)}"` : '—',
    })),
    [tableChallenges]
  );

  const logColumns = [
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

  const handleCardClick = (type) => {
    if (tableFilter.type === type) {
      setTableFilter({ type: null, value: null, inverted: false });
    } else {
      setTableFilter({ type, value: null, inverted: false });
    }
  };

  const handleChartClick = (type, value) => {
    if (tableFilter.type === type && tableFilter.value === value && !tableFilter.inverted) {
      setTableFilter({ type: null, value: null, inverted: false });
    } else {
      setTableFilter({ type, value, inverted: false });
    }
  };

  const toggleInvert = () => {
    setTableFilter(prev => ({ ...prev, inverted: !prev.inverted }));
  };

  const filterLabel = useMemo(() => {
    if (!tableFilter.type) return null;
    const inv = tableFilter.inverted;
    switch (tableFilter.type) {
      case 'total': return 'All Challenges';
      case 'batterSuccess': return inv ? 'Batter Unsuccessful' : 'Batter Successful';
      case 'fielderSuccess': return inv ? 'Fielder Unsuccessful' : 'Fielder Successful';
      case 'date': return inv ? `Excluding ${tableFilter.value}` : `Date: ${tableFilter.value}`;
      case 'pitchType': return inv ? `Excluding ${tableFilter.value}` : `Pitch: ${tableFilter.value}`;
      case 'inning': return inv ? `Excluding Inning ${tableFilter.value}` : `Inning ${tableFilter.value}`;
      default: return null;
    }
  }, [tableFilter]);

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard label="Total Challenges" value={stats.total} icon={Activity} color={COLORS.accent}
          onClick={() => handleCardClick('total')} active={tableFilter.type === 'total'} />
        <StatCard label="Overturn Rate" value={`${stats.overturnRate}%`} icon={TrendingUp} color={COLORS.green} />
        <StatCard label="Avg Miss Distance" value={`${stats.avgMiss}"`} icon={Target} color={COLORS.orange} />
        <StatCard label="Batter Success" value={`${stats.batterSuccess}%`} icon={Users} color={COLORS.purple}
          onClick={() => handleCardClick('batterSuccess')} active={tableFilter.type === 'batterSuccess'} />
        <StatCard label="Fielder Success" value={`${stats.fielderSuccess}%`} icon={Shield} color={COLORS.red}
          onClick={() => handleCardClick('fielderSuccess')} active={tableFilter.type === 'fielderSuccess'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 24 }}>
        <div style={chartCardStyle}>
          <div style={chartTitleStyle}>Challenge Locations</div>
          <StrikeZone pitches={tableChallenges} width={360} height={420} onPitchClick={onPitchClick} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 16 }}>
          <div style={chartCardStyle}>
            <div style={chartTitleStyle}>Daily Trend <span style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 400 }}>click a bar</span></div>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={dailyData} onClick={(e) => { if (e?.activeLabel) handleChartClick('date', e.activeLabel); }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                <XAxis dataKey="date" stroke={COLORS.border} tick={{ fill: COLORS.textMuted, fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                <YAxis yAxisId="left" stroke={COLORS.border} tick={{ fill: COLORS.textMuted, fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" stroke={COLORS.border} tick={{ fill: COLORS.textMuted, fontSize: 10 }} domain={[0, 100]} />
                <Tooltip {...tooltipStyle} />
                <Bar yAxisId="left" dataKey="total" fill={COLORS.accent} opacity={0.6} radius={[2, 2, 0, 0]} name="Challenges" cursor="pointer" />
                <Bar yAxisId="left" dataKey="overturned" fill={COLORS.green} radius={[2, 2, 0, 0]} name="Overturned" cursor="pointer" />
                <Line yAxisId="right" dataKey="overturnRate" stroke={COLORS.orange} strokeWidth={2} dot={false} name="Overturn %" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div style={chartCardStyle}>
            <div style={chartTitleStyle}>By Pitch Type <span style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 400 }}>click a bar</span></div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={pitchTypeData} layout="vertical" onClick={(e) => { if (e?.activeLabel) handleChartClick('pitchType', e.activeLabel); }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" horizontal={false} />
                <XAxis type="number" stroke={COLORS.border} tick={{ fill: COLORS.textMuted, fontSize: 10 }} />
                <YAxis type="category" dataKey="name" stroke={COLORS.border} tick={{ fill: COLORS.textMuted, fontSize: 9 }} width={100} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="total" fill={COLORS.accent} opacity={0.6} radius={[0, 2, 2, 0]} name="Total" cursor="pointer" />
                <Bar dataKey="overturned" fill={COLORS.green} radius={[0, 2, 2, 0]} name="Overturned" cursor="pointer" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={chartCardStyle}>
            <div style={chartTitleStyle}>By Inning <span style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 400 }}>click a bar</span></div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={inningData} onClick={(e) => { if (e?.activeLabel) handleChartClick('inning', e.activeLabel); }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                <XAxis dataKey="inning" stroke={COLORS.border} tick={{ fill: COLORS.textMuted, fontSize: 10 }} />
                <YAxis stroke={COLORS.border} tick={{ fill: COLORS.textMuted, fontSize: 10 }} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="total" name="Total" radius={[2, 2, 0, 0]} cursor="pointer">
                  {inningData.map((entry, idx) => (
                    <Cell key={idx} fill={parseInt(entry.inning) >= 7 ? COLORS.purple : COLORS.accent} opacity={0.7} />
                  ))}
                </Bar>
                <Bar dataKey="overturned" fill={COLORS.green} radius={[2, 2, 0, 0]} name="Overturned" cursor="pointer" />
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

      {/* Filter indicator + invert toggle */}
      <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={chartTitleStyle}>
          Pitch Log {filterLabel ? `— ${filterLabel}` : ''} ({tableChallenges.length})
        </div>
        {tableFilter.type && tableFilter.type !== 'total' && (
          <button
            onClick={toggleInvert}
            style={{
              padding: '4px 12px', borderRadius: 4, fontSize: 11, fontWeight: 600,
              fontFamily: 'JetBrains Mono, monospace', cursor: 'pointer',
              border: `1px solid ${tableFilter.inverted ? COLORS.orange : COLORS.border}`,
              background: tableFilter.inverted ? `${COLORS.orange}22` : COLORS.bg3,
              color: tableFilter.inverted ? COLORS.orange : COLORS.textMuted,
            }}
          >
            Invert
          </button>
        )}
        {tableFilter.type && (
          <button
            onClick={() => setTableFilter({ type: null, value: null, inverted: false })}
            style={{
              padding: '4px 12px', borderRadius: 4, fontSize: 11, fontWeight: 500,
              fontFamily: 'JetBrains Mono, monospace', cursor: 'pointer',
              border: `1px solid ${COLORS.border}`, background: COLORS.bg3, color: COLORS.textMuted,
            }}
          >
            Clear Filter
          </button>
        )}
      </div>

      <div style={{ ...chartCardStyle, marginTop: 8 }}>
        <DataTable columns={logColumns} data={tableData} onRowClick={onPitchClick} defaultSort={{ key: 'date', dir: 'desc' }} />
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
  const [logFilters, setLogFilters] = useState({
    date: 'All', inning: 'All', batter: 'All', pitcher: 'All',
    challengerType: 'All', pitchType: 'All', result: 'All',
    umpire: 'All', inZone: 'All', team: 'All',
    veloMin: '', veloMax: '', missMin: '', missMax: '',
  });

  // Extract unique values for each filter dropdown
  const options = useMemo(() => {
    const unique = (field) => [...new Set(challenges.map(c => c[field]).filter(Boolean))].sort();
    return {
      dates: unique('date'),
      innings: [...new Set(challenges.map(c => c.inning))].sort((a, b) => a - b),
      batters: unique('batter'),
      pitchers: unique('pitcher'),
      pitchTypes: unique('pitchType').map(t => ({ value: t, label: PITCH_TYPES[t] || t })),
      umpires: unique('umpire'),
      teams: unique('team'),
    };
  }, [challenges]);

  const filteredChallenges = useMemo(() => {
    return challenges.filter(c => {
      if (logFilters.date !== 'All' && c.date !== logFilters.date) return false;
      if (logFilters.inning !== 'All' && String(c.inning) !== logFilters.inning) return false;
      if (logFilters.batter !== 'All' && c.batter !== logFilters.batter) return false;
      if (logFilters.pitcher !== 'All' && c.pitcher !== logFilters.pitcher) return false;
      if (logFilters.challengerType !== 'All' && c.challengerType !== logFilters.challengerType) return false;
      if (logFilters.pitchType !== 'All' && c.pitchType !== logFilters.pitchType) return false;
      if (logFilters.result !== 'All') {
        if (logFilters.result === 'Overturned' && !c.overturned) return false;
        if (logFilters.result === 'Confirmed' && c.overturned) return false;
      }
      if (logFilters.umpire !== 'All' && c.umpire !== logFilters.umpire) return false;
      if (logFilters.inZone !== 'All') {
        if (logFilters.inZone === 'Yes' && !c.inZone) return false;
        if (logFilters.inZone === 'No' && c.inZone) return false;
      }
      if (logFilters.team !== 'All' && c.team !== logFilters.team) return false;
      if (logFilters.veloMin && c.velocity < Number(logFilters.veloMin)) return false;
      if (logFilters.veloMax && c.velocity > Number(logFilters.veloMax)) return false;
      if (logFilters.missMin && (c.missDistanceInches || 0) < Number(logFilters.missMin)) return false;
      if (logFilters.missMax && (c.missDistanceInches || 0) > Number(logFilters.missMax)) return false;
      return true;
    });
  }, [challenges, logFilters]);

  const tableData = useMemo(() =>
    filteredChallenges.map(c => ({
      ...c,
      count: `${c.balls}-${c.strikes}`,
      missInches: c.missDistanceInches != null ? `${c.missDistanceInches.toFixed(1)}"` : '—',
    })),
    [filteredChallenges]
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

  const setF = (key, val) => setLogFilters(prev => ({ ...prev, [key]: val }));

  const activeFilterCount = Object.entries(logFilters).filter(([k, v]) => {
    if (['veloMin', 'veloMax', 'missMin', 'missMax'].includes(k)) return v !== '';
    return v !== 'All';
  }).length;

  const selectStyle = {
    padding: '5px 8px', borderRadius: 5, border: `1px solid ${COLORS.border}`,
    background: COLORS.bg3, color: COLORS.text, fontSize: 11, fontFamily: 'Inter, sans-serif',
    cursor: 'pointer', minWidth: 0,
  };
  const inputStyle = {
    ...selectStyle, width: 60, cursor: 'text',
  };
  const labelStyle = {
    fontSize: 9, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em',
    marginBottom: 2, fontFamily: 'JetBrains Mono, monospace',
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      {/* Filter panel */}
      <div style={{
        ...chartCardStyle, marginBottom: 16, padding: '16px 20px',
        display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end',
      }}>
        <div>
          <div style={labelStyle}>Date</div>
          <select value={logFilters.date} onChange={e => setF('date', e.target.value)} style={selectStyle}>
            <option value="All">All</option>
            {options.dates.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <div style={labelStyle}>Team</div>
          <select value={logFilters.team} onChange={e => setF('team', e.target.value)} style={selectStyle}>
            <option value="All">All</option>
            {options.teams.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <div style={labelStyle}>Inning</div>
          <select value={logFilters.inning} onChange={e => setF('inning', e.target.value)} style={selectStyle}>
            <option value="All">All</option>
            {options.innings.map(n => <option key={n} value={String(n)}>{n}</option>)}
          </select>
        </div>
        <div>
          <div style={labelStyle}>Batter</div>
          <select value={logFilters.batter} onChange={e => setF('batter', e.target.value)} style={selectStyle}>
            <option value="All">All</option>
            {options.batters.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <div style={labelStyle}>Pitcher</div>
          <select value={logFilters.pitcher} onChange={e => setF('pitcher', e.target.value)} style={selectStyle}>
            <option value="All">All</option>
            {options.pitchers.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <div style={labelStyle}>Challenger</div>
          <select value={logFilters.challengerType} onChange={e => setF('challengerType', e.target.value)} style={selectStyle}>
            <option value="All">All</option>
            <option value="Batter">Batter</option>
            <option value="Fielder">Fielder</option>
          </select>
        </div>
        <div>
          <div style={labelStyle}>Pitch Type</div>
          <select value={logFilters.pitchType} onChange={e => setF('pitchType', e.target.value)} style={selectStyle}>
            <option value="All">All</option>
            {options.pitchTypes.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <div style={labelStyle}>Result</div>
          <select value={logFilters.result} onChange={e => setF('result', e.target.value)} style={selectStyle}>
            <option value="All">All</option>
            <option value="Overturned">Overturned</option>
            <option value="Confirmed">Confirmed</option>
          </select>
        </div>
        <div>
          <div style={labelStyle}>Umpire</div>
          <select value={logFilters.umpire} onChange={e => setF('umpire', e.target.value)} style={selectStyle}>
            <option value="All">All</option>
            {options.umpires.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <div style={labelStyle}>In Zone</div>
          <select value={logFilters.inZone} onChange={e => setF('inZone', e.target.value)} style={selectStyle}>
            <option value="All">All</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>
        <div>
          <div style={labelStyle}>Velo Min</div>
          <input type="number" value={logFilters.veloMin} onChange={e => setF('veloMin', e.target.value)} placeholder="—" style={inputStyle} />
        </div>
        <div>
          <div style={labelStyle}>Velo Max</div>
          <input type="number" value={logFilters.veloMax} onChange={e => setF('veloMax', e.target.value)} placeholder="—" style={inputStyle} />
        </div>
        <div>
          <div style={labelStyle}>Miss Min"</div>
          <input type="number" value={logFilters.missMin} onChange={e => setF('missMin', e.target.value)} placeholder="—" style={inputStyle} step="0.1" />
        </div>
        <div>
          <div style={labelStyle}>Miss Max"</div>
          <input type="number" value={logFilters.missMax} onChange={e => setF('missMax', e.target.value)} placeholder="—" style={inputStyle} step="0.1" />
        </div>
        {activeFilterCount > 0 && (
          <button
            onClick={() => setLogFilters({
              date: 'All', inning: 'All', batter: 'All', pitcher: 'All',
              challengerType: 'All', pitchType: 'All', result: 'All',
              umpire: 'All', inZone: 'All', team: 'All',
              veloMin: '', veloMax: '', missMin: '', missMax: '',
            })}
            style={{
              padding: '5px 14px', borderRadius: 5, fontSize: 11, fontWeight: 600,
              fontFamily: 'JetBrains Mono, monospace', cursor: 'pointer',
              border: `1px solid ${COLORS.red}44`, background: `${COLORS.red}11`, color: COLORS.red,
            }}
          >
            Clear All ({activeFilterCount})
          </button>
        )}
      </div>

      <div style={chartCardStyle}>
        <div style={chartTitleStyle}>
          {activeFilterCount > 0 ? `Filtered Challenges (${filteredChallenges.length} of ${challenges.length})` : `All Challenges (${challenges.length})`}
        </div>
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
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: COLORS.textMuted, textAlign: 'right' }}>
            <div>
              {filteredData.length} challenge{filteredData.length !== 1 ? 's' : ''}
              {data?.lastUpdated && <span> | Updated {new Date(data.lastUpdated).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}</span>}
            </div>
            <div style={{ fontSize: 10, color: COLORS.textMuted, opacity: 0.6, marginTop: 2 }}>
              Syncs hourly · 12 PM – 12 AM PT during season
            </div>
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

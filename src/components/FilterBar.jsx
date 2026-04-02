import React from 'react';
import { Search } from 'lucide-react';
import { COLORS, ALL_TEAMS, TEAM_NAMES } from '../utils/constants';

const pillStyle = (active) => ({
  padding: '6px 14px',
  borderRadius: 20,
  border: `1px solid ${active ? COLORS.accent : COLORS.border}`,
  background: active ? COLORS.accent + '22' : 'transparent',
  color: active ? COLORS.accent : COLORS.textMuted,
  cursor: 'pointer',
  fontSize: 12,
  fontFamily: 'Inter, sans-serif',
  fontWeight: 500,
  transition: 'all 0.15s',
  whiteSpace: 'nowrap',
});

export default function FilterBar({ filters, onFilterChange }) {
  const set = (key, val) => onFilterChange({ ...filters, [key]: val });

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '10px 20px',
      background: COLORS.bg2,
      borderBottom: `1px solid ${COLORS.border}`,
      flexWrap: 'wrap',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {['All', 'Batters', 'Fielders'].map(t => (
          <button key={t} style={pillStyle(filters.challengerType === t)} onClick={() => set('challengerType', t)}>
            {t === 'All' ? 'All Challengers' : t}
          </button>
        ))}
      </div>

      <div style={{ width: 1, height: 24, background: COLORS.border }} />

      <div style={{ display: 'flex', gap: 4 }}>
        {['All', 'Overturned', 'Confirmed'].map(t => (
          <button key={t} style={pillStyle(filters.result === t)} onClick={() => set('result', t)}>
            {t}
          </button>
        ))}
      </div>

      <div style={{ width: 1, height: 24, background: COLORS.border }} />

      <select
        value={filters.team}
        onChange={e => set('team', e.target.value)}
        style={{
          padding: '6px 10px',
          borderRadius: 6,
          border: `1px solid ${COLORS.border}`,
          background: COLORS.bg3,
          color: COLORS.text,
          fontSize: 12,
          fontFamily: 'Inter, sans-serif',
          cursor: 'pointer',
        }}
      >
        <option value="All">All Teams</option>
        {ALL_TEAMS.map(t => (
          <option key={t} value={t}>{t} — {TEAM_NAMES[t]}</option>
        ))}
      </select>

      <div style={{ position: 'relative', flex: '0 1 200px', minWidth: 140 }}>
        <Search size={14} style={{ position: 'absolute', left: 8, top: 8, color: COLORS.textMuted }} />
        <input
          type="text"
          placeholder="Search players, umpires..."
          value={filters.search}
          onChange={e => set('search', e.target.value)}
          style={{
            width: '100%',
            padding: '6px 10px 6px 28px',
            borderRadius: 6,
            border: `1px solid ${COLORS.border}`,
            background: COLORS.bg3,
            color: COLORS.text,
            fontSize: 12,
            fontFamily: 'Inter, sans-serif',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>
    </div>
  );
}

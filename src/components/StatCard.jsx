import React from 'react';
import { COLORS } from '../utils/constants';

export default function StatCard({ label, value, subtitle, color = COLORS.accent, icon: Icon }) {
  return (
    <div style={{
      background: COLORS.bg3,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 8,
      padding: '16px 20px',
      minWidth: 160,
      flex: '1 1 160px',
      position: 'relative',
    }}>
      {Icon && (
        <Icon size={16} style={{ position: 'absolute', top: 12, right: 12, color: COLORS.textMuted }} />
      )}
      <div style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11,
        color: COLORS.textMuted,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'Oswald, sans-serif',
        fontSize: 32,
        fontWeight: 600,
        color,
        lineHeight: 1.1,
      }}>
        {value}
      </div>
      {subtitle && (
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          color: COLORS.textMuted,
          marginTop: 4,
        }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

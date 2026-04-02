import React, { useState, useMemo } from 'react';
import { COLORS } from '../utils/constants';

const ZONE_HALF_W = 0.708;
const BALL_RADIUS_FT = 1.45 / 12;
const VIEW_X_MIN = -1.8;
const VIEW_X_MAX = 1.8;
const VIEW_Z_MIN = 0.5;
const VIEW_Z_MAX = 4.5;

function toSvg(px, pz, width, height) {
  const x = ((px - VIEW_X_MIN) / (VIEW_X_MAX - VIEW_X_MIN)) * width;
  const y = ((VIEW_Z_MAX - pz) / (VIEW_Z_MAX - VIEW_Z_MIN)) * height;
  return { x, y };
}

export default function StrikeZone({ pitches = [], width = 380, height = 430, onPitchClick, highlightPitch }) {
  const [hovered, setHovered] = useState(null);

  const avgZone = useMemo(() => {
    if (!pitches.length) return { top: 3.4, bot: 1.55 };
    const top = pitches.reduce((s, p) => s + (p.zoneTop || 3.4), 0) / pitches.length;
    const bot = pitches.reduce((s, p) => s + (p.zoneBot || 1.55), 0) / pitches.length;
    return { top, bot };
  }, [pitches]);

  const effHalfW = ZONE_HALF_W + BALL_RADIUS_FT;
  const effTop = avgZone.top + BALL_RADIUS_FT;
  const effBot = avgZone.bot - BALL_RADIUS_FT;
  const zoneTopLeft = toSvg(-effHalfW, effTop, width, height);
  const zoneBotRight = toSvg(effHalfW, effBot, width, height);
  const zoneW = zoneBotRight.x - zoneTopLeft.x;
  const zoneH = zoneBotRight.y - zoneTopLeft.y;

  const third1 = toSvg(0, effBot + (effTop - effBot) * 2 / 3, width, height);
  const third2 = toSvg(0, effBot + (effTop - effBot) / 3, width, height);
  const thirdV = toSvg(-effHalfW / 3, 0, width, height);
  const thirdV2 = toSvg(effHalfW / 3, 0, width, height);
  const centerX = toSvg(0, 0, width, height).x;

  // Home plate polygon (catcher's view)
  const plateW = 0.708;
  const platePoints = [
    toSvg(-plateW, 0.3, width, height),
    toSvg(plateW, 0.3, width, height),
    toSvg(plateW, 0.15, width, height),
    toSvg(0, 0.0, width, height),
    toSvg(-plateW, 0.15, width, height),
  ].map(p => `${p.x},${p.y}`).join(' ');

  return (
    <svg width={width} height={height} style={{ background: COLORS.bg2, borderRadius: 8 }}>
      {/* Home plate */}
      <polygon points={platePoints} fill="none" stroke={COLORS.border} strokeWidth={1.5} />

      {/* Zone rectangle */}
      <rect
        x={zoneTopLeft.x} y={zoneTopLeft.y}
        width={zoneW} height={zoneH}
        fill="none" stroke={COLORS.textMuted} strokeWidth={1.5} strokeDasharray="6 3"
      />

      {/* Zone thirds */}
      <line x1={zoneTopLeft.x} y1={third1.y} x2={zoneBotRight.x} y2={third1.y}
        stroke={COLORS.border} strokeWidth={0.5} strokeDasharray="4 4" />
      <line x1={zoneTopLeft.x} y1={third2.y} x2={zoneBotRight.x} y2={third2.y}
        stroke={COLORS.border} strokeWidth={0.5} strokeDasharray="4 4" />
      <line x1={centerX - (zoneW / 6)} y1={zoneTopLeft.y} x2={centerX - (zoneW / 6)} y2={zoneBotRight.y}
        stroke={COLORS.border} strokeWidth={0.5} strokeDasharray="4 4" />
      <line x1={centerX + (zoneW / 6)} y1={zoneTopLeft.y} x2={centerX + (zoneW / 6)} y2={zoneBotRight.y}
        stroke={COLORS.border} strokeWidth={0.5} strokeDasharray="4 4" />

      {/* Pitch dots */}
      {pitches.map((p, i) => {
        const isHighlight = highlightPitch && highlightPitch.id === p.id;
        const isHover = hovered === p.id;
        const r = isHighlight ? 8 : isHover ? 7 : 5;
        const color = p.overturned ? COLORS.green : COLORS.red;

        // Use this pitch's individual zone (not the average) for nudging,
        // since inZone was determined per-batter
        let drawPx = p.px;
        let drawPz = p.pz;
        if (!p.inZone) {
          const margin = r / ((width) / (VIEW_X_MAX - VIEW_X_MIN)); // radius in feet
          const pEffTop = (p.zoneTop || 3.4) + BALL_RADIUS_FT;
          const pEffBot = (p.zoneBot || 1.55) - BALL_RADIUS_FT;
          if (drawPx > effHalfW) drawPx = Math.max(drawPx, effHalfW + margin);
          else if (drawPx < -effHalfW) drawPx = Math.min(drawPx, -effHalfW - margin);
          if (drawPz > pEffTop) drawPz = Math.max(drawPz, pEffTop + margin);
          else if (drawPz < pEffBot) drawPz = Math.min(drawPz, pEffBot - margin);
        }
        const pos = toSvg(drawPx, drawPz, width, height);
        return (
          <g key={p.id ?? i}>
            <circle
              cx={pos.x} cy={pos.y} r={r}
              fill={color} fillOpacity={isHighlight ? 0.9 : 0.7}
              stroke={isHighlight ? '#fff' : 'none'} strokeWidth={isHighlight ? 2 : 0}
              style={{ cursor: 'pointer', transition: 'r 0.1s' }}
              onClick={() => onPitchClick?.(p)}
              onMouseEnter={() => setHovered(p.id)}
              onMouseLeave={() => setHovered(null)}
            />
            {isHover && (
              <g>
                <rect
                  x={pos.x + 10} y={pos.y - 24}
                  width={Math.max(120, (p.batter?.length || 10) * 7 + 20)} height={32}
                  rx={4} fill={COLORS.bg3} stroke={COLORS.border} strokeWidth={1}
                />
                <text x={pos.x + 16} y={pos.y - 10} fill={COLORS.text}
                  fontFamily="JetBrains Mono" fontSize={10}>
                  {p.batter}
                </text>
                <text x={pos.x + 16} y={pos.y + 1} fill={p.overturned ? COLORS.green : COLORS.red}
                  fontFamily="JetBrains Mono" fontSize={9}>
                  {p.overturned ? 'OVERTURNED' : 'CONFIRMED'}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

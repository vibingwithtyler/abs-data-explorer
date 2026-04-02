import React from 'react';
import { X } from 'lucide-react';
import { COLORS } from '../utils/constants';
import { nearestZoneEdge, feetToInches } from '../utils/calculations';

const ZONE_HALF_W = 0.708;
const VIEW_X_MIN = -1.8;
const VIEW_X_MAX = 1.8;
const VIEW_Z_MIN = 0.5;
const VIEW_Z_MAX = 4.5;
const VIEW_W = VIEW_X_MAX - VIEW_X_MIN; // 3.6 ft
const VIEW_H = VIEW_Z_MAX - VIEW_Z_MIN; // 4.0 ft

function toSvg(px, pz, svgW, svgH) {
  const x = ((px - VIEW_X_MIN) / VIEW_W) * svgW;
  const y = ((VIEW_Z_MAX - pz) / VIEW_H) * svgH;
  return { x, y };
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function missContext(inches) {
  if (inches < 1) return 'Extremely close — less than 1 inch';
  if (inches < 3) return 'Borderline — within 3 inches';
  return 'Well off the zone';
}

function DetailRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${COLORS.border}22` }}>
      <span style={{ color: COLORS.textMuted, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>{label}</span>
      <span style={{ color: color || COLORS.text, fontSize: 12, fontFamily: 'JetBrains Mono, monospace', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

export default function PitchDetailModal({ challenge, onClose }) {
  if (!challenge) return null;

  const c = challenge;
  const svgW = 280;
  const svgH = Math.round(svgW * (VIEW_H / VIEW_W)); // ~311px, preserving aspect ratio
  const zoneTop = c.zoneTop || 3.4;
  const zoneBot = c.zoneBot || 1.55;
  const edge = nearestZoneEdge(c.px, c.pz, zoneTop, zoneBot);
  const dotR = 10;
  const ftPerPx = VIEW_W / svgW;
  const margin = dotR * ftPerPx;
  let drawPx = c.px;
  let drawPz = c.pz;
  if (!c.inZone) {
    if (drawPx > ZONE_HALF_W) drawPx = Math.max(drawPx, ZONE_HALF_W + margin);
    else if (drawPx < -ZONE_HALF_W) drawPx = Math.min(drawPx, -ZONE_HALF_W - margin);
    if (drawPz > zoneTop) drawPz = Math.max(drawPz, zoneTop + margin);
    else if (drawPz < zoneBot) drawPz = Math.min(drawPz, zoneBot - margin);
  }
  const pitchPos = toSvg(drawPx, drawPz, svgW, svgH);
  const edgePos = toSvg(edge.edgeX, edge.edgeZ, svgW, svgH);
  const ztl = toSvg(-ZONE_HALF_W, zoneTop, svgW, svgH);
  const zbr = toSvg(ZONE_HALF_W, zoneBot, svgW, svgH);
  const inches = c.missDistanceInches ?? feetToInches(c.missDistance ?? 0);

  const platePoints = [
    toSvg(-ZONE_HALF_W, 0.6, svgW, svgH),
    toSvg(ZONE_HALF_W, 0.6, svgW, svgH),
    toSvg(ZONE_HALF_W, 0.45, svgW, svgH),
    toSvg(0, 0.3, svgW, svgH),
    toSvg(-ZONE_HALF_W, 0.45, svgW, svgH),
  ].map(p => `${p.x},${p.y}`).join(' ');

  const thirdH1 = toSvg(0, zoneBot + (zoneTop - zoneBot) / 3, svgW, svgH);
  const thirdH2 = toSvg(0, zoneBot + (zoneTop - zoneBot) * 2 / 3, svgW, svgH);
  const thirdV1X = toSvg(-ZONE_HALF_W / 3, 0, svgW, svgH).x;
  const thirdV2X = toSvg(ZONE_HALF_W / 3, 0, svgW, svgH).x;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: COLORS.bg2,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          display: 'flex',
          flexWrap: 'wrap',
          maxWidth: 720,
          width: '100%',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 12, right: 12, zIndex: 10,
            background: 'none', border: 'none', color: COLORS.textMuted, cursor: 'pointer',
          }}
        >
          <X size={20} />
        </button>

        {/* Left: Strike Zone */}
        <div style={{ flex: '1 1 300px', padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width={svgW} height={svgH} style={{ background: COLORS.bg1, borderRadius: 8 }}>
            <polygon points={platePoints} fill="none" stroke={COLORS.border} strokeWidth={1.5} />
            <rect x={ztl.x} y={ztl.y} width={zbr.x - ztl.x} height={zbr.y - ztl.y}
              fill="none" stroke={COLORS.textMuted} strokeWidth={1.5} strokeDasharray="6 3" />
            {/* Zone thirds */}
            <line x1={ztl.x} y1={thirdH1.y} x2={zbr.x} y2={thirdH1.y} stroke={COLORS.border} strokeWidth={0.5} strokeDasharray="4 4" />
            <line x1={ztl.x} y1={thirdH2.y} x2={zbr.x} y2={thirdH2.y} stroke={COLORS.border} strokeWidth={0.5} strokeDasharray="4 4" />
            <line x1={thirdV1X} y1={ztl.y} x2={thirdV1X} y2={zbr.y} stroke={COLORS.border} strokeWidth={0.5} strokeDasharray="4 4" />
            <line x1={thirdV2X} y1={ztl.y} x2={thirdV2X} y2={zbr.y} stroke={COLORS.border} strokeWidth={0.5} strokeDasharray="4 4" />

            {/* Miss distance line — from zone edge to circle edge */}
            {!c.inZone && inches > 0 && (() => {
              // Shorten the line: start at zone edge, end at circle edge (not center)
              const dx = pitchPos.x - edgePos.x;
              const dy = pitchPos.y - edgePos.y;
              const len = Math.sqrt(dx * dx + dy * dy);
              // Circle edge point: move from center toward zone edge by dotR pixels
              const circleEdgeX = len > 0 ? pitchPos.x - (dx / len) * dotR : pitchPos.x;
              const circleEdgeY = len > 0 ? pitchPos.y - (dy / len) * dotR : pitchPos.y;
              return (
                <>
                  <line x1={circleEdgeX} y1={circleEdgeY} x2={edgePos.x} y2={edgePos.y}
                    stroke={COLORS.orange} strokeWidth={1.5} strokeDasharray="4 3" />
                  <text
                    x={(circleEdgeX + edgePos.x) / 2 + 8}
                    y={(circleEdgeY + edgePos.y) / 2 - 6}
                    fill={COLORS.orange} fontSize={11} fontFamily="JetBrains Mono"
                  >
                    {inches.toFixed(1)}"
                  </text>
                </>
              );
            })()}

            {/* Pitch dot */}
            <circle cx={pitchPos.x} cy={pitchPos.y} r={10}
              fill={c.overturned ? COLORS.green : COLORS.red}
              fillOpacity={0.85}
              stroke="#fff" strokeWidth={2}
            />
          </svg>
        </div>

        {/* Right: Details */}
        <div style={{ flex: '1 1 300px', padding: '20px 24px 20px 4px', minWidth: 280 }}>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 18, fontWeight: 600, color: COLORS.text, marginBottom: 12 }}>
            Pitch Detail
          </div>

          <DetailRow label="Date" value={c.date} />
          <DetailRow label="Inning" value={ordinal(c.inning)} />
          <DetailRow label="Count" value={`${c.balls}-${c.strikes}`} />
          <DetailRow label="Outs" value={c.outs} />
          <DetailRow label="Batter" value={c.batter} />
          <DetailRow label="Pitcher" value={c.pitcher} />
          <DetailRow label="Catcher" value={c.catcher || '—'} />
          <DetailRow label="Umpire" value={c.umpire} />
          <DetailRow label="Pitch" value={`${c.pitchName || c.pitchType} — ${c.velocity} mph`} />
          <DetailRow label="Challenger" value={c.challengerType} color={c.challengerType === 'Batter' ? COLORS.accent : COLORS.purple} />
          <DetailRow label="Original Call" value={c.originalCall} />
          <DetailRow
            label="Result"
            value={c.overturned ? 'OVERTURNED' : 'CONFIRMED'}
            color={c.overturned ? COLORS.green : COLORS.red}
          />

          {/* Miss distance highlight box */}
          <div style={{
            marginTop: 12,
            padding: 12,
            background: COLORS.bg3,
            borderRadius: 8,
            border: `1px solid ${COLORS.border}`,
            textAlign: 'center',
          }}>
            {c.inZone ? (
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 28, color: COLORS.green, fontWeight: 600 }}>
                IN ZONE
              </div>
            ) : (
              <>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 32, color: COLORS.orange, fontWeight: 600 }}>
                  {inches.toFixed(1)}"
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: COLORS.textMuted, marginTop: 4 }}>
                  {missContext(inches)}
                </div>
              </>
            )}
          </div>

          {/* Raw coords */}
          <div style={{ marginTop: 8, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: COLORS.textMuted, display: 'flex', gap: 12 }}>
            <span>px: {c.px?.toFixed(3)}</span>
            <span>pz: {c.pz?.toFixed(3)}</span>
            <span>top: {zoneTop.toFixed(2)}</span>
            <span>bot: {zoneBot.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

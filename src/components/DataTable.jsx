import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { COLORS } from '../utils/constants';

export default function DataTable({ columns, data, onRowClick, defaultSort, pageSize = 25 }) {
  const [sortKey, setSortKey] = useState(defaultSort?.key || columns[0]?.key);
  const [sortDir, setSortDir] = useState(defaultSort?.dir || 'desc');
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    const arr = [...data];
    arr.sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey];
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [data, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const handleSort = (key) => {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
    setPage(0);
  };

  const SortIcon = ({ col }) => {
    if (col.sortable === false) return null;
    if (sortKey !== col.key) return <ChevronDown size={12} style={{ opacity: 0.2 }} />;
    return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 12,
      }}>
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                onClick={() => col.sortable !== false && handleSort(col.key)}
                style={{
                  padding: '10px 12px',
                  textAlign: 'left',
                  borderBottom: `1px solid ${COLORS.border}`,
                  color: COLORS.textMuted,
                  fontWeight: 500,
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  cursor: col.sortable !== false ? 'pointer' : 'default',
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                  width: col.width,
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {col.label} <SortIcon col={col} />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paged.map((row, i) => (
            <tr
              key={row.id ?? i}
              onClick={() => onRowClick?.(row)}
              style={{
                cursor: onRowClick ? 'pointer' : 'default',
                borderBottom: `1px solid ${COLORS.border}22`,
              }}
              onMouseEnter={e => e.currentTarget.style.background = COLORS.bg3}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {columns.map(col => (
                <td key={col.key} style={{ padding: '8px 12px', color: COLORS.text, whiteSpace: 'nowrap' }}>
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 12,
          padding: '12px 0',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 12,
          color: COLORS.textMuted,
        }}>
          <button
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
            style={{
              padding: '4px 12px', borderRadius: 4,
              border: `1px solid ${COLORS.border}`, background: COLORS.bg3,
              color: page === 0 ? COLORS.border : COLORS.text, cursor: page === 0 ? 'default' : 'pointer',
            }}
          >
            Prev
          </button>
          <span>{page + 1} / {totalPages}</span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
            style={{
              padding: '4px 12px', borderRadius: 4,
              border: `1px solid ${COLORS.border}`, background: COLORS.bg3,
              color: page >= totalPages - 1 ? COLORS.border : COLORS.text,
              cursor: page >= totalPages - 1 ? 'default' : 'pointer',
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

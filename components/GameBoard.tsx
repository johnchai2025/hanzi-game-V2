'use client'

import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Cell } from '../types';
import { CellTile } from './CellTile';

interface Props {
  cells: Cell[][];
  onCellClick: (row: number, col: number) => void;
  flippedCells?: Set<string>;
  onFlipCell?: (cellId: string) => void;
}

type ConnectorKind = 'hint' | 'match' | 'mismatch';

interface ConnectorSpec {
  kind: ConnectorKind;
  aId: string;
  bId: string;
}

interface ConnectorLine extends ConnectorSpec {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// 棋盘上任意时刻，"提示中/消除中/震动中"的格子最多各有 2 个——
// 直接从格子状态里找出这两两一对的格子，不需要 useGame.ts 额外暴露数据
function findConnectorSpecs(cells: Cell[][]): ConnectorSpec[] {
  const groups: Record<ConnectorKind, string[]> = { hint: [], match: [], mismatch: [] };
  cells.forEach(row =>
    row.forEach(cell => {
      if (cell.isEmpty) return;
      if (cell.isEliminating) groups.match.push(cell.id);
      else if (cell.isShaking) groups.mismatch.push(cell.id);
      else if (cell.isHinted) groups.hint.push(cell.id);
    })
  );
  const specs: ConnectorSpec[] = [];
  (Object.keys(groups) as ConnectorKind[]).forEach(kind => {
    const ids = groups[kind];
    if (ids.length === 2) specs.push({ kind, aId: ids[0], bId: ids[1] });
  });
  return specs;
}

export function GameBoard({ cells, onCellClick, flippedCells, onFlipCell }: Props) {
  const rows = cells.length;
  const cols = cells[0]?.length ?? 0;
  const containerRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<ConnectorLine[]>([]);

  const boardStyle = {
    '--board-cols': cols,
    '--board-rows': rows,
  } as CSSProperties & Record<'--board-cols' | '--board-rows', number>;

  const specs = useMemo(() => findConnectorSpecs(cells), [cells]);
  // 只有"要连的格子变了"才重新量坐标，避免棋盘每次无关的 re-render 都重算一遍
  const specsKey = specs.map(s => `${s.kind}:${s.aId}-${s.bId}`).join('|');

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const containerRect = container.getBoundingClientRect();
      const next: ConnectorLine[] = [];
      for (const spec of specs) {
        const elA = container.querySelector<HTMLElement>(`[data-cell-id="${spec.aId}"]`);
        const elB = container.querySelector<HTMLElement>(`[data-cell-id="${spec.bId}"]`);
        if (!elA || !elB) continue;
        const rectA = elA.getBoundingClientRect();
        const rectB = elB.getBoundingClientRect();
        next.push({
          ...spec,
          x1: rectA.left + rectA.width / 2 - containerRect.left,
          y1: rectA.top + rectA.height / 2 - containerRect.top,
          x2: rectB.left + rectB.width / 2 - containerRect.left,
          y2: rectB.top + rectB.height / 2 - containerRect.top,
        });
      }
      setLines(next);
    };

    measure();

    if (specs.length === 0) return;
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specsKey]);

  return (
    <div className="game-board" style={boardStyle} ref={containerRef}>
      {cells.map((row, r) =>
        row.map((cell, c) => (
          <CellTile
            key={cell.id}
            cell={cell}
            onClick={() => onCellClick(r, c)}
            isFlipped={flippedCells?.has(cell.id)}
            onFlip={() => onFlipCell?.(cell.id)}
          />
        ))
      )}
      {lines.length > 0 && (
        <svg className="connector-layer" aria-hidden="true">
          {lines.map(line => {
            // 轻微的二次贝塞尔弧度，视觉上更像"连连看"的连线而不是生硬直尺线
            const mx = (line.x1 + line.x2) / 2;
            const my = (line.y1 + line.y2) / 2 - 14;
            // 曲线实际长度略长于两点直线距离，弧度很浅，+8% 近似即可，
            // 用作"画线"动画的 dasharray/dashoffset 起点，让线条长短不同时都能一次性画完
            const approxLength = Math.hypot(line.x2 - line.x1, line.y2 - line.y1) * 1.08;
            return (
              <path
                key={`${line.kind}-${line.aId}-${line.bId}`}
                className={`connector connector-${line.kind}`}
                d={`M ${line.x1} ${line.y1} Q ${mx} ${my} ${line.x2} ${line.y2}`}
                fill="none"
                style={{ '--connector-len': approxLength } as CSSProperties & Record<'--connector-len', number>}
              />
            );
          })}
        </svg>
      )}
    </div>
  );
}

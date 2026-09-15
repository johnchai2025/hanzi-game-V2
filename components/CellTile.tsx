'use client'

import { useRef } from 'react';
import { pinyin } from 'pinyin-pro';
import type { Cell } from '../types';

interface Props {
  cell: Cell;
  onClick: () => void;
  isFlipped?: boolean;
  onFlip?: () => void;
}

export function CellTile({ cell, onClick, isFlipped = false, onFlip }: Props) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  if (cell.isEmpty) {
    return <div className="cell cell-empty" />;
  }

  let className = 'cell';
  if (isFlipped) className += ' cell-flipped';
  else if (cell.isSelected) className += ' cell-selected';
  else if (cell.isHinted) className += ' cell-hinted';
  if (cell.isEliminating) className += ' cell-eliminating';
  if (cell.isShaking) className += ' cell-shaking';

  const handlePointerDown = () => {
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      onFlip?.();
    }, 600);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleClick = () => {
    if (didLongPress.current) return;
    // Short press on flipped tile → flip back (don't select)
    if (isFlipped) {
      onFlip?.();
    } else {
      onClick();
    }
  };

  const cellPinyin = pinyin(cell.char, { toneType: 'symbol' });

  return (
    <div
      className={className}
      data-cell-id={cell.id}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={cancelLongPress}
      onPointerLeave={cancelLongPress}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
    >
      <div className="cell-face cell-front">
        <span className="cell-word">{cell.char}</span>
      </div>
      <div className="cell-face cell-back">
        <span className="cell-pinyin-back">{cellPinyin}</span>
        <span className="cell-char-small">{cell.char}</span>
      </div>
    </div>
  );
}

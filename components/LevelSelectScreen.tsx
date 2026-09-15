'use client'

import { useState } from 'react';
import type { LevelData, CustomLevel, AnimalCharacter } from '../types';
import { CustomTab } from './CustomTab';
import { MascotImg } from './MascotImg';
import { LevelNodeIcon } from './LevelNodeIcon';

interface Props {
  levels: LevelData[];
  saveData: { unlockedLevels: string[]; completedLevels: string[] };
  customLevels: CustomLevel[];
  onSelectLevel: (level: LevelData) => void;
  onPlayCustom: (level: CustomLevel) => void;
  onSaveCustom: (level: CustomLevel) => void;
  onDeleteCustom: (id: string) => void;
  getCharacter: () => AnimalCharacter;
}

export function LevelSelectScreen({
  levels,
  saveData,
  customLevels,
  onSelectLevel,
  onPlayCustom,
  onSaveCustom,
  onDeleteCustom,
  getCharacter,
}: Props) {
  const [showCustom, setShowCustom] = useState(false);

  const character = getCharacter();
  // 列表里的第一关永远可玩：换课程后老存档里只有旧课程的关卡 ID，
  // 光靠 unlockedLevels 会导致新课程一关都开不了
  const isUnlocked = (id: string, idx?: number) =>
    idx === 0 || saveData.unlockedLevels.includes(id);
  const isCompleted = (id: string) => saveData.completedLevels.includes(id);

  // 第一个「已解锁未完成」即当前关
  const nowIndex = levels.findIndex((l, idx) => isUnlocked(l.id, idx) && !isCompleted(l.id));
  const doneCount = levels.filter(l => isCompleted(l.id)).length;

  const stateOf = (level: LevelData, idx: number): 'done' | 'now' | 'lock' => {
    if (isCompleted(level.id)) return 'done';
    if (idx === nowIndex) return 'now';
    return isUnlocked(level.id, idx) ? 'now' : 'lock';
  };

  const subOf = (st: 'done' | 'now' | 'lock') =>
    st === 'done' ? '已通关 ⭐⭐⭐' : st === 'now' ? '继续闯关！' : '通关解锁';

  return (
    <div className="map-main">
      <div className="map-head">
        <div className="map-title">识字大冒险</div>
        <div className="map-sub">二年级上 · {character.name || '小伙伴'}陪你出发</div>
        <div className="map-prog">⭐ {doneCount} / {levels.length}</div>
      </div>

      <div className="trail-scroll">
        <div className="trail">
          <div className="trail-line" />
          {levels.map((level, idx) => {
            const st = stateOf(level, idx);
            const pos = idx % 2 === 0 ? 'up' : 'down';
            const clickable = st !== 'lock';
            return (
              <div key={level.id} className={`trail-stop ${pos}`}>
                <div
                  className={`trail-node ${st}`}
                  onClick={() => clickable && onSelectLevel(level)}
                >
                  {st === 'now' ? (
                    <MascotImg animal={character.animal} emoji={character.emoji} />
                  ) : (
                    <LevelNodeIcon index={idx} title={level.title} locked={st === 'lock'} />
                  )}
                </div>
                <div className="trail-card">
                  <div className="trail-name">{level.level}. {level.title}</div>
                  <div className="trail-sub">{subOf(st)}</div>
                  {clickable && (
                    <button className="btn btn-primary" onClick={() => onSelectLevel(level)}>
                      {st === 'done' ? '重玩' : '开始'} →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button className="map-custom-btn" onClick={() => setShowCustom(true)}>
        ✨ 我的字库
      </button>

      {showCustom && (
        <div className="modal-overlay" onClick={() => setShowCustom(false)}>
          <div className="modal-content custom-modal" onClick={e => e.stopPropagation()}>
            <button className="close-btn custom-modal-close" onClick={() => setShowCustom(false)}>✕</button>
            <CustomTab
              customLevels={customLevels}
              onPlay={(l) => { setShowCustom(false); onPlayCustom(l); }}
              onDelete={onDeleteCustom}
              onSave={onSaveCustom}
            />
          </div>
        </div>
      )}
    </div>
  );
}

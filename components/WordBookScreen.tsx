'use client'

import { useState } from 'react'
import type { LevelData, CustomLevel, SaveData, WordCard } from '../types';
import { fetchWordImage } from '../lib/wordImageClient';

const GRADE_NAMES: Record<number, string> = { 1: '启蒙', 2: '进阶', 3: '挑战' };

type TabType = 'words' | 'cards';

interface Props {
  levels: LevelData[];
  saveData: SaveData;
  customLevels: CustomLevel[];
  onStory: () => void;
  onDeleteCard: (id: string) => void;
  onUpdateCard: (card: WordCard) => void;
}

export function WordBookScreen({ levels, saveData, customLevels, onStory, onDeleteCard, onUpdateCard }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('cards');
  const [selectedCard, setSelectedCard] = useState<WordCard | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);
  const playedCustomLevels = customLevels.filter(l => l.playCount > 0);

  const builtInTotal = levels
    .filter(l => saveData.completedLevels.includes(l.id))
    .reduce((sum, l) => sum + l.pairs.length, 0);

  const customTotal = playedCustomLevels
    .reduce((sum, l) => sum + l.pairs.length, 0);

  const totalWords = builtInTotal + customTotal;

  const totalCards = saveData.wordCards?.length || 0;

  // 图鉴槽位：至少 18 格，且始终留有待收集的锁定位
  const albumSlots = Math.max(18, Math.ceil((totalCards + 1) / 6) * 6);
  const lockedSlots = Math.max(0, albumSlots - totalCards);
  const storyThreshold = 4;
  const remainForStory = Math.max(0, storyThreshold - totalCards);

  return (
    <div className="wb-main">
      <div className="wb-tabs">
        <button
          className={`wb-tab ${activeTab === 'cards' ? 'active' : ''}`}
          onClick={() => setActiveTab('cards')}
        >
          🎴 宝藏图鉴 ({totalCards})
        </button>
        <button
          className={`wb-tab ${activeTab === 'words' ? 'active' : ''}`}
          onClick={() => setActiveTab('words')}
        >
          📝 词语本
        </button>
      </div>

      {/* 词卡库 Tab — 宝藏图鉴 */}
      {activeTab === 'cards' && (
        <>
          <div className="wb-top">
            <div>
              <div className="wb-title">宝藏图鉴</div>
              <div className="wb-sub">把配对成功的词卡都收集起来吧～</div>
            </div>
            <div className="wb-stat"><b>{totalCards}</b> / {albumSlots} 张</div>
          </div>
          <div className="wb-progbar">
            <div style={{ width: `${Math.round((totalCards / albumSlots) * 100)}%` }} />
          </div>

          <div className="album-pad">
            <div className="album-grid-pad">
              {saveData.wordCards?.map(card => (
                <div
                  key={card.id}
                  className="sticker-pad got"
                  onClick={() => { setSelectedCard(card); setConfirmDelete(false); setRegenError(null); }}
                >
                  {card.imageUrl ? (
                    <img src={card.imageUrl} alt={card.word} />
                  ) : (
                    <div className="wcard-ph">{card.word}</div>
                  )}
                  <div className="sticker-cap">{card.word}</div>
                </div>
              ))}
              {Array.from({ length: lockedSlots }, (_, i) => (
                <div key={`lock-${i}`} className="sticker-pad locked">?</div>
              ))}
            </div>
          </div>

          <div className="wb-foot">
            <span className="wb-foot-txt">
              {remainForStory > 0 ? `📖 再集 ${remainForStory} 张解锁故事屋` : '📖 词卡够啦，去编个故事吧！'}
            </span>
            <button className="btn btn-primary" disabled={totalCards < storyThreshold} onClick={onStory}>
              ✍️ 用宝藏编故事
            </button>
          </div>
        </>
      )}

      {/* 词语本 Tab */}
      {activeTab === 'words' && (
        <div className="wb-words-scroll">
          <div className="wordbook-hero">
            <span className="wordbook-hero-num">{totalWords}</span>
            <span className="wordbook-hero-label">已学会的词语</span>
          </div>

          <div className="wordbook-sections">
            {([1, 2, 3] as const).map(grade => {
              const gradeLevels = levels.filter(l => l.grade === grade);
              const unlockedCount = gradeLevels.filter(l => saveData.unlockedLevels.includes(l.id)).length;
              const completedPairs = gradeLevels
                .filter(l => saveData.completedLevels.includes(l.id))
                .flatMap(l => l.pairs);
              const isGradeLocked = unlockedCount === 0;

              return (
                <div key={grade} className={`wordbook-section${isGradeLocked ? ' wordbook-section-locked' : ''}`}>
                  <div className="wordbook-section-header">
                    <span className="wordbook-section-title">第{grade}级 · {GRADE_NAMES[grade]}</span>
                    <span className={`wordbook-section-badge${isGradeLocked ? ' badge-locked' : ''}`}>
                      {isGradeLocked ? '未解锁' : `已解锁 ${unlockedCount} 关`}
                    </span>
                  </div>

                  {isGradeLocked ? (
                    <div className="wordbook-locked-hint">完成上一级后解锁</div>
                  ) : completedPairs.length === 0 ? (
                    <div className="wordbook-empty-hint">完成关卡后词语将收录在这里～</div>
                  ) : (
                    <div className="wordbook-chips">
                      {completedPairs.map((pair, i) => (
                        <span key={i} className="word-chip">{pair[0]}{pair[1]}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* 自定义词库分区 */}
            <div className={`wordbook-section${playedCustomLevels.length === 0 ? ' wordbook-section-locked' : ''}`}>
              <div className="wordbook-section-header">
                <span className="wordbook-section-title">自定义词库</span>
                <span className={`wordbook-section-badge${playedCustomLevels.length === 0 ? ' badge-locked' : ''}`}>
                  {playedCustomLevels.length === 0 ? '暂无记录' : `${playedCustomLevels.length} 个词库`}
                </span>
              </div>

              {playedCustomLevels.length === 0 ? (
                <div className="wordbook-empty-hint">上传并完成自定义词库后将收录在这里～</div>
              ) : (
                playedCustomLevels.map(level => (
                  <div key={level.id} className="wordbook-custom-group">
                    <div className="wordbook-custom-title">{level.title}</div>
                    <div className="wordbook-chips">
                      {level.pairs.map((pair, i) => (
                        <span key={i} className="word-chip">{pair[0]}{pair[1]}</span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 词卡详情弹窗 */}
      {selectedCard && (
        <div
          className="modal-overlay"
          onClick={() => { setSelectedCard(null); setConfirmDelete(false); setRegenError(null); }}
        >
          <div className="wordcard-detail-modal" onClick={e => e.stopPropagation()}>
            <button
              className="close-btn"
              onClick={() => { setSelectedCard(null); setConfirmDelete(false); setRegenError(null); }}
            >×</button>
            <div className="detail-image">
              {selectedCard.imageUrl ? (
                <img src={selectedCard.imageUrl} alt={selectedCard.word} />
              ) : (
                <div className="detail-placeholder">
                  <span>{selectedCard.word}</span>
                </div>
              )}
            </div>
            <div className="detail-info">
              <h2>{selectedCard.word}</h2>
            </div>
            <button
              className="wordcard-regen-btn"
              disabled={regenerating}
              onClick={async () => {
                setRegenerating(true);
                setRegenError(null);
                const { imageUrl, error } = await fetchWordImage(selectedCard.word, true);
                setRegenerating(false);
                if (imageUrl) {
                  const updated: WordCard = { ...selectedCard, imageUrl, generatedAt: Date.now() };
                  onUpdateCard(updated);
                  setSelectedCard(updated);
                } else {
                  setRegenError(error ?? '生成失败，请稍后再试');
                }
              }}
            >
              {regenerating ? '生成中…' : '🔄 换一张图'}
            </button>
            {regenError && <div className="wordcard-regen-error">{regenError}</div>}
            {!confirmDelete ? (
              <button
                className="wordcard-delete-btn"
                onClick={() => setConfirmDelete(true)}
              >
                删除词卡
              </button>
            ) : (
              <div className="wordcard-confirm-row">
                <span>确定删除这张词卡？</span>
                <button
                  className="wordcard-confirm-yes"
                  onClick={() => {
                    onDeleteCard(selectedCard.id);
                    setSelectedCard(null);
                    setConfirmDelete(false);
                  }}
                >
                  确认删除
                </button>
                <button
                  className="wordcard-confirm-no"
                  onClick={() => setConfirmDelete(false)}
                >
                  取消
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

'use client'

import { useState } from 'react'
import type { LevelData, CustomLevel, SaveData, WordCard } from '../types';
import { STORY_CARD_MINIMUM } from '../types';

type TabType = 'words' | 'cards';

interface Props {
  levels: LevelData[];
  saveData: SaveData;
  customLevels: CustomLevel[];
  onStory: () => void;
  onDeleteCard: (id: string) => void;
}

export function WordBookScreen({ levels, saveData, customLevels, onStory, onDeleteCard }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('cards');
  const [selectedCard, setSelectedCard] = useState<WordCard | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const practiceByLevel = saveData.practiceByLevel || {};
  const practicedCustomLevels = customLevels.filter(level =>
    Object.keys(practiceByLevel[level.id] || {}).length > 0
  );
  const totalWords = new Set(
    Object.values(practiceByLevel).flatMap(levelPractice => Object.keys(levelPractice))
  ).size;

  const totalCards = saveData.wordCards?.length || 0;

  // 图鉴槽位：至少 18 格，且始终留有待收集的锁定位
  const albumSlots = Math.max(18, Math.ceil((totalCards + 1) / 6) * 6);
  const lockedSlots = Math.max(0, albumSlots - totalCards);
  const remainForStory = Math.max(0, STORY_CARD_MINIMUM - totalCards);

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
                  onClick={() => { setSelectedCard(card); setConfirmDelete(false); }}
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
            <button className="btn btn-primary" disabled={totalCards < STORY_CARD_MINIMUM} onClick={onStory}>
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
            <span className="wordbook-hero-label">已练习的词语</span>
          </div>

          <div className="wordbook-sections">
            {levels.map((level, index) => {
              const practicedWords = Object.keys(practiceByLevel[level.id] || {});
              const isLocked = index !== 0 && !saveData.unlockedLevels.includes(level.id);
              return (
                <div key={level.id} className={`wordbook-section${isLocked ? ' wordbook-section-locked' : ''}`}>
                  <div className="wordbook-section-header">
                    <span className="wordbook-section-title">第{level.level}关 · {level.title}</span>
                    <span className={`wordbook-section-badge${isLocked ? ' badge-locked' : ''}`}>
                      {isLocked ? '未解锁' : `已练习 ${practicedWords.length} / ${level.pairs.length}`}
                    </span>
                  </div>
                  {isLocked ? (
                    <div className="wordbook-locked-hint">完成上一关后解锁</div>
                  ) : practicedWords.length === 0 ? (
                    <div className="wordbook-empty-hint">配对成功的词语会收录在这里～</div>
                  ) : (
                    <div className="wordbook-chips">
                      {practicedWords.map(word => <span key={word} className="word-chip">{word}</span>)}
                    </div>
                  )}
                </div>
              );
            })}

            {/* 自定义词库分区 */}
            <div className={`wordbook-section${practicedCustomLevels.length === 0 ? ' wordbook-section-locked' : ''}`}>
              <div className="wordbook-section-header">
                <span className="wordbook-section-title">自定义词库</span>
                <span className={`wordbook-section-badge${practicedCustomLevels.length === 0 ? ' badge-locked' : ''}`}>
                  {practicedCustomLevels.length === 0 ? '暂无记录' : `${practicedCustomLevels.length} 个词库`}
                </span>
              </div>

              {practicedCustomLevels.length === 0 ? (
                <div className="wordbook-empty-hint">上传词库并配对成功后将收录在这里～</div>
              ) : (
                practicedCustomLevels.map(level => (
                  <div key={level.id} className="wordbook-custom-group">
                    <div className="wordbook-custom-title">{level.title}</div>
                    <div className="wordbook-chips">
                      {Object.keys(practiceByLevel[level.id] || {}).map(word => (
                        <span key={word} className="word-chip">{word}</span>
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
          onClick={() => { setSelectedCard(null); setConfirmDelete(false); }}
        >
          <div className="wordcard-detail-modal" onClick={e => e.stopPropagation()}>
            <button
              className="close-btn"
              onClick={() => { setSelectedCard(null); setConfirmDelete(false); }}
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

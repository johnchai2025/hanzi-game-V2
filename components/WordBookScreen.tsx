'use client'

import { useState } from 'react'
import type { LevelData, CustomLevel, SaveData, WordCard } from '../types';
import { STORY_CARD_MINIMUM } from '../types';
import { getLearningStatus, normalizeWordPractice } from '../lib/learningProgress';

type TabType = 'words' | 'cards';
type LearningFilter = 'all' | 'support' | 'familiar';

interface Props {
  levels: LevelData[];
  saveData: SaveData;
  customLevels: CustomLevel[];
  onStory: () => void;
  onDeleteCard: (id: string) => void;
}

export function WordBookScreen({ levels, saveData, customLevels, onStory, onDeleteCard }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('cards');
  const [learningFilter, setLearningFilter] = useState<LearningFilter>('all');
  const [selectedCard, setSelectedCard] = useState<WordCard | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const practiceByLevel = saveData.practiceByLevel || {};
  const isActuallyPracticed = (practice: unknown) => {
    const normalized = normalizeWordPractice(practice);
    return normalized.correctCount > 0 || normalized.wrongCount > 0
      || normalized.hintCount > 0 || normalized.lastPracticedAt > 0;
  };
  const matchesLearningFilter = (practice: unknown) => {
    const status = getLearningStatus(normalizeWordPractice(practice));
    if (learningFilter === 'familiar') return status === 'familiar';
    if (learningFilter === 'support') return status === 'needs-support' || status === 'familiarizing';
    return true;
  };
  const practicedEntries = Object.entries(practiceByLevel).flatMap(([levelId, byWord]) =>
    Object.entries(byWord).filter(([, practice]) => isActuallyPracticed(practice))
      .map(([word, practice]) => ({ levelId, word, practice })),
  );
  const uniquePracticeByWord = new Map<string, (typeof practicedEntries)[number]>();
  practicedEntries.forEach(entry => {
    const existing = uniquePracticeByWord.get(entry.word);
    if (!existing || normalizeWordPractice(entry.practice).correctStreak > normalizeWordPractice(existing.practice).correctStreak) {
      uniquePracticeByWord.set(entry.word, entry);
    }
  });
  const allPracticedWords = [...uniquePracticeByWord.values()];
  const filterCounts = {
    all: allPracticedWords.length,
    support: allPracticedWords.filter(({ practice }) => {
      const status = getLearningStatus(normalizeWordPractice(practice));
      return status === 'needs-support' || status === 'familiarizing';
    }).length,
    familiar: allPracticedWords.filter(({ practice }) => getLearningStatus(normalizeWordPractice(practice)) === 'familiar').length,
  };
  const practicedCustomLevels = customLevels.filter(level =>
    Object.values(practiceByLevel[level.id] || {}).some(isActuallyPracticed)
  );
  const knownLevelIds = new Set([...levels.map(level => level.id), ...customLevels.map(level => level.id)]);
  const orphanEntries = practicedEntries.filter(entry => !knownLevelIds.has(entry.levelId) && matchesLearningFilter(entry.practice));
  const totalWords = filterCounts.all;

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

          <div className="wordbook-filters" role="group" aria-label="按学习状态筛选">
            {([
              ['all', '全部练过'],
              ['support', '待巩固'],
              ['familiar', '已经熟悉'],
            ] as const).map(([key, label]) => (
              <button key={key} type="button"
                className={`wordbook-filter${learningFilter === key ? ' active' : ''}`}
                aria-pressed={learningFilter === key}
                onClick={() => setLearningFilter(key)}>
                <span>{label}</span><b>{filterCounts[key]}</b>
              </button>
            ))}
          </div>

          {filterCounts[learningFilter] === 0 && (
            <div className="wordbook-filter-empty" role="status">
              {learningFilter === 'familiar'
                ? '再多练几次，熟悉的词语就会来到这里～'
                : learningFilter === 'support'
                  ? '现在没有需要巩固的词语，保持得真棒！'
                  : '完成一次配对后，练过的词语会收录在这里～'}
            </div>
          )}

          <div className="wordbook-sections">
            {levels.map((level, index) => {
              const levelPractice = practiceByLevel[level.id] || {};
              const allLevelPracticedWords = Object.entries(levelPractice)
                .filter(([, practice]) => isActuallyPracticed(practice));
              const practicedWords = allLevelPracticedWords
                .filter(([, practice]) => matchesLearningFilter(practice))
                .map(([word]) => word);
              const isLocked = index !== 0 && !saveData.unlockedLevels.includes(level.id);
              return (
                <div key={level.id} className={`wordbook-section${isLocked ? ' wordbook-section-locked' : ''}`}>
                  <div className="wordbook-section-header">
                    <span className="wordbook-section-title">第{level.level}关 · {level.title}</span>
                    <span className={`wordbook-section-badge${isLocked ? ' badge-locked' : ''}`}>
                      {isLocked ? '未解锁' : `已练习 ${allLevelPracticedWords.length} / ${level.pairs.length}`}
                    </span>
                  </div>
                  {isLocked ? (
                    <div className="wordbook-locked-hint">完成上一关后解锁</div>
                  ) : practicedWords.length === 0 ? (
                    <div className="wordbook-empty-hint">
                      {allLevelPracticedWords.length === 0 ? '配对成功的词语会收录在这里～' : '这一关暂时没有符合筛选的词语～'}
                    </div>
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
                      {Object.entries(practiceByLevel[level.id] || {})
                        .filter(([, practice]) => isActuallyPracticed(practice) && matchesLearningFilter(practice))
                        .map(([word]) => (
                        <span key={word} className="word-chip">{word}</span>
                        ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {orphanEntries.length > 0 && (
              <div className="wordbook-section">
                <div className="wordbook-section-header">
                  <span className="wordbook-section-title">其他练习</span>
                  <span className="wordbook-section-badge">已练习 {orphanEntries.length}</span>
                </div>
                <div className="wordbook-chips">
                  {orphanEntries.map(({ levelId, word }) => (
                    <span key={`${levelId}-${word}`} className="word-chip">{word}</span>
                  ))}
                </div>
              </div>
            )}
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

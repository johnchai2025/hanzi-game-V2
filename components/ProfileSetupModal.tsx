'use client';

import { useState } from 'react';
import type { UserProfile, AnimalCharacter } from '@/types';
import { AVAILABLE_ANIMALS, AVAILABLE_SCENES } from '@/types';
import { MascotImg } from './MascotImg';
import { AnimalIcon } from './AnimalIcon';

function SceneIcon({ name }: { name: string }) {
  switch (name) {
    case '森林': return (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <polygon points="8,21 13,9 18,21" fill="#4ade80"/>
        <rect x="12" y="21" width="2" height="4" rx="1" fill="#92400e"/>
        <polygon points="16,19 22,5 28,19" fill="#16a34a"/>
        <rect x="21" y="19" width="2" height="5" rx="1" fill="#92400e"/>
      </svg>
    );
    case '学校': return (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect x="5" y="14" width="22" height="14" rx="2" fill="#60a5fa"/>
        <polygon points="3,14 16,6 29,14" fill="#3b82f6"/>
        <rect x="13" y="20" width="6" height="8" rx="1" fill="#fef3c7"/>
        <line x1="16" y1="6" x2="16" y2="2" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round"/>
        <polygon points="16,2 21,4.5 16,7" fill="#fbbf24"/>
      </svg>
    );
    case '家里': return (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <polygon points="4,15 16,5 28,15" fill="#fb923c"/>
        <rect x="6" y="14" width="20" height="14" rx="2" fill="#fef3c7"/>
        <rect x="13" y="20" width="6" height="8" rx="1" fill="#fb923c"/>
        <rect x="7" y="17" width="5" height="5" rx="1" fill="#bfdbfe"/>
        <rect x="20" y="17" width="5" height="5" rx="1" fill="#bfdbfe"/>
      </svg>
    );
    case '太空': return (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <ellipse cx="16" cy="14" rx="5" ry="9" fill="#a855f7"/>
        <polygon points="11,8 16,2 21,8" fill="#7c3aed"/>
        <polygon points="11,18 7,25 11,22" fill="#c084fc"/>
        <polygon points="21,18 25,25 21,22" fill="#c084fc"/>
        <ellipse cx="16" cy="25" rx="3" ry="4" fill="#f97316"/>
        <ellipse cx="16" cy="25" rx="1.5" ry="2.5" fill="#fbbf24"/>
        <circle cx="5" cy="6" r="1" fill="#fbbf24"/>
        <circle cx="27" cy="10" r="1" fill="#fbbf24"/>
        <circle cx="4" cy="20" r="0.8" fill="#e0e7ff"/>
      </svg>
    );
    case '海边': return (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <circle cx="24" cy="8" r="5" fill="#fbbf24"/>
        <path d="M2,20 Q6,15 10,20 Q14,25 18,20 Q22,15 26,20 Q28,22 30,20 L30,30 L2,30 Z" fill="#38bdf8"/>
        <path d="M2,20 Q6,15 10,20 Q14,25 18,20 Q22,15 26,20 Q28,22 30,20" stroke="#0ea5e9" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      </svg>
    );
    case '城市': return (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect x="2" y="16" width="8" height="14" rx="1" fill="#818cf8"/>
        <rect x="3" y="13" width="6" height="4" rx="0.5" fill="#6366f1"/>
        <rect x="12" y="10" width="8" height="20" rx="1" fill="#6366f1"/>
        <rect x="13" y="7" width="6" height="4" rx="0.5" fill="#4f46e5"/>
        <rect x="22" y="14" width="8" height="16" rx="1" fill="#818cf8"/>
        <rect x="4" y="18" width="2" height="2" rx="0.3" fill="#e0e7ff"/>
        <rect x="7" y="18" width="2" height="2" rx="0.3" fill="#e0e7ff"/>
        <rect x="14" y="13" width="2" height="2" rx="0.3" fill="#e0e7ff"/>
        <rect x="18" y="13" width="2" height="2" rx="0.3" fill="#e0e7ff"/>
        <rect x="23" y="17" width="2" height="2" rx="0.3" fill="#e0e7ff"/>
        <rect x="27" y="17" width="2" height="2" rx="0.3" fill="#e0e7ff"/>
      </svg>
    );
    case '糖果王国': return (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <circle cx="13" cy="12" r="7" fill="#f472b6"/>
        <circle cx="13" cy="12" r="7" stroke="#ec4899" strokeWidth="1.5" fill="none"/>
        <path d="M13,6 Q18,9 13,12 Q8,15 13,18" stroke="#fde68a" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        <line x1="18" y1="17" x2="26" y2="28" stroke="#c084fc" strokeWidth="2.5" strokeLinecap="round"/>
        <polygon points="26,6 27.2,9.5 31,9.5 28.1,11.7 29.3,15.2 26,13 22.7,15.2 23.9,11.7 21,9.5 24.8,9.5" fill="#c084fc"/>
      </svg>
    );
    default: return null;
  }
}

interface ProfileSetupModalProps {
  onComplete: (profile: UserProfile) => void;
}

type Step = 1 | 2 | 3;

export function ProfileSetupModal({ onComplete }: ProfileSetupModalProps) {
  const [step, setStep] = useState<Step>(1);
  const [childName, setChildName] = useState('');
  const [selectedAnimal, setSelectedAnimal] = useState<typeof AVAILABLE_ANIMALS[number] | null>(null);
  const [animalName, setAnimalName] = useState('');
  const [selectedScenes, setSelectedScenes] = useState<string[]>([]);

  const handleSceneToggle = (sceneName: string) => {
    setSelectedScenes(prev => {
      if (prev.includes(sceneName)) return prev.filter(s => s !== sceneName);
      return [...prev, sceneName];
    });
  };

  const handleComplete = () => {
    const character: AnimalCharacter = {
      animal: selectedAnimal?.animal ?? '小兔子',
      emoji: selectedAnimal?.emoji ?? '🐰',
      name: animalName.trim() || (selectedAnimal?.animal ?? '小兔子'),
    };
    onComplete({
      childName: childName.trim() || '小朋友',
      character,
      preferredScenes: selectedScenes,
      setupCompleted: true,
    });
  };

  const canProceed = () => {
    if (step === 2) return selectedAnimal !== null && animalName.trim().length > 0;
    if (step === 3) return selectedScenes.length > 0;
    return true;
  };

  return (
    <div className="profile-setup-modal">
      <div className="ob">
        {/* 进度指示器 */}
        <div className="ob-steps">
          {[1, 2, 3].map(s => (
            <div key={s} className={`step-dot ${s === step ? 'active' : ''} ${s < step ? 'done' : ''}`}>
              {s < step ? '✓' : s}
            </div>
          ))}
        </div>

        {/* Step 1: 欢迎 + 起名 */}
        {step === 1 && (
          <div className="ob-single">
            <div className="welcome-icon">👋</div>
            <h2 className="ob-h">欢迎来到汉字对对碰！</h2>
            <p className="ob-p">让我们一起开启有趣的汉字学习之旅吧！</p>
            <div className="ob-name">
              <label>你叫什么名字呀？（可选）</label>
              <input
                type="text"
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                placeholder="输入你的名字"
                maxLength={10}
              />
            </div>
          </div>
        )}

        {/* Step 2: 选小动物 + 起名（横屏双栏） */}
        {step === 2 && (
          <div className="ob-cols">
            <div className="ob-left">
              <div className="ob-hero">
                <MascotImg
                  animal={selectedAnimal?.animal}
                  emoji={selectedAnimal?.emoji ?? '🐰'}
                  className="mascot-img-xl"
                />
                <div className="speech ob-speech">
                  {selectedAnimal ? `你好呀！给我起个名字吧～` : '挑一个小伙伴陪你学汉字吧！'}
                </div>
                {selectedAnimal && (
                  <div className="ob-name">
                    <label>给你的{selectedAnimal.animal}起个名字</label>
                    <input
                      type="text"
                      value={animalName}
                      onChange={(e) => setAnimalName(e.target.value)}
                      placeholder="例如：棉花糖"
                      maxLength={6}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="ob-right">
              <div className="ob-h">选一个专属小动物</div>
              <p className="ob-p">它会一直陪着你闯关、收词卡、听故事～</p>
              <div className="animal-grid-pad">
                {AVAILABLE_ANIMALS.map(a => (
                  <button
                    key={a.animal}
                    className={`acard ${selectedAnimal?.animal === a.animal ? 'sel' : ''}`}
                    onClick={() => setSelectedAnimal(a)}
                  >
                    <span className="acard-img"><AnimalIcon animal={a.animal} emoji={a.emoji} /></span>
                    <span className="acard-name">{a.animal}</span>
                    {selectedAnimal?.animal === a.animal && <span className="tick">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: 选场景 */}
        {step === 3 && (
          <div className="ob-single">
            <h2 className="ob-h">选择你喜欢的场景</h2>
            <p className="ob-p">选择你喜欢的场景，让学习更有趣！</p>
            <div className="scene-grid">
              {AVAILABLE_SCENES.map(scene => (
                <button
                  key={scene.name}
                  className={`scene-card ${selectedScenes.includes(scene.name) ? 'selected' : ''}`}
                  onClick={() => handleSceneToggle(scene.name)}
                >
                  <SceneIcon name={scene.name} />
                  <span className="scene-name">{scene.name}</span>
                  {selectedScenes.includes(scene.name) && <span className="check-mark">✓</span>}
                </button>
              ))}
            </div>
            <p className="selection-count">已选择 {selectedScenes.length} 个场景</p>
          </div>
        )}

        {/* 按钮组 */}
        <div className="button-group">
          {step > 1 && (
            <button className="btn btn-secondary" onClick={() => setStep(prev => (prev - 1) as Step)}>
              上一步
            </button>
          )}
          {step < 3 ? (
            <button
              className="btn btn-primary"
              onClick={() => setStep(prev => (prev + 1) as Step)}
              disabled={!canProceed()}
            >
              下一步
            </button>
          ) : (
            <button className="btn btn-primary btn-start" onClick={handleComplete} disabled={!canProceed()}>
              🎮 开始游戏
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

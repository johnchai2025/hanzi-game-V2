'use client';

import { useState } from 'react';
import type { UserProfile } from '@/types';
import { MascotImg } from './MascotImg';

const FOX_ANIMAL = '小狐狸';
const FOX_EMOJI = '🦊';

interface ProfileSetupModalProps {
  onComplete: (profile: UserProfile) => void;
}

// 角色收敛为狐狸单选、场景改成按词自动适配之后，向导从"起名 → 选动物 → 选场景"
// 三步瘦成一步：只剩"给小狐狸起个名字"。
export function ProfileSetupModal({ onComplete }: ProfileSetupModalProps) {
  const [animalName, setAnimalName] = useState('');

  const handleComplete = () => {
    onComplete({
      childName: '',
      character: { animal: FOX_ANIMAL, emoji: FOX_EMOJI, name: animalName.trim() || FOX_ANIMAL },
      preferredScenes: [],
      setupCompleted: true,
    });
  };

  return (
    <div className="profile-setup-modal">
      <div className="ob">
        <div className="ob-single">
          <div className="ob-hero">
            <MascotImg animal={FOX_ANIMAL} emoji={FOX_EMOJI} className="mascot-img-xl" />
            <div className="speech ob-speech">你好呀！给我起个名字吧～</div>
          </div>
          <h2 className="ob-h">欢迎来到汉字对对碰！</h2>
          <p className="ob-p">给你的小狐狸起个名字，它会一直陪着你闯关、收词卡、听故事～</p>
          <div className="ob-name">
            <label>给你的小狐狸起个名字</label>
            <input
              type="text"
              value={animalName}
              onChange={(e) => setAnimalName(e.target.value)}
              placeholder="例如：棉花糖"
              maxLength={6}
              autoFocus
            />
          </div>
        </div>

        <div className="button-group">
          <button className="btn btn-primary btn-start" onClick={handleComplete}>
            🎮 开始游戏
          </button>
        </div>
      </div>
    </div>
  );
}

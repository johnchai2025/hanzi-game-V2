import type { AnimalCharacter } from '@/types';
import { getMissionBeats, getMissionConfig } from '@/lib/missionConfig';
import { MascotImg } from './MascotImg';

interface MissionSceneProps {
  levelId: string;
  levelTitle: string;
  restoredCount: number;
  totalCount: number;
  character?: AnimalCharacter;
}

const BEAT_MARKS = ['☀', '☁', '●', '✿', '≈', '♢', '✦', '✧'];

export function MissionScene({
  levelId,
  levelTitle,
  restoredCount,
  totalCount,
  character,
}: MissionSceneProps) {
  const suppliedTitle = levelTitle.trim() || '完成词语星光任务';
  const config = getMissionConfig(levelId, suppliedTitle);
  const beats = getMissionBeats(config, totalCount);
  const title = config.isCustom ? suppliedTitle : config.title;
  const restoredBeats = beats.filter((_, index) => index < restoredCount);
  const isComplete = beats.length > 0 && restoredBeats.length === beats.length;
  const characterName = character?.name?.trim() || '小伙伴';
  const missionCopy = config.isCustom
    ? `${characterName}和你一起，把词语星光一颗颗点亮吧！`
    : levelId === 'g2s1u1'
      ? `${characterName}和你一起，把春天一点点唤醒吧！`
      : `${characterName}和你一起，让这个任务场景一点点出现吧！`;
  const completeCopy = config.isCustom
    ? `词语星光都收集好啦！${characterName}和你完成了任务！`
    : levelId === 'g2s1u1'
      ? `春天已经醒来啦！${characterName}和你完成了任务！`
      : `${title}完成啦！${characterName}和你完成了任务！`;

  return (
    <section
      className={`mission-scene mission-theme-${levelId}`}
      aria-labelledby={`mission-title-${levelId}`}
      data-mission-complete={isComplete}
    >
      <div className="mission-heading">
        <p className="mission-kicker">任务地图</p>
        <h2 id={`mission-title-${levelId}`}>{title}</h2>
        <p className="mission-copy">{missionCopy}</p>
      </div>

      <div className="mission-stage">
        <div className="mission-sky" aria-hidden="true" />
        <div className="mission-cloud mission-cloud-left" aria-hidden="true" />
        <div className="mission-cloud mission-cloud-right" aria-hidden="true" />
        <div className="mission-hill mission-hill-back" aria-hidden="true" />
        <div className="mission-hill mission-hill-front" aria-hidden="true" />
        <div className="mission-ground" aria-hidden="true" />

        <ol className="mission-beats" aria-label="任务物件">
          {beats.map((beat, index) => {
            const restored = index < restoredCount;
            const state = restored ? '已恢复' : '等待恢复';
            return (
              <li
                key={beat.key}
                className={`mission-beat mission-beat-${index + 1} ${restored ? 'restored' : 'pending'}`}
                data-restored={restored}
                data-state={restored ? 'restored' : 'pending'}
                aria-label={`${beat.label}：${state}`}
              >
                <span className="mission-beat-mark" aria-hidden="true">{BEAT_MARKS[index % BEAT_MARKS.length]}</span>
                <span className="mission-beat-label">{beat.label}</span>
                <span className="mission-beat-state">{state}</span>
              </li>
            );
          })}
        </ol>

        <div className="mission-mascot">
          <MascotImg
            animal={character?.animal}
            emoji={character?.emoji || '🐰'}
            className="mascot-img-sm"
          />
          <span>{characterName}</span>
        </div>
      </div>

      <div className="mission-progress" aria-label="闯关进度">
        <span>已恢复</span>
        <output>{restoredBeats.length} / {beats.length}</output>
      </div>
      {isComplete && (
        <p className="mission-complete" role="status" aria-live="polite">{completeCopy}</p>
      )}
    </section>
  );
}

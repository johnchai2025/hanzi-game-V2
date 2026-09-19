export interface MissionBeat {
  /** Stable identifier for rendering and accessible relationships. */
  key: string;
  /** Short visible and accessible name for this mission object. */
  label: string;
}

export interface MissionConfig {
  levelId: string;
  title: string;
  beats: MissionBeat[];
  isCustom?: boolean;
}

const createBeats = (levelId: string, labels: string[]): MissionBeat[] =>
  labels.map((label, index) => ({ key: `${levelId}-beat-${index + 1}`, label }));

export const MISSION_CONFIG: Record<string, MissionConfig> = {
  g2s1u1: {
    levelId: 'g2s1u1',
    title: '帮团团唤醒春天',
    beats: createBeats('g2s1u1', ['阳光', '云朵', '绿叶', '花朵', '小溪', '蝴蝶']),
  },
  g2s1u2: {
    levelId: 'g2s1u2',
    title: '一起建好森林乐园',
    beats: createBeats('g2s1u2', ['小路', '松树', '柏树', '小桥', '鸟窝', '旗帜']),
  },
  g2s1u3: {
    levelId: 'g2s1u3',
    title: '帮团团布置温暖的家',
    beats: createBeats('g2s1u3', ['台灯', '画作', '信封', '窗户', '枕头', '拥抱']),
  },
  g2s1u4: {
    levelId: 'g2s1u4',
    title: '完成一张旅行画卷',
    beats: createBeats('g2s1u4', ['高楼', '黄山', '瀑布', '湖泊', '葡萄架', '晚霞']),
  },
  g2s1u5: {
    levelId: 'g2s1u5',
    title: '修好葫芦园',
    beats: createBeats('g2s1u5', ['水井', '藤蔓', '葫芦', '雨滴', '篱笆', '笑脸']),
  },
  g2s1u6: {
    levelId: 'g2s1u6',
    title: '点亮祝福广场',
    beats: createBeats('g2s1u6', ['河流', '道路', '扁担', '灯笼', '花环', '祝福旗']),
  },
  g2s1u7: {
    levelId: 'g2s1u7',
    title: '帮雪孩子找到伙伴',
    beats: createBeats('g2s1u7', ['大雾', '雪花', '小屋', '火光', '星星', '伙伴']),
  },
  g2s1u8: {
    levelId: 'g2s1u8',
    title: '完成伙伴嘉年华',
    beats: createBeats('g2s1u8', ['老虎', '狐狸', '奶酪', '纸船', '风筝', '彩带']),
  },
};

export function getMissionConfig(levelId: string, title: string): MissionConfig {
  if (Object.prototype.hasOwnProperty.call(MISSION_CONFIG, levelId)) {
    return MISSION_CONFIG[levelId];
  }

  return {
    levelId,
    title,
    beats: [],
    isCustom: true,
  };
}

export function getMissionBeats(config: MissionConfig, totalCount: number): MissionBeat[] {
  const count = Math.max(0, Math.floor(totalCount));
  if (config.isCustom) {
    return createBeats(config.levelId, Array.from(
      { length: count },
      (_, index) => `词语星光 ${index + 1}`,
    ));
  }

  const beats = config.beats.slice(0, count);
  while (beats.length < count) {
    const genericIndex = beats.length - config.beats.length + 1;
    beats.push({
      key: `${config.levelId}-generic-${genericIndex}`,
      label: `词语星光 ${genericIndex}`,
    });
  }
  return beats;
}

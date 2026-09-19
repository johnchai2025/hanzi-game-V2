export type WordPair = [string, string];

export interface LevelData {
  id: string;
  grade: 1 | 2 | 3;
  level: number;
  title: string;
  pairs: WordPair[];
  semester?: 1 | 2;
  lessons?: string[];
  newChars?: string[];
  boardRows?: number;
  boardCols?: number;
}

export interface Cell {
  id: string;
  char: string;    // 格子显示的单个汉字，如 "高"
  word: string;    // 完整词语，如 "高山"，用于词卡和朗读
  pairId: number;  // 同一词语的两个汉字共享同一 pairId
  isEmpty: boolean;
  isSelected: boolean;
  isHinted: boolean;
  isEliminating: boolean;
  isShaking: boolean;
}

export interface GameState {
  currentLevel: LevelData;
  cells: Cell[][];
  selectedCell: { row: number; col: number } | null;
  eliminatedCount: number;
  isComplete: boolean;
  feedbackMessage: string | null;
}

// ========== Phase 2: 新增数据模型 ==========

export interface AnimalCharacter {
  animal: string;   // '小兔子' | '小猫咪' 等
  emoji: string;    // '🐰' | '🐱' 等
  name: string;     // 孩子起的名字，如 '棉花糖'
}

export interface UserProfile {
  childName: string;
  character: AnimalCharacter;
  preferredScenes: string[];
  setupCompleted: boolean;
}

export interface WordCard {
  id: string;
  word: string;
  chars: [string, string];
  imageUrl: string;
  generatedAt: number;
  /** 旧存档迁移信息；新进度请使用 SaveData.practiceByLevel。 */
  levelId?: string;
}

export interface WordPractice {
  correctCount: number;
  lastPracticedAt: number;
}

export interface AttemptSummary {
  mistakeCount: number;
  hintCount: number;
}

export interface Story {
  id: string;
  title?: string;      // AI 生成的故事标题
  words: string[];
  wordCards?: string[];
  content: string;
  audioUrl?: string;
  generatedAt: number;
  characterName: string;  // 角色名
  animal: string;         // 动物类型
  scene: string;
}

// 扩展 SaveData
export interface SaveData {
  unlockedLevels: string[];
  completedLevels: string[];
  wordCards: WordCard[];         // 新增
  stories: Story[];
  practiceByLevel: Record<string, Record<string, WordPractice>>;
  levelStars: Record<string, number>;
}

export interface CurriculumUnit {
  id: string;
  grade: 1 | 2 | 3;
  semester: 1 | 2;
  unit: number;
  title: string;
  lessons: string[];
  newChars: string[];
  pairs: WordPair[];
  boardRows: number;
  boardCols: number;
}

export interface Curriculum {
  version: string;
  textbook: string;
  grade: 1 | 2 | 3;
  semester: 1 | 2;
  units: CurriculumUnit[];
}

export interface CustomLevel {
  id: string;
  title: string;
  pairs: WordPair[];
  createdAt: number;
  playCount: number;
}

export interface ParseResult {
  pairs: WordPair[];
  errors: string[];
  warnings: string[];
}

// ========== 常量定义 ==========

// 自定义关卡固定棋盘尺寸。CustomTab.tsx 展示"每局抽取数量"的文案和
// GameScreen.tsx 实际铺棋盘都从这里取值，不会再出现两边数字对不上的情况
// （历史 bug：文案硬编码写的 18，实际棋盘只抽 8 个）。
export const CUSTOM_LEVEL_BOARD_ROWS = 4;
export const CUSTOM_LEVEL_BOARD_COLS = 4;
export const CUSTOM_LEVEL_PAIR_COUNT = (CUSTOM_LEVEL_BOARD_ROWS * CUSTOM_LEVEL_BOARD_COLS) / 2;

export const STORY_CARD_MINIMUM = 3;

// 角色固定为狐狸（收敛前是 8 选 1，生图成本随"动物×场景"组合数几何级增长）。
// 仍保留数组形态，减少 ProfileSetupModal / types 消费端的改动面。
export const AVAILABLE_ANIMALS: Omit<AnimalCharacter, 'name'>[] = [
  { animal: '小狐狸', emoji: '🦊' },
];

// 仅供故事生成使用（每次从全部 7 个里随机抽一个）。
// 生图不再传场景——场景由 AI 根据词意自己判断，避免"大海配太空"这类矛盾画面，
// 也让同一个词的提示词完全确定，才谈得上"一词一图"全局复用。
export const AVAILABLE_SCENES = [
  { name: '森林', emoji: '🌲' },
  { name: '学校', emoji: '🏫' },
  { name: '家里', emoji: '🏠' },
  { name: '太空', emoji: '🚀' },
  { name: '海边', emoji: '🏖️' },
  { name: '城市', emoji: '🏙️' },
  { name: '糖果王国', emoji: '🍬' },
] as const;

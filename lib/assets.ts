// 图标 / 吉祥物静态资源映射。
// 设计稿用 window.* 全局共享，这里改为可 import 的纯模块。
// 注意：真实课程数据（grade2_semester1.json）的关卡标题与定制图标主题名不一致，
// 因此关卡图标按「索引循环」分配（见 levelIconByIndex），而非按标题精确匹配。

// 动物选择图标：键 = AnimalCharacter.animal（见 types.ts AVAILABLE_ANIMALS）。
// 角色已收敛为狐狸单选，这里只留一项——不是遗漏，是有意精简。
export const ANIMAL_ICONS: Record<string, string> = {
  小狐狸: '/assets/animals/fox.png',
};

// 吉祥物缺省姿态图（当孩子所选动物无对应图时回退）
export const MASCOT = {
  idle: '/assets/mascot/mascot-idle.png',
  cheer: '/assets/mascot/mascot-cheer.png',
};

// 关卡主题图标（5 张），按地图节点索引循环分配
export const LEVEL_ICON_LIST: string[] = [
  '/assets/levels/lvl-nature.png',
  '/assets/levels/lvl-animals.png',
  '/assets/levels/lvl-body.png',
  '/assets/levels/lvl-home.png',
  '/assets/levels/lvl-plants.png',
];

export const LEVEL_LOCK_ICON = '/assets/levels/lvl-lock.png';

// 可选：按标题精确匹配（levels.json 主题命名用；当前 curriculum 多数命不中）
export const LEVEL_ICONS: Record<string, string> = {
  天地自然: '/assets/levels/lvl-nature.png',
  动物朋友: '/assets/levels/lvl-animals.png',
  身体部位: '/assets/levels/lvl-body.png',
  我的家: '/assets/levels/lvl-home.png',
  花草植物: '/assets/levels/lvl-plants.png',
};

/** 动物名 → 图标路径，无则 null（调用方回退 emoji） */
export function animalIcon(animal: string | undefined): string | null {
  if (!animal) return null;
  return ANIMAL_ICONS[animal] ?? null;
}

/** 关卡图标：优先按标题精确匹配，否则按索引循环取一张主题图 */
export function levelIconByIndex(index: number, title?: string): string {
  if (title && LEVEL_ICONS[title]) return LEVEL_ICONS[title];
  return LEVEL_ICON_LIST[index % LEVEL_ICON_LIST.length];
}

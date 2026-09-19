# P1 Mission Scene Product Specification

## Objective

Turn each six-pair round from an abstract board-clearing exercise into a visible child-sized mission. Every successful match restores one part of a themed scene, so the child can see both immediate progress and the purpose of finishing the round.

## Approved direction

The approved game pattern is **scene restoration**, and the accepted visual treatment is **A · Paper-cut theatre**. The first unit's mission is “帮团团唤醒春天”; its six restoration beats are sunlight, cloud, leaves, flowers, stream, and butterfly. The scene lives in the existing right-hand game column and updates without blocking the board.

## Design system

- **Palette:** retain paper `#fdf6e3`, ink brown `#231810`, vermilion `#d4380d` / `#f5722a`, amber `#faad14`, and sage `#7cb87a`. Unit-specific colors are derived from these existing hues rather than introducing an unrelated palette.
- **Typography:** retain Ma Shan Zheng for expressive headings, ZCOOL KuaiLe for child-facing labels, and PingFang SC fallbacks for body copy.
- **Spacing:** 8px base rhythm; primary gaps use 8/16/24px.
- **Radius:** 16px for secondary cards, 20–24px for the mission scene, pill shapes only for progress/status.
- **Elevation:** two levels—soft paper-card shadow and a stronger active/restoration shadow.
- **Motion:** 300–500ms ease-out scale/fade/float; no continuous decorative motion. Respect `prefers-reduced-motion`.
- **Graphics:** no runtime-generated images and no new remote assets. Use CSS layers and the product's existing restrained emoji/sticker vocabulary for v0; production objects must look like paper cut-outs within the current visual language.

## Layout and interaction

1. The game remains optimized for iPad landscape, with 1024×768 as the minimum design target. The comparison prototype deliberately includes the 92px navigation rail as a conservative width budget. Production preserves the existing active-game shell, where the rail is hidden while playing, and verifies the full board/scene layout at 1024×768.
2. The board stays on the left and keeps its present touch-target size.
3. The right column shows, in order: unit/mission title, mission scene, compact progress, and hint/restart controls.
4. The fox is integrated into the mission scene instead of occupying a separate large card.
5. Each correct match reveals exactly one scene object and updates mission copy.
6. A wrong match never removes scene progress.
7. Hint use does not reveal a scene object; only a completed pair does.
8. Completing all objects produces one short final scene celebration before the existing completion modal.
9. Progress must remain understandable without color or motion: every object has a text label and restored/not-restored state.

## Curriculum mission mapping

| Unit | Mission | Six beats |
|---|---|---|
| 自然与变化 | 帮团团唤醒春天 | 阳光、云朵、绿叶、花朵、小溪、蝴蝶 |
| 场景与树木 | 一起建好森林乐园 | 小路、松树、柏树、小桥、鸟窝、旗帜 |
| 智慧与亲情 | 帮团团布置温暖的家 | 台灯、画作、信封、窗户、枕头、拥抱 |
| 山河与风景 | 完成一张旅行画卷 | 高楼、黄山、瀑布、湖泊、葡萄架、晚霞 |
| 寓言与道理 | 修好葫芦园 | 水井、藤蔓、葫芦、雨滴、篱笆、笑脸 |
| 英雄与节日 | 点亮祝福广场 | 河流、道路、扁担、灯笼、花环、祝福旗 |
| 雾雪与想象 | 帮雪孩子找到伙伴 | 大雾、雪花、小屋、火光、星星、伙伴 |
| 童话与伙伴 | 完成伙伴嘉年华 | 老虎、狐狸、奶酪、纸船、风筝、彩带 |

## v0 decision gate

Before production integration, provide a standalone landscape prototype containing the same first-unit scene in three treatments:

1. **Paper-cut theatre (recommended):** layered landscape with objects appearing in place.
2. **Sticker diorama:** six collectible stickers fill a central scene board.
3. **Scroll landscape:** horizontal illustrated scroll revealed in six segments.

The prototype must allow switching treatments and progress states 0/3/6. Production work pauses until one treatment is accepted.

## Variable round sizes

Built-in curriculum rounds currently restore six objects. Custom-word-list rounds restore eight because their board uses eight pairs. `MissionScene` must therefore render exactly `totalCount` beats:

- built-in levels use their six named curriculum beats;
- custom levels use numbered generic “词语星光” beats sized to the actual round;
- if a future built-in round differs from its configured beat count, configured beats are used first and accessible generic beats fill the remainder.

Every successful match, including the seventh and eighth custom matches, restores exactly one object.

## Completion presentation

The final restored object must remain visible for 700ms before the completion modal appears. This delay is presentation-only: mission progress remains derived from `eliminatedCount`. A restart, level change, or component unmount must cancel the pending timer so a stale modal cannot appear.

## Acceptance criteria for production

- All eight units have mission copy and six restoration beats.
- `eliminatedCount` alone drives scene progress; no duplicate progress state is introduced.
- The scene fits at 1024×768 landscape without shrinking the board below current dimensions or hiding controls.
- Every successful match visibly adds one object within 500ms and never opens a modal.
- The final object and complete scene remain unobscured for 700ms before the completion modal.
- Reduced-motion mode disables scale/float animations but preserves state changes.
- Existing P0 tests remain green and mission-specific tests cover progress 0, partial, complete, and unit mapping.
- Production build succeeds and no image-generation request is introduced.

## Out of scope

- Runtime or offline word-card image generation.
- Music, sound-effect settings, or haptic feedback.
- A timed combo system.
- Post-level tracing.
- Parent analytics and full spaced repetition.

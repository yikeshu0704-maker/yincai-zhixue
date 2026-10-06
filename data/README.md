# 初中数学题库

本目录接入了一批可用于“因材智学”技能训练的中文初中数学选择题。

## 数据来源

- TAL-SCQ5K-CN
- 上游仓库：math-eval/TAL-SCQ5K
- 上游许可证：MIT License
- 本项目接入：从 TAL-SCQ5K-CN 的 5000 道题中，根据题目来源字段包含“初中 / 初一 / 初二 / 初三 / 七年级 / 八年级 / 九年级 / 中考”等初中阶段标记筛选出 992 道，转换为因材智学自己的题库字段。
- 上游数据包含小学、初中、高中内容；本目录仅保存按上述初中标记筛选后的子集。

## 字段

每道题包含：

- id
- grade
- chapter
- knowledgePoints
- difficulty
- type
- question
- options
- answer
- explanation
- source
- sourceDataset
- sourceLicense

`difficulty` 在训练引擎中映射为：1 基础题、2 中等题、3 困难题、4 拔尖题候选。当前 992 道初中题中，按上游 difficulty 分布为：基础题 605 道、中等题 351 道、困难题 28 道、拔尖题 8 道。

## 训练引擎

前端加载 math-junior-high-1.js ～ math-junior-high-4.js 后，技能训练优先从题库选择题目：

学生学情 → 当前知识点 → 难度（基础 / 中等 / 困难 / 拔尖）→ 题库筛选 → 答题 → 掌握度更新 → 下一题。

AI 仍用于学情增强、错因分析、AI答疑和训练策略增强；题库负责保证技能训练在 AI 不可用时仍然有题可做。

## 许可与署名

本目录中的来源数据来自 TAL-SCQ5K-CN。上游 README 声明该数据集采用 MIT License。

上游项目：https://github.com/math-eval/TAL-SCQ5K

本目录中的字段转换、筛选逻辑和因材智学集成代码由本项目维护。

## CJEval 初中数学补充题库

本项目为非商业、比赛/公益教育用途，补充接入 SmileWHC/CJEval 的“初中数学”数据。CJEval README 标明数据仅限学术研究用途，禁止商业使用，数据采用 CC BY-NC-SA 4.0；本仓库保留来源字段 `sourceDataset`、`sourceLicense` 与 `source`，便于追溯。

本次补充 2008 道：
- 单选题：951 道
- 填空题：950 道
- 解答题：107 道

与已有 TAL-SCQ5K-CN 的 992 道初中数学题合并后，前端训练题库共约 3000 道。

来源：
- https://github.com/SmileWHC/CJEval
- CJEval README / 数据目录：data/CJEval_data/（初中数学）

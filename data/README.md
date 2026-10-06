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

`difficulty` 在训练引擎中映射为：1 基础、2 中等、3 综合、4 变式候选。

## 训练引擎

前端加载 math-junior-high-1.js ～ math-junior-high-4.js 后，技能训练优先从题库选择题目：

学生学情 → 当前知识点 → 难度 → 题库筛选 → 答题 → 掌握度更新 → 下一题。

AI 仍用于学情增强、错因分析、AI答疑和训练策略增强；题库负责保证技能训练在 AI 不可用时仍然有题可做。

## 许可与署名

本目录中的来源数据来自 TAL-SCQ5K-CN。上游 README 声明该数据集采用 MIT License。

上游项目：https://github.com/math-eval/TAL-SCQ5K

本目录中的字段转换、筛选逻辑和因材智学集成代码由本项目维护。
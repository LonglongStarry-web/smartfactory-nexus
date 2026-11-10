# SmartFactory Nexus Skills 核查记录

核查范围：本机技能目录、OpenAI 官方 curated 目录、候选上游仓库的原始 SKILL.md、许可与提交记录，以及本项目现有技术栈。

状态说明：“已有”表示当前环境或任务目录中已有源文件；“候选”表示已查阅源码但尚未安装并用于项目验证；“参考”表示可帮助设计，不提供可直接运行的工业仿真实现。技能源文件可读和仓库仍维护，不等于其已通过本项目或真实工业现场验证。

## 1. 采用建议

| 开发部分 | 技能与来源 | 当前状态 | 使用范围及限制 |
|---|---|---|---|
| 设备详情、工艺观察、质量追溯界面 | 本机 design-taste-frontend | 已有 | 复用应用界面设计与真实浏览器检查，保持当前品牌、主题、字号与用户偏好 |
| 三维组件与 Fiber 帧循环 | [cesartevisual / threejs-r3f](https://github.com/cesartevisual/threejs-skills/blob/84f9bcb4bea1f7a28d57fe7f0af78f7f9c3dc467/skills/threejs-r3f/SKILL.md) | 候选 | 与已安装版本共同核对，保持 Canvas 生命周期、ref 动画与资源释放 |
| 机械动作与工序姿态 | [CloudAI-X / threejs-animation](https://github.com/CloudAI-X/threejs-skills/blob/0e181866f095b5f06d005133876e926515390d95/skills/threejs-animation/SKILL.md) | 候选 | 关键帧、动画混合、程序化动作；具体上下料轨迹与可达范围由项目设计 |
| 选择、镜头、观察热点 | [threejs-interaction](https://github.com/CloudAI-X/threejs-skills/blob/0e181866f095b5f06d005133876e926515390d95/skills/threejs-interaction/SKILL.md)、[threejs-product-viewer](https://github.com/cesartevisual/threejs-skills/blob/84f9bcb4bea1f7a28d57fe7f0af78f7f9c3dc467/skills/threejs-product-viewer/SKILL.md) | 候选 | 点击、拖拽冲突、稳定选择 ID、观察视角和热点；加工内部结构需要实际建模 |
| 半透明机壳与模型管理 | [threejs-materials](https://github.com/CloudAI-X/threejs-skills/blob/0e181866f095b5f06d005133876e926515390d95/skills/threejs-materials/SKILL.md)、[threejs-loaders](https://github.com/CloudAI-X/threejs-skills/blob/0e181866f095b5f06d005133876e926515390d95/skills/threejs-loaders/SKILL.md) | 按需候选 | 材质、透明、glTF 结构与释放；技能不附带可直接加工的工业设备模型 |
| 三维性能与 React 更新 | [threejs-performance](https://github.com/CloudAI-X/threejs-skills/blob/0e181866f095b5f06d005133876e926515390d95/skills/threejs-performance/SKILL.md)、[vercel-react-best-practices](https://github.com/vercel-labs/agent-skills/blob/1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62/skills/react-best-practices/SKILL.md) | 候选 | 帧时间、绘制调用、资源复用、局部订阅与包体；Vite 项目只采用适用条目 |
| 工序状态与异常恢复 | [state-machine-design](https://github.com/definite-d/agent-skills/blob/035a1418494b69d7390c29403c9aae2432527da3/skills/state-machine-design/SKILL.md) | 设计参考 | 状态、事件、条件、持久化与恢复检查；优先在现有 TypeScript 引擎实现，不因找到技能就增加 XState 依赖 |
| 不合格记录与原因证据 | [quality-nonconformance](https://github.com/affaan-m/ECC/blob/d2ef2680594f9a17526a6e1a2e18b3d242c5d17b/skills/quality-nonconformance/SKILL.md) | 设计参考 | 借鉴测量值与规格、工件追溯、隔离、返工复检和证据区分；不将法规条目或经验阈值直接当项目规则 |
| 多品种、换型、插单与改派 | [production-scheduling](https://github.com/affaan-m/ECC/blob/d2ef2680594f9a17526a6e1a2e18b3d242c5d17b/skills/production-scheduling/SKILL.md) | 设计参考 | 借鉴有限能力、工序路径、换型与异常重排；实际调度算法、缓冲与时间估计仍需编码和检查 |
| 浏览器与界面回归 | [OpenAI / playwright](https://github.com/openai/skills/tree/main/skills/.curated/playwright) | 当前任务内已有 | 真实浏览器操作、截图和流程验证；同时复用项目既有 Vitest 与 Playwright 测试框架 |
| 图表、MindAR、课程交付材料 | ECharts/MindAR 官方文档；本机 presentations 技能 | 已有路线，按需加载 | 保持现有图表和图像识别路线，交付时同步课程材料；不为匹配技能改换 XR 架构 |

## 2. 兼容性与筛选结果

CloudAI-X 候选的说明面向 Three.js r186，R3F 条目面向 Fiber 9.8、React 19、Drei 10.7。本项目实际为 Three.js r180、Fiber 9.8.2、React 19.3.1、Drei 10.7.9。React/Fiber 主版本路线相符，但 Three.js 示例仍需逐项核对；使用其方法不会自动触发依赖升级。

cesartevisual 的技能更强调沿用项目已有版本、生命周期与验证，作为 Fiber 集成与观察交互的补充。多个源中有同名技能，接入时记录仓库和提交，不只记录名字。

EnzeD/r3f-skills 中能找到 R3F 动画、交互等条目，但当前仓库 API 未返回明确许可信息。此次列为备选，不作为首选接入源；这不表示已经判定其内容质量不足。

也检索到 XState 技能，有些针对其他仓库结构，有些明确标为 Alpha。现有项目未使用 XState，本阶段采用状态图设计方法与原有引擎，不为使用某个技能额外迁移架构。

quality-nonconformance 和 production-scheduling 的上游属于综合技能库，其内容主要是工作流与行业经验说明，没有提供本项目所需的切削模型、缺陷生成器或经验证的排产求解器。技能文件 frontmatter 为 Apache-2.0，仓库 API 报告 MIT；若实际分发，应保留各文件原有许可声明并核对适用范围。

此次检索未确认有可直接替代本项目工艺引擎、因果质检和 MindAR 图像识别的成熟即用技能。现成开发指导可复用，产品模型和业务规则仍需实现与验证。

## 3. 来源固定记录

| 仓库 | 核查提交 | 核查时最后提交 | 许可与说明 |
|---|---|---|---|
| CloudAI-X/threejs-skills | 0e181866f095b5f06d005133876e926515390d95 | 2026-10-19 | API 标注 MIT，未归档 |
| cesartevisual/threejs-skills | 84f9bcb4bea1f7a28d57fe7f0af78f7f9c3dc467 | 2026-09-10 | API 标注 MIT，未归档 |
| vercel-labs/agent-skills | 1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62 | 2026-10-27 | SKILL.md 标注 MIT，未归档 |
| definite-d/agent-skills | 035a1418494b69d7390c29403c9aae2432527da3 | 2026-10-28 | API 标注 MIT，未归档 |
| affaan-m/ECC | d2ef2680594f9a17526a6e1a2e18b3d242c5d17b | 2026-11-06 | 文件 Apache-2.0 / 仓库 API MIT，未归档 |
| EnzeD/r3f-skills | 4a11805f097396fb0b893172efd1e359e8051f92 | 2026-08-31 | API 未识别许可，备选，未归档 |

以上提交日期是源仓库核查信息，与应用版本更新时间无关。源文件快照保存在当前任务 `work/skill-audit/`，仅供核查，未执行下载内容，也未安装到全局技能目录。

官方 curated 列表通过本机 skill-installer 的 list-skills.py 实时读取，确认包括 playwright 与 playwright-interactive。官方列表没有上述专用 Three.js 或制造过程条目；社区来源另行核查，不能将其误称为官方提供。

当前动作边界：本轮已完成目录检索、源文件查阅、兼容性核对和计划编写；社区候选技能尚未安装或用于实际功能开发，未对其作项目验收通过的声明。

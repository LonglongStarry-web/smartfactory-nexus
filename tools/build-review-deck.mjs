import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const { Presentation, PresentationFile } = await import(
  process.env.NEXUS_ARTIFACT_MODULE
    ? pathToFileURL(process.env.NEXUS_ARTIFACT_MODULE).href
    : "@oai/artifact-tool"
);
const root = fileURLToPath(new URL("../", import.meta.url));
const delivery = path.join(root, "deliverables");
const work = path.join(delivery, ".ppt-build", "review");
await fs.mkdir(work, { recursive: true });
const validation = JSON.parse(await fs.readFile(path.join(delivery, "v1.3-final-validation.json"), "utf8"));
const repo = "https://github.com/LonglongStarry-web/smartfactory-nexus";
const deck = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const family = "Microsoft YaHei";
const dark = {
  bg: "#0B1422", surface: "#13243A", ink: "#F1F6FC", muted: "#B3C4D6",
  accent: "#53DFEB", line: "#36506B", strong: "#1B4057", warn: "#FFD08A",
};
const noLine = { fill: "none", width: 0 };
const sections = [
  "01  需求与范围", "02  系统设计", "03  业务功能", "04  初步验证", "05  项目获取",
];
const manifest = [];

function rect(s, x, y, w, h, fill, stroke = "none") {
  return s.shapes.add({
    geometry: "rect", position: { left: x, top: y, width: w, height: h },
    fill, line: stroke === "none" ? noLine : { fill: stroke, width: 1 },
  });
}

function text(s, value, x, y, w, h, options = {}) {
  const { size = 23, color = dark.ink, bold = false, align = "left", link } = options;
  const sh = s.shapes.add({
    geometry: "textbox", position: { left: x, top: y, width: w, height: h },
    fill: "none", line: noLine,
    ...(link ? { hyperlink: { uri: link, isExternal: true } } : {}),
  });
  sh.text = value;
  sh.text.style = {
    typeface: family, fontSize: size, bold, color, alignment: align,
    verticalAlignment: "top", autoFit: "none", wrap: "square", insets: 0,
    ...(link ? { underline: "sng" } : {}),
  };
  return sh;
}

function add(title, note, palette = dark) {
  const s = deck.slides.add();
  s.background.fill = palette.bg;
  s.speakerNotes.text = note;
  manifest.push({ title, note });
  return s;
}

function page(section, title, lead, source, note, palette = dark) {
  const s = add(title, note, palette);
  const n = manifest.length;
  text(s, sections[section], 56, 31, 425, 25, { size: 17, color: palette.accent, bold: true });
  text(s, "SMARTFACTORY NEXUS", 940, 32, 284, 25, { size: 15, color: palette.muted, align: "right" });
  text(s, title, 56, 67, 1168, 61, { size: 43, color: palette.ink, bold: true });
  text(s, lead, 58, 133, 1164, 53, { size: 23, color: palette.muted });
  rect(s, 56, 661, 1168, 1, palette.line);
  text(s, source, 56, 672, 1070, 26, { size: 15, color: palette.muted });
  text(s, String(n).padStart(2, "0"), 1167, 669, 57, 30, {
    size: 18, color: palette.accent, bold: true, align: "right",
  });
  return s;
}

const assetCache = new Map();
async function img(s, filename, x, y, w, h, crop) {
  if (!assetCache.has(filename)) {
    assetCache.set(filename, await fs.readFile(path.join(delivery, "screenshots", filename)));
  }
  s.images.add({
    blob: assetCache.get(filename), contentType: "image/png", alt: filename,
    position: { left: x, top: y, width: w, height: h },
    fit: crop ? "cover" : "contain", ...(crop ? { crop } : {}),
  });
}

function clip(width, height, x1, y1, x2, y2) {
  return { left: x1 / width, top: y1 / height, right: 1 - x2 / width, bottom: 1 - y2 / height };
}

function caption(s, value, x, y, w, p = dark) {
  text(s, value, x, y, w, 39, { size: 17, color: p.muted });
}

function rules(s, entries, x, y, w, step, p = dark) {
  for (const [i, [title, detail]] of entries.entries()) {
    const top = y + i * step;
    rect(s, x, top, w, 1, p.line);
    text(s, title, x, top + 13, w, 32, { size: 25, color: p.accent, bold: true });
    text(s, detail, x, top + 52, w, step - 54, { size: 22, color: p.ink });
  }
}

function summary(s, title, value, x, y, w, p = dark) {
  text(s, title, x, y, w, 31, { size: 21, color: p.muted });
  text(s, value, x, y + 34, w, 67, { size: 51, color: p.accent, bold: true });
}

function node(s, title, detail, x, y, w, h, p = dark, emphasized = false) {
  const sh = rect(s, x, y, w, h, emphasized ? p.strong : p.surface, p.line);
  text(s, title, x + 14, y + 13, w - 28, 34, {
    size: 23, color: p.accent, bold: true, align: "center",
  });
  text(s, detail, x + 12, y + 53, w - 24, h - 57, {
    size: 20, color: p.ink, align: "center",
  });
  return sh;
}

function connect(s, from, to, p = dark, fromSide = "right", toSide = "left", both = false) {
  const arrow = { type: "triangle", width: "sm", length: "sm" };
  s.shapes.connect(from, to, {
    kind: "straight", fromSide, toSide, line: { fill: p.accent, width: 2 },
    tail: arrow, ...(both ? { head: arrow } : {}),
  });
}

function flow(s, entries, y, h, p = dark) {
  const gap = 26;
  const width = (1168 - gap * (entries.length - 1)) / entries.length;
  const nodes = entries.map(([title, detail], i) =>
    node(s, title, detail, 56 + i * (width + gap), y, width, h, p, i === 0),
  );
  for (let i = 1; i < nodes.length; i += 1) connect(s, nodes[i - 1], nodes[i], p);
}

function table(s, values, widths, y, height, p = dark, size = 22) {
  const t = s.tables.add({
    rows: values.length, columns: widths.length, left: 56, top: y,
    width: widths.reduce((a, b) => a + b, 0), height, columnWidths: widths, values,
  });
  t.styleOptions = { headerRow: false, bandedRows: false };
  t.borders.assign({ style: "solid", fill: p.line, width: 1 });
  for (let row = 0; row < values.length; row += 1) {
    t.rows[row].height = height / values.length;
    for (let col = 0; col < widths.length; col += 1) {
      const cell = t.getCell(row, col);
      cell.fill = row === 0 ? p.strong : p.surface;
      cell.text.style = {
        typeface: family, color: row === 0 ? p.accent : p.ink, fontSize: size,
        bold: row === 0 || col === 0, insets: { left: 13, right: 10, top: 8, bottom: 6 },
        verticalAlignment: "middle",
      };
    }
  }
  return t;
}

function paragraph(s, value, x, y, w, p = dark, options = {}) {
  text(s, value, x, y, w, options.h ?? 61, { size: options.size ?? 22, color: options.color ?? p.ink });
}

// Cover
{
  const s = add("智造未来", "来源：项目 README、原始需求文档、Git 远程仓库与 v1.3.0 实际车间截图。");
  text(s, "SMARTFACTORY NEXUS", 56, 57, 500, 32, { size: 21, color: dark.accent, bold: true });
  text(s, "智造未来", 52, 147, 530, 108, { size: 82, bold: true });
  text(s, "数字孪生与 AR\n柔性制造车间协同管控系统", 56, 263, 520, 130, { size: 37, bold: true });
  text(s, "系统设计与初步验证", 58, 424, 510, 41, { size: 28, color: dark.muted });
  text(s, "可交互原型  v1.3.0", 58, 478, 500, 35, { size: 20, color: dark.accent });
  await img(s, "final-twin.png", 594, 117, 630, 446, clip(1224, 850, 35, 191, 887, 785));
  caption(s, "双加工单元、共享质检与立体仓储  |  原型实景", 594, 573, 630);
  rect(s, 56, 618, 1168, 1, dark.line);
  text(s, "项目源码已推送至作者个人 GitHub 仓库", 56, 634, 1168, 25, { size: 18, color: dark.muted });
  text(s, repo, 56, 664, 1120, 28, { size: 21, color: dark.accent, link: repo });
}

// Requirements and scope
{
  const s = page(0, "车间协同管控的范围", "围绕双加工单元的生产闭环，把排产、加工、质量、维护与发运关联起来。",
    "原型范围  |  两组 CNC 加工单元、共享检测资源、AGV 物流和立体仓储",
    "来源：docs/01-需求分析.md、docs/02-初步设计.md、README.md。");
  flow(s, [
    ["订单下达", "数量、配方\n计划与交期"], ["派工换型", "兼容单元\n先到 / 紧急优先"], ["加工送检", "取料与切削\n共享 QC"],
    ["处置转运", "合格、返工\n或隔离报废"], ["入库发运", "履约计数\n库存释放"],
  ], 216, 128);
  rules(s, [
    ["生产进度", "同一件工件的加工、质检和入库分别记录，订单以合格入库计完成量。"],
    ["异常处理", "故障可追到受影响的设备和工件，超差可追到具体测量与工艺参数。"],
  ], 56, 390, 1168, 107);
}
{
  const s = page(0, "用户任务与验收条件", "以可观察的业务结果定义需求。三类角色可从相同工件和设备编号交叉核对记录。",
    "需求来源  |  柔性制造场景的角色任务分析",
    "来源：docs/01-需求分析.md、docs/22-系统测试操作手册.docx。", dark);
  table(s, [
    ["角色", "需要解决的问题", "操作与验收条件"],
    ["生产调度", "插单、停机和换型改变交付时间", "对比排产策略。停机后停止派工，在制件原位保留。"],
    ["质量检验", "不合格原因与去向难追踪", "查看同编号的测量、工序及参数。返工保留首检结果。"],
    ["设备维护", "告警、维修和恢复各自记录", "按设备查看告警与工单。三项确认完成后才恢复生产。"],
  ], [185, 405, 578], 205, 333, dark, 23);
  paragraph(s, "基础能力还包括浏览器启动、主题与字号设置、存档恢复，以及可打开的报告导出。", 56, 580, 1168, dark);
}

// Architecture and data
{
  const s = page(1, "统一状态驱动九个业务页面", "React 页面、三维设备和图表读取同一份模拟状态，操作由规则引擎更新。",
    "技术架构  |  React + Zustand + Three.js / React Three Fiber + ECharts + MindAR",
    "来源：src/app.tsx、src/store/useFactory.ts、src/simulation/、src/pages/AR.tsx、public/ar/、package.json。");
  const web = node(s, "React 业务页面", "调度、质量、维护、报告与设置", 56, 200, 346, 100);
  const twin = node(s, "三维场景与图表", "设备姿态、工件位置和运行趋势", 467, 200, 346, 100);
  const ar = node(s, "MindAR 识别页面", "接收设备状态，独立运行相机识别", 878, 200, 346, 100);
  const state = node(s, "Zustand 统一状态", "订单 / 工件 / 设备 / 告警 / 工单 / 能耗", 262, 352, 756, 104, dark, true);
  const engine = node(s, "模拟规则引擎", "时钟、排产、工序、质检与物流", 56, 519, 514, 100);
  const disk = node(s, "浏览器存档与导出", "localStorage、报告和工作空间备份", 710, 519, 514, 100);
  connect(s, web, state, dark, "bottom", "top", true);
  connect(s, state, twin, dark, "top", "bottom");
  connect(s, state, ar, dark, "top", "bottom");
  connect(s, engine, state, dark, "top", "bottom", true);
  connect(s, state, disk, dark, "bottom", "top", true);
}
{
  const s = page(1, "工件编号贯通生产记录", "投料时固化配方与参数。检测结果、返工和库存动作按编号回到同一件工件。",
    "数据设计  |  订单 ID、工件 ID 和设备 ID 作为跨页面查询线索",
    "来源：src/domain/types.ts、src/simulation/process.ts、src/simulation/flow.ts、src/simulation/persistence.ts。", dark);
  flow(s, [
    ["订单", "数量、配方\n交期与优先级"], ["工件", "唯一编号\n所属订单"], ["加工轨迹", "设备和参数快照\n工序起止时间"],
    ["质检与处置", "规格、实测\n首检与返工"], ["库存与发运", "合格入库\n发运记录"],
  ], 213, 131, dark);
  rules(s, [
    ["当前状态和历史快照", "实时页面读取当前工序，历史回放读取已记录的工序区间和该件工艺参数。"],
    ["计数发生的时间", "切削完成计加工量，首次检测决定首检良品率，合格件登记入库后增加订单完成量。"],
  ], 56, 396, 1168, 108, dark);
}
{
  const s = page(1, "工序联锁与模拟时钟", "设备、夹具和检测位按工序交接工件。三维从当前工序和进度计算姿态。",
    "工序模型  |  法兰 49 模拟秒，安装板 52 模拟秒，正常入库转运另计 14 模拟秒",
    "来源：src/simulation/process.ts、src/simulation/engine.ts、src/simulation/flow.ts 与 motion/flow 测试。");
  flow(s, [
    ["上料装夹", "开门、定位与夹紧\n夹爪交给夹具"], ["切削退刀", "端面、轮廓、钻孔\n去毛刺与退刀"],
    ["卸料送检", "开门、握持与松夹\n夹具交给夹爪"], ["检测分流", "扫描与规格判定\nQC 交给暂存位"],
  ], 212, 142);
  rules(s, [
    ["运行与暂停", "统一时钟推进工序、转运与换型。暂停或设备故障时，相关工序和工件位置冻结。"],
    ["共享资源等待", "检测位、缓冲位和物流资源不足时，工件保持当前持有者或进入等待。"],
  ], 56, 397, 1168, 109);
}

// Interactive prototype and functions
{
  const s = page(2, "数字孪生车间布局", "两个加工单元各有 CNC 和机械臂，共享检测、物流和仓储资源。",
    "界面证据  |  数字孪生车间的设备选择、状态与工件流转",
    "来源：deliverables/screenshots/final-twin.png；src/pages/TwinPage.tsx、src/components/DeviceDetail.tsx。");
  await img(s, "final-twin.png", 56, 196, 755, 423, clip(1224, 850, 28, 134, 1199, 787));
  rules(s, [
    ["加工单元", "CNC-01 与 CNC-02 对应独立上料位和机械臂。"],
    ["共享检测与物流", "QC-01 检测分流，AGV 将合格件送往 ASRS-01。"],
    ["设备详情", "选中设备可查看状态、当前工件、工序和故障信息。"],
  ], 843, 197, 381, 141);
}
{
  const s = page(2, "三维动作与加工阶段同步", "原型用 19 道工序驱动取放、装夹、切削、送检和分流。",
    "界面证据  |  同一法兰配方的三个确定工序状态",
    "来源：final-load.png、final-face.png、final-drill.png；tests/motion.test.ts、tests/motion.spec.ts。");
  const panes = [
    ["final-load.png", "上料", "工件随夹爪进入加工区。"],
    ["final-face.png", "端面加工", "夹具夹持，刀具进入切削位置。"],
    ["final-drill.png", "钻孔", "刀具按孔位下探并退回。"],
  ];
  for (const [i, [file, title, detail]] of panes.entries()) {
    const x = 56 + 394 * i;
    await img(s, file, x, 204, 380, 287);
    text(s, title, x, 509, 380, 35, { size: 26, bold: true, color: dark.accent });
    paragraph(s, detail, x, 555, 380);
  }
  paragraph(s, "灯杆安装在设备表面，状态随设备更新。暂停后动画与工序进度一起停止。", 56, 616, 1168, dark, { size: 19, h: 31 });
}
{
  const s = page(2, "设备内部观察与历史回放", "选择设备进入内部视角，查看工序、刀路和投料时保存的工艺参数。",
    "界面证据  |  加工观察与已完成工序的轨迹回放",
    "来源：deliverables/screenshots/final-observer.png；src/features/digital-twin/Observation.tsx、tests/observation.spec.ts。");
  await img(s, "final-observer.png", 56, 196, 737, 423, clip(1168, 1103, 0, 0, 1168, 675));
  rules(s, [
    ["看当前加工", "透视机床外壳，读取当前步骤、转速、进给与补偿。"],
    ["查历史工件", "按编号选择工件，可跳转工序、拖动时间、调整回放速度。"],
    ["独立回放", "回放使用已完成工序的时间区间，生产计数与时钟保持原值。"],
  ], 829, 197, 395, 142);
}
{
  const s = page(2, "生产调度与交付时间", "先来先服务和紧急订单优先可以对比。设备能力、换型、共享 QC 与物流等待进入估算。",
    "界面证据  |  CNC 双设备甘特图与两种调度策略对比",
    "来源：deliverables/screenshots/final-scheduling.png；src/pages/Scheduling.tsx、src/simulation/flow.ts。");
  await img(s, "final-scheduling.png", 56, 211, 747, 263, clip(1224, 850, 28, 410, 1196, 813));
  caption(s, "同一运行快照的预计时刻  |  策略对比取决于当前任务与可用资源", 56, 492, 747);
  rules(s, [
    ["计划开始", "下单时指定的最早开始时刻。"],
    ["预计完工", "按任务、设备及已知等待估算。"],
    ["实际完工", "订单所需合格件全部入库的时刻。"],
  ], 842, 201, 382, 137);
  paragraph(s, "紧急插单只调整尚未开工的任务。预测随设备故障和队列变化更新。", 56, 571, 747, dark);
}
{
  const s = page(2, "配方切换改变刀路与规格", "两组 CNC 可设置兼容产品。换型占用 6 个模拟秒，单元有投料或转运时锁定能力配置。",
    "工艺配方  |  周期为标准模式的单件工艺时间，物流时间另计",
    "来源：src/simulation/process.ts、src/simulation/flow.ts、tests/flexibility.test.ts；final-plate.png。", dark);
  table(s, [
    ["项目", "圆形法兰 A-320", "安装支架板 B-210"],
    ["外形与刀路", "圆形、圆周外轮廓", "矩形、矩形外轮廓"],
    ["加工周期", "49 模拟秒", "52 模拟秒"],
    ["孔位 X", "20 mm，公差 ±0.05 mm", "30 mm，公差 ±0.05 mm"],
    ["轮廓尺寸", "直径 80 mm，公差 ±0.10 mm", "宽度 100 mm，公差 ±0.10 mm"],
  ], [245, 461, 462], 211, 340, dark, 23);
  paragraph(s, "没有兼容加工单元时，订单显示能力等待。标准工装完成换型后才开始对应配方。", 56, 584, 1168, dark);
}
{
  const s = page(2, "超差可追溯至测量与工序", "按投料时的工艺参数计算特征测量值，再与该配方的规格比较。",
    "质量实验  |  圆形法兰单件示例，测量单位为 mm",
    "来源：src/features/quality/ProcessLab.tsx、src/simulation/flow.ts、tests/quality-cause.test.ts 与界面操作复核。", dark);
  table(s, [
    ["实验输入", "关联工序", "实测值 / 允许范围", "判定"],
    ["装夹 X 偏移 +0.08", "钻孔", "孔位 X  20.08 / 19.95–20.05", "孔位超差"],
    ["轮廓补偿 +0.20", "轮廓加工", "外径  80.20 / 79.90–80.10", "尺寸超差"],
    ["跳过去毛刺", "去毛刺", "毛刺高度  0.12 / 0–0.05", "毛刺超限"],
  ], [284, 188, 480, 216], 211, 317, dark, 22);
  paragraph(s, "质检详情显示设备、配方、参数快照与来源工序，可按工件编号回看加工过程。", 56, 574, 1168, dark);
}
{
  const s = page(2, "隔离、返工与报废补投", "超差件可暂存等待人工处置。去毛刺返工保留原编号和失败首检。",
    "质量口径  |  首检良品率按首次检测计算，返工复测单独记录",
    "来源：src/simulation/flow.ts、tests/quality-cause.spec.ts；deliverables/screenshots/final-cause.png。");
  await img(s, "final-cause.png", 56, 206, 548, 405);
  rules(s, [
    ["毛刺超限", "隔离后去毛刺。同一编号复测合格后入库。"],
    ["孔位或尺寸超差", "原件保留报废记录，按订单缺口补投，替补件使用新编号。"],
    ["入库计数", "仅合格入库增加订单完成量。首检和返工复测可分别查询。"],
  ], 648, 200, 576, 139);
}
{
  const s = page(2, "故障联动与维修恢复", "告警、停机状态、工件冻结和调度更新使用同一个设备编号。",
    "维护逻辑  |  模拟维修步骤和恢复事件可在设备与报告页面追踪",
    "来源：src/pages/Health.tsx、src/pages/AR.tsx、src/simulation/engine.ts、tests/workflow.spec.ts。");
  flow(s, [
    ["触发告警", "温度、振动\n或设备异常"], ["停机隔离", "冻结在制工件\n退出可用派工"],
    ["创建维修工单", "按设备记录\n维修进度"], ["确认并恢复", "隔离、检查、复位\n工序与排产继续"],
  ], 211, 146);
  rules(s, [
    ["维修联锁", "有维修工单时，隔离、检查、复位三项均确认后才开放恢复操作。"],
    ["故障证据", "告警历史与维修记录保留。其他兼容单元具备空位时可接收未开工毛坯。"],
  ], 56, 400, 1168, 108);
}
{
  const s = page(2, "AGV 物流与仓储发运", "物流把质检结果转换为库存和订单履约记录，同时处理停机转运与满仓等待。",
    "仓储规则  |  480 件容量，12 个逻辑货格，发运释放当前库存",
    "来源：deliverables/screenshots/v1.3-reroute.png；src/features/digital-twin/logistics.ts、tests/flexibility.test.ts。");
  await img(s, "v1.3-reroute.png", 56, 212, 725, 398, clip(1440, 1034, 240, 185, 1430, 838));
  rules(s, [
    ["正常转运  14 秒", "取货、顶升、载货、入库和返回动作随转运阶段联动。"],
    ["替代路线  8 秒", "故障单元仅移出未开工毛坯，在制件留在原工序。"],
    ["发运释放容量", "满仓阻塞入库，发运后库存减少，历史订单完成量保留。"],
  ], 817, 199, 407, 140);
}
{
  const s = page(2, "AR 目标识别与巡检工单", "摄像头对准识别图，MindAR 跟踪目标并叠加简化设备模型。",
    "AR 验证  |  补充验证确认识别成功，图为桌面合成视频流记录",
    "来源：用户补充确认 AR 功能验证成功；deliverables/ar-synthetic-result.json、deck-ar-synthetic.png、src/pages/AR.tsx。用户未提供设备型号、逐次结果和耗时。");
  await img(s, "deck-ar-synthetic.png", 56, 201, 755, 390, clip(1064, 760, 27, 196, 1037, 717));
  caption(s, "左侧为识别叠加，右侧为同设备的巡检与维修工单", 56, 605, 755);
  rules(s, [
    ["识别成功", "补充验证已确认 AR 能成功识别目标。"],
    ["现场操作", "选择设备，授权相机并对准识别图，按工单逐项确认。"],
    ["失败处理", "权限拒绝时给出提示，可进入普通三维巡检。"],
  ], 847, 201, 377, 139);
}
{
  const s = page(2, "驾驶舱概览与可复核报告", "驾驶舱从车间状态汇总产出、在制、质量、能耗和告警。",
    "界面证据  |  驾驶舱运行快照与可按事件、设备和时间检索的报告",
    "来源：final-dashboard.png、final-reports.png；src/pages/Dashboard.tsx、src/pages/Reports.tsx。");
  await img(s, "final-dashboard.png", 56, 197, 555, 386);
  await img(s, "final-reports.png", 669, 197, 555, 386);
  caption(s, "驾驶舱  |  全厂或产线范围的运行指标", 56, 594, 555);
  caption(s, "报告  |  事件 CSV、状态 JSON、可打印 HTML", 669, 594, 555);
}
{
  const s = page(2, "界面设置与浏览器存档", "系统可以调整主题、字号、表格密度、三维画质与默认模拟倍速。",
    "界面证据  |  设置、版本清单、外观和显示偏好",
    "来源：deliverables/screenshots/final-settings.png；src/pages/Settings.tsx、src/store/useFactory.ts、tests/settings.spec.ts。");
  await img(s, "final-settings.png", 56, 194, 617, 429);
  rules(s, [
    ["显示偏好", "主题和字号同步应用于导航、排产条和图表。"],
    ["本地存档", "订单、工件和维修记录随刷新恢复，恢复时模拟默认暂停。"],
    ["备份与版本", "可导出工作空间。版本检查读取部署清单。"],
  ], 720, 197, 504, 142);
}

// Evidence and evaluation
{
  const { benchmark } = validation;
  const s = page(3, "同批量下的能耗与工期", "40 件法兰、两单元、关闭随机不良，逐秒模拟至订单全部合格入库。",
    "数据来源  |  v1.3-final-validation.json / benchmark",
    "来源：deliverables/v1.3-final-validation.json 的 benchmark；设备功率和工序倍率为模拟设定。", dark);
  const names = { standard: "标准", performance: "高性能", eco: "节能" };
  table(s, [
    ["运行模式", "完工用时 / 模拟秒", "合格入库 / 件", "累计模拟能耗 / kWh"],
    ...benchmark.map(b => [names[b.mode], String(b.seconds), String(b.stored), b.energyKwh.toFixed(4)]),
  ], [223, 310, 245, 390], 212, 279, dark, 23);
  rules(s, [
    ["工期与能耗的取舍", "能耗页按设备功率对模拟时间积分，显示产线趋势和分设备用电。\n同一批次中，高性能模式工期最短，节能模式累计用电最低。"],
  ], 56, 517, 1168, 132, dark);
}
{
  const s = page(3, "验证方法与覆盖范围", "用逻辑单元、浏览器业务流程和布局组合覆盖关键路径。",
    "验证环境  |  Windows、Chrome、SwiftShader 软件 WebGL",
    "来源：docs/03-系统验证.md、v1.3-final-validation.json、tests/、deliverables/ar-synthetic-result.json。", dark);
  summary(s, "单元测试通过", String(validation.unitTests), 56, 205, 320, dark);
  summary(s, "浏览器用例通过", String(validation.browserTests), 464, 205, 320, dark);
  summary(s, "页面与宽度组合", String(validation.productionLayouts.length), 872, 205, 352, dark);
  table(s, [
    ["核验场景", "观察结果"],
    ["暂停、故障与回放", "在制工件与阶段进度保留，回放不会改变生产状态"],
    ["超差、返工、换型与物流", "结果可复现，首检保留，兼容约束及满仓规则有效"],
    ["布局与 AR", "三种宽度无页面横向溢出，目标识别与摄像头释放有记录"],
  ], [367, 801], 332, 274, dark, 21);
}
{
  const b = validation.batch;
  const s = page(3, "默认订单完成与工件数量守恒", "从 370 件合格需求出发，运行完整默认批次，核对工件去向与订单完成记录。",
    "数据来源  |  v1.3-final-validation.json / batch，模拟运行窗口 12,000 秒",
    "来源：deliverables/v1.3-final-validation.json 的 batch；tests/flow.test.ts 与 tests/flow.spec.ts。", dark);
  const metrics = [
    ["释放工件", b.released], ["合格入库", b.stored], ["隔离报废", b.scrapped], ["最终在制", b.wip],
  ];
  for (const [i, [label, value]] of metrics.entries()) {
    const x = 56 + i * 292;
    rect(s, x, 209, 264, 2, dark.line);
    summary(s, label, String(value), x, 230, 264, dark);
  }
  text(s, `${b.released}  =  ${b.stored}  +  ${b.scrapped}`, 56, 365, 1168, 86, {
    size: 61, color: dark.ink, bold: true,
  });
  paragraph(s, `每件有唯一编号。全部 ${b.traceCount} 件均保存 19 个已完成的工序区间。`, 56, 482, 1168, dark);
  paragraph(s, `末单在 ${b.completionTime.toLocaleString("en-US")} 模拟秒完工。存档约 ${(b.storageBytes / 2 ** 20).toFixed(2)} MiB，刷新可恢复批次记录。`, 56, 550, 1168, dark);
}
{
  const s = page(3, "仿真边界与证据口径", "验证聚焦浏览器原型的流程一致性、规则复现和界面操作。",
    "评估范围  |  当前结论适用于已记录的原型、运行环境与模拟条件",
    "来源：docs/03-系统验证.md、docs/05-AR实机测试清单.md、v1.3-final-validation.json；用户补充 AR 验证反馈。", dark);
  table(s, [
    ["方面", "模型或测试条件", "可支持的结论"],
    ["加工与质量", "简化几何、刀路与规则测量", "工序联锁、参数映射和超差处置可复现"],
    ["生产与能耗", "模拟订单、时钟、设定功率与倍率", "同条件可比较用时、能耗和批次工件去向"],
    ["AR 识别", "同一目标图绑定所选设备，叠加简化模型", "已确认目标识别成功。桌面自动化记录媒体轨道释放"],
    ["运行与数据", "浏览器本地规则引擎及存档", "本地运行、恢复和导出。现场设备接入需 PLC 与工业接口"],
  ], [220, 452, 496], 206, 386, dark, 22);
}

// Handoff
{
  const s = page(4, "运行项目与查看验证材料", "仓库包含源码、测试用例、复核手册和原型验证记录。",
    "SmartFactory Nexus  |  原型 v1.3.0",
    "来源：Git origin、README.md、启动系统.cmd、docs/22-系统测试操作手册.docx、deliverables/v1.3-final-validation.json。");
  rules(s, [
    ["运行原型", "Windows 安装 Node.js 22.12+，双击「启动系统.cmd」，浏览器访问本机原型。"],
    ["复核项目", "按《系统测试操作手册》检查关键流程。运行 npm test、npm run test:e2e 或 npm run build。"],
  ], 56, 198, 1168, 116);
  rect(s, 56, 466, 1168, 2, dark.line);
  text(s, "已推送至作者个人 GitHub 仓库", 56, 488, 1168, 41, { size: 29, bold: true });
  text(s, repo, 56, 545, 1168, 45, { size: 28, color: dark.accent, link: repo });
  caption(s, "GitHub 公开仓库  |  源码、测试与演示材料", 56, 609, 1168);
}

const output = path.join(work, "review-draft.pptx");
await (await PresentationFile.exportPptx(deck)).save(output);
await fs.writeFile(path.join(work, "slide-manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`Exported ${manifest.length} editable slides to ${output}`);

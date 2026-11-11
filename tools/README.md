# PPT 生成说明

当前演示文稿为 `deliverables/智造未来-数字孪生与AR柔性制造车间.pptx` 及同名 PDF。架构图、流程图与表格可编辑，界面图片来自原型截图，批次和能耗数据取自 `deliverables/v1.3-final-validation.json`。

1. 用包含 `@oai/artifact-tool` 的 Codex 运行时运行 `node tools/build-review-deck.mjs`。如需指定模块路径，将 `NEXUS_ARTIFACT_MODULE` 设为该包入口文件的绝对路径。
2. 草稿 `review-draft.pptx` 写入 `deliverables/.ppt-build/review`。从 PowerPoint 导出 PDF，检查分页、文本和链接，再复制已验证的交付文件。
3. 第 16 页记录 AR 识别结果。第 1 和 23 页链接至作者个人 GitHub 仓库。

`make-submission-plan.py` 和 `build-submission.ps1` 用于复现之前的演示文稿。

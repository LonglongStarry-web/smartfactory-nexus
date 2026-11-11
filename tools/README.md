# PPT生成来源

最终PPT由Windows本机PowerPoint原生对象生成，图片是本原型实际截图，表格数据读取最终验证JSON。文字、表格和结构图可编辑。

1. 可选运行 `python tools/make-submission-plan.py`，从验证结果重建内容计划。
2. 在安装PowerPoint的Windows电脑运行 `pwsh -File tools/build-submission.ps1`。
3. 草稿PPTX/PDF输出到`deliverables/.ppt-build`，逐页PNG和文本边界检查输出到`deliverables`；最终提交文件不自动覆盖。

现有本地文件工作流采用原生PowerPoint COM，保留原生可编辑对象。交付前已进行包完整性、字体、布局、COM文本边界与逐页目视检查。没有声称完成Artifact导入测试。

封面与末页显示 GitHub 完整地址，并附可点击的仓库超链接。当前交付文件为 `deliverables/智造未来-系统设计与初步验证.pptx` 及同名 PDF。

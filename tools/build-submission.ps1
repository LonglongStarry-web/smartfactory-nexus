$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
$buildDir=Join-Path $projectRoot 'deliverables\.ppt-build'
New-Item -ItemType Directory -Force -Path $buildDir | Out-Null
$deckDir=Join-Path $projectRoot 'deliverables'
$renderDir=Join-Path $deckDir 'submission-slides'
New-Item -ItemType Directory -Force -Path $renderDir | Out-Null
$plan=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'submission-plan.json') -Raw -Encoding UTF8|ConvertFrom-Json
function Color([string]$hex){$h=$hex.TrimStart('#');return [int]([Convert]::ToInt32($h.Substring(0,2),16)+256*[Convert]::ToInt32($h.Substring(2,2),16)+65536*[Convert]::ToInt32($h.Substring(4,2),16))}
$bg=Color '#0B1220';$ink=Color '#E8EEF7';$muted=Color '#9EB0C5';$accent=Color '#22D3EE';$line=Color '#3B5066'
function Text($sl,[string]$txt,[single]$x,[single]$y,[single]$w,[single]$h,[single]$size=18,[int]$color=$ink,[bool]$bold=$false){
 $sh=$sl.Shapes.AddTextbox(1,$x,$y,$w,$h);$sh.TextFrame.MarginLeft=0;$sh.TextFrame.MarginRight=0;$sh.TextFrame.MarginTop=0;$sh.TextFrame.MarginBottom=0;$sh.TextFrame.WordWrap=-1
 $sh.TextFrame.TextRange.Text=$txt;$sh.TextFrame.TextRange.Font.Name='Microsoft YaHei';$sh.TextFrame.TextRange.Font.NameFarEast='Microsoft YaHei';$sh.TextFrame.TextRange.Font.Size=$size;$sh.TextFrame.TextRange.Font.Color.RGB=$color;$sh.TextFrame.TextRange.Font.Bold=([int]$bold*-1);$sh.TextFrame.TextRange.ParagraphFormat.SpaceAfter=0
 return $sh
}
function Node($sl,[string]$txt,[single]$x,[single]$y,[single]$w,[single]$h,[single]$font=19){$sh=$sl.Shapes.AddShape(1,$x,$y,$w,$h);$sh.Fill.ForeColor.RGB=$bg;$sh.Line.ForeColor.RGB=$line;$sh.TextFrame.MarginLeft=12;$sh.TextFrame.MarginRight=12;$sh.TextFrame.MarginTop=8;$sh.TextFrame.MarginBottom=8;$sh.TextFrame.WordWrap=-1;$sh.TextFrame.TextRange.Text=$txt;$sh.TextFrame.TextRange.Font.Name='Microsoft YaHei';$sh.TextFrame.TextRange.Font.NameFarEast='Microsoft YaHei';$sh.TextFrame.TextRange.Font.Size=$font;$sh.TextFrame.TextRange.Font.Color.RGB=$ink;$sh.TextFrame.TextRange.ParagraphFormat.Alignment=2;$sh.TextFrame.VerticalAnchor=3;return $sh}
function Arrow($sl,[single]$x1,[single]$y1,[single]$x2,[single]$y2){$a=$sl.Shapes.AddConnector(1,$x1,$y1,$x2,$y2);$a.Line.ForeColor.RGB=$accent;$a.Line.Weight=1.5;$a.Line.EndArrowheadStyle=3;[void]$a.ZOrder(1)}
function Picture($sl,[string]$name,[single]$x,[single]$y,[single]$w,[single]$h,[double]$cropTop=0,[double]$cropBottom=0){
 $path=Join-Path $deckDir ('screenshots\'+$name)
 if(-not(Test-Path -LiteralPath $path)){throw "Missing image $name"}
 $im=$sl.Shapes.AddPicture($path,0,-1,$x,$y,-1,-1)
 $originalWidth=$im.Width
 $originalHeight=$im.Height
 $visibleHeight=$originalHeight*(1-$cropTop-$cropBottom)
 $ratio=[Math]::Min($w/$originalWidth,$h/$visibleHeight)
 $im.LockAspectRatio=0
 if($cropTop -gt 0 -or $cropBottom -gt 0){
  $crop=$im.PictureFormat.Crop
  $crop.ShapeWidth=$originalWidth*$ratio
  $crop.ShapeHeight=$visibleHeight*$ratio
  $crop.PictureWidth=$originalWidth*$ratio
  $crop.PictureHeight=$originalHeight*$ratio
  $crop.PictureOffsetX=0
  $crop.PictureOffsetY=$originalHeight*($cropBottom-$cropTop)*$ratio/2
 }else{
  $im.Width=$originalWidth*$ratio
  $im.Height=$originalHeight*$ratio
 }
 $im.Left=$x+($w-$im.Width)/2
 $im.Top=$y+($h-$im.Height)/2
}
function Table($sl,$rows,$widths){
 $nr=$rows.Count;$nc=$widths.Count;$tb=$sl.Shapes.AddTable($nr,$nc,46,187,868,288).Table
 for($c=1;$c -le $nc;$c++){$tb.Columns.Item($c).Width=$widths[$c-1]}
 for($r=1;$r -le $nr;$r++){for($c=1;$c -le $nc;$c++){$cell=$tb.Cell($r,$c);$cell.Shape.Fill.ForeColor.RGB=$bg;$tf=$cell.Shape.TextFrame;$tf.MarginLeft=9;$tf.MarginRight=9;$tf.MarginTop=7;$tf.MarginBottom=7;$tf.TextRange.Text=$rows[$r-1][$c-1];$tf.TextRange.Font.Name='Microsoft YaHei';$tf.TextRange.Font.NameFarEast='Microsoft YaHei';$tf.TextRange.Font.Size=16;$tf.TextRange.Font.Color.RGB=$(if($r -eq 1){$accent}else{$ink});$tf.TextRange.Font.Bold=$(if($r -eq 1){-1}else{0});$tf.TextRange.ParagraphFormat.SpaceAfter=0;foreach($b in 1..4){$cell.Borders.Item($b).ForeColor.RGB=$line;$cell.Borders.Item($b).Weight=.6}}}
}
$app=New-Object -ComObject PowerPoint.Application
$deck=$app.Presentations.Add(0);$deck.PageSetup.SlideWidth=960;$deck.PageSetup.SlideHeight=540
try{
 for($i=0;$i -lt $plan.Count;$i++){
  $d=$plan[$i];$sl=$deck.Slides.Add($i+1,12);$sl.FollowMasterBackground=0;$sl.Background.Fill.ForeColor.RGB=$bg
  [void](Text $sl 'SmartFactory Nexus · 课程提交版' 44 20 600 20 12 $muted)
  [void](Text $sl ([string]($i+1)) 879 20 35 20 12 $muted)
  if($d.kind -eq 'cover'){
   [void](Text $sl $d.title 44 118 380 70 46 $ink $true)
   [void](Text $sl $d.lead 46 218 370 102 26 $ink)
   [void](Text $sl ($d.points -join "`n") 46 371 390 94 17 $muted)
   Picture $sl 'final-plate.png' 443 117 474 351
  }else{
   [void](Text $sl $d.title 44 64 872 55 32 $ink $true)
   [void](Text $sl $d.lead 46 123 868 53 18 $muted)
   switch($d.kind){
    'table'{Table $sl $d.rows $d.widths}
    'rows'{for($j=0;$j -lt $d.points.Count;$j++){[void](Text $sl $d.points[$j][0] 46 (199+$j*94) 220 75 24 $accent $true);[void](Text $sl $d.points[$j][1] 292 (200+$j*94) 620 80 20 $ink)}}
    'architecture'{
     $top=@('React 业务页面（8模块）','ECharts 图表','主题 / 字号 / 报告导出')
     for($j=0;$j -lt 3;$j++){[void](Node $sl $top[$j] (46+$j*300) 194 268 58 18);Arrow $sl (180+$j*300) 252 (180+$j*300) 291}
     [void](Node $sl 'Zustand 统一状态：订单 / 设备 / 工件 / 工序 / 质量 / 维修 / 能耗' 46 291 868 62 20)
     $bottom=@('模拟时钟与规则引擎','R3F 三维场景与回放','MindAR 独立识别','本地持久化与记录')
     for($j=0;$j -lt 4;$j++){Arrow $sl (146+$j*223) 353 (146+$j*223) 405;[void](Node $sl $bottom[$j] (46+$j*223) 405 199 62 17)}
    }
    'entities'{
     [void](Node $sl "订单`n需求 / 优先级 / 交期" 46 206 252 68 18)
     [void](Node $sl "工件唯一编号`n订单关联 / 所在位置" 354 206 252 68 18)
     [void](Node $sl "配方与参数快照`n投料时固定" 662 206 252 68 18)
     Arrow $sl 298 240 354 240;Arrow $sl 662 240 606 240
     Arrow $sl 480 274 480 389
     $bottom=@("加工工序轨迹`n设备 / 时间 / 持有者","检测与处置`n测量 / 首检 / 返工","入库与发运`n库存 / 历史订单履约")
     for($j=0;$j -lt 3;$j++){[void](Node $sl $bottom[$j] (46+$j*308) 389 252 75 18)}
     $a=$sl.Shapes.AddLine(172,329,788,329);$a.Line.ForeColor.RGB=$accent;Arrow $sl 172 329 172 389;Arrow $sl 788 329 788 389
    }
    'process'{
     $groups=@("上料与装夹`n`n抓取毛坯 / 开门`n定位 / 夹紧`n撤爪 / 关门`n`n夹爪 → 夹具","切削与退刀`n`n端面 / 外轮廓`n钻孔 / 去毛刺`n刀具退回安全位`n`n夹具持续持有","卸料与送检`n`n开门 / 握持成品`n松夹 / 卸料`n关门 / 放入检测台`n`n夹具 → 夹爪 → QC","检测与分流`n`n扫描测量`n规格判定 / 分流`n合格与超差分开`n`nQC → 暂存位")
     for($j=0;$j -lt 4;$j++){[void](Node $sl $groups[$j] (46+$j*224) 195 196 276 18);if($j -lt 3){Arrow $sl (242+$j*224) 331 (270+$j*224) 331}}
    }
    'triptych'{for($j=0;$j -lt 3;$j++){Picture $sl $d.images[$j] (46+$j*296) 186 276 241;[void](Text $sl $d.labels[$j] (46+$j*296) 439 276 34 18 $ink $true)}}
    'twoimages'{for($j=0;$j -lt 2;$j++){Picture $sl $d.images[$j] (46+$j*444) 187 424 270;[void](Text $sl $d.labels[$j] (46+$j*444) 459 424 28 17 $ink $true)}}
    default{
     for($j=0;$j -lt $d.points.Count;$j++){[void](Text $sl $d.points[$j] 46 (200+$j*89) 278 82 18 $ink)}
     Picture $sl $d.image 350 185 565 292 $d.crop_top $d.crop_bottom
    }
   }
   [void](Text $sl $d.caption 46 495 868 39 14 $muted)
  }
  try{$sl.NotesPage.Shapes.Placeholders.Item(2).TextFrame.TextRange.Text=$d.notes}catch{}
 }
 $draft=Join-Path $buildDir 'submission-draft.pptx';$deck.SaveAs($draft,24)
 $checks=@();foreach($page in $deck.Slides){foreach($shape in $page.Shapes){if($shape.HasTextFrame -eq -1 -and $shape.TextFrame.HasText -eq -1){$checks+=@{slide=$page.SlideIndex;text=$shape.TextFrame.TextRange.Text;outOfSlide=($shape.Left -lt -1 -or $shape.Top -lt -1 -or $shape.Left+$shape.Width -gt 961 -or $shape.Top+$shape.Height -gt 541);overflow=($shape.TextFrame.TextRange.BoundHeight -gt $shape.Height+3)}}if($shape.HasTable -eq -1){for($r=1;$r -le $shape.Table.Rows.Count;$r++){for($c=1;$c -le $shape.Table.Columns.Count;$c++){$cell=$shape.Table.Cell($r,$c).Shape;$checks+=@{slide=$page.SlideIndex;cell="$r,$c";text=$cell.TextFrame.TextRange.Text;overflow=($cell.TextFrame.TextRange.BoundHeight -gt $cell.Height-$cell.TextFrame.MarginTop-$cell.TextFrame.MarginBottom+3);outOfSlide=$false}}}}}}
 @{slideCount=$deck.Slides.Count;font='Microsoft YaHei';fontPolicy=@{basis='design';families=@('Microsoft YaHei')};checks=$checks;method='Native PowerPoint COM; every slide exported to PNG; editable text, tables and diagrams; artifact runtime unavailable'}|ConvertTo-Json -Depth 6|Set-Content -LiteralPath (Join-Path $deckDir 'submission-ppt-validation.json') -Encoding UTF8
 foreach($sl in $deck.Slides){$sl.Export((Join-Path $renderDir ('slide-{0:00}.png' -f $sl.SlideIndex)),'PNG',1600,900)}
 $pdf=Join-Path $buildDir 'submission-draft.pdf';$deck.SaveAs($pdf,32)
 Write-Output "Created $($deck.Slides.Count) editable slides, PDF and all PNG previews."
}finally{$deck.Close();[void][Runtime.InteropServices.Marshal]::ReleaseComObject($deck);[void][Runtime.InteropServices.Marshal]::ReleaseComObject($app)}

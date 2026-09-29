# ACCEPTANCE · 《猜猜我》MVP

执行人：Hermes（自动化 + 手工模拟）。每项须有证据（脚本输出或逐条走查记录）。

## A. 功能验收（对应任务书 §11）

| # | 项目 | 通过标准 |
|---|---|---|
| 1 | A 创建 5 道题 | 表单可增填 5 题并选定答案 |
| 2 | A 生成链接 | 输出含 `#` 编码数据的 URL |
| 3 | B 打开链接 | 进入 B_ANSWER_A，5 题正确显示 |
| 4 | B 回答 A 的题 | 全部作答后可提交，进入 B_CREATE |
| 5 | B 创建 5 道题 | 同 #1 |
| 6 | B 生成返回链接 | stage=2 URL 含 a 题 + bAnswers + b 题 |
| 7 | A 打开返回链接 | 进入 A_ANSWER_B，B 的题正确显示 |
| 8 | A 回答 B 的题 | 提交后本地算分 |
| 9 | 得分计算 | 已知答案的构造用例：X/5、Y/5 精确匹配 |
| 10 | 非法 URL | 空/乱码/缺字段/错 version/题数≠5/选项≠4/answer 越界/超长 → 全部显示「这个链接无效或已经损坏。」且无未捕获 JS 错误 |
| 11 | 刷新不崩溃 | 各状态下刷新回到当前环节 |
| 12 | navigator.share 可用 | 在安全上下文调用分享面板（代码走查 + 条件模拟） |
| 13 | 不支持 share 时复制 | 复制链接成功、有「已复制」反馈 |
| 14 | 手机尺寸 | 375×667 无横向滚动、按钮 ≥44px |
| 15 | 隐私静态检查 | 代码中无 fetch/XHR/WebSocket/Analytics/广告 SDK/外部资源/cookie |

## B. 隐私验收（对应任务书 §3）

- 全源码 grep：`fetch(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|document.cookie|<script src|@font-face|https?://`（除注释与规格文档外）零命中。
- 答案只流经 URL Fragment 与内存。
- README 隐私表述只允许「游戏程序不会把答案上传到服务器。」口径，不得出现「绝对没有网络痕迹」。

## C. 冻结验收

- 无规格外功能；无 MVP 禁令清单中的任何一项（任务书 §13）。
- 新想法只允许出现在 README「Future Ideas」章节。

## D. 交付物

交付报告含任务书 §12 的 A–G 七节，逐项 PASS/FAIL/NOT TESTED。

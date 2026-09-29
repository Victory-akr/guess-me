# SRS · 《猜猜我》MVP

## 1. 技术栈约束（硬性）

允许：HTML、CSS、Vanilla JavaScript。
禁止：React/Vue/Angular、Node.js 后端、npm/构建系统、数据库、API、云函数、第三方 SDK、登录、账号、广告、Analytics、WebSocket、外部字体、外部图片、AI API。
运行方式：直接双击打开 `index.html`（file:// 可用），或任意静态托管。

## 2. 页面状态机（必须实现的 8 个状态）

HOME → A_CREATE → SHARE_TO_B → B_ANSWER_A → B_CREATE → SHARE_BACK_TO_A → A_ANSWER_B → RESULT
（另加：ERROR = 无效链接提示态）

路由规则（由 URL Fragment 决定入口）：

| Fragment | 进入状态 |
|---|---|
| 无 | HOME |
| `#<stage=1 数据>` | B_ANSWER_A（后续经 B_CREATE → SHARE_BACK_TO_A） |
| `#<stage=2 数据>` | A_ANSWER_B（答完 → RESULT） |
| 解析失败 / 校验失败 | ERROR |

## 3. 数据结构（version 1）

```json
{
  "version": 1,
  "stage": 1,
  "a": { "questions": [ { "question": "...", "options": ["...","...","...","..."], "answer": 0 } ] },
  "bAnswers": [],
  "b": { "questions": [] },
  "aAnswers": []
}
```

- stage=1 链接只携带 `version, stage, a`。
- stage=2 链接携带 `version, stage, a, bAnswers, b`。
- `aAnswers` 只在 A 本地内存中产生，**不进入任何 URL**；RESULT 全部本地计算。
- 题目数组固定 5 项；options 固定 4 项；answer/bAnswers/aAnswers 均为 0..3 整数索引。

## 4. 编码

JSON → UTF-8 字节 → Base64 → Base64URL（`+`→`-`，`/`→`_`，去 `=`）。
仅编码，非加密。解码用严格字符表校验，任何失败走 ERROR。

## 5. 校验规则（全部在渲染前完成，任一失败 → ERROR）

1. Fragment 长度 > 64000 字符 → 超长，无效。
2. Base64URL 解码失败 / UTF-8 解码失败 / JSON 解析失败。
3. 解码后 JSON 文本 > 30000 字符 → 超长，无效。
4. `version !== 1`；`stage` 非 1/2。
5. 缺字段：stage=1 缺 `a.questions`；stage=2 缺 `a/b/bAnswers` 任一。
6. `questions.length !== 5`（a 与 b 分别校验）。
7. 任一题 `options.length !== 4`；题干 >80 字符；选项 >30 字符；空字符串。
8. `answer` 非 0..3 整数。
9. stage=2：`bAnswers.length !== 5` 或含非 0..3 整数。
10. 创建表单侧：题干/选项为空、未选正确答案 → 内联提示，不生成链接（不进 ERROR 态）。

## 6. 分享

- `navigator.share` 存在且在用户手势内调用；失败/不可用（file:// 等非安全上下文）→ 回退「复制链接」。
- 复制：`navigator.clipboard.writeText`（安全上下文）→ 回退 `document.execCommand('copy')`（textarea 选中）→ 再回退提示手动选中。
- 不接微信/QQ SDK。

## 7. 结果计算（本地）

- A 得分 = `bAnswers[i] === a.questions[i].answer` 的个数（X/5）。
- B 得分 = `aAnswers[i] === b.questions[i].answer` 的个数（Y/5）。

## 8. 隐私红线（代码层面）

全项目禁止出现：`fetch`、`XMLHttpRequest`、`WebSocket`、`EventSource`、`sendBeacon`、`<img src=http`、`<script src=`（外部）、`<link>` 外部字体、Analytics/广告 SDK、`document.cookie`。
游戏数据仅存于 URL Fragment 与内存；不落盘、不上传。

## 9. 兼容性目标

现代浏览器（Chrome/Edge/Safari/Firefox 近版本），移动端 375px 宽起步，单列自适应布局；系统字体，无外部图片（图标用 emoji/纯 CSS）。

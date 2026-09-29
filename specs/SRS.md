# SRS · 《猜猜我》MVP v3

## 1. 技术栈约束（硬性）

允许：HTML、CSS、Vanilla JS。禁止：框架、后端、npm/构建、数据库、API、第三方 SDK、登录、广告、Analytics、WebSocket、外部字体/图片、AI API、Cookie/localStorage/sessionStorage/IndexedDB。
运行：双击 index.html（file://）或静态托管。

## 2. 状态机

HOME →(开始) A_SELF →(提交) SHARE_TO_B → [对方] B_GUESS →(提交) B_SELF →(提交) SHARE_BACK_TO_A → [对方] A_GUESS →(提交) RESULT。带 Fragment 入口解析失败 → ERROR。角色字段 role 仅存内存，不进 URL。

## 3. 数据结构（protocolVersion=3）

```json
stage1: {"pv":3,"bv":<int>,"st":1,"g":"<4-8位[a-z0-9]>","q":["<5个bank ID>"],"aa":[<5个0..3>]}
stage2: {"pv":3,"bv":<int>,"st":2,"g":"同上","q":[...],"aa":[...],"bq":["<5个ID，与q不相交>"],"bg":[...],"ba":[...]}
```

- 题目/选项文字永不进 URL；由本机 window.GUESS_ME_BANK 按 id 还原。
- A 的最终猜测 ag 只存 A 内存，不进任何 URL。
- 长度硬门槛：stage1 URL ≤300 字符；stage2 URL ≤500 字符。超出即 FAIL。

## 4. 版本策略

- `pv` 协议版本：payload 结构变更才升。当前 3。
- `bv` 题库版本：题目文字/选项/增删任何变化必须同步递增 window.QUESTION_BANK_VERSION。当前 1。
- 二者正交。不匹配 → fail-closed 进 ERROR（ERR_PROTOCOL_VERSION / ERR_BANK_VERSION），禁止静默变脸。
- v1/v2 旧链接在 v3 代码下全部拒绝（预期行为，README 已声明）。

## 5. 校验规则（顺序即优先级，全部渲染前完成，失败→ERROR+内部码）

1. ERR_EMPTY_FRAGMENT（空 fragment 视为首页，不算错）
2. ERR_LENGTH（fragment >8000）
3. ERR_BASE64（字符表 / 解码失败）
4. ERR_UTF8 / ERR_JSON
5. ERR_PAYLOAD（非对象）
6. ERR_PROTOCOL_VERSION（pv≠3）
7. ERR_BANK_VERSION（bv≠本机题库版本）
8. ERR_STAGE（st∉{1,2}）
9. ERR_GAME_ID（格式）
10. ERR_QUESTION_COUNT（题数组≠5）
11. ERR_QUESTION_ID（ID 不在本机题库）
12. ERR_DUPLICATE_QUESTION（stage2 时 q 与 bq 相交）
13. ERR_ANSWER（答案数组≠5 个 0..3 整数）
14. ERR_BANK_INTEGRITY / ERR_BANK_SMALL（题库自检失败 / 可用类别<5，本地环境错误）
用户界面统一显示"这个链接无效或已经损坏。"；ERR_* 显示于 aria-hidden 调试行。

## 6. 分享

navigator.share → 回退 clipboard.writeText → 回退 execCommand → 回退手动选中提示。不接微信/QQ SDK。

## 7. 结果计算（本地）

TA猜中你 = #{bg[i]===aa[i]}；你猜中TA = #{ag[i]===ba[i]}。逐题对照按查看者视角标注代词。

## 8. 隐私红线（代码层面）

全项目禁止：fetch、XMLHttpRequest、WebSocket、EventSource、sendBeacon、外部资源、Analytics/广告 SDK、document.cookie、localStorage/sessionStorage/IndexedDB。游戏数据仅存于 URL Fragment 与内存。

## 9. 兼容性目标

Chrome/Edge/Firefox/Safari 近版本 + iOS 微信内置浏览器（WKWebView）。移动端 375px 起单列。file:// 可用。链接长度需适应"人在微信里长按复制"：短到一眼完整、不易截尾。

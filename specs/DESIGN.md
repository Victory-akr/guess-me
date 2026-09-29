# DESIGN · 《猜猜我》MVP v3

## 1. 文件结构

```
guess-me/
├─ index.html        # 5 个屏（home/answer/share/result/error），一次加载，资源引用带 ?v=3 钉版
├─ style.css         # 单列移动端优先
├─ question-bank.js  # window.GUESS_ME_BANK + window.QUESTION_BANK_VERSION（改题必须升号）
├─ app.js            # 单文件 IIFE：协议编解码 + 校验(内部ERR码) + 状态机 + 渲染
├─ README.md
└─ specs/
```

## 2. 单一真相

`location.hash`（跨设备传递）+ 内存对象 `S`（本局状态与角色）。无持久层。启动时 initBank() 自检（ID 唯一、4 选项、非空文本），失败即 ERR_BANK_INTEGRITY 并 fail-closed。

## 3. 核心模块（app.js）

| 模块 | 职责 |
|---|---|
| encode/decode | JSON↔Base64URL，失败抛 {code:ERR_*} |
| validate(o) | SRS §5 顺序校验，抛 {code:ERR_*} |
| sampleQuestions(excludeIds) | 5 个不同类别各抽 1；类别不足 5 → null → ERR_BANK_SMALL |
| renderSelfQuiz/renderGuess | 自答页/猜测页共用选项渲染；进度门（5/5 才可提交） |
| submit() | 角色状态机推进：A_SELF→SHARE / B_GUESS→B_SELF→SHARE / A_GUESS→RESULT |
| route() | 空 hash→HOME；否则 decode→validate→bankMap 还原题目→按 st 进 B_GUESS 或 A_GUESS |
| result/appendDetail | 本地计分 + 逐题对照（按查看者视角代词） |

## 4. 协议设计决策

- URL 只带 ID 与索引：实测 stage1 frag≈105、stage2≈195 字符，满足 300/500 门槛且无需任何压缩库。
- pv/bv/g 三元前缀；g 提供对局归因，为未来防重放留钩子，但本版不承诺一次性。
- A 的答案 aa 进 stage1（威胁模型：链接即秘密通道，拿到即可读，已在 PRD/README/分享页三处声明）。

## 5. 部署一致性

发布顺序：question-bank.js（含 bv）→ app.js（含 pv）→ index.html（?v= 钉版）。Pages 有约 1-2 分钟边缘缓存窗口（实测 max-age=600），?v= 与 app 内的 bv 匹配校验共同保证混载 fail-closed 而非静默错乱。

## 6. 关键实现约束

- 零网络调用；一切异常 try/catch → ERROR（带内部码），不允许未捕获错误。
- file:// 下 navigator.share/clipboard 不可用 → 复制回退路径必须实测。
- 刷新即按 hash 重进当前环节；无"半途状态"持久化。

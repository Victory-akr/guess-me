# DESIGN · 《猜猜我》MVP

## 1. 文件结构

```
guess-me/
├─ index.html      # 全部 8 个状态的 DOM（template 或 section），一次加载
├─ style.css       # 单列移动端优先样式
├─ app.js          # 状态机 + 编解码 + 校验 + 渲染，无模块系统（单文件 IIFE）
├─ README.md
└─ specs/
```

## 2. 状态机

单一真相：`location.hash` + 内存对象 `state`。

```
HOME ──开始出题──▶ A_CREATE ──校验通过──▶ SHARE_TO_B
B_ANSWER_A ──答完5题──▶ B_CREATE ──校验通过──▶ SHARE_BACK_TO_A
A_ANSWER_B ──答完5题──▶ RESULT
任意带 Fragment 入口 ──解析/校验失败──▶ ERROR
```

- 渲染函数 `show(screenId)` 切换 `<section>` 显隐；同一时刻只有一个可见。
- 入口分发 `route()`：hash 为空 → HOME；非空 → decode+validate → 按 stage 进 B_ANSWER_A 或 A_ANSWER_B；失败 → ERROR。
- 内存 `payload` 保存已解码数据（stage1 时 B 出题后拼装 stage2）。

## 3. 核心模块（app.js 内部）

| 模块 | 职责 |
|---|---|
| `encode(obj)` / `decode(str)` | JSON ↔ Base64URL（TextEncoder + btoa/atob 逐字节映射，含 URL 长度上限检查） |
| `validate(obj, expectStage)` | SRS §5 全部规则，返回 `{ok, error}` |
| `buildQuestions()` | A_CREATE / B_CREATE 的 5×(1 题干 + 4 选项 + 单选正确答案) DOM；实时 maxLength 与内联错误 |
| `renderQuiz(questions, container)` | 答题页（radio 必答，答完解锁「提交」） |
| `makeLink(payloadObj)` | 生成完整分享 URL（file:// 下用 `path + #` 拼接） |
| `shareOrCopy(url)` | navigator.share → 回退复制链 |
| `calcResult()` | X/5、Y/5 与逐题对照列表 |

## 4. 页面线框（文字版）

- HOME：标题《猜猜我》、一句话说明、隐私一句话（“游戏程序不会把答案上传到服务器。”）、按钮「我来出题」。
- A_CREATE/B_CREATE：5 张题卡堆叠，每卡：题干输入、4 选项输入、正确答案 radio（ABCD）、底部「生成链接」+ 内联错误区。
- SHARE_TO_B/SHARE_BACK_TO_A：只读 URL 文本框 + 「分享」按钮 + 「复制链接」按钮 + 下一步提示文案。
- B_ANSWER_A/A_ANSWER_B：题目逐屏或整页（整页单列），每题 4 个大按钮选项（radio 包装），全部作答后「提交」可用。
- RESULT：两张记分卡（「B 懂你：X/5」「你懂 B：Y/5」）+ 逐题对错折叠列表 + 「再玩一局」（回 HOME）。
- ERROR：大字「这个链接无效或已经损坏。」+「返回首页」。

## 5. 视觉规范

系统字体栈 `-apple-system, "Segoe UI", "Microsoft YaHei", sans-serif`；主色 #6c5ce7 系；卡片圆角 12px；按钮 ≥44px 触控高度；375px 起单列，无横向滚动；无图片，图标用 emoji。

## 6. 关键实现约束

- 零网络调用（见 SRS §8）；`index.html` 外链只有 `style.css`、`app.js` 两个相对路径。
- 一切异常走 try/catch → ERROR，不允许 console 抛未捕获错误。
- file:// 协议下 `navigator.share`、`navigator.clipboard` 不可用 → 回退路径必须实测可用。
- 刷新即重进当前态：stage1/2 数据全在 hash，无需持久化。

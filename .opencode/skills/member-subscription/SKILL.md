---
name: 会员订阅项目规范
description: 修改会员订阅（member-subscription）项目时使用：遵循项目代码风格、金额与时长规则、UI 交互约束、测试与提交流程
---

# 会员订阅项目规范

## 何时使用

在修改本项目的 `src/`、`server/`、`shared/`、`tests/`、`README.md` 或 `TEST_REPORT.md` 时使用。

先读 `README.md` 了解产品规则，再读 `TEST_REPORT.md` 了解当前测试覆盖情况。涉及具体页面时，先读对应页面、组件和 SCSS，不要凭印象改样式或交互。

## 规则优先级

1. 用户最新的明确指令
2. 本 skill
3. `README.md` 和 `TEST_REPORT.md` 中的现有说明
4. 周边代码的现有写法

如果规范之间冲突，先向用户确认，不要自行选择。

## 工作流

1. 查看 `git status --short`，保留用户正在进行的修改。
2. 做最小必要改动，优先复用现有组件、工具函数和样式。
3. 行为变更同步补测试；纯样式变更至少做浏览器验证。
4. 运行相关测试，再运行类型检查；涉及构建或依赖时运行构建。
5. 视觉改动在 `http://127.0.0.1:5173` 实际确认，不能只看代码。
6. 提交信息使用简短英文，小步提交。
7. 只有用户明确要求时才 push。

## 技术栈与目录

- 前端：React 18 + TypeScript + Vite
- 后端：Express
- 数据库：SQLite（better-sqlite3，WAL 模式）
- 样式：SCSS
- 图表：Recharts 3.10.1
- 测试：Vitest 2.1.9
- 开发模式：Vite 以中间件方式运行在 Express 中，前后端同端口 `5173`

目录约定：

```text
src/pages/<Page>/<Page>.tsx       页面
src/components/<Name>/<Name>.tsx  通用组件
src/utils/                        前端计算与工具函数
src/styles/                       全局样式与设计变量
server/                           API、数据库、校验、聚合、导入导出
shared/                           前后端共用的金额与时长逻辑
tests/                            Vitest 测试与 fixtures
```

## 代码风格

- TypeScript `strict` 模式，不使用 `any` 兜底；确实需要时先说明原因。
- 2 空格缩进、单引号、行尾不加分号、多行结构保留尾逗号。
- 类型导入使用 `import type`。
- 组件使用命名导出，不使用默认导出。
- 组件 props 类型命名为 `<ComponentName>Props`。
- 页面和组件使用「同名目录 + 同名 `.tsx` + 同名 `.scss`」的组织方式。
- 路径别名：`@/` 指向 `src/`，`@shared/` 指向 `shared/`；跨层引用优先用别名。
- 用户可见文案和注释用中文；代码标识符、提交信息用英文。
- 优先复用 `Modal`、`ConfirmDialog`、`Toast`、`Pagination`、`FlowTabs`、`SearchBox`、`EmptyState`、`Badge`、`SelectMenu` 等现有组件，不重复造轮子。
- 样式优先使用 `src/styles/` 里的 CSS 变量和现有工具类；组件私有样式放在同目录 SCSS。
- 前端请求统一走 `src/api.ts`，不要在组件里直接散写 `fetch`。
- 服务端参数校验放在 `server/validation.ts`，联合费用分摊放在 `server/allocation.ts`，不要在 `api.ts`、`store.ts` 里复制同一套规则。
- API 路由保持薄层；业务错误使用 `HttpError`，错误响应格式为 `{ error: string }`。
- 多步数据库写入使用事务；单条读写使用 prepared statement。
- 统计和聚合优先在 `server/store.ts` 的 `buildState` 中完成，前端不要重复实现同一套统计。
- 表单内部可以保留元的字符串输入，但提交前必须通过 `toMinor` 转成分；展示金额通过 `toMajor` 或 `formatCNY`。

## 金额、时长与状态

- 所有金额使用人民币，数据库以「分」存储整数；禁止用浮点数存金额。
- 月均成本四舍五入到分。
- 时长统一使用「天」；一个月按 `365 / 12` 天折算，365 天正好等于 12 个月。
- 单次录入时长范围是 1 到 3650 天。
- 月成本公式：`金额 × 365 / 12 ÷ 覆盖天数`。
- 平台报价未填写总天数时，按套餐计费周期折算。
- 状态只使用 `active` / `planned` / `expired`。
- 界面文案固定为「活跃」「想买」「已过期」。
- 禁止使用「已逾期」；已过期标签使用红色。
- 「想买」没有到期日，不计入支出、到期提醒和统计；记录购买后自动转为「活跃」。
- 下次续费日优先使用手填的 `nextRenewalOverride`。
- 未手填时，按最近一笔支付日期 + 本次覆盖时长 / 套餐计费周期推算。
- 删除支付会重新计算成本统计，但不会主动修改手填的下次续费日。
- 联合费用归属：均分时 `floor(总金额 × 该会员天数 ÷ 所有会员总天数)`，余数记在主会员；主会员承担时全部记在主会员。
- 联合报价和联合续费必须使用同一套费用归属规则；分摊结果在读取时计算，不存储冗余金额。
- 导入采用追加方式，不覆盖已有数据；服务和套餐按名称、周期大小写不敏感地复用或新建；导入失败必须整体回滚。

## 页面与交互约束

### 通用

- Toast 显示在页面顶部，约 2 秒后自动消失。
- 当前主 Tab 在刷新后保持；使用现有标签页记忆逻辑，不要改成 URL 路由。
- 视觉改动保持现有白色卡片、圆角、浅色边框和设计变量风格，除非用户明确要求重做。

### 会员页

- 固定每页 9 条。
- 不显示每页条数选择器。
- 状态筛选、分类筛选、搜索和分页逻辑保持现有行为。

### 比价页

- 使用「联合报价 / 会员」两个 Tab。
- 两个 Tab 的分页互相独立，每页各 10 条。
- 不显示「全部报价记录」。
- 联合报价保持之前的白色卡片布局。
- 联合报价对比时，使用每个会员分摊后的等效月成本，而不是整条报价总价直接除。
- 同捆套餐显示为 `服务名 · 套餐名`。
- 联合报价参考按节省金额从多到少排序，默认显示最省的一条，多条可展开。
- 联合报价参考块放在比价页每个会员的「我的购买」下方。
- 平台报价在对应套餐内查看、编辑和删除，不单独做报价记录页。

### 总览页

- 分类月均使用环形图。
- 会员月均支出使用 Top 6。
- 近 12 个月实际支出与未来 12 个月预计续费可切换。
- 所有图表统一使用 Recharts，不引入其他图表库。
- Top 6 不显示灰色轨道；数值单行放在 pill 条内部；占比放在 tooltip 中。

## 测试与覆盖率

- 测试放在 `tests/`，共享数据工厂放在 `tests/fixtures.ts`。
- 工具函数、服务端逻辑优先写单元 / 集成测试；交互逻辑写组件测试。
- 组件测试文件顶部加 `// @vitest-environment jsdom`。
- 组件测试使用 `@testing-library/react`、`@testing-library/user-event` 和 `@testing-library/jest-dom/vitest`，并在 `afterEach` 调用 `cleanup`。
- 组件测试通过 mock `@/api` 隔离网络请求。
- 数据库测试使用 `SUBLEDGER_DB_PATH` 指向临时 SQLite 文件，禁止读写 `data/app.db`；测试结束后关闭并清理临时目录。
- 导入导出往返测试需要重置 `sqlite_sequence`，保证 ID 可比。
- 测试顺序：先补导入/导出测试，再补组件交互测试。
- 覆盖率范围包含 `src/`、`server/`、`shared/`，排除 `tests/` 和样式文件。
- 覆盖率使用 Istanbul；`npm run test:coverage` 生成 `coverage/`，HTML 入口为 `coverage/index.html`。
- `coverage/` 已被 `.gitignore` 忽略，不提交。
- `vite.config.ts` 中的 `root: realpathSync.native(process.cwd())` 用于修正 Windows 路径大小写导致的覆盖率 ID 不匹配；不要随意删除，改动后必须重新验证覆盖率。
- 常规验证命令：

```bash
npm test
npm run test:coverage
npm run typecheck
npm run build
```

## Git 与交付

- 小步提交，提交信息简短英文，例如 `fix: align compare offer columns`。
- 只有用户明确要求时才 push。
- 不修改用户的 Git 配置。
- 不提交 `data/`、`dist/`、`coverage/`。
- 不重置、不重建、不重新灌入数据库；用户可能在用真实数据测试。
- 开发服务器出现旧的 504 `Outdated Request` 或页面空白时，重启 `npm run dev`，不要直接认为代码有问题。
- 如果本机代理影响 push，可使用临时覆盖命令，不要改全局配置：

```bash
git -c http.proxy= -c https.proxy= push origin master
```

## 禁止事项

- 禁止把金额存成浮点数或元。
- 禁止使用「已逾期」。
- 禁止在比价页恢复「全部报价记录」。
- 禁止给会员页加每页条数选择器。
- 禁止把联合报价改回非白色卡片布局。
- 禁止用非 Recharts 图表替换现有图表。
- 禁止在 Top 6 中加回灰色轨道。
- 禁止在测试中读写 `data/app.db`。
- 禁止在未确认时重置或重新填充数据库。
- 禁止未经要求 push。
- 禁止把服务端校验、联合分摊、统计规则复制到多个文件。

## 待补充

后续可以在这里继续补充：

- 命名偏好与文件拆分规则
- 错误提示文案风格
- API 响应格式与状态码约定
- 表单校验与提交交互细节
- 组件复用与拆分边界
- 性能、可访问性和浏览器兼容要求
- Code Review 检查清单

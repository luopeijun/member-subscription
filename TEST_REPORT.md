# 测试覆盖率报告

统计日期：2026-10-22

## 测试结果

- 测试文件：32 个
- 测试用例：243 个
- 结果：全部通过
- 统计范围：`src/`、`server/`、`shared/` 全部源文件，以及 `electron/desktop.ts`；排除 `tests/` 和样式文件
- 覆盖率工具：Vitest + Istanbul
- 报告目录：`coverage/`（已加入 `.gitignore`）

## 总体覆盖率

| 指标 | 覆盖率 | 已覆盖 / 总数 |
|---|---:|---:|
| 语句 Statements | 74.84% | 1687 / 2254 |
| 分支 Branches | 65.18% | 1273 / 1953 |
| 函数 Functions | 72.95% | 429 / 588 |
| 行 Lines | 75.08% | 1516 / 2019 |

## 分层覆盖率

| 模块 | 文件数 | 语句 | 分支 | 函数 | 行 |
|---|---:|---:|---:|---:|---:|
| `shared/` | 2 | 100% | 100% | 100% | 100% |
| `electron/desktop.ts` | 1 | 100% | 91.66% | 100% | 100% |
| `src/utils/` | 12 | 96.25% | 93.85% | 97.92% | 96.46% |
| `src/components/` | 23 | 64.07% | 62.56% | 66.82% | 64.74% |
| `server/` | 11 | 89.09% | 77.92% | 96.82% | 89.71% |
| `src/pages/` | 11 | 71.90% | 44.26% | 66.95% | 72.43% |
| `src/` 入口与 API | 4 | 3.14% | 0% | 0% | 3.38% |

## 覆盖较好的部分

- `shared/duration.ts`、`shared/money.ts`：100%
- `electron/desktop.ts`：100% 行、91.66% 分支，覆盖数据目录覆盖、旧库定位、主库 / WAL / SHM 复制、失败清理和同源判断
- `src/utils/`：整体接近 96%，周期、日期、金额、报价、快照、标签页等核心函数基本 100%
- 服务端核心逻辑：
  - `validation.ts`：100%
  - `allocation.ts`：100%
  - `errors.ts`：100%
  - `util.ts`：100%
  - `seed.ts`：100%
  - `api.ts`：94.39% 语句 / 96.01% 行，72.91% 分支（会员、支付、联合续费、套餐比价、联合报价、导入导出、清空和示例数据主流程）
  - `store.ts`：100% 语句 / 100% 行，82.11% 分支
  - `app.ts`：100% 语句 / 100% 行，90% 分支（本地服务启动、静态回退和关闭）
  - `transfer.ts`：95.60% 语句 / 96.51% 行，81.09% 分支
  - `db.ts`：51.78% 语句 / 45.45% 行（配置路径、WAL、外键和关闭已覆盖）
- 主要表单：
  - `SubscriptionForm`：80.64%
  - `JointQuoteForm`：80.53%
  - `JointRenewForm`：85.85%
- 流水页：`Payments.tsx`、`PaymentRow.tsx`、`JointRenewalCard.tsx` 均为 100%，覆盖搜索、日期筛选、反向日期校验、双流水切换、独立分页和删除回调
- 通用组件：`Pagination` 93.75%，`FlowTabs`、`EmptyState`、`SearchBox` 等基础路径覆盖良好

## 主要缺口

| 文件 | 行覆盖率 | 未覆盖行数 | 说明 |
|---|---:|---:|---|
| `src/App.tsx` | 0% | 134 | 应用入口、全局状态和页面切换未做集成测试 |
| `src/components/QuoteForm/QuoteForm.tsx` | 0% | 44 | 平台报价新增/编辑表单未覆盖 |
| `src/components/QuoteFields/QuoteFields.tsx` | 0% | 16 | 报价字段组件未覆盖 |
| `server/db.ts` | 45.45% | 48 | 数据库初始化和迁移分支覆盖较低 |
| `src/pages/Dashboard/Dashboard.tsx` | 59.25% | 22 | 图表分支和部分交互未覆盖 |
| `server/index.ts` | 0% | 17 | 服务启动入口未覆盖 |
| `src/api.ts` | 0% | 17 | 前端 API 客户端未直接覆盖 |
| `src/components/AppModals/AppModals.tsx` | 0% | 13 | 全局弹窗调度未覆盖 |
| `src/pages/Compare/PlanJointQuote.tsx` | 0% | 10 | 比价页联合报价区域未覆盖 |
| `src/pages/Compare/OfferRow.tsx` | 0% | 8 | 报价行交互未覆盖 |
| `src/utils/download.ts` | 0% | 6 | 下载工具未覆盖 |
| `src/components/SelectMenu.tsx` | 66.66% | 28 | 键盘操作、滚动、边界分支覆盖不足 |
| `src/components/SearchBox.tsx` | 33.33% | 2 | 搜索输入和清除行为覆盖不足 |
| `src/components/PaymentForm.tsx` | 64.28% | 35 | 主流程已覆盖，但异常和分支覆盖不足 |
| `src/pages/Subscriptions/SubscriptionCard.tsx` | 25% | 3 | 卡片操作分支覆盖不足 |

`server/api.ts` 的主流程已经覆盖，剩余未覆盖分支主要是联合报价编辑异常、部分 404 和参数校验组合。

展示型组件基本未覆盖：`ConfirmDialog`、`ResetDataDialog`、`Toast`、`Topbar`、`BootScreen`、`InfoTip`、`PageHeader`，以及 `Badge` 的部分分支。

`electron/main.ts` 的窗口、菜单、对话框和单实例生命周期不在单元测试覆盖率内，由 `npm run desktop -- --smoke-test` 和实际打包运行验证；可测试的数据目录、旧库导入和同源判断已拆到 `electron/desktop.ts`。

## 结论与建议

当前测试对核心业务逻辑和服务端 API 主流程覆盖较好，工具函数、金额与周期计算、报价分摊、导入导出、状态聚合、桌面数据导入都比较扎实；整体行覆盖率已提升到 75.08%，语句覆盖率 74.84%。支付流水页已经达到 100%，剩余缺口主要集中在页面级组件、应用入口和前端 API 客户端。

如果目标是继续提升到 80% 左右，优先级建议：

1. `QuoteForm` + `QuoteFields`
2. `App.tsx` / `AppModals` 主要流程
3. `Dashboard`、`Compare`、`Subscriptions` 的分支和交互
4. `server/db.ts` 数据库迁移分支

如果目标是 85% 以上，再补 `SelectMenu`、`ConfirmDialog`、`ResetDataDialog`、`Toast` 等通用组件。

## 运行方式

```bash
npm test
npm run test:coverage
```

`npm run test:coverage` 会在 `coverage/` 下生成 HTML 报告，入口为 `coverage/index.html`。

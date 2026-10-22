# 测试覆盖率报告

统计日期：2026-10-22

## 测试结果

- 测试文件：27 个
- 测试用例：210 个
- 结果：全部通过
- 统计范围：`src/`、`server/`、`shared/` 全部源文件，排除 `tests/` 和样式文件
- 覆盖率工具：Vitest + Istanbul
- 报告目录：`coverage/`（已加入 `.gitignore`）

## 总体覆盖率

| 指标 | 覆盖率 | 已覆盖 / 总数 |
|---|---:|---:|
| 语句 Statements | 56.89% | 1267 / 2227 |
| 分支 Branches | 51.93% | 1008 / 1941 |
| 函数 Functions | 58.21% | 340 / 584 |
| 行 Lines | 56.44% | 1126 / 1995 |

## 分层覆盖率

| 模块 | 文件数 | 语句 | 分支 | 函数 | 行 |
|---|---:|---:|---:|---:|---:|
| `shared/` | 2 | 100% | 100% | 100% | 100% |
| `src/utils/` | 12 | 96.25% | 93.85% | 97.92% | 96.46% |
| `src/components/` | 23 | 63.74% | 62.40% | 65.88% | 64.38% |
| `server/` | 11 | 55.56% | 53.03% | 64.96% | 54.77% |
| `src/pages/` | 11 | 41.50% | 22.01% | 38.98% | 42.28% |
| `src/` 入口与 API | 4 | 3.14% | 0% | 0% | 3.38% |

## 覆盖较好的部分

- `shared/duration.ts`、`shared/money.ts`：100%
- `src/utils/`：整体接近 96%，周期、日期、金额、报价、快照、标签页等核心函数基本 100%
- 服务端核心逻辑：
  - `validation.ts`：100%
  - `allocation.ts`：100%
  - `errors.ts`：100%
  - `util.ts`：100%
  - `app.ts`：100% 行、95.83% 语句（本地服务启动、静态回退和关闭）
  - `store.ts`：94.05% 语句
  - `transfer.ts`：95.60% 语句
- 主要表单：
  - `SubscriptionForm`：80.64%
  - `JointQuoteForm`：80.53%
  - `JointRenewForm`：85.85%
- 通用组件：`Pagination` 93.75%，`Modal`、`FlowTabs`、`EmptyState` 等基础路径覆盖良好

## 主要缺口

| 文件 | 行覆盖率 | 未覆盖行数 | 说明 |
|---|---:|---:|---|
| `server/api.ts` | 10.29% | 270 | 只覆盖了状态读取和参数错误路径，其余 Express 路由仍未做集成测试 |
| `src/App.tsx` | 0% | 134 | 应用入口、全局状态和页面切换未做集成测试 |
| `src/pages/Payments/Payments.tsx` | 0% | 77 | 支付流水筛选、搜索、分页未覆盖 |
| `src/components/QuoteForm/QuoteForm.tsx` | 0% | 44 | 平台报价新增/编辑表单未覆盖 |
| `src/components/QuoteFields/QuoteFields.tsx` | 0% | 16 | 报价字段组件未覆盖 |
| `server/db.ts` | 45.45% | 48 | 数据库初始化和迁移分支覆盖较低 |
| `src/pages/Dashboard/Dashboard.tsx` | 59.25% | 22 | 图表分支和部分交互未覆盖 |
| `server/seed.ts` | 5.26% | 18 | 示例数据载入未覆盖 |
| `server/index.ts` | 0% | 17 | 服务启动入口未覆盖 |
| `src/components/AppModals/AppModals.tsx` | 0% | 13 | 全局弹窗调度未覆盖 |
| `src/pages/Compare/PlanJointQuote.tsx` | 0% | 10 | 比价页联合报价区域未覆盖 |
| `src/pages/Compare/OfferRow.tsx` | 0% | 8 | 报价行交互未覆盖 |
| `src/utils/download.ts` | 0% | 6 | 下载工具未覆盖 |
| `src/components/SelectMenu.tsx` | 66.66% | 28 | 键盘操作、滚动、边界分支覆盖不足 |
| `src/components/SearchBox.tsx` | 33.33% | 2 | 搜索输入和清除行为覆盖不足 |
| `src/components/PaymentForm.tsx` | 64.28% | 35 | 主流程已覆盖，但异常和分支覆盖不足 |
| `src/pages/Subscriptions/SubscriptionCard.tsx` | 25% | 3 | 卡片操作分支覆盖不足 |

展示型组件基本未覆盖：`ConfirmDialog`、`ResetDataDialog`、`Toast`、`Topbar`、`BootScreen`、`InfoTip`、`PageHeader`，以及 `Badge` 的部分分支。

## 结论与建议

当前测试对核心业务逻辑覆盖较好，工具函数、金额与周期计算、报价分摊、导入导出、状态聚合都比较扎实；整体行覆盖率主要被页面级组件、应用入口和服务端路由层拉低。

如果要提升到 70% 左右，优先级建议：

1. `server/api.ts` 路由集成测试
2. `Payments` 页面筛选、搜索、分页
3. `QuoteForm` + `QuoteFields`
4. `App.tsx` / `AppModals` 主要流程
5. `Dashboard`、`Compare`、`Subscriptions` 的分支和交互

如果目标是 80% 以上，再补 `SelectMenu`、`SearchBox`、`ConfirmDialog`、`ResetDataDialog`、`Toast` 等通用组件。

## 运行方式

```bash
npm test
npm run test:coverage
```

`npm run test:coverage` 会在 `coverage/` 下生成 HTML 报告，入口为 `coverage/index.html`。

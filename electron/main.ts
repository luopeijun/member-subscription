import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  shell,
  type BrowserWindowConstructorOptions,
  type MenuItemConstructorOptions,
} from 'electron'
import fs from 'node:fs'
import type { Server } from 'node:http'
import path from 'node:path'

const APP_NAME = '会员订阅'
const APP_ID = 'com.luopeijun.member-subscription'

interface ServerModule {
  startServer: (options: {
    staticDir: string
    host?: string
    port?: number
  }) => Promise<{ server: Server; host: string; port: number }>
  stopServer: (server: Server) => Promise<void>
}

app.setName(APP_NAME)
app.setAppUserModelId(APP_ID)

let mainWindow: BrowserWindow | null = null
let server: Server | null = null
let appUrl = ''
let dataDir = ''
let isQuitting = false

const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })

  app.whenReady().then(startDesktopApp).catch(showFatalError)

  app.on('activate', () => {
    if (mainWindow || !appUrl) return
    createMainWindow()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', (event) => {
    if (isQuitting || !server) return

    event.preventDefault()
    isQuitting = true
    const activeServer = server
    server = null

    activeServer.closeAllConnections?.()
    const { stopServer } = require('./server.cjs') as ServerModule
    stopServer(activeServer)
      .catch((error) => console.error('关闭服务失败', error))
      .finally(() => app.quit())
  })
}

async function startDesktopApp(): Promise<void> {
  const staticDir = path.join(__dirname, '..', 'dist')
  if (!fs.existsSync(path.join(staticDir, 'index.html'))) {
    throw new Error(`找不到前端构建产物：${staticDir}\n请先运行 npm run build。`)
  }

  dataDir = resolveDataDir()
  fs.mkdirSync(dataDir, { recursive: true })

  const dbPath = path.join(dataDir, 'app.db')
  if (!process.env.SUBLEDGER_DESKTOP_DATA_DIR) {
    await maybeImportLegacyDatabase(dbPath)
  }
  process.env.SUBLEDGER_DB_PATH = dbPath

  const { startServer } = require('./server.cjs') as ServerModule
  const started = await startServer({ staticDir })
  server = started.server
  appUrl = `http://${started.host}:${started.port}`

  installMenu()

  if (process.argv.includes('--smoke-test')) {
    await runSmokeTest(appUrl)
    app.quit()
    return
  }

  createMainWindow()
}

function resolveDataDir(): string {
  const override = process.env.SUBLEDGER_DESKTOP_DATA_DIR?.trim()
  return override
    ? path.resolve(override)
    : path.join(app.getPath('userData'), 'data')
}

async function maybeImportLegacyDatabase(targetDbPath: string): Promise<void> {
  if (fs.existsSync(targetDbPath)) return

  const legacyDbPath = findLegacyDatabase(targetDbPath)
  if (legacyDbPath) {
    const result = await dialog.showMessageBox({
      type: 'question',
      title: APP_NAME,
      message: '检测到旧版数据',
      detail: `桌面版使用独立的数据目录。是否把旧数据复制到桌面版？\n\n来源：${legacyDbPath}\n目标：${targetDbPath}\n\n旧数据不会被删除。如果网页版仍在运行，请先关闭它再导入。`,
      buttons: ['导入旧数据', '跳过'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    })
    if (result.response === 0) {
      await importDatabase(legacyDbPath, targetDbPath)
    }
    return
  }

  const welcome = await dialog.showMessageBox({
    type: 'info',
    title: APP_NAME,
    message: '欢迎使用桌面版',
    detail:
      '桌面版使用独立的数据目录。如果你之前在网页版使用过，可以选择旧数据库文件导入；也可以从零开始，之后在应用内导入 JSON。\n\n如果网页版仍在运行，请先关闭它再选择数据库。',
    buttons: ['选择旧数据库…', '从零开始'],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
  })
  if (welcome.response !== 0) return

  const picked = await dialog.showOpenDialog({
    title: '选择旧版数据库',
    properties: ['openFile'],
    filters: [{ name: 'SQLite 数据库', extensions: ['db', 'sqlite', 'sqlite3'] }],
  })
  const source = picked.filePaths[0]
  if (picked.canceled || !source) return
  await importDatabase(source, targetDbPath)
}

async function importDatabase(sourceDbPath: string, targetDbPath: string): Promise<void> {
  if (path.resolve(sourceDbPath) === path.resolve(targetDbPath)) return

  fs.mkdirSync(path.dirname(targetDbPath), { recursive: true })
  const suffixes = ['', '-wal', '-shm']
  try {
    fs.rmSync(`${targetDbPath}-wal`, { force: true })
    fs.rmSync(`${targetDbPath}-shm`, { force: true })
    for (const suffix of suffixes) {
      const source = `${sourceDbPath}${suffix}`
      if (fs.existsSync(source)) {
        fs.copyFileSync(source, `${targetDbPath}${suffix}`)
      }
    }
  } catch (error) {
    for (const suffix of suffixes) {
      fs.rmSync(`${targetDbPath}${suffix}`, { force: true })
    }
    throw new Error(
      `导入旧版数据失败：${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

function findLegacyDatabase(targetDbPath: string): string | null {
  const target = path.resolve(targetDbPath)
  const candidates = [
    path.join(process.cwd(), 'data', 'app.db'),
    path.join(path.dirname(app.getPath('exe')), 'data', 'app.db'),
  ]

  for (const candidate of candidates) {
    if (path.resolve(candidate) === target) continue
    try {
      if (fs.statSync(candidate).isFile()) return candidate
    } catch {
      // 路径不存在时继续检查下一个候选位置。
    }
  }
  return null
}

function createMainWindow(): void {
  const options: BrowserWindowConstructorOptions = {
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: APP_NAME,
    backgroundColor: '#f4f6f8',
    show: false,
    autoHideMenuBar: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  }

  const window = new BrowserWindow(options)
  mainWindow = window
  window.once('ready-to-show', () => window.show())
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    void openExternal(url)
    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) {
      event.preventDefault()
      void openExternal(url)
    }
  })

  window.webContents.on('did-fail-load', (_event, code, description) => {
    if (code === -3) return
    dialog.showErrorBox('页面加载失败', `${description}（${code}）`)
  })

  void window.loadURL(appUrl)
}

function isAppUrl(url: string): boolean {
  try {
    return new URL(url).origin === new URL(appUrl).origin
  } catch {
    return false
  }
}

async function openExternal(url: string): Promise<void> {
  try {
    await shell.openExternal(url)
  } catch (error) {
    console.error('打开外部链接失败', error)
  }
}

function installMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        {
          label: '打开数据目录',
          click: () => {
            fs.mkdirSync(dataDir, { recursive: true })
            void shell.openPath(dataDir).then((errorMessage) => {
              if (errorMessage) dialog.showErrorBox('无法打开数据目录', errorMessage)
            })
          },
        },
        { type: 'separator' },
        { role: 'quit', label: '退出' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '刷新' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            void dialog.showMessageBox({
              type: 'info',
              title: APP_NAME,
              message: `${APP_NAME} ${app.getVersion()}`,
              detail: `数据目录：${dataDir}`,
              noLink: true,
            })
          },
        },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

async function runSmokeTest(url: string): Promise<void> {
  if (!process.env.SUBLEDGER_DESKTOP_DATA_DIR) {
    throw new Error('自检模式必须设置 SUBLEDGER_DESKTOP_DATA_DIR，避免写入真实数据。')
  }

  const request = async (path: string, init?: RequestInit) => {
    const response = await fetch(`${url}${path}`, init)
    if (!response.ok) {
      throw new Error(`本地服务自检失败：${path} HTTP ${response.status}`)
    }
    return response.json()
  }

  await request('/api/state')
  const marker = `桌面自检-${Date.now()}`
  const state = (await request('/api/subscriptions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      serviceName: marker,
      category: '其他',
      planName: '自检套餐',
      cycleMonths: 1,
      cycleDays: null,
      listPrice: 100,
      startedAt: '2026-01-01',
      status: 'planned',
      autoRenew: false,
    }),
  })) as { services?: { name: string }[] }

  if (!state.services?.some((service) => service.name === marker)) {
    throw new Error('自检写入失败：未在返回数据中找到测试记录。')
  }
  console.log(`[smoke-test] 本地服务正常：${url}`)
}

function showFatalError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  dialog.showErrorBox(`${APP_NAME}启动失败`, message)
  app.exit(1)
}

# langLSRW

个人本地优先的外语学习原型（英语为主，也支持西班牙语等），围绕「听说读写」四个模块展开。目前「听」「说」可用于日常本地练习，「读」「写」尚未实现。纯前端页面，没有后端、鉴权或云同步，AI 语法分析是唯一联网功能，且需要手动触发。

## 快速开始

项目是静态页面，需要一个本地 HTTP 服务器（不能直接双击打开 `index.html`，否则句库等文件的 `fetch` 会被浏览器的同源策略拦截）。

**Windows**

```bat
tools\start-langlsrw-server.bat
```

**Linux / Ubuntu**

```bash
tools/start-langlsrw-server.sh
```

两个脚本都会：从脚本自身位置推算出项目根目录、检查 8848 端口是否被占用（如果是遗留的 `python -m http.server` 会自动关闭，如果是其他程序会提示并退出）、然后用 `python3`（或 `python`）在该端口启动静态服务器。

启动后打开浏览器访问：

```
http://localhost:8848/
```

## 功能概览

- **听**：导入 `.txt` / `.lrc` 或粘贴句子列表，顺序/随机/错题练习模式，英式发音朗读、慢速回放、单词回放，听写打分（准确率/速度/流畅度）。
- **说**：按住说话，语音识别 + 录音，音量条与相似度/漏词/错词/多词反馈，可回放录音并与原句对比。
- **句库**：服务器上不存任何句库。用户自己导入，推荐 txt 每行一句、用 `|` 分隔两种语言（`Hello | 你好`，`#` 开头为注释），也支持 tsv / lrc / Anki 导出。导入前先预览，可以新建句库或追加到已有句库：重复句子不区分大小写和空格自动去重，翻译可合并 / 保留 / 覆盖；可对调两列；句库可导出为同样格式的 txt。登录 Google 后可以「从 Google 表格导入」（粘贴链接 → Google 文件选择器确认 → 选句子列 / 翻译列），句库记住来源表格，表格改了点「从表格更新」即可合并进来。导入后保存，刷新不丢，记住每个句库练到第几句；Google 用户的句库存成自己 Google Drive「langLSRW/libraries」里的 TSV 文件，可以在 Drive 里改名、下载、删除。原来内置的 3 万条常用句库留在仓库 `data/libraries/common-english-30150/sentences.tsv`，需要时自己导入。每个句库有自己的学习语言（英/西/法/德/意/葡，导入时自动识别，可修改），朗读和语音识别跟着切换；听写默认忽略重音符号。仓库里还有 `data/libraries/spanish-chinese/`（Tatoeba 西中句对 11,057 句，由 `script/build_tatoeba_pairs.py` 生成）。
- **AI 语法分析**：手动触发，按句子缓存结果，避免重复计费；层级化 JSON 语法树渲染，可查看/复制原始 prompt 和 AI 返回内容。API Key 目前只存在浏览器本地存储，仅适合个人本地使用。
- **用户与同步**：Google 登录，句库、练习记录、训练进度、设置和 AI 语法缓存都存在用户自己的 Google Drive「langLSRW」文件夹（无需后端）；也可用本机用户（游客模式，本地存储、JSON 导入导出）。配置步骤见 [deploy/README.md](deploy/README.md)。
- **通用设置**：与 nav.mltz.tech 一致的界面风格（浅色/深色跟随系统 + 默认绿/GitHub/Reddit/Twitter 四套色系，外加 Anki 风格）、语法角色配色自定义、可配置快捷键。

更详细的实现状态、架构和已知边界见 [PROJECT_STATUS.md](PROJECT_STATUS.md)。

## 项目结构

```text
langLSRW/
  index.html
  src/
    app.js                 # 主逻辑（听说读写、设置、用户、语法渲染）
    library-store.js       # 本机句库存储（IndexedDB）
    google-drive.js        # Google 登录 + Drive 读写
    cloud-sync.js          # 同步合并规则（tests/ 有单元测试）
    styles.css
    generated/grammar-prompt.js   # 生成产物，勿手改
  data/                     # 不部署：原内置句库（可手动导入）、示例材料
    libraries/common-english-30150/sentences.tsv
    materials/
  tools/
    start-langlsrw-server.bat
    start-langlsrw-server.sh
  .agents/skills/            # AI 语法分析的 Skill 定义（传统语法 / SIEG2）
  deploy/                    # 部署到 vpsde（lang.mltz.tech）的脚本与说明
```

## 部署

日常仍以本地测试为主。往 `vpsde` 这台 VPS 部署（域名 `lang.mltz.tech`）的脚本、nginx 配置和步骤说明都在 [deploy/README.md](deploy/README.md)，不含任何密钥/Token，需要单独的 SSH 别名配置。

## AI 语法分析的 Skill 机制

网页里实际生效的语法分析 prompt 来自 `.agents/skills/langlsrw-traditional-grammar-analysis/`，不要直接改 `src/generated/grammar-prompt.js`。改动流程是先改 Skill 里的 prompt 源文本，再跑：

```bash
node .agents/skills/langlsrw-traditional-grammar-analysis/scripts/build-web-prompt.js
node .agents/skills/langlsrw-traditional-grammar-analysis/scripts/build-web-prompt.js --check
```

`langlsrw-sieg2-grammar-analysis` 是另一套并存的语法框架，目前在 UI 中禁用，不参与运行时。

## 已知边界

- 读、写页面未实现；没有复习池、AI 文章生成等能力。
- 没有后端、鉴权、数据库或云同步；API Key 存在浏览器本地存储，只适合私人本地使用，公开前必须先接后端代理。
- 语音识别与录音依赖浏览器支持和麦克风权限。
- 仓库中存在 Sites 托管配置（`.openai/hosting.json`），但部署只能在项目所有者明确要求时进行。

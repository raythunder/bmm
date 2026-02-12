<div align="center">
  <img width="120" src="./doc/images/logo.svg">
  <br>
  <h3 style="font-size: 3rem">BMM</h3>
  <p>收纳、分享、探索优质网站</p>
  <i>BMM / bookmark manager / 你的专属书签管家</i>
</div>

<br>

<div align="center">

  <img alt="PC 端明亮/暗夜主题" src="./doc/images/screenshot-pc-light-dark.webp">

  <img alt="后台管理" src="./doc/images/screenshot-pc-cms-light-dark.png">

  <img width="680" alt="移动端" src="./doc/images/screenshot-mobile.png">

  <img alt="AI 解析网站" width="680" src="./doc/images/screenshot-ai-analyse.gif">

</div>

## ✨ 功能

基本功能：

- [x] 支持移动端/桌面端、明亮主题/暗夜主题
- [x] 搜索书签、标签
- [x] 标签和标签、书签和标签间的相互关联
- [x] Github 授权登录、账号密码登录
- [x] 登录用户可管理自己的书签、标签
- [x] 登录用户可在首页卡片直接编辑站点信息、复制站点地址

后台管理功能：

- [x] 导入浏览器导出的书签
- [x] 标签、书签的增删改查
- [x] 标签间的相互关联
- [x] 标签和书签的相互关联
- [x] 标签排序
- [x] 爬取网站标题、图标、简介，多个 API 获取网站图标
- [x] AI 智能解析网站标题、图标、简介、关联标签
- [x] AI 解析关联标签时，自动创建不存在的标签并回填
- [x] AI 为标签关联标签

待实现：

- [ ] 多功能卡片，支持展示天气、资讯...
- [ ] 浏览器插件
- [ ] 服务端、客户端检测书签可用性
- [ ] 稍后阅读系统

## 🧑‍💻 本地开发

1. git 克隆项目至本地 `git clone https://github.com/Y80/bmm.git`

2. 安装依赖 `pnpm install`

3. 启动项目 `pnpm dev`

## 环境变量

具体的环境变量配置可以参考 [.env](./.env) 。

若您只是想快速体验项目，本地拉取项目后，无需修改任何环境变量即可启动开发服务器（数据库用的是本地 SQLite）。

若您需要部署到服务器上，重点关注 `AUTH_URL` 和数据库相关变量配置。

## 🗄️ 数据库

BMM 使用 Drizzle ORM 持久化存储数据，当前开箱即用的支持 SQLite 和 PostgreSQL 数据库。

默认的配置使用本地的 SQLite 数据库，通过 `pnpm dev` 可在本地自动创建数据库文件，并供本地开发服务器使用。

若需部署到线上，需要使用线上数据库，这里提供两篇文档以便您能快速、免费获取线上数据库资源：

1. [BMM 接入 Turso](https://github.com/Y80/bmm/wiki/%E4%BD%BF%E7%94%A8-Turso-%E6%95%B0%E6%8D%AE%E5%BA%93%E6%9C%8D%E5%8A%A1)
2. [一些免费的 PostgreSQL 数据库](https://juejin.cn/post/7411047482651951119)

您也可以使用自己的数据库云服务。

## 🚀 项目部署

### 方式一：Node 项目常规部署

1. 通过 `git clone` 或其他方式将项目复制到服务器上

2. 安装依赖 `pnpm install`

3. 构建项目 `pnpm build`

4. 启动生产环境服务器 `pnpm start`；若您使用了 PM2，可通过 `pm2 start "pnpm start"` 启动项目。

### 方式二：部署至 Vercel

1. fork 当前 Github 仓库

2. 登入 <a href="https://vercel.com" target="_blank">Vercel</a>，新建项目，并关联 fork 的 Github 仓库

3. 在当前项目下的 Environment Variables 页面中配置环境变量

<details>
  <summary>查看截图</summary>
  
  ![vercel-settings-env](./doc/images/vercel-settings-env.png)

Vercel 上每个项目都会被自动分配一个域名，如 bmm.vercel.app，如果你最终使用这个域名访问 BMM 服务，那么可以不用配置 `AUTH_URL`，否则必须配置该环境变量。

</details>

4. 在 「Deployments 面板」再重新部署一下即可

### 方式三：使用 Docker 部署

```sh
# 拉取镜像
docker pull lcclcc/bmm

# 启动容器（使用本地 SQLite， 通过 docker volume bmm 查看数据库文件地址）
docker run --rm  \
-e DB_DRIVER=sqlite \
-e DB_CONNECTION_URL=file:/app/volume/sqlite.db \
-v bmm:/app/volume \
-p 3000:3000 \
lcclcc/bmm \
pnpm start

# 启动容器（使用 Turso ）
docker run --rm  \
-e DB_DRIVER=sqlite \
-e DB_CONNECTION_URL=libsql://Turso数据库地址  \
-e DB_AUTH_TOKEN=<Turso数据库令牌> \
-p 3000:3000 \
lcclcc/bmm \
pnpm start

# 启动容器（使用 PostgreSQL ）
docker run --rm  \
-e DB_DRIVER=postgresql \
-e DB_CONNECTION_URL=postgresql://数据库地址 \
-p 3000:3000 \
lcclcc/bmm \
pnpm start

```

## 🤖 接入 AI 服务（可选）

本项目通过 AI 实现了 **分析总结网站、给网站打标签、分析相关联的标签** 的功能，可大大减少维护书签数据的工作量。

目前已内置 OpenAI 接口标准的支持。无需修改代码，只需在环境变量中配置即可直接接入 **OpenAI** 以及 **DeepSeek、Moonshot (Kimi)、GLM、豆包** 等支持该标准的第三方服务。

在 `.env` 文件中添加：

```bash
# 示例：接入 DeepSeek
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx
OPENAI_BASE_URL=https://api.deepseek.com/v1
OPENAI_MODEL=deepseek-chat
```

如果你希望在应用内切换不同模型配置，可在登录后通过右上角头像菜单进入 **系统设置** 页面：

- 支持创建多个配置（`OPENAI_BASE_URL`、`OPENAI_API_KEY`、配置名称）
- 每个配置支持维护多个模型
- 可指定一个“当前激活配置”，并为该配置选择唯一的“当前激活模型”
- 在系统配置中可控制“是否开放注册”；关闭后登录页会隐藏注册入口，服务端也会拒绝注册请求

AI 调用时将优先使用“当前激活配置 + 当前激活模型”；如果未设置，则回退到 `.env` 中的 `OPENAI_*` 变量。

另外，在用户空间的标签页（如 `/user/tags/其它`）右上角提供了 **批量 AI 更新** 功能：

- 目标范围：仅处理当前用户下标签包含 `其它` 的站点
- 支持设置并发数（`1~5`，默认 `3`）
- 支持查看实时进度（总数、已处理、成功、失败）
- 支持软暂停：停止分发新任务，已开始的任务会先执行完成
- 对于批量任务中“获取 HTML 失败/超时”的站点，后续新任务会自动跳过（服务重启后仍生效）

此外，用户空间的导航页在站点卡片列表顶部还提供了 **AI 快速创建站点**：

- 输入网址后会先立即创建一个占位书签（默认标签 `其它` + 域名标题），并在后台异步执行 AI 解析
- 前端提交后无需等待 AI 完成
- 若 AI 返回新标签，会自动尝试创建并关联
- 若 AI 解析失败，占位书签会保留默认信息（`其它` 标签 + 域名标题）

当前实现基于单实例应用进程（Docker 单实例）执行后台任务；若服务重启，运行中的任务会被标记为失败，可再次手动启动。
当前镜像的 `pnpm start` 会在启动前自动执行数据库同步（优先使用 migrations；若未检测到迁移文件则回退为 `drizzle-kit push` 的非交互模式）。migrations 文件已纳入镜像构建输入；对于“旧库已初始化但无迁移历史”的场景，启动时会自动回退为 `push` 以兼容升级。已部署实例升级后拉取新镜像并重启容器即可。若遇到涉及旧数据冲突的变更，启动日志会给出失败原因，按提示处理后重启即可。

对于其它不兼容 OpenAI API 标准的服务，如 Gemini / Anthropic 等，可参考 [AI SDK Providers](https://ai-sdk.dev/providers/ai-sdk-providers) 接入。

## 接入 Github 授权登录（可选）

BMM 支持使用 Github 授权登录，配置 Github OAuth 即可实现。

<details>
  <summary>
  查看创建步骤
  </summary>

1. 登录您的 Github 账户后，访问 https://github.com/settings/applications/new

2. 依次填写表单内容

<img width="480" src="./doc/images/github-oauth-new.png">

其他内容可随意填写，最重要的是 `Authorization callback URL` 这一项，请保证它和你的项目最终部署的 **线上访问地址** 一致！

3. 创建一个 Client secret

<img width="480" src="./doc/images/github-oauth-new-secret.png">

</details>

Github OAuth App 的 Client ID 和 Client Secret 将分别用作环境变量 `AUTH_GITHUB_ID` 和 `AUTH_GITHUB_SECRET`，填写的 Authorization callback URL 要和环境变量 `AUTH_URL` 保持一致。

## 🤔 常见问题

<details>
  <summary>
    如何设置环境变量 <code>AUTH_URL</code> 和 Github 中的 Authorization callback URL?
  </summary>
  
  <br>
  首先需要明确， <code>AUTH_URL</code> 和 Github OAuth App 中的 Authorization callback URL 是一致的，用于指定用户在 Github 确认授权后，浏览器需要重定向的服务器地址。
  
  <br>
  它们的值如何设定，简单来说，通过什么地址访问 BMM 服务，就把该地址作为它们的值，例如：

- http://localhost:3000 - 本地开发
- https://bmm.vercel.app - 部署到 Vercel 的平台上，使用 Vercel 为你分配的域名
- https://example.com - 用 nginx 代理了本机地址，线上通过域名访问服务
- http://10.1.2.3:3000 - 线上通过 IP:PORT 直接访问服务

</details>

<details>
  <summary>
    Github 登录失败：redirect_uri 错误
  </summary>

  <br>
  如果在 Github 授权之后出现如下错误提示：

![github-redirect-uri-error](./doc/images/github-redirect-uri-err.png)

这表示授权之后 Github 需要跳转的地址和 [Github:OAuth Apps](https://github.com/settings/developers) 中的配置不一致。

**请保证下方配置的 Authorization callback URL 和你访问的域名地址、 `AUTH_URL` 一致。**

![github-oauth-cb-url](./doc/images/github-oauth-cb-url.png)

</details>

<details>
  <summary>
    修改了项目端口后，Github 授权登录回调地址的端口有误
  </summary>

  <br>
  如果你修改了项目端口，并通过 http://{IP}:{PORT} 的方式访问 bmm，那你也需要修改环境变量 <code>AUTH_URL</code>。

  <br>
  再次明确：访问项目的地址、Authorization callback URL、AUTH_URL 这三者应该是一致的。
</details>

<details>
  <summary>
    数据库重置后，上传或新建数据时报 FOREIGN KEY constraint failed
  </summary>

  <br>
  这通常是因为浏览器仍保留旧登录态（JWT），但数据库中的对应用户记录已经被清理（例如本地重置了 SQLite 文件）。

  <br>
  此时请先退出登录并重新登录，再继续操作。
</details>

<details>
  <summary>
    支持其他数据库吗？
  </summary>
  
  <br>
  借助 drizzle-orm 的能力，本项目可以快速接入 MySQL 数据库。
</details>

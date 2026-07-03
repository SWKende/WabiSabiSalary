# Trae Salary 工资计算器

Taro 多端（微信小程序为主）的工资计算器和记账工具，支持**多设备云同步**。

## 功能特性

- 实时计算每秒工资、日薪、月薪
- 工资明细、发薪日倒计时、今日进度可视化
- 完整记账功能（分类、图表、统计）
- 多设备云同步（注册账号后数据自动同步）
- 中国节假日智能识别（数据云端自动更新）

## 项目结构

```
trae-salary/
├── client/    前端（Taro 微信小程序）
├── server/    后端（Node.js + Fastify + Prisma + SQLite）
├── deploy/    部署（Docker Compose + Caddy）
├── data/      运行时数据（gitignore）
└── docs/      设计文档
```

## 一、本地开发

### 前端

```bash
cd client
npm install
npm run dev:weapp
```

然后用微信开发者工具导入 `client/dist/` 目录。

API 地址默认是 `http://localhost:3000`。要指向其他地址：

```bash
TARO_APP_API_BASE_URL=https://your-api.example.com npm run dev:weapp
```

### 后端

```bash
cd server
npm install
cp .env.example .env
# 编辑 .env，填入 JWT_SECRET（用 openssl rand -hex 32 生成）
npx prisma migrate dev
npm run dev
```

默认端口 3000。运行 `npm test` 跑全部测试。

## 二、部署到云服务器（生产环境）

### 前提条件

- 一台云服务器（最低 1 核 1GB 内存，推荐 2 核 2GB）
- 一个域名（如 `salary.example.com`），A 记录解析到服务器 IP
- 服务器 80 和 443 端口在防火墙开放

### 部署步骤

#### 1. 安装 Docker

```bash
ssh user@your-server-ip
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
exit
# 重新登录 SSH
```

#### 2. 上传代码

```bash
# 在本地
scp -r trae-salary user@your-server-ip:/tmp/

# 在服务器
sudo mkdir -p /opt/trae-salary
sudo mv /tmp/trae-salary/* /opt/trae-salary/
sudo chown -R $USER:$USER /opt/trae-salary
cd /opt/trae-salary
```

#### 3. 配置环境变量和域名

```bash
cd deploy
cp .env.example .env
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
nano Caddyfile  # 把所有 "your-domain.com" 替换为你的实际域名
```

#### 4. 启动

```bash
docker compose up -d
docker compose logs -f app
# 看到 "server listening on :3000" 即可 Ctrl+C 退出日志跟踪
```

首次启动时 Caddy 会自动向 Let's Encrypt 申请 HTTPS 证书。如果失败，查看 FAQ。

#### 5. 构建小程序（带正确 API 地址）

```bash
cd ../client
TARO_APP_API_BASE_URL=https://salary.example.com npm run build:weapp
```

然后用微信开发者工具打开 `client/dist/`，上传发布。

### 验证

```bash
curl https://salary.example.com/health
# 应返回 {"status":"ok","uptime":...}
```

打开小程序，注册账号，添加一笔记账。然后退出登录，在另一台设备登录同一账号，应能看到数据。

## 三、运维

### 查看运行状态

```bash
cd /opt/trae-salary/deploy
docker compose ps              # 容器状态
docker compose logs -f app     # 应用日志（Ctrl+C 退出）
tail -f ../logs/caddy/access.log  # 访问日志
```

### 重启服务

```bash
docker compose restart
```

### 升级代码

```bash
cd /opt/trae-salary
git pull  # 或重新上传新代码
cd deploy
docker compose up -d --build
```

### 数据备份

设置每日自动备份：

```bash
mkdir -p /backup
crontab -e
```

添加：

```
0 2 * * * cp /opt/trae-salary/data/salary.db /backup/salary-$(date +\%Y\%m\%d).db && find /backup -name "salary-*.db" -mtime +30 -delete
```

### 数据恢复

```bash
cd /opt/trae-salary/deploy
docker compose down
cp /backup/salary-YYYYMMDD.db /opt/trae-salary/data/salary.db
docker compose up -d
```

### 节假日同步日志

```bash
docker compose logs app | grep holiday-sync
```

正常情况下，启动时会有 `[holiday-sync] XXXX 缺失，开始从远程拉取...` 或 `[holiday-sync] 定时任务已注册`。

## 四、常见问题

**Q: 忘记密码怎么办？**

A: 当前版本不支持密码找回。如需重置：
```bash
cd /opt/trae-salary/deploy
docker compose exec app npx prisma studio
```
打开浏览器访问 `http://your-server-ip:5555`，手动修改 user 表的 passwordHash（用 bcrypt 在线工具生成新密码的哈希）。

**Q: 数据会丢吗？**

A: SQLite 数据在服务器本地，建议按上文开启每日备份。建议同时将 `/backup` 目录同步到云存储（OSS/S3）。

**Q: 怎么换域名？**

A: 修改 `deploy/Caddyfile` 中的域名，重新 `docker compose up -d` 即可。Caddy 会自动重新申请证书。

**Q: Caddy 证书申请失败？**

排查清单：
1. `curl ifconfig.me` 确认服务器 IP 正确
2. `nslookup your-domain.com` 确认 DNS 已生效
3. 服务器 80/443 端口是否开放：`sudo ufw status`
4. `docker compose logs caddy` 看具体错误

**Q: 怎么修改 API 地址（如换服务器）？**

A: 重新构建小程序时设置新的 `TARO_APP_API_BASE_URL`：
```bash
cd client
TARO_APP_API_BASE_URL=https://new-api.example.com npm run build:weapp
```

**Q: 服务端节假日同步失败会影响使用吗？**

A: 不会。失败时前端会按普通周末处理，业务正常运行。

## 五、技术栈

### 前端
- Taro 4.2 + React 18 + TypeScript
- Sass

### 后端
- Node.js 20 + Fastify 4
- Prisma 5 + SQLite
- bcrypt（密码哈希）
- jsonwebtoken（Token）
- node-cron（定时任务）
- Vitest（测试）

### 部署
- Docker + Docker Compose
- Caddy 2（自动 HTTPS）

# 部署 AlphaPicker → alphapicker.manualstool.com

单台 VM + Docker Compose（app + PostgreSQL），前面接反向代理做域名与 HTTPS。

## 0 · 前置条件
- 服务器已安装 **Docker** 与 **Docker Compose v2**（`docker compose version`）。
- DNS：`alphapicker.manualstool.com` 的公网 A 记录指向本服务器公网 IP（`172.203.219.193`）。
- 准备好真实密钥（Sorftime / eBay）。

## 1 · 拉取代码 + 配置
```bash
git clone git@github.com:jinhuaxiao/AlphaPicker.git
cd AlphaPicker
cp deploy/.env.example .env
vim .env                 # 填 POSTGRES_PASSWORD / SORFTIME_KEY / EBAY_*
```

## 2 · 启动（app + 数据库）
```bash
docker compose up -d --build
docker compose logs -f app     # 看到 migrate → seed → starting on :3000
```
此时应用监听 `127.0.0.1:3000`（仅本机），由反向代理对外。

## 3 · 域名 + HTTPS —— 二选一

### A) 服务器已有 nginx（推荐，80/443 已被占用时）
```bash
sudo cp deploy/nginx-alphapicker.conf /etc/nginx/sites-available/alphapicker.manualstool.com
sudo ln -s /etc/nginx/sites-available/alphapicker.manualstool.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d alphapicker.manualstool.com      # 签发 TLS
```

### B) 80/443 空闲（用内置 Caddy 自动 HTTPS）
```bash
docker compose --profile caddy up -d
# Caddy 会自动为 alphapicker.manualstool.com 申请 Let's Encrypt 证书
```

## 4 · 验证
```bash
curl -I https://alphapicker.manualstool.com        # 期望 200/307
```

## 运维
```bash
docker compose pull && docker compose up -d --build   # 更新
docker compose restart app                            # 重启
docker compose down                                   # 停止（保留数据卷 pgdata）
docker compose exec app npm run db:seed               # 手动重新灌数据
```

> 数据库数据存于命名卷 `pgdata`，`docker compose down` 不会删除；如需清空用 `docker compose down -v`。

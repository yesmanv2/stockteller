# 牛古推演神算 · 股票五行命盘

基于中国传统五行命理的股票分析娱乐工具。纯前端，零依赖，开箱即用。

## 功能

- 八字四柱排盘（年/月/日/时）
- 身强身弱 & 用神分析
- 股票五行属性 & 行业映射
- 人股匹配度评分（三维：命理匹配 × 流年运势 × 时代景气度）
- 2024–2036 流年运势推演
- 命理推荐 TOP 5 标的
- 覆盖 950+ 美股/港股/ETF

## 快速开始

```bash
# 方式一：npx serve
npx serve . -p 8080

# 方式二：Python
python3 -m http.server 8080

# 方式三：Docker
docker build -t stockteller .
docker run -p 8080:80 stockteller
```

浏览器打开 `http://localhost:8080`

## 项目结构

```
├── index.html          # 主页面
├── styles.css          # 样式（赛博朋克暗色主题）
├── app.js              # UI 交互与渲染
├── bazi-engine.js      # 八字排盘核心引擎
├── stock-core.js       # 股票五行匹配 & 评分算法
├── stock-data.js       # 股票数据库（950+ 标的）
├── Dockerfile          # Docker 容器化部署
├── nginx.conf          # Nginx 配置
└── scripts/build.js    # 构建脚本（自动注入版本号）
```

## 部署

### GitHub Pages

推送到 GitHub 后自动通过 Actions 部署。

### Docker / 腾讯云

```bash
# 构建镜像
docker build -t stockteller .

# 本地运行
docker run -d -p 8080:80 --name stockteller stockteller

# 推送到腾讯云容器镜像服务
docker tag stockteller ccr.ccs.tencentyun.com/<命名空间>/stockteller:latest
docker push ccr.ccs.tencentyun.com/<命名空间>/stockteller:latest
```

腾讯云部署选项：
- **Lighthouse（轻量应用服务器）**：装 Docker，拉镜像运行
- **CloudBase（云开发）**：直接上传静态文件到静态网站托管
- **COS + CDN**：上传到对象存储，配 CDN 加速

### 发布新版本

```bash
node scripts/build.js   # 自动更新资源版本号
git add -A && git commit -m "release" && git push
```

## 免责声明

本系统基于中国古法五行堪舆统计学，仅供娱乐参考。**不构成任何形式的投资建议、投资指导或投资依据。**

## 版权

Copyright (c) 2026 yesmanv2. All Rights Reserved.

# AI 作图服务

## 📖 项目简介

MCP（Model Context Protocol）是一个部署在云端服务器的HTTP请求模式项目，可以让您通过AI助手（如Claude、Dify、LobeChat等）直接调用即梦AI的图像生成功能。

### 🎯 主要功能
- ✨ **文本生成图片**：根据您的描述生成高质量图像
- 🖼️ **图片参考生成**：上传参考图片，生成相似风格的新图片
- 🤖 **AI助手集成**：支持Dify、LobeChat等AI工具
- 🎨 **多种模型**：支持即梦3.0、2.1、2.0-pro等多个版本
- 📐 **自定义尺寸**：支持多种图片比例和自定义尺寸

## 🛠️ 系统要求

在开始安装前，请确保您的环境满足以下要求：

- **操作系统**：Linux（推荐Ubuntu 20.04+）、macOS、Windows（通过WSL2）
- **Node.js版本**：14.0 或更高版本
- **内存**：建议2GB以上
- **网络**：需要能访问即梦AI官网和GitHub

## 📋 安装前准备

### 1. 检查Node.js版本

```bash
# 检查是否已安装Node.js
node --version

# 如果未安装或版本过低，请安装Node.js 16+
# Ubuntu/Debian系统：
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS/RHEL系统：
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# 验证安装
node --version
npm --version
```

### 2. 获取即梦API Token（重要）

**注意：** 本项目不需要在服务器端配置Token，Token是在各个AI平台中单独配置的。但您需要先获取到自己的Token。

#### 步骤1：登录即梦AI
1. 打开浏览器，访问 [即梦AI官网](https://jimeng.jianying.com)
2. 使用您的账号登录（如果没有账号请先注册）

#### 步骤2：获取Session ID
1. 登录成功后，按 `F12` 键打开浏览器开发者工具
2. 点击 `Application` 标签（在Chrome中）或 `存储` 标签（在Firefox中）
3. 在左侧菜单中找到 `Cookies` 并展开
4. 点击 `https://jimeng.jianying.com`
5. 在右侧列表中找到名为 `sessionid` 的项目
6. 复制 `sessionid` 的值（这就是您的API Token）

**⚠️ 重要提醒：**
- `sessionid` 是一串长字符串，请完整复制，类似：`abcd1234efgh5678...`
- 这个Token是您的账号凭证，请妥善保管
- Token会在后续步骤中配置到具体的AI平台中（如Claude、LobeChat、Dify等）
- Token可能会过期，如果服务报错请重新获取

## 🚀 快速安装教程

### 方法一：一键安装（推荐新手）

```bash
# 创建项目目录
mkdir jimeng-mcp && cd jimeng-mcp

# 下载项目
git clone https://github.com/c-rick/jimeng-mcp.git .

# 安装依赖
npm install

# 构建项目
npm run build

# 启动服务（无需配置环境变量）
npm start
```

看到以下输出说明启动成功：
```
🚀 即梦HTTP服务已启动，正在监听端口: 3400
📋 插件清单地址: http://<your_ip>:3400/manifest.json
🤖 LobeChat清单地址: http://<your_ip>:3400/manifest-lobechat.json
✨ 新功能: 支持Markdown格式图片输出！
```

**🎉 安装完成！** 服务已启动，现在可以在各AI平台中配置使用了。

## 🔧 高级配置

### 自定义端口

如果3400端口被占用，您可以修改端口：

```bash
# 方法1：修改.env文件
echo "PORT=8080" >> .env

# 方法2：临时指定端口启动
PORT=8080 npm start
```

### 使用Docker部署（推荐云服务器）

```bash
# 构建Docker镜像
docker build -t jimeng-mcp .

# 运行容器（无需配置Token环境变量）
docker run -d \
  --name jimeng-mcp \
  -p 3400:3400 \
  jimeng-mcp
```

### 使用PM2守护进程（推荐生产环境）

```bash
# 安装PM2
npm install -g pm2

# 创建PM2配置文件
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'jimeng-mcp',
    script: 'lib/index.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3400
    }
  }]
}
EOF

# 启动服务
pm2 start ecosystem.config.js

# 查看服务状态
pm2 status

# 查看日志
pm2 logs jimeng-mcp

# 设置开机自启
pm2 startup
pm2 save
```

## 🤖 AI助手集成教程

### LobeChat集成

1. 在LobeChat中打开插件设置
2. 添加新插件，输入插件URL：
   ```
   http://您的服务器IP:3400/manifest-lobechat.json
   ```
3. 在插件设置中的"即梦Session ID"字段填入您获取的sessionid

### Dify集成

1. 在Dify中创建新的自定义工具
2. 工具URL设置为：
   ```
   http://您的服务器IP:3400/api/dify/generateImage
   ```
3. 在请求头中添加：
   ```
   Authorization: Bearer 您的sessionid
   ```

### ComfyUI集成

如果您使用ComfyUI，可以通过以下API调用：
```
POST http://您的服务器IP:3400/api/comfyui/generateImage
Authorization: Bearer 您的sessionid
```

## 📝 使用示例

### 基础文本生成图片

在AI助手中输入：
```
请生成一张图片：夕阳下的古城，油画风格
```

### 指定模型和比例

```
用即梦3.0生成一张1:1比例的可爱小猫图片
```

### 图片参考生成

```
根据这张图片生成类似风格的图片：[上传图片或提供图片URL]
描述：未来科技城市
```

## 🧪 测试服务

### 测试API是否正常工作

```bash
# 测试1：检查服务是否启动
curl http://localhost:3400/manifest.json

# 测试2：测试图像生成API（需要您的sessionid）
curl -X POST http://localhost:3400/api/generateImage \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 您的sessionid" \
  -d '{"prompt": "一只可爱的小猫"}'
```

### 使用MCP测试工具

```bash
# 安装MCP测试工具
npm install -g @modelcontextprotocol/inspector

# 运行测试
npx @modelcontextprotocol/inspector node lib/index.js
```

## 🔍 故障排除

### 常见问题及解决方案

#### 1. 端口被占用错误
```bash
Error: listen EADDRINUSE: address already in use :::3400
```
**解决方案：**
```bash
# 查找占用端口的进程
lsof -i :3400
# 或者
netstat -tlnp | grep 3400

# 终止占用进程
sudo kill -9 进程ID

# 或者使用其他端口
PORT=8080 npm start
```

#### 2. Token无效错误
```
错误：请求失败：请在请求头Authorization字段中提供Bearer Token
```
**解决方案：**
- 重新获取sessionid（可能已过期）
- 检查Token是否在正确的位置配置（LobeChat插件设置、Dify请求头等）
- 确保登录即梦AI账号时有充足的积分

#### 3. 图像生成失败
```
图像生成失败: 内容被过滤，请修改提示词后重试
```
**解决方案：**
- 修改提示词，避免敏感内容
- 尝试更换描述方式
- 检查即梦AI账号积分是否充足

#### 4. 依赖安装失败
```bash
npm ERR! network request failed
```
**解决方案：**
```bash
# 清理npm缓存
npm cache clean --force

# 使用淘宝镜像源
npm config set registry https://registry.npmmirror.com/

# 重新安装
npm install
```

#### 5. TypeScript编译错误
```bash
error TS2307: Cannot find module
```
**解决方案：**
```bash
# 安装TypeScript
npm install -g typescript

# 重新安装依赖
rm -rf node_modules package-lock.json
npm install

# 重新构建
npm run build
```

### 查看日志

```bash
# 查看实时日志
npm run start:dev

# 或者使用PM2查看日志
pm2 logs jimeng-mcp

# 查看系统日志
journalctl -u your-service-name -f
```

## 📊 性能优化

### 服务器配置建议

```bash
# 增加Node.js内存限制
node --max-old-space-size=4096 lib/index.js

# 使用多进程模式（PM2）
pm2 start lib/index.js -i max
```

### 网络优化

```bash
# 设置HTTP Keep-Alive
export HTTP_KEEP_ALIVE=true

# 配置反向代理（Nginx示例）
cat > /etc/nginx/sites-available/jimeng-mcp << EOF
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3400;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
EOF

# 启用配置
sudo ln -s /etc/nginx/sites-available/jimeng-mcp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 🔐 安全设置

### 基础安全配置

```bash
# 设置防火墙规则
sudo ufw allow 3400/tcp
sudo ufw enable

# 限制访问IP（可选）
sudo ufw allow from 特定IP地址 to any port 3400
```

### 环境变量安全

```bash
# 如果需要设置环境变量（可选）
# 设置文件权限
chmod 600 .env

# 使用系统环境变量（仅在特殊情况下需要）
export JIMENG_API_TOKEN="您的token"
unset HISTFILE  # 防止token被记录到历史记录
```

**注意：** 大多数情况下不需要设置环境变量，Token通过各AI平台的界面配置。

## 📚 API文档

### 主要接口

#### 1. 图像生成接口
```
POST /api/generateImage
Content-Type: application/json
Authorization: Bearer {您的token}

{
  "prompt": "图像描述",
  "model": "jimeng-3.0",
  "width": 1024,
  "height": 1024,
  "filePath": "参考图片URL（可选）"
}
```

#### 2. Dify专用接口
```
POST /api/dify/generateImage
Authorization: Bearer {您的token}

{
  "prompt": "图像描述",
  "model": "jimeng-3.0",
  "aspect_ratio": "16:9"
}
```

#### 3. ComfyUI专用接口
```
POST /api/comfyui/generateImage
Content-Type: multipart/form-data

参数：
- prompt: 文本描述
- image: 上传的图片文件（可选）
- model: 模型名称
- width/height: 尺寸
```

### 支持的模型

| 模型名称 | 描述 | 适用场景 |
|---------|------|----------|
| jimeng-3.0 | 最新版本，效果最佳 | 通用图像生成 |
| jimeng-2.1 | 稳定版本 | 日常使用 |
| jimeng-2.0-pro | 专业版本 | 图片混合/参考图生成 |
| jimeng-2.0 | 标准版本 | 基础需求 |
| jimeng-1.4 | 早期版本 | 特定风格 |
| jimeng-xl-pro | XL专业版 | 高分辨率图像 |

### 支持的尺寸比例

| 比例 | 即梦3.0尺寸 | 其他模型尺寸 |
|------|-------------|--------------|
| 1:1 | 1328×1328 | 1360×1360 |
| 16:9 | 1664×936 | 1360×765 |
| 4:3 | 1472×1104 | 1360×1020 |
| 3:2 | 1584×1056 | 1360×906 |
| 21:9 | 2016×864 | 1360×582 |

## 🔄 更新维护

### 更新项目

```bash
# 备份当前配置（如果有.env文件）
cp .env .env.backup 2>/dev/null || echo "无.env文件需要备份"

# 获取最新代码
git pull origin main

# 重新安装依赖
npm install

# 重新构建
npm run build

# 恢复配置（如果有备份）
cp .env.backup .env 2>/dev/null || echo "无需恢复.env文件"

# 重启服务
pm2 restart jimeng-mcp
```

### 监控服务状态

```bash
# 检查服务状态
pm2 status

# 设置服务监控
pm2 monitor

# 查看资源使用情况
pm2 monit
```


## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。


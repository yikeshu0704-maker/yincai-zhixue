# 因材智学

个性化学习 Web MVP：通过一个 Spring Boot 后端连接大模型，让六个核心学习 Agent 在真实浏览器中运行。

## 当前六个核心

1. 学情分析 Agent
2. 学习路径规划 Agent
3. AI 答疑 Agent
4. 错题复盘 Agent
5. 技能训练 Agent
6. 学习激励 Agent

## 项目结构

- `index.html`：前端页面
- `app.js`：页面交互、真实 Agent 请求
- `styles.css`：页面样式
- `backend/`：Spring Boot 后端
  - `/api/chat`：AI 答疑
  - `/api/agent`：analysis / plan / mistake / skill / motivation
  - `/api/health`：后端健康检查

## 本地运行

### 1. 配置 DeepSeek API Key

Windows PowerShell：

```powershell
setx MODEL_API_KEY "你的DeepSeek API Key"
```

配置后重新打开终端或 IDE。

### 2. 启动后端

```powershell
cd backend
mvn spring-boot:run
```

默认端口：

`http://localhost:8080`

### 3. 启动前端

使用任意本地静态服务器打开项目根目录，例如 VS Code Live Server 或其他静态文件服务器。

不要直接把 API Key 写进前端。

## 重要环境变量

- `MODEL_API_KEY)：模型 API Key
- `MODEL_BASE_URL`：可选，覆盖默认模型接口地址
- `MODEL_NAME`：可选，覆盖默认模型名

## MVP 验收

后端启动后访问：

`GET http://localhost:8080/api/health`

应返回：

```json
{"status":"ok","service":"yincai-backend"}
```

随后在网页依次验证六个核心入口，确保网页 → Spring Boot → 大模型 → 网页链路正常。

## 安全

API Key 只放在本机环境变量，不提交 GitHub，不写入 HTML/JavaScript。

# AI思维导图生成器

一个基于Vue 3和simple-mind-map库实现的AI思维导图生成工具，可以根据用户输入的主题自动生成完整的思维导图，支持流式生成效果。

## 特性

- 🧠 AI自动生成思维导图内容
- 💧 支持流式生成效果（类似ChatGPT打字效果）
- 🔄 每个新生成的节点会自动居中显示
- 📱 响应式设计，适配不同设备
- 🛠️ 支持与不同AI API集成（目前使用模拟数据）

## 技术栈

- Vue 3 - 前端框架
- Vite - 构建工具
- simple-mind-map - 思维导图核心库

## 开始使用

### 环境要求

- Node.js 18+ 

### 安装

```bash
# 克隆项目
git clone https://github.com/yourusername/mind-map-ai.git
cd mind-map-ai

# 安装依赖
npm install
```

### 开发

```bash
# 启动开发服务器
npm run dev
```

### 构建

```bash
# 构建生产版本
npm run build
```

## 连接真实AI API

目前，项目使用模拟数据生成思维导图。要连接真实的AI API，请编辑 `src/services/aiService.js` 文件，将模拟函数替换为实际API调用。

## 许可证

MIT

## 致谢

本项目基于[simple-mind-map](https://github.com/wanglin2/mind-map)开发，特此感谢！

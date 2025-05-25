# AI思维导图生成器

基于DeepSeek API和Mastra框架实现的智能思维导图自动生成工具。

## 功能特点

- 自动为任意主题生成完整的思维导图结构
- 使用DeepSeek AI生成高质量内容
- 实时流式生成，动态展示思维导图构建过程
- 美观的用户界面，支持导图交互和编辑

## 项目结构

- `/serve`: 后端服务器，使用Express和Mastra框架
- `/web`: 前端应用，使用Vue 3实现

## 安装与使用

1. 克隆仓库
```bash
git clone https://github.com/s154621323/ai-mindmap-generator.git
cd ai-mindmap-generator
```

2. 安装依赖
```bash
# 安装后端依赖
cd serve
npm install

# 安装前端依赖
cd ../web
npm install
```

3. 配置API密钥

在serve目录中创建`.env`文件并添加你的DeepSeek API密钥：
```
PORT=3000
DEEPSEEK_API_KEY=你的DeepSeek API密钥
```

项目中已包含`.env.example`文件作为模板。

4. 启动服务
```bash
# 启动后端
cd serve
npm run dev

# 启动前端 (新终端)
cd web
npm run dev
```

5. 访问应用

打开浏览器访问 http://localhost:5173

## 效果展示

生成思维导图示例：

![思维导图示例](https://raw.githubusercontent.com/s154621323/ai-mindmap-generator/main/screenshots/example.png)

## 技术栈

- 后端：Node.js、Express、Mastra框架、DeepSeek AI
- 前端：Vue 3、simple-mind-map、Vite

## 许可证

MIT 
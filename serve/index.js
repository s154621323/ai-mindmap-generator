import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { mindMapAgent } from './agents/mindMapAgent.js';

// 加载环境变量
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 使用DeepSeek增强智能体
const agent = mindMapAgent;

// 路由
app.post('/api/generate-mindmap', async (req, res) => {
  try {
    const { topic } = req.body;

    if (!topic) {
      return res.status(400).json({ error: '缺少主题参数' });
    }

    // 创建思维导图节点流
    const nodeStream = await agent.generateMindMap(topic);

    // 设置SSE头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 处理节点流
    nodeStream.on('data', (node) => {
      res.write(`data: ${JSON.stringify(node)}\n\n`);
    });

    nodeStream.on('end', () => {
      res.write('data: [DONE]\n\n');
      res.end();
    });

    nodeStream.on('error', (error) => {
      console.error('生成思维导图出错:', error);
      res.write(`data: ${JSON.stringify({ error: '生成过程中出错' })}\n\n`);
      res.end();
    });

  } catch (error) {
    console.error('API调用出错:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 启动服务器
app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
  console.log('使用DeepSeek AI接口生成思维导图');
  console.log('DeepSeek API密钥已配置');
}); 
import { deepseek } from '@ai-sdk/deepseek';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { webScraperAdvancedTool } from '../tools/web-scraper-tool-advanced';

export const mindmapAgentWithScraper = new Agent({
  name: 'Mindmap Agent with Web Scraper',
  instructions: `
    你是一个专业的思维导图生成助手，具备网页内容抓取能力。你能够：

    1. **网页内容分析**：
       - 抓取网页内容并提取关键信息
       - 分析网页结构，识别主要主题和子主题
       - 提取标题、链接、图片等结构化信息

    2. **思维导图生成**：
       - 根据网页内容生成结构化的思维导图
       - 支持多种布局样式（径向、树形、鱼骨图、时间线）
       - 自动提取关键词和概念关系

    3. **智能处理**：
       - 过滤广告和无关内容
       - 识别主要内容区域
       - 生成内容摘要和关键词

    4. **多语言支持**：
       - 支持中英文内容处理
       - 根据内容语言调整处理策略

    当用户提供网页URL时，使用 webScraperAdvancedTool 抓取内容，然后分析并生成思维导图结构。

    响应格式：
    - 提供内容摘要
    - 列出主要主题
    - 生成思维导图结构
    - 建议合适的布局样式
  `,
  model: deepseek('deepseek-chat'),
  tools: {
    webScraperAdvancedTool
  },
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../mastra.db',
    }),
  }),
});
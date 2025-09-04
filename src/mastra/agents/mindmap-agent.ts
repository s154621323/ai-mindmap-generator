import { deepseek } from '@ai-sdk/deepseek'
import { Agent } from '@mastra/core/agent'
import { Memory } from '@mastra/memory'
import { LibSQLStore } from '@mastra/libsql'
import { mindmapTool, webScraperTool } from '../tools'

export const mindmapAgent = new Agent({
  name: 'Mindmap Agent',
  instructions: `
   你是一个专业的思维导图生成助手，能够：
    - 分析用户输入的主题或内容
    - 生成结构化的思维导图节点
    - 提供多种思维导图样式选择
    - 支持中英文内容处理
    - 根据内容类型调整导图结构
`,
  model: deepseek('deepseek-chat'),
  tools: { mindmapTool, webScraperTool },
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../mastra.db', // path is relative to the .mastra/output directory
    }),
  }),
})

import { createWorkflow, createStep } from '@mastra/core/workflows'
import { z } from 'zod'
import { mindmapAgent } from '../agents/mindmap-agent'
import { webScraperTool, searchTool } from '../tools'

// 定义workflow的输入schema
const workflowInputSchema = z.object({
  topic: z.string().describe('思维导图主题'),
  sourceType: z.enum(['text', 'url', 'search']).describe('内容来源类型'),
  content: z.string().optional().describe('直接提供的文本内容'),
  url: z.string().url().optional().describe('要抓取的网页URL'),
  searchQuery: z.string().optional().describe('搜索关键词'),
  maxDepth: z.number().min(1).max(5).default(3).describe('思维导图最大深度'),
  style: z.enum(['radial', 'tree', 'fishbone']).default('radial').describe('思维导图样式'),
  language: z.enum(['zh', 'en']).default('zh').describe('生成语言')
})

// 定义workflow的输出schema
const workflowOutputSchema = z.object({
  mindmap: z.object({
    id: z.string(),
    title: z.string(),
    nodes: z.array(z.object({
      id: z.string(),
      text: z.string(),
      level: z.number(),
      parentId: z.string().optional(),
      children: z.array(z.string()).default([])
    })),
    style: z.string(),
    theme: z.string(),
    metadata: z.object({
      source: z.string(),
      generatedAt: z.string(),
      nodeCount: z.number(),
      maxDepth: z.number()
    })
  }),
  summary: z.string().describe('思维导图内容摘要'),
  processingSteps: z.array(z.string()).describe('处理步骤记录')
})

// 步骤1: 内容收集
const collectContentStep = createStep({
  id: 'collect-content',
  description: '根据输入类型收集内容',
  inputSchema: workflowInputSchema,
  outputSchema: z.object({
    content: z.string(),
    source: z.string(),
    contentType: z.string()
  }),
  execute: async ({ inputData }) => {
    const { sourceType, content, url, searchQuery } = inputData

    let collectedContent = ''
    let source = ''
    let contentType = ''

    switch (sourceType) {
      case 'text':
        collectedContent = content || ''
        source = 'direct_input'
        contentType = 'text'
        break

      case 'url':
        if (!url) throw new Error('URL is required for url source type')
        // 直接调用工具函数，避免复杂的上下文传递
        const scrapeResult = await webScraperTool.execute({
          context: {
            url,
            extractImages: true,
            extractLinks: true,
            maxContentLength: 10000,
            includeMetadata: true,
            removeAds: true
          }
        } as any)
        collectedContent = scrapeResult.content
        source = url
        contentType = 'webpage'
        break

      case 'search':
        if (!searchQuery) throw new Error('Search query is required for search source type')

        // 第一步：获取搜索结果
        const searchResult = await searchTool.execute({
          context: { query: searchQuery, maxResults: 5 } // 减少数量，因为要爬取每个链接
        } as any)

        // 第二步：并行爬取搜索结果中的网页内容
        const scrapePromises = searchResult.results.map(async (result) => {
          try {
            console.log(`正在爬取: ${result.url}`)
            const scrapedResult = await webScraperTool.execute({
              context: {
                url: result.url,
                extractImages: false, // 搜索场景下不需要图片
                extractLinks: false,  // 搜索场景下不需要链接
                maxContentLength: 8000, // 减少内容长度，因为要处理多个页面
                includeMetadata: true,
                removeAds: true
              }
            } as any)

            return {
              title: result.title,
              url: result.url,
              content: scrapedResult.content,
              summary: scrapedResult.summary,
              success: true
            }
          } catch (error) {
            console.warn(`爬取失败 ${result.url}:`, error.message)
            // 如果爬取失败，使用搜索结果摘要作为备选
            return {
              title: result.title,
              url: result.url,
              content: result.snippet,
              summary: result.snippet,
              success: false
            }
          }
        })

        // 等待所有爬取任务完成
        const scrapedContents = await Promise.all(scrapePromises)

        // 第三步：合并所有爬取的内容
        const successfulScrapes = scrapedContents.filter(item => item.success).length
        const failedScrapes = scrapedContents.length - successfulScrapes

        collectedContent = scrapedContents
          .map(item => `# ${item.title}\nURL: ${item.url}\n${item.success ? '' : '[使用搜索结果摘要]'}\n\n${item.content}`)
          .join('\n\n---\n\n')

        source = `search: ${searchQuery} (${successfulScrapes}/${scrapedContents.length} pages scraped successfully)`
        contentType = 'search_results_scraped'
        break

      default:
        throw new Error(`Unsupported source type: ${sourceType}`)
    }

    return {
      content: collectedContent,
      source,
      contentType
    }
  }
})

// 步骤2: 内容分析
const analyzeContentStep = createStep({
  id: 'analyze-content',
  description: '使用AI分析内容并提取关键信息',
  inputSchema: z.object({
    content: z.string(),
    source: z.string(),
    contentType: z.string(),
    topic: z.string(),
    maxDepth: z.number(),
    language: z.string()
  }),
  outputSchema: z.object({
    keyTopics: z.array(z.string()),
    structure: z.array(z.object({
      level: z.number(),
      topic: z.string(),
      subtopics: z.array(z.string())
    })),
    summary: z.string()
  }),
  execute: async ({ inputData }) => {
    const { content, topic, maxDepth, language } = inputData

    const prompt = `
请分析以下内容并生成思维导图结构：

主题: ${topic}
内容: ${content}

请按照以下要求分析：
1. 提取主要话题和子话题
2. 按照层级结构组织（最多${maxDepth}层）
3. 生成简洁的摘要
4. 使用${language === 'zh' ? '中文' : '英文'}输出

请以JSON格式返回结果：
{
  "keyTopics": ["主要话题1", "主要话题2", ...],
  "structure": [
    {
      "level": 1,
      "topic": "主要话题",
      "subtopics": ["子话题1", "子话题2", ...]
    }
  ],
  "summary": "内容摘要"
}
`

    const response = await mindmapAgent.generateVNext([{
      role: 'user',
      content: prompt
    }])

    try {
      const result = JSON.parse(response.text)
      return result
    } catch (error) {
      // 如果JSON解析失败，使用简单的文本分析
      const lines = content.split('\n').filter(line => line.trim())
      const keyTopics = lines.slice(0, 5).map(line => line.substring(0, 50))

      return {
        keyTopics,
        structure: [{
          level: 1,
          topic: topic,
          subtopics: keyTopics
        }],
        summary: `基于${topic}的内容分析，提取了${keyTopics.length}个主要话题`
      }
    }
  }
})

// 步骤3: 生成思维导图
const generateMindmapStep = createStep({
  id: 'generate-mindmap',
  description: '基于分析结果生成思维导图数据结构',
  inputSchema: z.object({
    keyTopics: z.array(z.string()),
    structure: z.array(z.object({
      level: z.number(),
      topic: z.string(),
      subtopics: z.array(z.string())
    })),
    summary: z.string(),
    topic: z.string(),
    style: z.string(),
    source: z.string()
  }),
  outputSchema: z.object({
    mindmap: z.object({
      id: z.string(),
      title: z.string(),
      nodes: z.array(z.object({
        id: z.string(),
        text: z.string(),
        level: z.number(),
        parentId: z.string().optional(),
        children: z.array(z.string()).default([])
      })),
      style: z.string(),
      theme: z.string(),
      metadata: z.object({
        source: z.string(),
        generatedAt: z.string(),
        nodeCount: z.number(),
        maxDepth: z.number()
      })
    })
  }),
  execute: async ({ inputData }) => {
    const { keyTopics, structure, summary, topic, style, source } = inputData

    const nodes: Array<{
      id: string
      text: string
      level: number
      parentId?: string
      children: string[]
    }> = []
    const nodeId = (text: string, level: number) => {
      // 处理undefined或null的情况
      const safeText = text || `empty_${Date.now()}`
      return `${level}_${safeText.replace(/\s+/g, '_')}`
    }

    // 创建根节点
    const rootId = 'root'
    nodes.push({
      id: rootId,
      text: topic,
      level: 0,
      parentId: undefined,
      children: []
    })

    // 根据结构创建节点
    structure.forEach((item, index) => {
      // 验证item数据
      if (!item || typeof item !== 'object') {
        console.warn(`跳过无效的structure项: ${JSON.stringify(item)}`)
        return
      }

      // 确保topic存在且为字符串
      const safeTopic = item.topic || `topic_${index}`
      const safeLevel = typeof item.level === 'number' ? item.level : 1
      const safeSubtopics = Array.isArray(item.subtopics) ? item.subtopics : []

      const parentId = safeLevel === 1 ? rootId : nodeId(safeTopic, safeLevel - 1)
      const currentNodeId = nodeId(safeTopic, safeLevel)

      nodes.push({
        id: currentNodeId,
        text: safeTopic,
        level: safeLevel,
        parentId: parentId,
        children: []
      })

      // 更新父节点的children
      const parentNode = nodes.find(n => n.id === parentId)
      if (parentNode) {
        parentNode.children.push(currentNodeId)
      }

      // 添加子话题
      safeSubtopics.forEach((subtopic, subIndex) => {
        // 确保subtopic存在且为字符串
        const safeSubtopic = subtopic || `subtopic_${subIndex}`
        const subtopicId = `${currentNodeId}_${subIndex}`

        nodes.push({
          id: subtopicId,
          text: safeSubtopic,
          level: safeLevel + 1,
          parentId: currentNodeId,
          children: []
        })

        // 更新当前节点的children
        const currentNode = nodes.find(n => n.id === currentNodeId)
        if (currentNode) {
          currentNode.children.push(subtopicId)
        }
      })
    })

    const mindmap = {
      id: `mindmap_${Date.now()}`,
      title: topic,
      nodes,
      style,
      theme: 'colorful',
      metadata: {
        source,
        generatedAt: new Date().toISOString(),
        nodeCount: nodes.length,
        maxDepth: Math.max(...nodes.map(n => n.level))
      }
    }

    return { mindmap }
  }
})

// 步骤4: 后处理和验证
const postProcessStep = createStep({
  id: 'post-process',
  description: '后处理思维导图数据并生成最终摘要',
  inputSchema: z.object({
    mindmap: z.object({
      id: z.string(),
      title: z.string(),
      nodes: z.array(z.object({
        id: z.string(),
        text: z.string(),
        level: z.number(),
        parentId: z.string().optional(),
        children: z.array(z.string()).default([])
      })),
      style: z.string(),
      theme: z.string(),
      metadata: z.object({
        source: z.string(),
        generatedAt: z.string(),
        nodeCount: z.number(),
        maxDepth: z.number()
      })
    }),
    summary: z.string()
  }),
  outputSchema: z.object({
    mindmap: z.object({
      id: z.string(),
      title: z.string(),
      nodes: z.array(z.object({
        id: z.string(),
        text: z.string(),
        level: z.number(),
        parentId: z.string().optional(),
        children: z.array(z.string()).default([])
      })),
      style: z.string(),
      theme: z.string(),
      metadata: z.object({
        source: z.string(),
        generatedAt: z.string(),
        nodeCount: z.number(),
        maxDepth: z.number()
      })
    }),
    summary: z.string(),
    processingSteps: z.array(z.string())
  }),
  execute: async ({ inputData }) => {
    const { mindmap, summary } = inputData

    // 验证思维导图结构
    const validationErrors: string[] = []

    // 检查是否有孤立节点
    const allNodeIds = new Set(mindmap.nodes.map(n => n.id))
    const allChildIds = new Set(mindmap.nodes.flatMap(n => n.children))

    for (const childId of allChildIds) {
      if (!allNodeIds.has(childId)) {
        validationErrors.push(`孤立节点: ${childId}`)
      }
    }

    // 检查父节点引用
    for (const node of mindmap.nodes) {
      if (node.parentId && !allNodeIds.has(node.parentId)) {
        validationErrors.push(`无效的父节点引用: ${node.id} -> ${node.parentId}`)
      }
    }

    const processingSteps: string[] = [
      '内容收集完成',
      'AI内容分析完成',
      '思维导图结构生成完成',
      '数据验证完成'
    ]

    if (validationErrors.length > 0) {
      processingSteps.push(`发现${validationErrors.length}个验证问题`)
    }

    return {
      mindmap,
      summary,
      processingSteps
    }
  }
})

// 创建并导出workflow
export const mindmapWorkflow = createWorkflow({
  id: 'mindmap-generation',
  description: 'AI思维导图生成工作流',
  inputSchema: workflowInputSchema,
  outputSchema: workflowOutputSchema
})
  .then(collectContentStep)
  .then(analyzeContentStep)
  .then(generateMindmapStep)
  .then(postProcessStep)
  .commit()
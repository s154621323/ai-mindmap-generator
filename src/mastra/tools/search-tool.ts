import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

// 搜索结果接口
interface SearchResult {
  title: string
  url: string
  snippet: string
  publishedDate?: string
  source?: string
  position: number
  apiSource: string
}

export const searchTool = createTool({
  id: 'search-internet',
  description: '使用Bing搜索互联网获取相关信息',
  inputSchema: z.object({
    query: z.string().describe('搜索关键词或问题'),
    maxResults: z
      .number()
      .min(1)
      .max(20)
      .optional()
      .default(5)
      .describe('最大搜索结果数量'),
  }),
  outputSchema: z.object({
    results: z
      .array(
        z.object({
          title: z.string(),
          url: z.string(),
          snippet: z.string(),
          publishedDate: z.string().optional(),
          source: z.string().optional(),
          position: z.number(),
          apiSource: z.string(),
        })
      )
      .describe('搜索结果列表'),
    totalResults: z.number().describe('总结果数量'),
  }),
  execute: async ({ context }) => {
    const {
      query,
      maxResults = 5,
    } = context

    // 直接使用Bing搜索
    return await performBingSearch(query, maxResults)
  },
})

// 使用Bing执行搜索
async function performBingSearch(
  query: string,
  maxResults: number,
): Promise<{
  results: SearchResult[]
  totalResults: number
  searchTime: string
}> {
  const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=${maxResults}`

  const response = await fetch(bingUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout(10000), // 10秒超时
  })

  if (!response.ok) {
    throw new Error(`Bing搜索失败: ${response.status} ${response.statusText}`)
  }

  const html = await response.text()
  const results = parseBingResults(html, maxResults)

  return {
    results,
    totalResults: results.length,
    searchTime: new Date().toISOString(),
  }
}

// 解析Bing搜索结果
function parseBingResults(html: string, maxResults: number): SearchResult[] {
  const results: SearchResult[] = []

  // 简单的Bing结果解析
  const resultRegex = /<li class="b_algo"[^>]*>[\s\S]*?<\/li>/gi
  let match
  let count = 0

  while ((match = resultRegex.exec(html)) !== null && count < maxResults) {
    const resultHtml = match[0]

    // 提取标题
    const titleMatch = resultHtml.match(/<h2[^>]*><a[^>]*>([^<]+)<\/a><\/h2>/i)
    if (!titleMatch) continue

    // 提取URL
    const urlMatch = resultHtml.match(/<h2[^>]*><a[^>]*href="([^"]+)"[^>]*>/i)
    if (!urlMatch) continue

    // 提取摘要
    const snippetMatch = resultHtml.match(/<p[^>]*>([^<]+)<\/p>/i)
    const snippet = snippetMatch ? snippetMatch[1] : ''

    results.push({
      title: titleMatch[1].trim(),
      url: urlMatch[1],
      snippet: snippet.trim(),
      source: 'Bing',
      position: count + 1,
      apiSource: 'bing-html',
    })

    count++
  }

  return results
}
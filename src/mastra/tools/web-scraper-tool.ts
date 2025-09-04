import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import * as cheerio from 'cheerio'

// 网页内容接口
interface WebPageContent {
  title: string
  content: string
  summary: string
  headings: Array<{
    level: number
    text: string
    id?: string
  }>
  links: Array<{
    url: string
    text: string
    isExternal: boolean
  }>
  images: Array<{
    url: string
    alt: string
    title?: string
  }>
  metadata: {
    description?: string
    keywords?: string[]
    author?: string
    publishDate?: string
    wordCount: number
    language?: string
    ogTitle?: string
    ogDescription?: string
    ogImage?: string
  }
}

export const webScraperTool = createTool({
  id: 'scrape-webpage',
  description: '网页内容抓取工具，使用 Cheerio 解析，提取结构化信息',
  inputSchema: z.object({
    url: z.string().url().describe('要抓取的网页URL'),
    extractImages: z
      .boolean()
      .optional()
      .default(true)
      .describe('是否提取图片信息'),
    extractLinks: z
      .boolean()
      .optional()
      .default(true)
      .describe('是否提取链接信息'),
    maxContentLength: z
      .number()
      .min(100)
      .max(100000)
      .optional()
      .default(15000)
      .describe('最大内容长度'),
    includeMetadata: z
      .boolean()
      .optional()
      .default(true)
      .describe('是否提取元数据'),
    removeAds: z
      .boolean()
      .optional()
      .default(true)
      .describe('是否移除广告内容'),
  }),
  outputSchema: z.object({
    title: z.string().describe('网页标题'),
    content: z.string().describe('提取的文本内容'),
    summary: z.string().describe('内容摘要'),
    headings: z
      .array(
        z.object({
          level: z.number(),
          text: z.string(),
          id: z.string().optional(),
        })
      )
      .describe('标题层级结构'),
    links: z
      .array(
        z.object({
          url: z.string(),
          text: z.string(),
          isExternal: z.boolean(),
        })
      )
      .optional()
      .describe('链接列表'),
    images: z
      .array(
        z.object({
          url: z.string(),
          alt: z.string(),
          title: z.string().optional(),
        })
      )
      .optional()
      .describe('图片信息列表'),
    metadata: z.object({
      description: z.string().optional(),
      keywords: z.array(z.string()).optional(),
      author: z.string().optional(),
      publishDate: z.string().optional(),
      wordCount: z.number(),
      language: z.string().optional(),
      ogTitle: z.string().optional(),
      ogDescription: z.string().optional(),
      ogImage: z.string().optional(),
    }),
    url: z.string().describe('原始URL'),
    scrapedAt: z.string().describe('抓取时间'),
    domain: z.string().describe('域名'),
  }),
  execute: async ({ context }) => {
    const {
      url,
      extractImages = true,
      extractLinks = true,
      maxContentLength = 15000,
      includeMetadata = true,
      removeAds = true,
    } = context

    try {
      const result = await scrapeWebPageAdvanced(
        url,
        extractImages,
        extractLinks,
        maxContentLength,
        includeMetadata,
        removeAds
      )
      return result
    } catch (error) {
      throw new Error(
        `网页抓取失败: ${error instanceof Error ? error.message : '未知错误'}`
      )
    }
  },
})

// 高级网页抓取函数
async function scrapeWebPageAdvanced(
  url: string,
  extractImages: boolean,
  extractLinks: boolean,
  maxContentLength: number,
  includeMetadata: boolean,
  removeAds: boolean
): Promise<
  WebPageContent & { url: string; scrapedAt: string; domain: string }
> {
  // 发送 HTTP 请求
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      Connection: 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`HTTP错误: ${response.status} ${response.statusText}`)
  }

  const html = await response.text()
  const domain = new URL(url).hostname

  // 使用 Cheerio 解析 HTML
  const $ = cheerio.load(html)

  // 移除不需要的元素
  if (removeAds) {
    $('script, style, noscript, iframe, embed, object').remove()
    $(
      '[class*="ad"], [id*="ad"], [class*="advertisement"], [class*="banner"]'
    ).remove()
    $('[class*="popup"], [class*="modal"], [class*="overlay"]').remove()
  }

  // 解析内容
  const parsedContent = parseHTMLWithCheerio(
    $,
    url,
    extractImages,
    extractLinks,
    maxContentLength,
    includeMetadata
  )

  return {
    ...parsedContent,
    url,
    domain,
    scrapedAt: new Date().toISOString(),
  }
}

// 使用 Cheerio 解析 HTML
function parseHTMLWithCheerio(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  extractImages: boolean,
  extractLinks: boolean,
  maxContentLength: number,
  includeMetadata: boolean
): WebPageContent {
  // 提取标题
  const title = extractTitleWithCheerio($)

  // 提取主要内容
  const content = extractMainContent($, maxContentLength)

  // 提取标题结构
  const headings = extractHeadingsWithCheerio($)

  // 提取链接
  const links = extractLinks ? extractLinksWithCheerio($, baseUrl) : []

  // 提取图片
  const images = extractImages ? extractImagesWithCheerio($, baseUrl) : []

  // 提取元数据
  const metadata = includeMetadata
    ? extractMetadataWithCheerio($)
    : { wordCount: content.length }

  // 生成摘要
  const summary = generateSmartSummary(content, headings)

  return {
    title,
    content,
    summary,
    headings,
    links,
    images,
    metadata: {
      ...metadata,
      wordCount: content.length,
    },
  }
}

// 使用 Cheerio 提取标题
function extractTitleWithCheerio($: cheerio.CheerioAPI): string {
  // 优先使用 og:title
  const ogTitle = $('meta[property="og:title"]').attr('content')
  if (ogTitle) return ogTitle.trim()

  // 使用 title 标签
  const title = $('title').text()
  if (title) return title.trim()

  // 使用 h1 标签
  const h1 = $('h1').first().text()
  if (h1) return h1.trim()

  return '无标题'
}

// 提取主要内容
function extractMainContent($: cheerio.CheerioAPI, maxLength: number): string {
  // 尝试找到主要内容区域
  const contentSelectors = [
    'main',
    'article',
    '[role="main"]',
    '.content',
    '.main-content',
    '.post-content',
    '.entry-content',
    '#content',
    '#main',
  ]

  let contentElement: cheerio.Cheerio<any> | null = null
  for (const selector of contentSelectors) {
    contentElement = $(selector).first()
    if (contentElement.length > 0) break
  }

  // 如果没有找到特定内容区域，使用 body
  if (!contentElement || contentElement.length === 0) {
    contentElement = $('body')
  }

  // 移除不需要的元素
  contentElement
    .find(
      'script, style, noscript, nav, header, footer, aside, .sidebar, .menu, .navigation'
    )
    .remove()

  // 提取文本
  let text = contentElement.text()

  // 清理文本
  text = text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim()

  // 限制长度
  if (text.length > maxLength) {
    text = text.substring(0, maxLength) + '...'
  }

  return text
}

// 提取标题结构
function extractHeadingsWithCheerio(
  $: cheerio.CheerioAPI
): Array<{ level: number; text: string; id?: string }> {
  const headings: Array<{ level: number; text: string; id?: string }> = []

  $('h1, h2, h3, h4, h5, h6').each((_, element) => {
    const $el = $(element)
    const level = parseInt(element.tagName.substring(1))
    const text = $el.text().trim()
    const id = $el.attr('id')

    if (text) {
      headings.push({ level, text, id })
    }
  })

  return headings
}

// 提取链接
function extractLinksWithCheerio(
  $: cheerio.CheerioAPI,
  baseUrl: string
): Array<{ url: string; text: string; isExternal: boolean }> {
  const links: Array<{ url: string; text: string; isExternal: boolean }> = []
  const baseDomain = new URL(baseUrl).hostname

  $('a[href]').each((_, element) => {
    const $el = $(element)
    const href = $el.attr('href')
    const text = $el.text().trim()

    if (href && text) {
      try {
        const absoluteUrl = resolveUrl(href, baseUrl)
        if (absoluteUrl) {
          const isExternal = new URL(absoluteUrl).hostname !== baseDomain
          links.push({ url: absoluteUrl, text, isExternal })
        }
      } catch (error) {
        // 忽略无效URL
      }
    }
  })

  // 去重并限制数量
  const uniqueLinks = links.filter(
    (link, index, self) => index === self.findIndex((l) => l.url === link.url)
  )

  return uniqueLinks.slice(0, 100)
}

// 提取图片
function extractImagesWithCheerio(
  $: cheerio.CheerioAPI,
  baseUrl: string
): Array<{ url: string; alt: string; title?: string }> {
  const images: Array<{ url: string; alt: string; title?: string }> = []

  $('img[src]').each((_, element) => {
    const $el = $(element)
    const src = $el.attr('src')
    const alt = $el.attr('alt') || ''
    const title = $el.attr('title')

    if (src) {
      try {
        const absoluteUrl = resolveUrl(src, baseUrl)
        if (absoluteUrl) {
          images.push({ url: absoluteUrl, alt, title })
        }
      } catch (error) {
        // 忽略无效URL
      }
    }
  })

  return images.slice(0, 50)
}

// 提取元数据
function extractMetadataWithCheerio($: cheerio.CheerioAPI) {
  const metadata: any = {}

  // 基本元数据
  const description =
    $('meta[name="description"]').attr('content') ||
    $('meta[property="og:description"]').attr('content')
  if (description) metadata.description = description

  const keywords = $('meta[name="keywords"]').attr('content')
  if (keywords) {
    metadata.keywords = keywords
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k)
  }

  const author =
    $('meta[name="author"]').attr('content') ||
    $('meta[property="article:author"]').attr('content')
  if (author) metadata.author = author

  const publishDate =
    $('meta[property="article:published_time"]').attr('content') ||
    $('meta[name="date"]').attr('content')
  if (publishDate) metadata.publishDate = publishDate

  const language =
    $('html').attr('lang') ||
    $('meta[http-equiv="content-language"]').attr('content')
  if (language) metadata.language = language

  // Open Graph 元数据
  const ogTitle = $('meta[property="og:title"]').attr('content')
  if (ogTitle) metadata.ogTitle = ogTitle

  const ogDescription = $('meta[property="og:description"]').attr('content')
  if (ogDescription) metadata.ogDescription = ogDescription

  const ogImage = $('meta[property="og:image"]').attr('content')
  if (ogImage) metadata.ogImage = ogImage

  return metadata
}

// 智能摘要生成
function generateSmartSummary(
  content: string,
  headings: Array<{ level: number; text: string }>
): string {
  // 如果有标题，优先使用标题信息
  if (headings.length > 0) {
    const mainHeadings = headings.filter((h) => h.level <= 2).slice(0, 3)
    if (mainHeadings.length > 0) {
      return `主要内容包括：${mainHeadings
        .map((h) => h.text)
        .join('、')}。${content.substring(0, 150)}...`
    }
  }

  // 否则使用内容摘要
  if (content.length <= 300) {
    return content
  }

  // 尝试在句号处截断
  const sentences = content.split(/[。！？.!?]/)
  let summary = ''

  for (const sentence of sentences) {
    if ((summary + sentence).length <= 300) {
      summary += sentence + '。'
    } else {
      break
    }
  }

  return summary || content.substring(0, 300) + '...'
}

// 解析相对URL为绝对URL
function resolveUrl(href: string, baseUrl: string): string | null {
  try {
    if (href.startsWith('http://') || href.startsWith('https://')) {
      return href
    }

    const base = new URL(baseUrl)

    if (href.startsWith('//')) {
      return base.protocol + href
    } else if (href.startsWith('/')) {
      return base.origin + href
    } else {
      return new URL(href, baseUrl).href
    }
  } catch (error) {
    return null
  }
}

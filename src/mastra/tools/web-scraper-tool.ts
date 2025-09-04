import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// 网页内容接口
interface WebPageContent {
  title: string;
  content: string;
  summary: string;
  headings: string[];
  links: string[];
  images: string[];
  metadata: {
    description?: string;
    keywords?: string[];
    author?: string;
    publishDate?: string;
    wordCount: number;
  };
}

export const webScraperTool = createTool({
  id: 'scrape-webpage',
  description: '抓取网页内容并提取关键信息，用于生成思维导图',
  inputSchema: z.object({
    url: z.string().url().describe('要抓取的网页URL'),
    extractImages: z.boolean().optional().default(true).describe('是否提取图片链接'),
    extractLinks: z.boolean().optional().default(true).describe('是否提取链接'),
    maxContentLength: z.number().min(100).max(50000).optional().default(10000).describe('最大内容长度'),
  }),
  outputSchema: z.object({
    title: z.string().describe('网页标题'),
    content: z.string().describe('提取的文本内容'),
    summary: z.string().describe('内容摘要'),
    headings: z.array(z.string()).describe('标题列表'),
    links: z.array(z.string()).optional().describe('链接列表'),
    images: z.array(z.string()).optional().describe('图片链接列表'),
    metadata: z.object({
      description: z.string().optional(),
      keywords: z.array(z.string()).optional(),
      author: z.string().optional(),
      publishDate: z.string().optional(),
      wordCount: z.number(),
    }),
    url: z.string().describe('原始URL'),
    scrapedAt: z.string().describe('抓取时间'),
  }),
  execute: async ({ context }) => {
    const { url, extractImages = true, extractLinks = true, maxContentLength = 10000 } = context;

    try {
      const result = await scrapeWebPage(url, extractImages, extractLinks, maxContentLength);
      return result;
    } catch (error) {
      throw new Error(`网页抓取失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  },
});

// 网页抓取主函数
async function scrapeWebPage(
  url: string,
  extractImages: boolean,
  extractLinks: boolean,
  maxContentLength: number
): Promise<WebPageContent & { url: string; scrapedAt: string }> {

  // 发送 HTTP 请求
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP错误: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();

  // 解析 HTML 内容
  const parsedContent = parseHTML(html, url, extractImages, extractLinks, maxContentLength);

  return {
    ...parsedContent,
    url,
    scrapedAt: new Date().toISOString(),
  };
}

// HTML 解析函数
function parseHTML(
  html: string,
  baseUrl: string,
  extractImages: boolean,
  extractLinks: boolean,
  maxContentLength: number
): WebPageContent {

  // 简单的 HTML 解析（实际项目中建议使用 cheerio 或 jsdom）
  const content = extractTextFromHTML(html);
  const title = extractTitle(html);
  const headings = extractHeadings(html);
  const links = extractLinks ? extractLinksFromHTML(html, baseUrl) : [];
  const images = extractImages ? extractImagesFromHTML(html, baseUrl) : [];
  const metadata = extractMetadata(html);

  // 限制内容长度
  const truncatedContent = content.length > maxContentLength
    ? content.substring(0, maxContentLength) + '...'
    : content;

  // 生成摘要
  const summary = generateSummary(truncatedContent);

  return {
    title,
    content: truncatedContent,
    summary,
    headings,
    links,
    images,
    metadata: {
      ...metadata,
      wordCount: truncatedContent.length,
    },
  };
}

// 从 HTML 中提取文本内容
function extractTextFromHTML(html: string): string {
  // 移除脚本和样式标签
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');

  // 移除 HTML 标签
  text = text.replace(/<[^>]*>/g, ' ');

  // 清理空白字符
  text = text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();

  return text;
}

// 提取网页标题
function extractTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (titleMatch) {
    return titleMatch[1].trim();
  }

  // 尝试从 h1 标签获取标题
  const h1Match = html.match(/<h1[^>]*>([^<]*)<\/h1>/i);
  if (h1Match) {
    return h1Match[1].trim();
  }

  return '无标题';
}

// 提取标题列表
function extractHeadings(html: string): string[] {
  const headings: string[] = [];
  const headingRegex = /<h([1-6])[^>]*>([^<]*)<\/h[1-6]>/gi;
  let match;

  while ((match = headingRegex.exec(html)) !== null) {
    const level = parseInt(match[1]);
    const text = match[2].trim();
    if (text) {
      headings.push(`${'  '.repeat(level - 1)}${text}`);
    }
  }

  return headings;
}

// 提取链接
function extractLinksFromHTML(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const absoluteUrl = resolveUrl(href, baseUrl);
    if (absoluteUrl && !links.includes(absoluteUrl)) {
      links.push(absoluteUrl);
    }
  }

  return links.slice(0, 50); // 限制链接数量
}

// 提取图片链接
function extractImagesFromHTML(html: string, baseUrl: string): string[] {
  const images: string[] = [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;

  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1];
    const absoluteUrl = resolveUrl(src, baseUrl);
    if (absoluteUrl && !images.includes(absoluteUrl)) {
      images.push(absoluteUrl);
    }
  }

  return images.slice(0, 20); // 限制图片数量
}

// 提取元数据
function extractMetadata(html: string) {
  const metadata: any = {};

  // 提取描述
  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i);
  if (descMatch) {
    metadata.description = descMatch[1];
  }

  // 提取关键词
  const keywordsMatch = html.match(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["'][^>]*>/i);
  if (keywordsMatch) {
    metadata.keywords = keywordsMatch[1].split(',').map(k => k.trim());
  }

  // 提取作者
  const authorMatch = html.match(/<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["'][^>]*>/i);
  if (authorMatch) {
    metadata.author = authorMatch[1];
  }

  // 提取发布日期
  const dateMatch = html.match(/<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["'][^>]*>/i);
  if (dateMatch) {
    metadata.publishDate = dateMatch[1];
  }

  return metadata;
}

// 生成内容摘要
function generateSummary(content: string): string {
  // 简单的摘要生成：取前200个字符
  if (content.length <= 200) {
    return content;
  }

  // 尝试在句号处截断
  const sentences = content.split(/[。！？.!?]/);
  let summary = '';

  for (const sentence of sentences) {
    if ((summary + sentence).length <= 200) {
      summary += sentence + '。';
    } else {
      break;
    }
  }

  return summary || content.substring(0, 200) + '...';
}

// 解析相对URL为绝对URL
function resolveUrl(href: string, baseUrl: string): string | null {
  try {
    // 如果已经是绝对URL，直接返回
    if (href.startsWith('http://') || href.startsWith('https://')) {
      return href;
    }

    // 解析基础URL
    const base = new URL(baseUrl);

    // 处理相对URL
    if (href.startsWith('//')) {
      return base.protocol + href;
    } else if (href.startsWith('/')) {
      return base.origin + href;
    } else {
      return new URL(href, baseUrl).href;
    }
  } catch (error) {
    return null;
  }
}
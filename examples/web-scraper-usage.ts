// 网页抓取工具使用示例

import { webScraperAdvancedTool } from '../src/mastra/tools/web-scraper-tool-advanced';

async function exampleUsage() {
  try {
    console.log('开始抓取网页内容...');

    // 抓取网页内容
    const result = await webScraperAdvancedTool.execute({
      context: {
        url: 'https://example.com',
        extractImages: true,
        extractLinks: true,
        maxContentLength: 10000,
        includeMetadata: true,
        removeAds: true,
      }
    });

    console.log('抓取结果：');
    console.log('标题:', result.title);
    console.log('域名:', result.domain);
    console.log('内容长度:', result.content.length);
    console.log('摘要:', result.summary);

    console.log('\n标题结构:');
    result.headings.forEach(heading => {
      console.log(`${'  '.repeat(heading.level - 1)}H${heading.level}: ${heading.text}`);
    });

    console.log('\n链接数量:', result.links?.length || 0);
    console.log('图片数量:', result.images?.length || 0);

    console.log('\n元数据:');
    console.log('描述:', result.metadata.description);
    console.log('关键词:', result.metadata.keywords);
    console.log('作者:', result.metadata.author);
    console.log('语言:', result.metadata.language);

  } catch (error) {
    console.error('抓取失败:', error);
  }
}

// 思维导图生成示例
async function generateMindmapFromWebpage(url: string) {
  try {
    // 1. 抓取网页内容
    const scrapedData = await webScraperAdvancedTool.execute({
      context: {
        url,
        extractImages: false,
        extractLinks: true,
        maxContentLength: 15000,
        includeMetadata: true,
        removeAds: true,
      }
    });

    // 2. 分析内容结构
    const mindmapStructure = {
      title: scrapedData.title,
      mainTopics: scrapedData.headings
        .filter(h => h.level <= 2)
        .map(h => ({
          text: h.text,
          level: h.level,
          subtopics: scrapedData.headings
            .filter(sub => sub.level === h.level + 1)
            .map(sub => sub.text)
        })),
      links: scrapedData.links?.slice(0, 10) || [],
      summary: scrapedData.summary,
    };

    // 3. 生成思维导图数据
    const mindmapData = {
      id: `mindmap_${Date.now()}`,
      title: scrapedData.title,
      nodes: [
        {
          id: 'root',
          text: scrapedData.title,
          level: 0,
          children: mindmapStructure.mainTopics.map((_, i) => `topic_${i}`),
        },
        ...mindmapStructure.mainTopics.map((topic, i) => ({
          id: `topic_${i}`,
          text: topic.text,
          level: 1,
          parentId: 'root',
          children: topic.subtopics.map((_, j) => `subtopic_${i}_${j}`),
        })),
        ...mindmapStructure.mainTopics.flatMap((topic, i) =>
          topic.subtopics.map((subtopic, j) => ({
            id: `subtopic_${i}_${j}`,
            text: subtopic,
            level: 2,
            parentId: `topic_${i}`,
            children: [],
          }))
        ),
      ],
      style: 'radial',
      theme: 'colorful',
      metadata: {
        source: url,
        scrapedAt: scrapedData.scrapedAt,
        wordCount: scrapedData.metadata.wordCount,
      },
    };

    return mindmapData;

  } catch (error) {
    console.error('生成思维导图失败:', error);
    throw error;
  }
}

// 导出示例函数
export { exampleUsage, generateMindmapFromWebpage };

// 如果直接运行此文件，执行示例
if (require.main === module) {
  exampleUsage();
}
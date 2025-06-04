import { EventEmitter } from 'events';
import { deepseek } from '@ai-sdk/deepseek';
import { Agent } from '@mastra/core/agent';

/**
 * 思维导图生成智能体
 * 使用DeepSeek API生成思维导图内容
 */
class MindMapAgent {
  constructor() {
    // 初始化Mastra智能体
    this.agent = new Agent({
      name: 'MindMapAgent',
      instructions: `
        你是一个专业的思维导图生成助手，擅长创建结构化的思维导图内容。

        当用户提供一个主题时，你应该：
        - 生成5-7个与主题相关的主要方面或类别
        - 为每个主要方面生成3-5个详细的子主题
        - 确保所有内容都以JSON格式返回
        - 保持结构清晰、逻辑连贯
        - 确保内容丰富且有洞察力
      `,
      model: deepseek('deepseek-chat')
    });
  }

  /**
   * 生成思维导图
   * @param {string} topic 主题
   * @returns {EventEmitter} 节点流事件发射器
   */
  async generateMindMap (topic) {
    // 创建事件发射器用于流式返回节点
    const nodeStream = new EventEmitter();

    // 启动异步生成过程
    this.generateMindMapAsync(topic, nodeStream).catch(error => {
      console.error('生成思维导图出错:', error);
      nodeStream.emit('error', error);
    });

    return nodeStream;
  }

  /**
   * 异步生成思维导图内容
   * @param {string} topic 主题
   * @param {EventEmitter} nodeStream 节点流
   * @private
   */
  async generateMindMapAsync (topic, nodeStream) {
    try {
      console.log('开始生成思维导图，主题:', topic);

      // 首先发送根节点
      const rootNodeId = `root-${Date.now()}`;
      console.log(`创建根节点: ${rootNodeId}, 文本: "${topic}"`);

      await new Promise(resolve => setTimeout(resolve, 100));

      nodeStream.emit('data', {
        id: rootNodeId,
        text: topic,
        isMain: true,
        parentId: null
      });

      console.log('已发送根节点:', rootNodeId, topic);

      // 1. 生成主要主题
      const mainTopicsPrompt = `
为主题"${topic}"创建一个详细的思维导图结构。
请生成5-7个主要方面或类别，每个都应该与主题密切相关。
必须返回JSON格式，使用以下结构:
[
  "主要方面1",
  "主要方面2",
  ...
]

只返回JSON数据，不要有任何其他文本。`;

      // 使用智能体生成主题
      const mainTopicsResponse = await this.agent.generate(mainTopicsPrompt);
      console.log('获取到主题列表响应');

      // 尝试解析响应
      let mainTopics = [];
      try {
        mainTopics = JSON.parse(mainTopicsResponse.text);
        console.log('成功解析JSON主题列表');
      } catch (e) {
        console.log('JSON解析失败');
      }

      // 确保我们有数组格式
      if (!Array.isArray(mainTopics)) {
        throw new Error('无法从响应中提取主题列表');
      }

      console.log(`成功提取${mainTopics.length}个主题`);

      // 2. 依次处理每个主题及其子主题
      for (const mainTopic of mainTopics) {
        // 延迟以确保流式显示效果
        await new Promise(resolve => setTimeout(resolve, 800));

        // 确保主题对象格式正确
        const mainTopicText = typeof mainTopic === 'string' ? mainTopic : mainTopic.topic;
        const mainTopicId = `main-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        console.log(`创建主题节点: ${mainTopicId}, 文本: "${mainTopicText}", 父节点: ${rootNodeId}`);

        // 发射主题节点
        nodeStream.emit('data', {
          id: mainTopicId,
          text: mainTopicText,
          parentId: rootNodeId // 所有主题都连接到根节点
        });

        console.log('已发送主题节点:', mainTopicId, mainTopicText, '-> 父节点:', rootNodeId);

        // 为每个主题生成子主题
        const subtopicsPrompt = `
为主题"${topic}"的子方面"${mainTopicText}"创建子主题。
请生成3-5个子主题，每个都应该详细阐述"${mainTopicText}"的不同方面。
必须返回JSON格式数组，每个元素是一个字符串，表示一个子主题。例如:
[
  "子主题1",
  "子主题2",
  ...
]

只返回JSON数组，不要有任何其他文本。`;

        // 使用智能体生成子主题
        console.log('请求生成子主题:', mainTopicText);
        const subtopicsResponse = await this.agent.generate(subtopicsPrompt);
        console.log('获取到子主题列表响应');

        // 尝试解析响应
        let subtopics = [];
        try {
          subtopics = JSON.parse(subtopicsResponse.text);
          console.log('成功解析JSON子主题列表');
        } catch (e) {
          console.log('JSON解析失败，尝试提取结构化数据');
          // 如果无法解析JSON，使用extractStructuredData方法提取
          subtopics = this.extractStructuredData(subtopicsResponse.text);
        }

        // 确保我们有数组格式
        if (!Array.isArray(subtopics)) {
          console.warn(`无法为主题"${mainTopicText}"提取子主题，跳过`);
          continue;
        }

        console.log(`成功提取${subtopics.length}个子主题`);

        // 发射子主题节点
        for (const subtopic of subtopics) {
          // 延迟以确保流式显示效果
          await new Promise(resolve => setTimeout(resolve, 600));

          const subtopicId = `sub-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          console.log(`创建子主题节点: ${subtopicId}, 文本: "${subtopic}", 父节点: ${mainTopicId}`);

          nodeStream.emit('data', {
            id: subtopicId,
            text: subtopic,
            parentId: mainTopicId // 使用主题ID作为父节点ID
          });

          console.log('已发送子主题节点:', subtopicId, subtopic, '-> 父节点:', mainTopicId);
        }
      }

      console.log('思维导图生成完成');
      // 完成生成
      nodeStream.emit('end');

    } catch (error) {
      console.error('生成思维导图内容时出错:', error);
      nodeStream.emit('error', error);
    }
  }
}

// 导出单例
export const mindMapAgent = new MindMapAgent(); 
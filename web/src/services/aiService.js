/**
 * AI服务 - 用于处理与AI API的通信
 * 
 * 连接到服务端的思维导图生成接口
 */

// 服务器API地址
const API_URL = 'http://localhost:3000';

/**
 * 流式生成思维导图
 * @param {string} topic 主题
 * @param {Function} onNewNode 新节点生成时的回调
 * @returns {Promise<void>}
 */
export async function streamGenerateMindMap (topic, onNewNode) {
  try {
    // 连接到服务端SSE接口
    const response = await fetch(`${API_URL}/api/generate-mindmap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ topic })
    });

    if (!response.ok) {
      throw new Error(`API响应错误: ${response.status}`);
    }

    // 创建事件源用于接收服务端的SSE流
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      // 解码接收到的数据
      buffer += decoder.decode(value, { stream: true });

      // 处理缓冲区中的每一行数据
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() === '') continue;

        // 解析SSE格式的数据
        const match = line.match(/^data: (.+)$/m);
        if (!match) continue;

        const data = match[1];
        if (data === '[DONE]') {
          // 生成完成
          break;
        }

        try {
          // 解析节点数据
          const node = JSON.parse(data);

          // 如果是错误信息
          if (node.error) {
            console.error('服务端错误:', node.error);
            continue;
          }

          // 调用回调处理新节点
          await onNewNode(node);

        } catch (e) {
          console.error('解析节点数据出错:', e, data);
        }
      }
    }
  } catch (error) {
    console.error('流式生成出错:', error);
    throw error;
  }
}

/**
 * 获取服务端配置信息
 * @returns {Promise<Object>} 配置信息
 */
export async function getServerConfig () {
  try {
    const response = await fetch(`${API_URL}/config`);

    if (!response.ok) {
      throw new Error(`API响应错误: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('获取服务端配置出错:', error);
    // 返回默认配置
    return {
      useMockData: true,
      hasApiKey: false,
      agentType: 'basic'
    };
  }
}

export default {
  streamGenerateMindMap,
  getServerConfig
}; 
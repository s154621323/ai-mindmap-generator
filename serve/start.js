// 设置环境变量
process.env.PORT = '3000';
process.env.USE_MOCK_DATA = 'false';
process.env.DEEPSEEK_API_KEY = '你的DeepSeek API密钥';

console.log('启动思维导图AI服务器...');
console.log('环境变量设置:');
console.log('- PORT:', process.env.PORT);
console.log('- DEEPSEEK_API_KEY:', '******' + process.env.DEEPSEEK_API_KEY.slice(-6));
console.log('- 使用真实AI接口生成思维导图');

// 启动服务器
import('./index.js').catch(err => {
  console.error('启动服务器时出错:', err);
  process.exit(1);
});

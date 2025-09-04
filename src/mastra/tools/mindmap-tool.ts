import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

interface GeocodingResponse {
  results: {
    latitude: number;
    longitude: number;
    name: string;
  }[];
}
interface WeatherResponse {
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    wind_gusts_10m: number;
    weather_code: number;
  };
}

export const mindmapTool = createTool({
  id: 'generate-mindmap',
  description: '根据内容生成思维导图结构',
  inputSchema: z.object({
    content: z.string().describe('要生成思维导图的内容'),
    layout: z.enum(['logicalStructure', 'mindMap', 'organizationStructure', 'catalogOrganization', 'timeline', 'timeline2', 'fishbone', 'verticalTimeline']).optional().describe('布局结构'),
    maxDepth: z.number().min(2).max(6).optional().describe('最大层级深度'),
  }),
  outputSchema: z.object({
    content: z.string(),
    layout: z.string(),
    maxDepth: z.number(),
  }),
  execute: async ({ context }) => {
    const { content, layout = 'logicalStructure', maxDepth = 4 } = context;

    return await generateMindmap(content, layout, maxDepth);
  },
});

const generateMindmap = async (content: string, layout: string, maxDepth: number) => {
  return {
    content,
    layout,
    maxDepth
  };
};

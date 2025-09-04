
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { mindmapWorkflow } from './workflows/mindmap-workflow';
import { mindmapAgent } from './agents/mindmap-agent';
import { mindmapAgentWithScraper } from './agents/mindmap-agent-with-scraper';

export const mastra = new Mastra({
  workflows: { mindmapWorkflow },
  agents: { mindmapAgent, mindmapAgentWithScraper },
  storage: new LibSQLStore({
    // stores telemetry, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});

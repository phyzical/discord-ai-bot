import { ModelInfo } from './ModelInfo.js';
import { Server } from './Server.js';

export type Config = {
  model: string;
  servers: Server[];
  channels: string[];
  customSystemMessage: string;
  useCustomSystemMessage: boolean;
  useModelSystemMessage: boolean;
  showStartOfConversation: boolean;
  randomServer: boolean;
  modelInfo: ModelInfo;
  initialPrompt: string;
  useInitialPrompt: boolean;
  requiresMention: boolean;
  token: string;
  production: boolean;
  botUserID: string;
};

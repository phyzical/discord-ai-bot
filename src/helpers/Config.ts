import dotenv from 'dotenv';
import process from 'process';
import { Config } from '../types/Config.js';
import { boolean, env } from './Parsers.js';
import { post } from './Requests.js';
import { ModelInfo } from '../types/ModelInfo.js';

const getConfig = async (): Promise<Config> => {
  dotenv.config();

  const production = process.env.NODE_ENV == 'prod' || process.env.NODE_ENV == 'production';
  const model = process.env.MODEL;
  const servers = process.env.OLLAMA.split(',').map((url) => ({ url: new URL(url), available: true }));
  const channels = process.env.CHANNELS.split(',');
  const token = process.env.TOKEN;
  const botUserID = process.env.BOT_USER_ID;

  if (servers.length == 0) throw new Error('No servers available');

  const customSystemMessage = env(process.env.SYSTEM);
  const useCustomSystemMessage = boolean(process.env.USE_SYSTEM) && !!customSystemMessage;
  const useModelSystemMessage = boolean(process.env.USE_MODEL_SYSTEM);
  const showStartOfConversation = boolean(process.env.SHOW_START_OF_CONVERSATION);
  const randomServer = boolean(process.env.RANDOM_SERVER);
  // fetch info about the model like the template and system message
  let modelInfo = (await post(servers, randomServer, '/api/show', {
    name: model,
  })) as ModelInfo;
  if (typeof modelInfo === 'string') modelInfo = JSON.parse(modelInfo) as ModelInfo;
  if (typeof modelInfo !== 'object') throw 'failed to fetch model information';
  const initialPrompt = env(process.env.INITIAL_PROMPT);
  const useInitialPrompt = boolean(process.env.USE_INITIAL_PROMPT) && !!initialPrompt;
  const requiresMention = boolean(process.env.REQUIRES_MENTION);

  return {
    model,
    servers,
    channels,
    customSystemMessage,
    useCustomSystemMessage,
    useModelSystemMessage,
    showStartOfConversation,
    randomServer,
    modelInfo,
    initialPrompt,
    useInitialPrompt,
    requiresMention,
    token,
    production,
    botUserID,
  };
};

export const config = await getConfig();

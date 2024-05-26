import dotenv from 'dotenv';
import process from 'process';
import { Config } from '../types/Config.js';
import { boolean } from './Parsers.js';
import { post } from './Requests.js';
import { ModelInfo } from '../types/ModelInfo.js';
import { Environment } from '../types/Environment.js';

const getConfig = async (): Promise<Config> => {
  dotenv.config();

  const {
    NODE_ENV,
    MODEL,
    OLLAMA,
    CHANNELS,
    TOKEN,
    BOT_USER_ID,
    SYSTEM,
    USE_MODEL_SYSTEM,
    SHOW_START_OF_CONVERSATION,
    RANDOM_SERVER,
    INITIAL_PROMPT,
    REQUIRES_MENTION,
    BOT_CHAT_COUNT_LIMIT,
  } = process.env as unknown as Environment;
  if (!BOT_USER_ID) throw 'Please provide bot token';
  if (!MODEL) throw 'Please provide model';
  if (!TOKEN) throw 'Please provide a token';
  if (!OLLAMA) throw 'Please provide a server';

  const servers = OLLAMA.split(',').map((url) => ({ url: new URL(url), available: true }));
  const model = MODEL;

  const randomServer = boolean(RANDOM_SERVER);
  // fetch info about the model like the template and system message
  let modelInfo = (await post(servers, randomServer, '/api/show', {
    name: model,
  })) as ModelInfo;
  if (typeof modelInfo === 'string') modelInfo = JSON.parse(modelInfo) as ModelInfo;
  if (typeof modelInfo !== 'object') throw 'failed to fetch model information';

  return {
    model,
    servers,
    channels: CHANNELS.split(','),
    customSystemMessage: SYSTEM || '',
    useModelSystemMessage: boolean(USE_MODEL_SYSTEM),
    showStartOfConversation: boolean(SHOW_START_OF_CONVERSATION),
    randomServer,
    modelInfo,
    initialPrompt: INITIAL_PROMPT || '',
    requiresMention: boolean(REQUIRES_MENTION),
    token: TOKEN,
    production: NODE_ENV == 'prod' || NODE_ENV == 'production',
    botUserID: BOT_USER_ID,
    botChatsCountLimit: parseInt(BOT_CHAT_COUNT_LIMIT || '5'),
  };
};

export const config = await getConfig();

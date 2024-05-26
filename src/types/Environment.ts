/* eslint-disable no-unused-vars */
export enum Env {
  PRODUCTION = 'production',
  PROD = 'prod',
  DEVELOPMENT = 'development',
}

// NOTE: these are not the only ones, just suggestions
export enum Models {
  OLLAMA2 = 'ollama2',
  OLLAMA3 = 'ollama3',
  MISITRAL = 'mistral',
  ORCA = 'orca',
}

export type Environment = {
  NODE_ENV: Env;
  // What language model to use, orca is one of the lower - end models
  // that doesn't require as much computer power as llama2
  MODEL: Models;
  // Ollama URL(if you want to use multiple, separate them by commas)
  OLLAMA: string;
  // What Discord channels to enable it in (by ID)
  CHANNELS: string;
  // Discord bot token
  TOKEN: string;
  // discord bot user id
  BOT_USER_ID: string;
  // System message that the language model can understand
  // Feel free to change this
  SYSTEM: string;
  // Use the model's system message? (true/false) If both are specified, model system message will be first
  USE_MODEL_SYSTEM: string;
  // Whether to show a message at the start of a conversation
  SHOW_START_OF_CONVERSATION: string;
  // Whether to use a random Ollama server or use the first available one
  RANDOM_SERVER: string;
  //Whether to add a message before the first prompt of the conversation
  INITIAL_PROMPT: string;
  //Require users to mention the bot to interact with it? (true/false)
  REQUIRES_MENTION: string;
  // specifiy how many bot chat pingpongs to perform
  // triggered via `@bot1 talk to @bot2`
  BOT_CHAT_COUNT_LIMIT: string;
};

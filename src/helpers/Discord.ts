import { Message } from 'discord.js';
import { splitText } from './Polyfils.js';

export const pingReply = async (message: Message): Promise<void> => {
  const beforeTime = Date.now();
  const reply = await message.reply({ content: 'Ping' });
  const afterTime = Date.now();
  const difference = afterTime - beforeTime;
  await reply.edit({ content: `Ping: ${difference}ms` });
};

export const replySplitMessage = async (replyMessage: Message, content: string): Promise<Message[]> => {
  const responseMessages = splitText(content, 2000).map((content: string) => ({ content }));

  const replyMessages = [];
  for (let i = 0; i < responseMessages.length; ++i)
    if (i == 0) replyMessages.push(await replyMessage.reply(responseMessages[i]));
    else replyMessages.push(await replyMessage.channel.send(responseMessages[i]));

  return replyMessages;
};

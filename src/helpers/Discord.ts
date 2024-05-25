import {
  DMChannel,
  Message,
  NewsChannel,
  PartialDMChannel,
  PrivateThreadChannel,
  PublicThreadChannel,
  StageChannel,
  TextChannel,
  VoiceChannel,
} from 'discord.js';
import { splitText } from './Polyfils.js';

export const pingReply = async (message: Message): Promise<void> => {
  const beforeTime = Date.now();
  const reply = await message.reply({ content: 'Ping' });
  const afterTime = Date.now();
  const difference = afterTime - beforeTime;
  await reply.edit({ content: `Ping: ${difference}ms` });
};

export const sendSplitReplyMessage = async (replyMessage: Message, content: string): Promise<Message[]> => {
  const responseMessages = splitText(content, 2000).map((content: string) => ({ content }));

  const messages = [];
  for (let i = 0; i < responseMessages.length; ++i)
    if (i == 0) messages.push(await replyMessage.reply(responseMessages[i]));
    else messages.push(await replyMessage.channel.send(responseMessages[i]));

  return messages;
};

export const sendSplitChannelMessage = async (
  messageChannel:
    | DMChannel
    | PartialDMChannel
    | NewsChannel
    | StageChannel
    | TextChannel
    | PrivateThreadChannel
    | PublicThreadChannel
    | VoiceChannel,
  content: string
): Promise<Message[]> => {
  const responseMessages = splitText(content, 2000).map((content: string) => ({ content }));
  const messages = [];
  for (let i = 0; i < responseMessages.length; ++i) messages.push(messageChannel.send(responseMessages[i]));

  return messages;
};

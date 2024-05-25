import { Client, Events, GatewayIntentBits, Message, MessageType, Partials } from 'discord.js';
import { config } from './helpers/Config.js';
import { post } from './helpers/Requests.js';
import { logDebug, logError } from './helpers/Log.js';
import { init } from './helpers/polyfils/All.js';
import { pingReply, replySplitMessage } from './helpers/Discord.js';

init();
const {
  channels,
  modelInfo,
  useModelSystemMessage,
  customSystemMessage,
  useCustomSystemMessage,
  requiresMention,
  servers,
  showStartOfConversation,
  initialPrompt,
  useInitialPrompt,
  token,
  model,
  randomServer,
} = config;

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  allowedMentions: { users: [], roles: [], repliedUser: false },
  partials: [Partials.Channel],
});

client.once(Events.ClientReady, async () => {
  await client.guilds.fetch();
  client.user.setPresence({ activities: [], status: 'online' });
});

const messages = {};

client.on(Events.MessageCreate, async (message: Message) => {
  let typing = false;
  try {
    await message.fetch();
    const {
      channel: messageChannel,
      guild,
      author: { id: authorID, bot: authorBot, username: authorUsername },
      content,
      type,
    } = message;
    const { id: channelID } = messageChannel;
    const { channels: guildChannels, members: guildMembers } = guild;
    let channelName = 'N/A';
    if ('name' in messageChannel) channelName = messageChannel.name;

    const {
      me: {
        roles: { botRole },
      },
    } = guildMembers;

    const {
      user: { id: userID },
    } = client;

    // return if not in the right channel
    if (guild && !channels.includes(channelID)) return;

    // return if user is a bot, or non-default message
    if (!authorID) return;
    if (authorBot || authorID == userID) return;

    // RegExp to match a mention for the bot
    const myMention = new RegExp(`<@((!?${userID}${botRole ? `)|(&${botRole.id}` : ''}))>`, 'g');

    if (typeof content !== 'string' || content.length == 0) return;

    let context = null;
    if (type == MessageType.Reply) {
      const reply = await message.fetchReference();
      if (!reply) return;
      if (reply.author.id != userID) return;
      if (messages[channelID] == null) return;
      if ((context = messages[channelID][reply.id]) == null) return;
    } else if (type != MessageType.Default) return;

    const systemMessages = [];

    if (useModelSystemMessage && modelInfo.system) systemMessages.push(modelInfo.system);

    if (useCustomSystemMessage) systemMessages.push(customSystemMessage);

    // join them together
    const systemMessage = systemMessages.join('\n\n');

    // deal with commands first before passing to LLM
    let userInput = content.replace(new RegExp('^s*' + myMention.source, ''), '').trim();

    // may change this to slash commands in the future
    // i'm using regular text commands currently because the bot interacts with text content anyway
    if (userInput.startsWith('.')) {
      const args = userInput.substring(1).split(/\s+/g);
      const cmd = args.shift();
      switch (cmd) {
        case 'reset':
        case 'clear':
          if (messages[channelID] != null) {
            // reset conversation
            const cleared = messages[channelID].amount;

            // clear
            delete messages[channelID];

            if (cleared > 0) {
              await message.reply({ content: `Cleared conversation of ${cleared} messages` });
              break;
            }
          }
          await message.reply({ content: 'No messages to clear' });
          break;
        case 'help':
        case '?':
        case 'h':
          await message.reply({
            content: 'Commands:\n- `.reset` `.clear`\n- `.help` `.?` `.h`\n- `.ping`\n- `.model`\n- `.system`',
          });
          break;
        case 'model':
          await message.reply({
            content: `Current model: ${model}`,
          });
          break;
        case 'system':
          await replySplitMessage(message, `System message:\n\n${systemMessage}`);
          break;
        case 'ping':
          // get ms difference
          await pingReply(message);
          break;
        case '':
          break;
        default:
          await message.reply({ content: 'Unknown command, type `.help` for a list of commands' });
          break;
      }

      return;
    }

    if (message.type == MessageType.Default && requiresMention && guild && !content.match(myMention)) return;

    if (message.guild) {
      await guildChannels.fetch();
      await guildMembers.fetch();
    }

    userInput = userInput
      .replace(myMention, '')
      .replace(/<#([0-9]+)>/g, (_, id) => {
        if (guild) {
          const chn = guildChannels.cache.get(id);
          if (chn) return `#${chn.name}`;
        }

        return '#unknown-channel';
      })
      .replace(/<@!?([0-9]+)>/g, (_, id) => {
        if (id == authorID) return authorUsername;
        if (guild) {
          const mem = guildMembers.cache.get(id);
          if (mem) return `@${mem.user.username}`;
        }

        return '@unknown-user';
      })
      .replace(/<:([a-zA-Z0-9_]+):([0-9]+)>/g, (_, name) => `emoji:${name}:`)
      .trim();

    if (userInput.length == 0) return;

    // create conversation
    if (messages[channelID] == null) messages[channelID] = { amount: 0, last: null };

    logDebug(`Starting!`);

    // start typing
    typing = true;
    await messageChannel.sendTyping();
    let typingInterval = setInterval(async () => {
      try {
        await messageChannel.sendTyping();
      } catch (error) {
        if (typingInterval != null) clearInterval(typingInterval);

        typingInterval = null;
      }
    }, 7000);

    let response;
    try {
      // context if the message is not a reply
      if (context == null) context = messages[channelID].last;

      if (useInitialPrompt && messages[channelID].amount == 0) {
        userInput = `${initialPrompt}\n\n${userInput}`;
        logDebug('Adding initial prompt to message');
      }

      // log user's message
      logDebug(`${guild ? `#${channelName}` : 'DMs'} - ${authorUsername}: ${userInput}`);

      // make request to model
      response = await post(servers, randomServer, '/api/generate', {
        model: model,
        prompt: userInput,
        system: systemMessage,
        context,
      });

      if (typeof response != 'string') {
        logDebug(response);
        throw new TypeError('response is not a string, this may be an error with ollama');
      }

      response = response
        .split('\n')
        .filter((e) => !!e)
        .map((e) => JSON.parse(e));
    } catch (error) {
      if (typingInterval != null) clearInterval(typingInterval);

      typingInterval = null;
      throw error;
    }

    if (typingInterval != null) clearInterval(typingInterval);

    typingInterval = null;

    let responseText = response
      .map((e) => e.response)
      .filter((e) => e != null)
      .join('')
      .trim();
    if (responseText.length == 0) responseText = '(No response)';

    logDebug(`Response: ${responseText}`);

    const prefix =
      showStartOfConversation && messages[channelID].amount == 0
        ? '> This is the beginning of the conversation, type `.help` for help.\n\n'
        : '';

    // reply (will automatically stop typing)
    const replyMessageIDs = (await replySplitMessage(message, `${prefix}${responseText}`)).map((msg) => msg.id);

    // add response to conversation
    context = response.filter((e) => e.done && e.context)[0].context;
    for (let i = 0; i < replyMessageIDs.length; ++i) messages[channelID][replyMessageIDs[i]] = context;

    messages[channelID].last = context;
    ++messages[channelID].amount;
  } catch (error) {
    if (typing)
      try {
        // return error
        await message.reply({ content: 'Error, please check the console' });
      } catch (ignored) {
        // ignored
      }

    logError(error);
  }
});

client.login(token);

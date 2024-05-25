import { Client, Events, GatewayIntentBits, Message, MessageType, Partials } from 'discord.js';
import { config } from './helpers/Config.js';
import { post } from './helpers/Requests.js';
import { logDebug, logError } from './helpers/Log.js';
import { init } from './helpers/polyfils/All.js';
import { pingReply, sendSplitChannelMessage, sendSplitReplyMessage } from './helpers/Discord.js';

type AiMessage = Message & {
  context: string;
};

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
  botUserID,
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

const messages = {} as AiMessage[];

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
    if (!messages[channelID]) messages[channelID] = [];
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
    if (!authorID || authorID == userID) return;

    // RegExp to match a mention for the bot
    const myMentionRegex = new RegExp(`<@((!?${userID}${botRole ? `)|(&${botRole.id}` : ''}))>`, 'g');

    if (typeof content !== 'string' || content.length == 0) return;

    let context = null;
    if (type == MessageType.Reply) {
      const reply = await message.fetchReference();
      if (!reply) return;
      if (reply.author.id != userID) return;
      if (messages[channelID].length == 0) return;
      if ((context = messages[channelID].find((x) => x.id == reply.id)) == null) return;
    } else if (type != MessageType.Default) return;

    const systemMessages = [];

    if (useModelSystemMessage && modelInfo.system) systemMessages.push(modelInfo.system);

    if (useCustomSystemMessage) systemMessages.push(customSystemMessage);

    // join them together
    const systemMessage = systemMessages.join('\n\n');

    // deal with commands first before passing to LLM
    let userInput = content.replace(new RegExp('^s*' + myMentionRegex.source, ''), '').trim();

    const initialRegex = /talk to <@!?([0-9]+)>/g;
    const initialAskAnotherBotRef = userInput.match(initialRegex);
    let anotherBotRefID = '';
    if (initialAskAnotherBotRef) anotherBotRefID = initialRegex.exec(content)[1];

    // don't respond if your the bot about to be talked to
    if (anotherBotRefID == botUserID) return;

    const followUpRegex = /talking to <@!?([0-9]+)>/g;
    const followUpAskAnotherBotRef = userInput.match(followUpRegex);
    if (followUpAskAnotherBotRef) anotherBotRefID = authorID;

    userInput = content
      .replace(new RegExp(/<*@([0-9A-Za-z]+)>*/g), '')
      .replace(new RegExp(/talk(ing)* to /g), '')
      .trim();

    // only when author is bot and there is another bot we care about
    if (authorBot && anotherBotRefID == null) return;

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
            const cleared = messages[channelID].length;

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
          await sendSplitReplyMessage(message, `System message:\n\n${systemMessage}`);
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

    if (message.type == MessageType.Default && requiresMention && guild && !content.match(myMentionRegex)) return;

    if (message.guild) {
      await guildChannels.fetch();
      await guildMembers.fetch();
    }

    userInput = userInput
      .replace(myMentionRegex, '')
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
      if (context == null) context = messages[channelID].last?.context;

      if (useInitialPrompt && messages[channelID].length == 0) {
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
      showStartOfConversation && messages[channelID].length == 0
        ? '> This is the beginning of the conversation, type `.help` for help.\n\n'
        : '';

    context = response.filter((e) => e.done && e.context)[0].context;

    // TODO workout if were looping and early out?
    const allContent = messages[channelID].map((x) => x.content).filter((x) => x);
    const duplicates = allContent.filter((item, index) => allContent.indexOf(item) !== index);

    if (duplicates.length > 0) {
      logDebug(`Duplicates found are ${JSON.stringify(duplicates)}`);
      messages[channelID].push({
        ...(await messageChannel.send(`Okay were going around in circles stopping....`)),
        context,
      });
    } else if (anotherBotRefID)
      messages[channelID].push(
        ...(
          await sendSplitChannelMessage(messageChannel, `talking to <@${anotherBotRefID}> ${prefix}${responseText}`)
        ).map((x) => ({ ...x, context }))
      );
    else
      messages[channelID].push(
        ...(await sendSplitReplyMessage(message, `${prefix}${responseText}`)).map((x) => ({ ...x, context }))
      );
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

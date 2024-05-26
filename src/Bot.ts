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
  requiresMention,
  servers,
  showStartOfConversation,
  initialPrompt,
  token,
  model,
  randomServer,
  botUserID,
  botChatsCountLimit,
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

//  TODO: make / commands
// client.once('ready', () => {
//   // Register a new slash command
//   client.guilds.cache.get('your-guild-id').commands.create({
//     name: 'ping',
//     description: 'Replies with Pong!',
//   });
// });

// client.on('interactionCreate', async interaction => {
//   if (!interaction.isCommand()) return;

//   const { commandName } = interaction;

//   if (commandName === 'ping') {
//     await interaction.reply('Pong!');
//   }
// });

const handleCommands = async (
  userInput: string,
  message: Message,
  messages: Message[],
  channelID: string,
  systemMessage: string
): Promise<void> => {
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
};

const regexMatch = (guildMembers): RegExp => {
  const {
    me: {
      roles: { botRole },
    },
  } = guildMembers;

  const {
    user: { id: userID },
  } = client;

  return new RegExp(`<@((!?${userID}${botRole ? `)|(&${botRole.id}` : ''}))>`, 'g');
};

const regexps = {
  atSymbols: /<*@([0-9A-Za-z]+)>*/g,
  emojiMatcher: /<:([a-zA-Z0-9_]+):([0-9]+)>/g,
  botTalking: /talk to /g,
  txt2img: /txt2img/g,
  channel: /<#([0-9]+)>/g,
  botTalkingFull: /talk to <@!?([0-9]+)>/g,
};

const cleanInputText = (content: string, message: Message): string => {
  const { guild } = message;
  const { channels: guildChannels, members: guildMembers } = guild;
  const myMentionRegex = regexMatch(guildMembers);

  return (
    content
      // remove yourself from input
      .replace(myMentionRegex, '')
      // remove channel
      .replace(regexps.channel, (_, id) => {
        if (guild) {
          const chn = guildChannels.cache.get(id);
          if (chn) return `#${chn.name}`;
        }

        return '#unknown-channel';
      })
      .replace(regexps.atSymbols, '')
      // convert emojis
      .replace(regexps.emojiMatcher, (_, name) => `emoji:${name}:`)
      // remove self again?
      .replace(new RegExp('^s*' + myMentionRegex.source, ''), '')
      // remove any @refs
      .replace(regexps.emojiMatcher, '')
      // remove the bot to bot triggers
      .replace(regexps.botTalking, '')
      // remove the txt2img trigger
      .replace(regexps.txt2img, '')
      .trim()
  );
};

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
    logDebug(`Message Received!`);

    const { id: channelID } = messageChannel;
    if (!messages[channelID]) messages[channelID] = [];
    const { channels: guildChannels, members: guildMembers } = guild;
    let channelName = 'N/A';
    if ('name' in messageChannel) channelName = messageChannel.name;

    const {
      user: { id: userID },
    } = client;

    // return if not in the right channel
    if (guild && !channels.includes(channelID)) return;

    // return if user is a bot, or non-default message
    if (!authorID || authorID == userID) return;

    const myMentionRegex = regexMatch(guildMembers);

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

    if (customSystemMessage) systemMessages.push(customSystemMessage);

    // join them together
    const systemMessage = systemMessages.join('\n\n');

    let talkingBotRefID = '';
    //  theres a bug here?
    // check if were stating a talk to session
    if (content.match(regexps.botTalkingFull)) talkingBotRefID = regexps.botTalkingFull.exec(content)[1];
    // don't respond if your the bot being talked to and a bot didn't say it
    if (talkingBotRefID != '' && talkingBotRefID == botUserID && !authorBot) return;
    // when author is bot and talk matches then use author as its another bot
    if (authorBot && content.match(regexps.botTalkingFull)) talkingBotRefID = authorID;

    const requestingImage = content.match(regexps.txt2img)?.length > 0;

    // only when author is bot and there is another bot we care about
    if (authorBot && talkingBotRefID == null) return;

    // may change this to slash commands in the future
    // i'm using regular text commands currently because the bot interacts with text content anyway
    await handleCommands(content, message, messages, channelID, systemMessage);

    if (message.type == MessageType.Default && requiresMention && guild && !content.match(myMentionRegex)) return;

    if (message.guild) {
      await guildChannels.fetch();
      await guildMembers.fetch();
    }

    let userInput = cleanInputText(content, message);

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

      if (initialPrompt && messages[channelID].length == 0) {
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

    const allContent = messages[channelID].map((x) => x.content).filter((x) => x);
    const duplicates = allContent.filter((item, index) => allContent.indexOf(item) !== index);
    const botChatsCount = messages[channelID].filter((item) => item.botChats).length;

    if (duplicates.length > 0 || botChatsCount > botChatsCountLimit) {
      const botResponseText =
        duplicates.length > 0
          ? `Okay were going around in circles stopping....`
          : `Sorry we have hit our limit of ${botChatsCount} chats`;

      messages[channelID].push({
        ...(await messageChannel.send(botResponseText)),
        context,
        botChats: false,
      });
    } else if (talkingBotRefID)
      messages[channelID].push(
        ...(
          await sendSplitChannelMessage(messageChannel, `talk to <@${talkingBotRefID}> ${prefix}${responseText}`)
        ).map((x) => ({ ...x, context, botChats: true }))
      );
    else
      messages[channelID].push(
        ...(await sendSplitReplyMessage(message, `${prefix}${responseText}`)).map((x) => ({
          ...x,
          context,
          botChats: false,
        }))
      );

    if (requestingImage) {
      const last = messages[channelID][messages[channelID].length - 1];
      messages[channelID].push(
        ...(await sendSplitChannelMessage(messageChannel, `/txt2img prompt:${last.content}`)).map((x) => ({
          ...x,
          context,
          botChats: false,
        }))
      );
    }
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

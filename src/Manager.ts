import { ShardingManager, Events, Shard } from 'discord.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Logger, LogLevel } from 'meklog';
import { config } from './helpers/Config.js';

export const init = (metaUrl: string): void => {
  const { production, token } = config;
  const log = new Logger(production, 'Shard Manager');

  log(LogLevel.Info, 'Loading');

  const filePath = path.join(path.dirname(fileURLToPath(metaUrl)), 'build', 'Bot.js');
  const manager = new ShardingManager(filePath, { token });

  manager.on('shardCreate', async (shard: Shard): Promise<void> => {
    const shardLog = new Logger(production, `Shard #${shard.id}`);

    shardLog(LogLevel.Info, 'Created shard');

    shard.once(Events.ClientReady, async (): Promise<void> => {
      shard.send({ shardID: shard.id, logger: shardLog.data });

      shardLog(LogLevel.Info, 'Shard ready');
    });
  });

  manager.spawn();
};

import 'dotenv/config';
import path from 'node:path';
import { Client, Collection, GatewayIntentBits } from 'discord.js';
import { globbySync } from 'globby';
import type { Command, Event } from './types';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();

const commandFiles = globbySync(path.join(import.meta.dirname, '/commands/**/*.ts'));
const eventFiles = globbySync(path.join(import.meta.dirname, '/events/**/*.ts'));

for (const file of commandFiles) {
  const command: Command = await import(file);
  client.commands.set(command.data.name, command);
}

for (const file of eventFiles) {
  const event: Event = await import(file);
  
  if (event.once) {
    client.once(event.name, event.execute);
  } else {
    client.on(event.name, event.execute);
  }
}

client.login(process.env.DISCORD_API_TOKEN);

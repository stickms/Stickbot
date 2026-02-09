import 'dotenv/config';
import path from 'node:path';
import {
  Client,
  Collection,
  GatewayIntentBits,
  REST,
  Routes
} from 'discord.js';
import { globbySync } from 'globby';
import type { Command, Event } from '~/types';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ]
});

client.commands = new Collection();

const commandFiles = globbySync(
  path.join(import.meta.dirname, '/commands/**/*.ts')
);
const eventFiles = globbySync(
  path.join(import.meta.dirname, '/events/**/*.ts')
);

for (const file of commandFiles) {
  const command: Command = await import(file);
  client.commands.set(command.data.name, command);
}

for (const file of eventFiles) {
  const event: Event = await import(file);

  event.once
    ? client.once(event.name, event.execute)
    : client.on(event.name, event.execute);
}

if (process.argv[2] === 'register') {
  const rest = new REST().setToken(process.env.DISCORD_API_TOKEN);
  const commands = client.commands.map((command) => command.data.toJSON());
  const data = await rest.put(
    Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
    { body: commands }
  );
  console.log(
    `Successfully reloaded ${(data as unknown[]).length} application (/) commands.`
  );
}

client.login(process.env.DISCORD_API_TOKEN);

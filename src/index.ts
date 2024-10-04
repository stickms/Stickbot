import * as fs from 'node:fs';
import * as path from 'node:path';
import { Client, GatewayIntentBits, Collection, SlashCommandBuilder, Interaction } from 'discord.js';

import './components/database.js';

const client = new Client({ 
	intents: [
		GatewayIntentBits.Guilds, 
		GatewayIntentBits.GuildMessages, 
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildVoiceStates,
		GatewayIntentBits.GuildMembers
	] 
});

type Command = {
	data: SlashCommandBuilder,
	execute: (_: Interaction) => Promise<void>
}

type Event = {
	name: string,
	once?: boolean,
	execute: (...args: any[]) => Promise<void>
}

const commands: Collection<string, Command> = new Collection();

const commandFiles = fs.readdirSync(path.join(import.meta.dirname, 'commands'));

for (const file of commandFiles) {
	const command: Command = await import(`./commands/${file}`);
	commands.set(command.data.name, command);
}

const eventFiles = fs.readdirSync(path.join(import.meta.dirname, 'events'));

for (const file of eventFiles) {
	const event: Event = await import(`./events/${file}`);
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	} else {
		client.on(event.name, (...args) => event.execute(...args));
	}
}

client.on('interactionCreate', interaction => {
	if (!interaction.isChatInputCommand()) {
		return;
	}

	const command = commands.get(interaction.commandName);
	if (!command) {
		return;
	}
	
	command.execute(interaction).catch(console.error);
});

client.login(process.env.DISCORD_TOKEN);

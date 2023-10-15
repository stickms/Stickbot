import fs from 'node:fs';
import 'dotenv/config';

import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { loadDB } from './components/database.js';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

loadDB();

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
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = await import('./commands/' + file);
	client.commands.set(command.data.name, command);
}

const eventFiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
	const event = await import('./events/' + file);
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	} else {
		client.on(event.name, (...args) => event.execute(...args));
	}
}

client.on('interactionCreate', async interaction => {
	if (!interaction.isChatInputCommand()) {
		return;
	}

	const command = interaction.client.commands.get(interaction.commandName);
	if (!command) {
		return;
	}
	
	await command.execute(interaction).catch(console.error);
});

process.on('unhandledRejection', error => {
	console.error(error);
});

process.on('uncaughtException', error => {
	console.error(error);
});

client.login(process.env.DISCORD_TOKEN);
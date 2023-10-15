import fs from 'node:fs';
import 'dotenv/config';

import { REST, Routes } from 'discord.js';
import { DEV_GUILD } from './components/bot-config.js';

const commands = [];
const devcomms = [];

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = await import('./commands/' + file);

	if (command.dev_guild) devcomms.push(command.data.toJSON());
	else commands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands })
	.then((data) => console.log(`Successfully registered ${data.length} application commands.`))
	.catch(console.error);

rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, DEV_GUILD), { body: devcomms })
	.then((data) => console.log(`Successfully registered ${data.length} development commands.`))
	.catch(console.error);
const fs = require('node:fs');
const path = require('node:path');

const { REST, Routes } = require('discord.js');
const { client_id, discord_token } = require('./config.json');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);
	for (const cmd of command.data) {
		commands.push(cmd.toJSON());
	}
}

const rest = new REST({ version: '10' }).setToken(discord_token);

rest.put(Routes.applicationCommands(client_id), { body: commands })
	.then((data) => console.log(`Successfully registered ${data.length} application commands.`))
	.catch(console.error);
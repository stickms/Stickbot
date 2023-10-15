import { SlashCommandBuilder } from 'discord.js';
import { exportDB } from '../components/database.js'; 

export const data = new SlashCommandBuilder()
	.setName('backup')
	.setDescription('Uploads playerlist data to Discord');

export const dev_guild = true;
        
export async function execute(interaction) {
	const file = {
		attachment: Buffer.from(JSON.stringify(exportDB(), null, 4)),
		name: 'playerlist.json'
	};

	await interaction.reply({
		content: '✅ Backup exported and uploaded!',
		files: [ file ]
	});
}
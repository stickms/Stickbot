import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
	.setName('ping')
	.setDescription('Replies with Pong!');
        
export async function execute(interaction) {
	const start = performance.now();
	const msg = await interaction.reply({ content: 'Pong!', fetchReply: true });
	await msg.edit(`Pong! ${Math.ceil(performance.now() - start)}ms`);	
}
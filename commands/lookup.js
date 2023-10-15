import { SlashCommandBuilder } from 'discord.js';
import { resolveSteamID } from '../components/bot-helpers.js';
import { getProfile } from '../components/profile-builder.js';

export const data = new SlashCommandBuilder()
	.setName('lookup')
	.setDescription('Lookup a Steam Profile!')
	.setDMPermission(false)
	.addStringOption(option => option
		.setName('profile')
		.setDescription('Lookup this Profile')
		.setRequired(true)
	);
    
export async function execute(interaction) {
	await interaction.deferReply();

	const query = interaction.options.getString('profile');
	const steamid = await resolveSteamID(query);

	if (!steamid) {
		return await interaction.editReply({
			content: '❌ Error: Could not find profile.'
		});
	}

	const profile = await getProfile(steamid.getSteamID64(), interaction.guildId);
	if (!profile?.getEmbed()) {
		return await interaction.editReply({
			content: '❌ Error: Could not load profile data.'
		});
	}

	await interaction.editReply({
		embeds: profile.getEmbed(),
		components: profile.getComponents()
	});
}
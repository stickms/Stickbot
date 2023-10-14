const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPlayers } = require('../components/database');
const { getAPICalls } = require('../components/bot-helpers');
const { EMBED_COLOR, INFO_ICON } = require('../components/bot-consts');

module.exports = {
	data: new SlashCommandBuilder()
	.setName('info')
	.setDescription('Some cool bot stats!'),
        
	async execute(interaction) {
    const client = interaction.client;
    if (!client.user) {
			return await interaction.reply({
					content: '❌ Error: Unknown Error when handling interaction.'
			});
		}

	const owner = (await interaction.client.application.fetch()).owner;
	const profiles =  Object.keys(getPlayers()).length;
	const guilds = await interaction.client.guilds.fetch();
	const uptime = Math.floor(interaction.client.uptime / (86_400_000));

	const embed = new EmbedBuilder()
		.setColor(EMBED_COLOR)
		.setAuthor({
			name: client.user.tag,
			iconURL: INFO_ICON
		})
		.setThumbnail(client.user.displayAvatarURL({ size: 512 }))
		.addFields([
			{
				name: 'Bot Owner',
				value: `<@${owner.id}>`,
				inline: true
			},{
				name: 'Servers',
				value: guilds.size.toLocaleString(),
				inline: true
			}, {
				name: 'Steam Profiles',
				value: profiles.toLocaleString(),
				inline: true
			}, {
				name: 'Audio Players',
				value: `${client.voice.adapters.size}`,
				inline: true
			}, {
				name: 'Latency',
				value: client.ws.ping + ' ms',
				inline: true
			}, {
				name: 'Uptime',
				value: uptime.toLocaleString() + ' days',
				inline: true
			}, {
				name: 'Steam API Calls',
				value: getAPICalls().toLocaleString() + ' calls',
				inline: true
			}
		]);
			
		await interaction.reply({ embeds: [ embed ] });
	},
};
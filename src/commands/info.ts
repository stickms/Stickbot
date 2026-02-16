import {
  type APIEmbed,
  type ChatInputCommandInteraction,
  SlashCommandBuilder
} from 'discord.js';
import { playersDB } from '~/lib/db';

export const data = new SlashCommandBuilder()
  .setName('info')
  .setDescription('Some cool bot stats!');

export async function execute(interaction: ChatInputCommandInteraction) {
  const owner = interaction.client.application.owner;
	const profiles = await playersDB.countDocuments();
	const guilds = await interaction.client.guilds.fetch();
	const uptime = Math.floor(interaction.client.uptime / (86_400_000));

  const embed: APIEmbed = {
    color: 0x386662,
    author: {
      name: interaction.client.user.tag,
      url: 'https://github.com/stickms/Stickbot'
    },
    thumbnail: {
      url: interaction.client.user.displayAvatarURL({ size: 512 })
    },
    fields: [
      {
				name: 'Bot Owner',
				value: `<@${owner?.id}>`,
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
				name: 'Latency',
				value: `${interaction.client.ws.ping} ms`,
				inline: true
			}, {
				name: 'Uptime',
				value: `${uptime.toLocaleString()} days`,
				inline: true
			}
    ]
  }

  await interaction.reply({ embeds: [embed], flags: ['SuppressNotifications'] });
}

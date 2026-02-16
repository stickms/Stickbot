import {
  type ChatInputCommandInteraction,
  InteractionContextType,
  SlashCommandBuilder
} from 'discord.js';
import { playersDB } from '~/lib/db';

export const data = new SlashCommandBuilder()
  .setName('export')
  .setDescription('Exports tagged profiles with a specified format')
  .setContexts(InteractionContextType.Guild)
  .addStringOption((option) =>
    option
      .setName('format')
      .setDescription('Export format')
      .setRequired(true)
      .addChoices(
        { name: 'SteamID 64', value: 'id64' },
        { name: 'SteamID 3', value: 'id3' },
        { name: 'SteamID 2', value: 'id2' },
        { name: 'Bot Detector', value: 'bd' }
      )
  )
  .addStringOption((option) =>
    option
      .setName('tag')
      .setDescription('Export profiles with only this tag (def. cheater)')
      .addChoices(
        { name: 'Cheater', value: 'cheater' },
        { name: 'Suspicious', value: 'suspicious' },
        { name: 'Content Creator', value: 'popular' },
        { name: 'Ban Watch', value: 'banwatch' }
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) {
    return;
  }

  const format = interaction.options.getString('format', true);
  const tag = interaction.options.getString('tag') ?? 'cheater';

  const players = await playersDB
    .find({
      [`tags.${interaction.guildId}.${tag}`]: { $exists: true }
    })
    .toArray();

  let content = '';

  if (format === 'bd') {
    content = JSON.stringify(
      {
        $schema:
          'https://raw.githubusercontent.com/PazerOP/tf2_bot_detector/master/schemas/v3/playerlist.schema.json',
        file_info: {
          authors: ['Stickbot'],
          description: `stickbot-${new Date().toLocaleDateString()}`,
          title: 'Stickbot'
        },
        players: players.map((x) => {
          return {
            steamid: x._id,
            attributes: [tag]
          };
        })
      },
      null,
      4
    );
  } else {
    content = players
      .map(({ _id }) => {
        const accountid = Number(BigInt(_id) & BigInt(0xffffffff));

        switch (format) {
          case 'id3':
            return `[U:1:${accountid}]`;
          case 'id2':
            return `STEAM_1:${accountid & 1}:${Math.floor(accountid / 2)}`;
          default:
            return _id;
        }
      })
      .join('\n');
  }

  if (!content) {
    return await interaction.reply({
      content: `❌ Error: No profiles found with tag \`${tag}\``,
      flags: ['Ephemeral']
    });
  }

  const filename = `playerlist${format === 'bd' ? '.stickbot.json' : '.txt'}`;
  const file = { attachment: Buffer.from(content), name: filename };
  const message = `✅ Playerlist successfully exported with tag \`${tag}\``;

  await interaction.reply({ content: message, files: [file] });
}

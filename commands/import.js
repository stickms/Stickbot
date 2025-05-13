import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { setTags, getDocument } from '../components/database.js';
import { httpsGet } from '../components/bot-helpers.js';
import { PROFILE_TAGS } from '../components/bot-consts.js';

import SteamID from 'steamid';

export const data = new SlashCommandBuilder()
  .setName('import')
  .setDescription('Import a list of Steam IDs!')
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addAttachmentOption(option => option
    .setName('list')
    .setDescription('A file with a list of Steam IDs')
    .setRequired(true)
  ).addStringOption(option => option
    .setName('tag')
    .setDescription('Tag to assign each profile with (default: cheater)')
    .setRequired(false)
    .addChoices(...PROFILE_TAGS)
  );
        
export async function execute(interaction) {
  const idlist = interaction.options.getAttachment('list');

  if (!idlist.contentType.includes('text/plain')) {
      return await interaction.reply({
          content: '❌ Error: Not a valid file type.',
          ephemeral: true
      });
  }

  await interaction.deferReply();

  const fulltext = await httpsGet(idlist.url);

  if (!fulltext?.length) {
    const error = fulltext ? 'File was empty' : 'Request timed out';
    return await interaction.editReply({
      content: `❌ Error: ${error}.`,
      ephemeral: true
    });
  }

  const tag = interaction.options.getString('tag') ?? 'cheater';
  const curdate = Math.floor(Date.now() / 1000);

  const steamids = fulltext.split('\n').map(x => x.trim()).filter(x => {
    try { return (new SteamID(x)).isValid() } catch { return false; }
  }).map(x => (new SteamID(x)).getSteamID64());

  await steamids.forEach(async x => {
    let data = await getDocument(x);
    if (data.tags?.[interaction.guildId]?.[tag]) {
      return;
    }

    data.tags = Object.assign({}, data.tags, {
      [interaction.guildId]: {
        [tag]: {
          addedby: interaction.user.id,
          date: curdate
        }
      }
    });

    await setTags(x, interaction.guildId, data.tags[interaction.guildId]);
  });

  await interaction.editReply({
    content: '✅ Successfully imported cheaters.',
    ephemeral: true
  });
}
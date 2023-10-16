import { SlashCommandBuilder } from 'discord.js';
import { PROFILE_TAGS } from '../components/bot-consts.js';
import { getPlayers, getTags } from '../components/database.js';

import SteamID from 'steamid';

export const data = new SlashCommandBuilder()
  .setName('export')
  .setDescription('Exports the cheaterlist with a specified tag and format')
  .setDMPermission(false)
  .addStringOption(option => option
    .setName('format')
    .setDescription('Export playerist for this format')
    .setRequired(true)
    .addChoices(
      { name: 'Steam ID 64', value: 'id64' },
      { name: 'Steam ID 3', value: 'id3' },
      { name: 'Steam ID 2', value: 'id2' },
      { name: 'LMAOBOX', value: 'lbox' },
      { name: 'Cathook', value: 'cat' }
    )
  ).addStringOption(
    option => option.setName('tag')
    .setDescription('Export this tag only (default: \"cheater\")')
    .setRequired(false)
    .addChoices(...PROFILE_TAGS)
  );
        
export async function execute(interaction) {
  let fmt = interaction.options.getString('format');
  let tag = interaction.options.getString('tag') ?? 'cheater';

  let result = (await getPlayers()).map(async x => {
    if (!(await getTags(x._id, interaction.guildId)[tag])) {
      return '';
    }

    const steamid = new SteamID(x._id);

    switch(fmt) {
      case 'id64':
        return steamid.getSteamID64() + '\n';
      case 'id3':
        return steamid.getSteam3RenderedID() + '\n';
      case 'id2':
        return steamid.getSteam2RenderedID() + '\n';
      case 'lbox':
        return `${steamid.accountid.toString(16).toUpperCase()};10;`;
      case 'cat':
        return `cat_pl_add ${steamid.accountid} RAGE\n`;
    }
  }).join('');

  if (result.length == 0) {
    return await interaction.reply({
      content: '❌ Error: There are no profiles with that tag.',
      ephemeral: true
    });
  }

  const filename = 'playerlist' + (fmt == 'cat' ? '.cfg' : '.txt');
  const file = { attachment: Buffer.from(result), name: filename };
  let message = `✅ Playerlist successfully exported with tag \`${tag}\`\n`;

  if (fmt == 'lbox') {
    message +=  "\u2139\uFE0F Paste the export after \`c1 = \` ";
    message += "under the [pl] section of your config in \`%localappdata%\`\n";
  }

  await interaction.reply({ content: message, files: [ file ] });
}
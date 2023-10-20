import { SlashCommandBuilder } from 'discord.js';
import { PROFILE_TAGS } from '../components/bot-consts.js';
import { getAllDocuments } from '../components/database.js';

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
      { name: 'Bot Detector', value: 'bd' }
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

  let content;
  const profiles = (await getAllDocuments()).filter(x => {
    return x.tags?.[interaction.guildId]?.[tag];
  });

  if (fmt === 'bd') {
    content = JSON.stringify({
      $schema: 'https://raw.githubusercontent.com/PazerOP/tf2_bot_detector/master/schemas/v3/playerlist.schema.json',
      file_info: {
        authors: [ 'Stick' ],
        description: `stickbot-${new Date().toLocaleDateString()}`,
        title: 'Stickbot'
      },
      players: profiles.map(x => {
        return {
          steamid: x._id,
          attributes: [ tag ]
        }
      })
    }, null, 4);
  } else {
    content = profiles.map(x => {
      const steamid = new SteamID(x._id);

      switch(fmt) {
        case 'id64':
          return steamid.getSteamID64() + '\n';
        case 'id3':
          return steamid.getSteam3RenderedID() + '\n';
        case 'id2':
          return steamid.getSteam2RenderedID() + '\n';
        }
    }).join('');  
  }

  if (!content.length) {
    return await interaction.reply({
      content: '❌ Error: There are no profiles with tag \`${tag}\`',
      ephemeral: true
    });
  }

  const filename = 'playerlist' + (fmt === 'bd' ? '.stickbot.json' : '.txt');
  const file = { attachment: Buffer.from(content), name: filename };
  let message = `✅ Playerlist successfully exported with tag \`${tag}\`\n`;

  await interaction.reply({ content: message, files: [ file ] });
}
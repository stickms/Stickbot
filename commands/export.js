const { SlashCommandBuilder } = require('discord.js');
const { PROFILE_TAGS } = require('../components/bot-consts.js');
const { getPlayers, getTags } = require('../components/database');
const SteamID = require('steamid');

module.exports = {
	data: new SlashCommandBuilder()
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
    ),
        
	async execute(interaction) {
    let fmt = interaction.options.getString('format');
    let tag = interaction.options.getString('tag') ?? 'cheater';

    let result = Object.keys(getPlayers()).map(id64 => {
      if (!getTags(id64, interaction.guildId)[tag]) {
        return '';
      }

      const steamid = new SteamID(id64);

      switch(fmt) {
        case 'id64':
          return id64 + '\n';
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
	},
};
const { SlashCommandBuilder, MessageAttachment } = require('discord.js');
const CONSTS = require('../bot-consts.js');
const fs = require('fs');
const SteamID = require('steamid');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('export')
		.setDescription('Exports the cheaterlist with a specified tag and format')
        .addStringOption(option => option.setName('format')
            .setDescription('Export playerist for this format')
            .setRequired(true)
            .addChoices(
                { name: 'Steam ID3', value: 'id3' },
                { name: 'Steam ID64', value: 'id64' },
                { name: 'Steam ID2', value: 'id2' },
                { name: 'LMAOBOX', value: 'lbox' },
                { name: 'Cathook', value: 'cat' }
            ))
        .addStringOption(option => option.setName('tag')
            .setDescription('Export this tag only (def. \"Cheater\")')
            .setRequired(false)
            .addChoices(...CONSTS.VALID_TAGS)),
        
	async execute(interaction) {
        let plist = JSON.parse(fs.readFileSync('./playerlist.json'));  
        let fmt = interaction.options.getString('format');
        let tag = interaction.options.getString('tag') ?? 'cheater';

        let result = '';

        for (let steamid of Object.keys(plist)) {
            if (!plist[steamid].tags.hasOwnProperty(tag)) {
               continue;
            }

            let conv = new SteamID(steamid);

            switch (fmt) {
                case 'id64':
                    result += steamid;
                    break;
                case 'id3':
                    result += conv.getSteam3RenderedID();
                    break;
                case 'id2':
                    result += conv.getSteam2RenderedID();
                    break;
                case 'lbox':
                    result += `${conv.accountid.toString(16)};10;`;
                    break;
                case 'cat':
                    result += `cat_pl_add ${conv.accountid} RAGE`;
                    break;
            }

            if (fmt != 'lbox') {
                result += '\n';
            }
        }

        let filename = fmt == 'cat' ? 'playerlist.cfg' : 'playerlist.txt';
        let file = { attachment: Buffer.from(result), name: filename };
        await interaction.reply({ content: '✅ Successfully exported ', files: [ file ] })
	},
};
const { SlashCommandBuilder } = require('discord.js');
const CONSTS = require('../bot-consts.js');
const SteamID = require('steamid');
const { db } = require('../database')

module.exports = {
	data: [ 
        new SlashCommandBuilder()
		.setName('export')
		.setDescription('Exports the cheaterlist with a specified tag and format')
        .addStringOption(
            option => option.setName('format')
            .setDescription('Export playerist for this format')
            .setRequired(true)
            .addChoices(
                { name: 'Steam ID 64', value: 'id64' },
                { name: 'Steam ID 3', value: 'id3' },
                { name: 'Steam ID 2', value: 'id2' },
                { name: 'LMAOBOX', value: 'lbox' },
                { name: 'Cathook', value: 'cat' }
            )
        )
        .addStringOption(
            option => option.setName('tag')
            .setDescription('Export this tag only (def. \"Cheater\")')
            .setRequired(false)
            .addChoices(...CONSTS.TAGS)
        )
    ],
        
	async execute(interaction) {
        let fmt = interaction.options.getString('format');
        let tag = interaction.options.getString('tag') ?? 'cheater';

        let result = Object.keys(db.players).map(x => {
            if (!db.players[x].tags[interaction.guildId]?.[tag]) {
                return '';
            }

            let steamid = new SteamID(x);

            switch(fmt) {
                case 'id64':
                    return x + '\n';
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

        let filename = fmt == 'cat' ? 'playerlist.cfg' : 'playerlist.txt';
        let file = { attachment: Buffer.from(result), name: filename };
        let message = `✅ Playerlist successfully exported with tag \`${tag}\`\n`;

        if (fmt == 'lbox') {
            message += "\u2139\uFE0F Paste the export after \"c1 = \" " 
                + "under the [pl] section of your config in `%localappdata%`\n";
        }

        await interaction.reply({ content: message, files: [ file ] });
	},
};
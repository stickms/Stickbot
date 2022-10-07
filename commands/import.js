const { SlashCommandBuilder } = require('discord.js');
const { newProfileEntry } = require('../bot-helpers.js');
const axios = require('axios').default;
const SteamID = require('steamid');
const fs = require('node:fs');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('import')
		.setDescription('Import a list of Steam IDs!')
        .addAttachmentOption(option => 
            option.setName('list')
                .setDescription('A file with a list of Steam IDs')
                .setRequired(true)
            ),
        
	async execute(interaction) {
		let idlist = interaction.options.getAttachment('list');

        await interaction.client.application.fetch();
        if (interaction.user.id != interaction.client.application.owner.id) {
            await interaction.reply({ content: '❌ Error: This command is only for the bot owner.', ephemeral: true });
            return;
        }

        if (!idlist.contentType.includes('text/plain')) {
            await interaction.reply({ content: '❌ Error: Not a valid file type.', ephemeral: true });
            return;
        }

        let fulltext = (await axios.get(idlist.url, { timeout: 5000 })).data;
        let plist = JSON.parse(fs.readFileSync('./playerlist.json'));

        for (let line of fulltext.split('\n')) {
            try {
                let steamid = new SteamID(line);
                plist[steamid.getSteamID64()] = await newProfileEntry(steamid);
            } catch (error) {
                console.log(`error parsing line: ${line}`);
            }
        }

        fs.writeFileSync('./playerlist.json', JSON.stringify(plist, null, '\t'));
	},
};
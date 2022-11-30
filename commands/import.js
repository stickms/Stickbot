const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { setTags, getTags } = require('../database');
const axios = require('axios');
const SteamID = require('steamid');

module.exports = {
	data: new SlashCommandBuilder()
    .setName('import')
    .setDescription('Import a list of Steam IDs!')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addAttachmentOption(option => option
        .setName('list')
        .setDescription('A file with a list of Steam IDs')
        .setRequired(true)
    ),
        
	async execute(interaction) {
		let idlist = interaction.options.getAttachment('list');

        if (!idlist.contentType.includes('text/plain')) {
            return await interaction.reply({
                content: '❌ Error: Not a valid file type.',
                ephemeral: true
            });
        }

        let fulltext = (await axios.get(idlist.url, { timeout: 5000 })).data;
        let curdate = Math.floor(Date.now() / 1000);

        for (let line of fulltext.split('\n')) {
            try {
                let steamid = (new SteamID(line)).getSteamID64();
                let curtags = getTags(steamid, interaction.guildId);

                if (!curtags['cheater']) {
                    curtags['cheater'] = {
                        addedby: interaction.user.id,
                        date: curdate
                    };

                    setTags(steamid, interaction.guildId, curtags);
                }
            } catch (error) {
                console.log(`error parsing line: ${line}`);
            }
        }

        await interaction.reply({ content: '✅ Successfully imported cheaters.', ephemeral: true });
	},
};
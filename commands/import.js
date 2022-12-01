const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { setTags, getTags } = require('../database');
const axios = require('axios');
const SteamID = require('steamid');
const CONSTS = require('../bot-consts');

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
    )
    .addStringOption(option => option
        .setName('tag')
        .setDescription('Tag to assign each listed player with (def. cheater)')
        .setRequired(false)
        .addChoices(...CONSTS.TAGS)
    ),
        
	async execute(interaction) {
		const idlist = interaction.options.getAttachment('list');

        if (!idlist.contentType.includes('text/plain')) {
            return await interaction.reply({
                content: '❌ Error: Not a valid file type.',
                ephemeral: true
            });
        }

        await interaction.deferReply();

        let fulltext = '';
        try {
            fulltext = (await axios.get(idlist.url, { timeout: CONSTS.REQ_TIMEOUT })).data;
        } catch (error) {
            return await interaction.editReply({
                content: '❌ Error: Request timed out.',
                ephemeral: true
            });
        }

        if (fulltext.length == 0) {
            return await interaction.editReply({
                content: '❌ Error: File was empty.',
                ephemeral: true
            });
        }

        const tag = interaction.options.getString('tag') ?? 'cheater';
        const curdate = Math.floor(Date.now() / 1000);

        for (let line of fulltext.split('\n')) {
            try {
                let steamid = (new SteamID(line)).getSteamID64();
                let curtags = getTags(steamid, interaction.guildId);

                if (!curtags[tag]) {
                    curtags[tag] = {
                        addedby: interaction.user.id,
                        date: curdate
                    };

                    await setTags(steamid, interaction.guildId, curtags);
                }
            } catch (error) {
                continue;
            }
        }

        await interaction.editReply({
            content: '✅ Successfully imported cheaters.',
            ephemeral: true
        });
	},
};
const { createProfile } = require('../profile-builder.js');

module.exports = {
	name: 'messageCreate',
	async execute(message) {
        if (message.author.bot || message.content.length > 200) {
            return;
        }

        try {
            const url = new URL(message.content);
            if (!url.hostname.endsWith('steamcommunity.com')) {
                return;
            }

            if (!url.pathname.startsWith('/profiles/') && 
                !url.pathname.startsWith('/id/')) {
                return;
            }

            const steamid = url.pathname.split('/')[2];

            let builder = await createProfile(steamid, message.guildId);
            let embed = await builder.getProfileEmbed();
            if (!embed) {
                return;
            }

            let comps = null;
            if (message.guildId) {
                comps = await builder.getProfileComponents();
            }

            await message.suppressEmbeds();
            await message.reply({
                embeds: embed,
                components: comps,
                allowedMentions: { repliedUser: false }
            });
        } catch (error) {
            return; // Not a valid URL, or does not have the necessary permissions
        }
    },
};
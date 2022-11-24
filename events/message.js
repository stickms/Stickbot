const { createProfile } = require('../profile-builder.js');

module.exports = {
	name: 'messageCreate',
	async execute(message) {
        if (message.author.bot) {
            return;
        }

        let words = message.content.split(' ');
        if (words.length > 100) {
            return;
        }

        for (let word of words) {
            if (!word.startsWith('https://steamcommunity.com/id/') &&
                !word.startsWith('https://steamcommunity.com/profiles/')) {
                continue;
            }

            let profileid = word.split('/')[4];

            let builder = await createProfile(message.guildId, profileid);
            let embed = await builder.getProfileEmbed();
            
            if (!embed) {
                return;
            }

            let comps = await builder.getProfileComponents();

            await message.suppressEmbeds();
            await message.reply({ embeds: embed, components: comps, allowedMentions: { repliedUser: false } });
        }
    },
};
const { getWelcome } = require('../database');
const { formatWelcomeMessage } = require('../bot-helpers');

module.exports = {
	name: 'guildMemberRemove',
	async execute(member) {
		const welcome = getWelcome(member.guild.id);
        if (!welcome?.channel || !welcome?.leave) return;

        const channel = await member.guild.channels.fetch(welcome.channel);
        if (!channel) return;

        try {
            await channel.send({
                content: formatWelcomeMessage(welcome.leave, member),
                allowedMentions: { parse: [] }
            });
        } catch (error) {
            // Likely doesn't have the necessary permissions
        }
	},
};
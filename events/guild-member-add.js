const { getWelcome } = require('../components/database');
const { formatWelcomeMessage } = require('../components/bot-helpers');

module.exports = {
	name: 'guildMemberAdd',
  
	async execute(member) {
    const welcome = getWelcome(member.guild.id);
    if (!welcome?.channel || !welcome?.join) return;

    try {
      const channel = await member.guild.channels.fetch(welcome.channel);
      if (!channel) return;

      await channel.send({
        content: formatWelcomeMessage(welcome.join, member),
        allowedMentions: { parse: [] }
      });
    } catch (error) {
      // Channel has either been deleted or
      // bot doesn't have the necessary permissions
    }
	},
};
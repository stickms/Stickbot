const { getWelcome } = require('../database');
const { formatWelcomeMessage } = require('../bot-helpers');

module.exports = {
  name: 'guildMemberRemove',
  
  async execute(member) {
    const welcome = getWelcome(member.guild.id);
    if (!welcome?.channel || !welcome?.leave) return;

    try {
      const channel = await member.guild.channels.fetch(welcome.channel);
      if (!channel) return;

      await channel.send({
        content: formatWelcomeMessage(welcome.leave, member),
        allowedMentions: { parse: [] }
      });
    } catch (error) {
      // Channel has either been deleted or
      // bot doesn't have the necessary permissions
    }
  },
};
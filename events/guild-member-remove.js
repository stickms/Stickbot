import { getWelcome } from '../components/database.js';
import { formatWelcomeMessage } from '../components/bot-helpers.js';

export const name = 'guildMemberRemove';

export async function execute(member) {
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
}
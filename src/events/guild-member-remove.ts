import { GuildMember, TextChannel } from 'discord.js';
import Database, { DatabaseServerEntry } from '../components/database.js';
import { formatWelcomeMessage } from '../components/util.js';

export const name = 'guildMemberRemove';

export async function execute(member: GuildMember) {
  const entry: DatabaseServerEntry = await Database.serverLookup(
    member.guild.id
  );

  if (!entry?.welcome?.channel || !entry.welcome?.leave) {
    return;
  }

  try {
    const channel = (await member.guild.channels.fetch(
      entry.welcome.channel
    )) as TextChannel;

    if (!channel) {
      return;
    }

    await channel.send({
      content: formatWelcomeMessage(entry.welcome.leave, member),
      allowedMentions: { parse: [] }
    });
  } catch (error) {
    // Channel has either been deleted or
    // bot doesn't have the necessary permissions
    return;
  }
}

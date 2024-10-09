import { GuildMember } from 'discord.js';

export function formatWelcomeMessage(
  message: string,
  member: GuildMember
): string {
  const mapped = {
    '{mention}': `<@${member.user.id}>`,
    '{id}': member.user.id,
    '{server}': member.guild.name,
    '{guild}': member.guild.name,
    '{name}': member.user.username,
    '{nick}': member.nickname ?? member.user.username
  };

  var regex = new RegExp(Object.keys(mapped).join('|'), 'gi');

  return message.replace(regex, (matched) => {
    return mapped[matched];
  });
}

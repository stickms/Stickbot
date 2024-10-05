import { Message } from 'discord.js';
import SteamProfile from '../components/steam-profile.js';

export const name = 'messageCreate';

export async function execute(message: Message) {
  if (!message.guildId || message.author.bot) {
    return;
  }

  if (!message.content.startsWith('https://steamcommunity.com/')) {
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

    const profile = await SteamProfile.create(
      url.pathname.split('/')[2],
      message.guildId
    );

    if (!profile) {
      return;
    }

    await message.suppressEmbeds();
    await message.reply({
      embeds: profile.embeds,
      components: profile.components as [],
      allowedMentions: { parse: [] }
    });
  } catch (error) {
    // Not a valid community URL or profile
    return;
  }
}

import { resolveSteamID } from '../components/bot-helpers.js';
import { getProfile } from '../components/profile-builder.js';

export const name = 'messageCreate';

export async function execute(message) {
  if (message.author.bot || message.content.length > 200) {
    return;
  }

  if (!message.guildId) {
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

    const steamid = await resolveSteamID(url.pathname.split('/')[2]);
    if (!steamid) {
      return;
    }

    const profile = await getProfile(steamid.getSteamID64(), message.guildId);
    if (!profile?.getEmbed()) {
      return;
    }

    await message.suppressEmbeds();
    await message.reply({
      embeds: profile.getEmbed(),
      components: profile.getComponents(),
      allowedMentions: { repliedUser: false }
    });
  } catch (error) {
    // Not a valid URL, or does not have the necessary permissions
  }
}
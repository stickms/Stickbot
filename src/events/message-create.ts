import {
  Events,
  type Message,
  type OmitPartialGroupDMChannel
} from 'discord.js';
import { createProfileEmbed } from '~/lib/steam-profile';

export const name = Events.MessageCreate;

export async function execute(message: OmitPartialGroupDMChannel<Message>) {
  if (message.author.bot) {
    return;
  }

  const url = URL.parse(message.content);

  if (!url?.hostname.endsWith('steamcommunity.com')) {
    return;
  }

  if (
    !url.pathname.startsWith('/id/') &&
    !url.pathname.startsWith('/profiles/')
  ) {
    return;
  }

  const steamId = url.pathname.split('/')[2];
  const profile = await createProfileEmbed(steamId, message.guildId);

  if (!profile) {
    return;
  }

  const { embeds, components } = profile;

  message.suppressEmbeds(true).catch(console.error);
  await message.reply({ embeds, components, flags: ['SuppressNotifications'] });
}

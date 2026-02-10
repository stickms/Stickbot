import {
  Events,
  type Message,
  type OmitPartialGroupDMChannel
} from 'discord.js';
import { createProfileEmbed } from '~/lib/steam-profile';

export const name = Events.MessageCreate;

export async function execute(message: OmitPartialGroupDMChannel<Message>) {
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

  const { embeds, components, sourcebans } = profile;

  message.suppressEmbeds(true);
  const reply = await message.reply({ embeds, components });
  await reply.edit({ embeds: [await sourcebans] });
}

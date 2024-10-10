import {
  BaseInteraction,
  EmbedBuilder,
  MessageComponentInteraction
} from 'discord.js';

import SteamAPI, {
  SteamFriendList,
  SteamProfileSummary
} from '../components/steam-api';

import Database, { DatabasePlayerEntry } from '../components/database';
import Sourcebans from '../components/sourcebans';
import SteamProfile from '../components/steam-profile';

export const name = 'interactionCreate';

export async function execute(interaction: BaseInteraction) {
  if (!(interaction instanceof MessageComponentInteraction)) {
    return;
  }

  if (!interaction.customId.includes(':')) {
    return;
  }

  switch (interaction.customId.split(':')[0]) {
    case 'moreinfo':
      return handleMoreInfo(interaction);
    case 'friends':
      return handleFriends(interaction);
    default:
      break;
  }
}

async function handleMoreInfo(interaction: MessageComponentInteraction) {
  const old_content = interaction.message.content;

  if (old_content.startsWith('Fetching')) {
    await interaction.reply({
      content: '❌ Error: Already fetching more info.',
      ephemeral: true
    });

    return;
  }

  await interaction.update({
    content: 'Fetching additional profile info...'
  });

  const steamid = interaction.customId.split(':')[1];
  const sourcebans = (await Sourcebans.get(steamid))
    .map((x) => {
      return `[${x.url.split('/')[2]} - ${x.reason}](${x.url})`;
    })
    .join('\n');

  const original = interaction.message.embeds[0];
  const moreinfo = await SteamProfile.moreinfo(steamid, interaction.guildId);

  moreinfo.push({
    name: 'Sourcebans',
    value: sourcebans.length ? sourcebans : '✅ None'
  });

  const embed = new EmbedBuilder(original)
    .setFields(
      original.fields.filter(
        (x) => !moreinfo.map((f) => f.name).includes(x.name)
      )
    )
    .addFields(moreinfo);

  await interaction.editReply({
    content: old_content,
    embeds: [embed]
  });
}

async function handleFriends(interaction: MessageComponentInteraction) {
  await interaction.deferReply();

  const steamid = interaction.customId.split(':')[1];
  const friends = await SteamAPI.getFriendList(steamid);

  if (!friends) {
    await interaction.editReply({
      content: '❌ Error grabbing friends.'
    });

    return;
  }

  const documents = await Database.playerLookup(
    friends.map((f: SteamFriendList) => f.steamid)
  );

  if (!documents) {
    await interaction.editReply({
      content: '❌ Error grabbing friends.'
    });

    return;
  }

  const guildid = interaction.guildId;
  const profiles = documents
    .filter((e: DatabasePlayerEntry) => {
      return e.tags[guildid]?.cheater ?? false;
    })
    .map((e: DatabasePlayerEntry) => e._id);

  profiles.unshift(steamid);

  const summaries = (await SteamAPI.getProfileSummaries(
    profiles
  )) as SteamProfileSummary[];

  if (!summaries) {
    await interaction.editReply({
      content: '❌ Error grabbing friends.'
    });

    return;
  }

  const current = summaries.find(
    (p: SteamProfileSummary) => p.steamid == steamid
  );

  const profile_url = 'https://steamcommunity.com/profiles/';

  let embed = new EmbedBuilder()
    .setColor(0x3297a8)
    .setAuthor({
      name: current.personaname,
      iconURL: 'https://i.imgur.com/uO7rwHu.png',
      url: profile_url + steamid
    })
    .setThumbnail(current.avatarfull)
    .addFields({
      name: `${current.personaname}\'s Cheater Friends`,
      value: summaries
        .filter((p: SteamProfileSummary) => p.steamid != steamid)
        .map((p: SteamProfileSummary) => {
          return `[${p.personaname}](${profile_url}${p.steamid}/)`;
        })
        .join('\n')
    });

  await interaction.editReply({ content: null, embeds: [embed] });
}

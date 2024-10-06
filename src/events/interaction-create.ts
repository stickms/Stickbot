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
  console.log(interaction);
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

  const documents = await Database.lookup(
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

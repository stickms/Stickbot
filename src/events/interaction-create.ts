import { BaseInteraction, MessageComponentInteraction } from 'discord.js';
import SteamAPI, { SteamFriendList } from '../components/steam-api';
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

  const documents = await Database.lookupMany(
    friends.map((f: SteamFriendList) => f.steamid)
  );

  if (!documents) {
    await interaction.editReply({
      content: '❌ Error grabbing friends.'
    });

    return;
  }

  const guildid = interaction.guildId;
  const cheaters = documents
    .filter((e: DatabasePlayerEntry) => {
      return e.tags[guildid]?.cheater ?? false;
    })
    .map((e: DatabasePlayerEntry) => e._id);

  console.log(cheaters);
}

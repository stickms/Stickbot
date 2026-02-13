import {
  type APIEmbed,
  AttachmentBuilder,
  type ButtonInteraction,
  Events,
  type Interaction,
  type StringSelectMenuInteraction
} from 'discord.js';
import { playersDB } from '~/lib/db';
import {
  createProfileEmbed,
  getFriends,
  getMoreInfo,
  getNotifications
} from '~/lib/steam-profile';

export const name = Events.InteractionCreate;

export async function execute(interaction: Interaction) {
  if (interaction.isChatInputCommand()) {
    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) {
      return;
    }

    command.execute(interaction).catch(console.error);
  } else if (interaction.isButton()) {
    if (interaction.customId.startsWith('moreinfo')) {
      moreInfoHandler(interaction);
    } else if (interaction.customId.startsWith('notifications')) {
      notificationsButtonHandler(interaction);
    } else if (interaction.customId.startsWith('friends')) {
      friendsHandler(interaction);
    }
  } else if (interaction.isStringSelectMenu()) {
    if (interaction.customId.startsWith('tags')) {
      tagsHandler(interaction);
    } else if (interaction.customId.startsWith('notifications')) {
      notificationsSelectHandler(interaction);
    }
  }
}

async function moreInfoHandler(interaction: ButtonInteraction) {
  const steamId = interaction.customId.split(':')[1];
  const moreInfo = await getMoreInfo(
    steamId,
    interaction.guildId,
    interaction.message.embeds[0]
  );

  await interaction.reply({ embeds: [moreInfo] });
}

async function notificationsButtonHandler(interaction: ButtonInteraction) {
  if (!interaction.guildId) {
    return;
  }

  const steamId = interaction.customId.split(':')[1];
  const embed = interaction.message.embeds[0];
  const component = await getNotifications(
    interaction.user.id,
    steamId,
    interaction.guildId
  );

  await interaction.reply({
    content: `Change notifications for **${embed?.author?.name ?? steamId}**`,
    components: [component],
    ephemeral: true
  });
}

async function friendsHandler(interaction: ButtonInteraction) {
  if (!interaction.guildId) {
    return;
  }

  const steamId = interaction.customId.split(':')[1];
  const guildId = interaction.guildId;

  const friends = (await getFriends(steamId)).map(({ steamid }) => steamid);
  const cheaters = await playersDB
    .find({
      _id: { $in: friends },
      [`tags.${guildId}.cheater`]: { $exists: true }
    })
    .toArray();

  let friendslist = '';

  for (const cheater of cheaters) {
    const names = Object.keys(cheater.names ?? []);
    const name = names.length ? ` - ${names[0]}` : '';
    friendslist += `[${cheater._id}${name}](https://steamcommunity.com/profiles/${cheater._id})\n`;
  }

  const maxLengthIndex = friendslist.lastIndexOf('\n', 4096);

  const personaName = interaction.message.embeds[0].author?.name;
  const embed: APIEmbed = {
    title: `${personaName ?? steamId}'s cheater friends`,
    thumbnail: interaction.message.embeds[0].thumbnail ?? undefined,
    description: friendslist.substring(0, maxLengthIndex)
  };

  const files: AttachmentBuilder[] = [];

  if (friendslist.length > 4096) {
    const buffer = Buffer.from(friendslist, 'utf-8');
    files.push(new AttachmentBuilder(buffer, { name: 'friends.md' }));
  }

  await interaction.reply({ embeds: [embed], files });
}

async function tagsHandler(interaction: StringSelectMenuInteraction) {
  if (!interaction.guildId) {
    return;
  }

  await interaction.deferReply({ flags: ['Ephemeral'] });

  const steamId = interaction.customId.split(':')[1];
  const guildId = interaction.guildId;

  const player = await playersDB.findOne({ _id: steamId });
  const tags = player?.tags?.[guildId] ?? {};

  for (const action of interaction.values) {
    const operation = action.split(':')[0];
    const tag = action.split(':')[1] as keyof typeof tags;

    if (tags[tag] && operation === 'remove') {
      delete tags[tag];
    } else if (!tags[tag] && operation === 'add') {
      tags[tag] = {
        addedby: interaction.user.id,
        date: Math.floor(Date.now() / 1000)
      };
    }
  }

  await playersDB.updateOne(
    {
      _id: steamId
    },
    {
      $set: {
        [`tags.${guildId}`]: tags
      }
    },
    {
      upsert: true
    }
  );

  // Refresh old message embed
  const profile = await createProfileEmbed(steamId, guildId);
  if (profile) {
    const { embeds, components, sourcebans } = profile;
    await interaction.message.edit({ embeds, components });
    sourcebans.then((embed) => interaction.message.edit({ embeds: [embed] }));
  }

  await interaction.editReply({
    content: `✅ Modified tags for **${steamId}**`
  });
}

async function notificationsSelectHandler(
  interaction: StringSelectMenuInteraction
) {
  if (!interaction.guildId) {
    return;
  }

  await interaction.deferUpdate();

  const userId = interaction.user.id;
  const steamId = interaction.customId.split(':')[1];
  const guildId = interaction.guildId;

  const player = await playersDB.findOne({ _id: steamId });
  const notifications = player?.notifications?.[guildId] ?? {};

  for (const action of interaction.values) {
    const operation = action.split(':')[0];
    const tag = action.split(':')[1] as keyof typeof notifications;

    if (notifications[tag]?.includes(userId) && operation === 'remove') {
      notifications[tag] = notifications[tag].filter((id) => id !== userId);
    } else if (!notifications[tag]?.includes(userId) && operation === 'add') {
      notifications[tag] = (notifications[tag] ?? []).concat(userId);
    }
  }

  await playersDB.updateOne(
    { _id: steamId },
    {
      $set: {
        [`notifications.${guildId}`]: notifications
      }
    },
    {
      upsert: true
    }
  );

  await interaction.editReply({
    content: `✅ Edited notification settings for **${steamId}**`,
    components: []
  });
}

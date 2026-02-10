import {
  type ButtonInteraction,
  Events,
  type Interaction,
  type StringSelectMenuInteraction
} from 'discord.js';
import { playersDB } from '~/lib/db';
import { createProfileEmbed, getMoreInfo } from '~/lib/steam-profile';

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
  const steamId = interaction.customId.split(':')[1];
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
  const steamId = interaction.customId.split(':')[1];
}

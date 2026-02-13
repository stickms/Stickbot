import type { Client, TextChannel } from 'discord.js';
import type { DatabasePlayerEntry, SteamProfileSummary } from '~/types';
import { playersDB, serversDB } from './db';
import { createProfileEmbed } from './steam-profile';

export async function updateDatabase(client: Client<true>) {
  const players = (await playersDB.find().toArray()).reduce<
    Record<string, DatabasePlayerEntry>
  >((acc, entry) => {
    acc[entry._id] = entry;
    return acc;
  }, {});

  const playerIds = Object.keys(players);
  const profilePromises: Promise<void>[] = [];
  const banPromises: Promise<void>[] = [];

  const SUMMARY =
    'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/';
  const BANS = 'https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/';

  const summaries: Record<string, Partial<SteamProfileSummary>> = {};

  for (let i = 0; i < playerIds.length; i += 100) {
    const steamIds = playerIds.slice(i, i + 100).join(',');

    const summary_url = `${SUMMARY}?key=${process.env.STEAM_API_TOKEN}&steamids=${steamIds}`;
    const ban_url = `${BANS}?key=${process.env.STEAM_API_TOKEN}&steamids=${steamIds}`;

    profilePromises.push(
      fetch(summary_url)
        .then(
          (res) =>
            res.json() as Promise<{
              response: {
                players: Partial<SteamProfileSummary> & { steamid: string }[];
              };
            }>
        )
        .then((json) => {
          (json.response?.players ?? []).forEach((part) => {
            summaries[part.steamid] = { ...summaries[part.steamid], ...part };
          });
        })
        .catch(console.error)
    );

    banPromises.push(
      fetch(ban_url)
        .then(
          (res) =>
            res.json() as Promise<{
              players: Partial<SteamProfileSummary> & { SteamId: string }[];
            }>
        )
        .then((json) => {
          (json.players ?? []).forEach((part) => {
            summaries[part.SteamId] = { ...summaries[part.SteamId], ...part };
          });
        })
        .catch(console.error)
    );

    // Wait 5 seconds between calls to not spam Steam API
    await new Promise((ex) => setTimeout(ex, 5_000));
  }

  await Promise.allSettled([...profilePromises, ...banPromises]);

  await updateBans(client, players, summaries);
  await updateSummaries(client, players, summaries);
}

async function updateBans(
  client: Client<true>,
  players: Record<string, DatabasePlayerEntry>,
  summaries: Record<string, Partial<SteamProfileSummary>>
) {
  for (const [steamId, player] of Object.entries(players)) {
    const summary = summaries[steamId];

    if (
      !summary || 
      summary.NumberOfVACBans === undefined ||
      summary.NumberOfGameBans === undefined ||
      summary.EconomyBan === undefined ||
      summary.CommunityBanned === undefined
    ) {
      continue;
    }

    const bandata = player.bandata;
    const messages = [];

    if (bandata) {
      if (summary.NumberOfVACBans !== bandata.vacbans) {
        const prefix = summary.NumberOfVACBans > bandata.vacbans ? '' : 'Un-';
        messages.push(`${prefix}VAC Banned`);
        bandata.vacbans = summary.NumberOfVACBans;
      }
      if (summary.NumberOfGameBans !== bandata.gamebans) {
        const prefix = summary.NumberOfGameBans > bandata.gamebans ? '' : 'Un-';
        messages.push(`${prefix}Game Banned`);
        bandata.gamebans = summary.NumberOfGameBans;
      }
      if (summary.CommunityBanned !== bandata.communityban) {
        const prefix = summary.CommunityBanned ? '' : 'Un-';
        messages.push(`${prefix}Community Banned`);
        bandata.communityban = summary.CommunityBanned;
      }
      if ((summary.EconomyBan === 'banned') !== bandata.tradeban) {
        const prefix = summary.EconomyBan === 'banned' ? '' : 'Un-';
        messages.push(`${prefix}Trade Banned`);
        bandata.tradeban = summary.EconomyBan === 'banned';
      }
    }

    await playersDB.updateOne(
      { _id: steamId },
      {
        $set: { bandata }
      },
      {
        upsert: true
      }
    );

    if (!messages.length) {
      continue;
    }

    for (const guildId of Object.keys(player.tags ?? {})) {
      const banwatchId = (await serversDB.findOne({ _id: guildId }))?.banwatch;

      if (!banwatchId) {
        continue;
      }

      const profile = await createProfileEmbed(steamId, guildId);
      if (!profile) {
        continue;
      }

      const { embeds, components } = profile;

      const mentions = (player.notifications?.[guildId]?.ban ?? [])
        .map((userId) => `<@${userId}> `)
        .join(' ');
      const content = `**${steamId}** has been **${messages.join(',')}**\n${mentions}`;

      try {
        const channel = (await client.channels.fetch(banwatchId)) as TextChannel;
        channel?.send({ content, embeds, components });
      } catch (_error) {
        //console.error(_error);
      }
    }
  }
}

async function updateSummaries(
  client: Client<true>,
  players: Record<string, DatabasePlayerEntry>,
  summaries: Record<string, Partial<SteamProfileSummary>>
) {
  for (const [steamId, player] of Object.entries(players)) {
    const summary = summaries[steamId];

    if (!summary) {
      continue;
    }

    const names = player.names ?? {};
    const addresses = player.addresses ?? {};

    let nameChanged = false;
    let serverLogged = false;

    if (summary.personaname) {
      const currentName = Object.entries(names).sort(
        ([, a], [, b]) => b - a
      )[0][0];

      if (summary.personaname !== currentName) {
        names[summary.personaname] = Math.floor(Date.now() / 1000);
        nameChanged = true;
      }

      if (Object.keys(names).length > 6) {
        const sorted = Object.entries(names).sort(([, a], [, b]) => a - b);
        delete names[sorted[0][0]];
      }
    }

    if (
      summary.gameserverip &&
      !Object.keys(addresses).includes(summary.gameserverip)
    ) {
      serverLogged = true;

      addresses[summary.gameserverip] = {
        game: summary.gameextrainfo ?? 'Unknown',
        date: Date.now() / 1000
      };

      if (Object.keys(addresses).length > 6) {
        const sorted = Object.entries(addresses).sort(
          ([, a], [, b]) => a.date - b.date
        );
        delete addresses[sorted[0][0]];
      }
    }

    await playersDB.updateOne(
      { _id: steamId },
      {
        $set: { names, addresses }
      },
      {
        upsert: true
      }
    );

    if (nameChanged) {
      const userIds = new Set(
        Object.values(player.notifications ?? {}).flatMap(
          ({ name }) => name ?? []
        )
      );

      updateNotifications(
        client,
        steamId,
        userIds,
        `**${steamId}** has changed their name`
      );
    }

    if (serverLogged) {
      const userIds = new Set(
        Object.values(player.notifications ?? {}).flatMap(
          ({ log }) => log ?? []
        )
      );

      updateNotifications(
        client,
        steamId,
        userIds,
        `**${steamId}** has a new server log`
      );
    }
  }
}

async function updateNotifications(
  client: Client<true>,
  steamId: string,
  userIds: Set<string>,
  content: string
) {
  if (!userIds.size) {
    return;
  }

  const profile = await createProfileEmbed(steamId, null);

  if (!profile) {
    return;
  }

  const { embeds, components } = profile;

  for (const userId of userIds) {
    try {
      const user = await client.users.fetch(userId);
      user?.send({ content, embeds, components });
    } catch (_error) {
      // console.error(_error);
    }
  }
}

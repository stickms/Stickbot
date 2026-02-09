import type { APIEmbed, APIEmbedField } from 'discord.js';
import type { SteamProfileSummary } from '~/types/index';
import { playersDB } from './db';

const tagLabels = {
  cheater: 'Cheater',
  suspicious: 'Suspicious',
  popular: 'Popular',
  banwatch: 'Banwatch'
};

function idList(summary: SteamProfileSummary): APIEmbedField {
  const accountid = Number(BigInt(summary.steamid) & BigInt(0xffffffff));

  const idlist = [
    summary.steamid,
    `[U:1:${accountid}]`,
    `STEAM_1:${accountid & 1}:${Math.floor(accountid / 2)}`
  ];

  if (summary.profileurl.includes('/id/')) {
    idlist.push(summary.profileurl.split('/')[4]);
  }

  return {
    name: 'Steam IDs',
    value: idlist.join('\n'),
    inline: true
  };
}

async function alertList(
  summary: SteamProfileSummary,
  guildId: string | null
): Promise<APIEmbedField> {
  const plural = (num: number, label: string) => {
    return `${num} ${label}${num === 1 ? '' : 's'}`;
  };

  const alertlist: string[] = [
    {
      label: `${plural(summary.NumberOfVACBans, 'VAC Ban')}`,
      show: summary.NumberOfVACBans > 0
    },
    {
      label: `${plural(summary.NumberOfGameBans, 'Game Ban')}`,
      show: summary.NumberOfGameBans > 0
    },
    {
      label: 'Community Ban',
      show: summary.CommunityBanned
    },
    {
      label: 'Trade Ban',
      show: summary.EconomyBan === 'banned'
    }
  ]
    .filter((alert) => alert.show)
    .map((alert) => `❌ ${alert.label}`);

  const player = await playersDB.findOne({ _id: summary.steamid });

  if (player) {
    const tags = Object.keys(player.tags?.[guildId ?? ''] ?? {}).filter(
      (tag) => tag !== 'banwatch'
    );
    alertlist.concat(
      Object.entries(tagLabels)
        .filter((tag) => tags.includes(tag[0]))
        .map(([tag]) => `⚠️ ${tag[1]}`)
    );
  }

  if (summary.timecreated) {
    const created = new Date(summary.timecreated * 1000);
    if (created.getFullYear() <= 2006) {
      alertlist.push(`\u2139\uFE0F Made in ${created.getFullYear()}`);
    }
  }

  if (player?.tags?.[guildId ?? '']?.banwatch) {
    alertlist.push(`\u2139\uFE0F ${tagLabels.banwatch}`);
  }

  if (!alertlist.length) {
    alertlist.push('✅ None');
  }

  return {
    name: 'Alerts',
    value: alertlist.join('\n'),
    inline: true
  };
}

function quickLinks(summary: SteamProfileSummary): APIEmbedField {
  const links = {
    SteamHistory: 'https://steamhistory.net/id/',
    'SteamID.uk': 'https://steamid.uk/profile/',
    SteamDB: 'https://steamdb.info/calculator/',
    'Backpack.tf': 'https://backpack.tf/profiles/',
    'Open in Client': 'https://stickbot.net/open-profile/'
  };

  const quicklinks = Object.entries(links).map(
    ([label, url]) => `[${label}](${url + summary.steamid})`
  );

  return {
    name: 'Steam IDs',
    value: quicklinks.join('\n'),
    inline: true
  };
}

export async function createProfileEmbed(
  steamId: string,
  guildId: string | null
): Promise<APIEmbed> {
  const response = await fetch(
    `https://stickbot.net/api/steam/lookup/${steamId}`
  );

  if (!response.ok) {
    throw new Error('Could not get profile info');
  }

  const summary = (await response.json()) as SteamProfileSummary;

  const fields = [
    idList(summary),
    await alertList(summary, guildId),
    quickLinks(summary)
  ];

  if (summary.gameextrainfo) {
    fields.push({
      name: 'Now Playing',
      value:
        summary.gameextrainfo +
        (!!summary.gameserverip && ` on \`${summary.gameserverip}\``)
    });
  }

  return {
    color: 0x386662,
    title: summary.personaname,
    thumbnail: { url: summary.avatarfull },
    fields
  };
}

import {
  type APIActionRowComponent,
  type APIButtonComponent,
  type APIEmbed,
  type APIEmbedField,
  type APIMessageComponent,
  type APISelectMenuOption,
  type APIStringSelectComponent,
  ButtonStyle,
  ComponentType,
  type Embed
} from 'discord.js';
import type {
  DatabasePlayerEntry,
  Sourceban,
  SteamFriendsList,
  SteamProfileSummary
} from '~/types/index';
import { playersDB } from './db';

const tagLabels = {
  cheater: 'Cheater',
  suspicious: 'Suspicious',
  popular: 'Popular',
  banwatch: 'Banwatch'
};

const eventLabels = {
  ban: 'Ban',
  name: 'Name Change',
  log: 'Server Log'
};

function steamIdsField(summary: SteamProfileSummary): APIEmbedField {
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

function alertsField(
  summary: SteamProfileSummary,
  dbdata: DatabasePlayerEntry | null,
  guildId: string | null,
  numFriends: number
): APIEmbedField {
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

  if (dbdata && guildId) {
    const tags = Object.keys(dbdata.tags?.[guildId] ?? {}).filter(
      (tag) => tag !== 'banwatch'
    );

    Object.entries(tagLabels)
      .filter((tag) => tags.includes(tag[0]))
      .forEach((tag) => {
        alertlist.push(`⚠️ ${tag[1]}`);
      });
  }

  if (numFriends) {
    alertlist.push(`⚠️ Friends with ${plural(numFriends, 'cheater')}`);
  }

  if (summary.timecreated) {
    const created = new Date(summary.timecreated * 1000);
    if (created.getFullYear() <= 2006) {
      alertlist.push(`\u2139\uFE0F Made in ${created.getFullYear()}`);
    }
  }

  if (guildId && dbdata?.tags?.[guildId]?.banwatch) {
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

function quickLinksField(summary: SteamProfileSummary): APIEmbedField {
  const links = {
    'SteamHistory': 'https://steamhistory.net/id/',
    'SteamID.uk': 'https://steamid.uk/profile/',
    'SteamDB': 'https://steamdb.info/calculator/',
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

function tagSelect(
  summary: SteamProfileSummary,
  dbdata: DatabasePlayerEntry | null,
  guildId: string | null
): APIMessageComponent[] {
  if (!guildId) {
    return [];
  }

  const options: APISelectMenuOption[] = Object.entries(tagLabels).map(
    ([tag, label]) => {
      const hasTag = Object.keys(dbdata?.tags?.[guildId] ?? {}).includes(tag);
      return {
        value: hasTag ? `remove:${tag}` : `add:${tag}`,
        label: hasTag ? `Remove ${label}` : `Add ${label}`
      };
    }
  );

  return [
    {
      type: ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.StringSelect,
          custom_id: `tags:${summary.steamid}`,
          placeholder: 'Edit tags...',
          max_values: Object.keys(tagLabels).length,
          options
        }
      ]
    }
  ];
}

export async function getSourcebans(
  steamId: string,
  embed: APIEmbed
): Promise<APIEmbed> {
  const response = await fetch(
    `https://stickbot.net/api/steam/sourcebans/${steamId}`
  );

  const field = {
    name: 'Sourcebans',
    value: '❌ Error retrieving sourcebans'
  };

  if (!response.ok) {
    return {
      ...embed,
      fields: [
        ...(embed.fields ?? []).filter(({ name }) => name !== 'Sourcebans'),
        field
      ]
    };
  }

  const sourcebans = ((await response.json()) as Sourceban[]).map((ban) => {
    const hostname = new URL(ban.url).hostname;
    return `[${hostname} - ${ban.reason}](${ban.url})`;
  });

  if (!sourcebans.length) {
    sourcebans.push('✅ None');
  }

  field.value = sourcebans.join('\n');

  return {
    ...embed,
    fields: [
      ...(embed.fields ?? []).filter(({ name }) => name !== 'Sourcebans'),
      field
    ]
  };
}

export async function getFriends(steamId: string) {
  const api_url = `https://api.steampowered.com/ISteamUser/GetFriendList/v1/?steamid=${steamId}&key=${process.env.STEAM_API_TOKEN}`;

  const response = await fetch(api_url);

  // Somehow the only Steam Web API endpoing that properly errors...
  if (!response.ok) {
    return [];
  }

  const friends = (await response.json()) as SteamFriendsList;

  return friends.friendslist.friends;
}

export async function createProfileEmbed(
  steamId: string,
  guildId: string | null
): Promise<{
  embeds: APIEmbed[];
  components: APIMessageComponent[];
} | null> {
  const response = await fetch(
    `https://stickbot.net/api/steam/lookup/${steamId}`
  );

  if (!response.ok) {
    return null;
  }

  const summary = (await response.json()) as SteamProfileSummary;
  const dbdata = await playersDB.findOne({ _id: summary.steamid });

  const friends = (await getFriends(summary.steamid)).map(
    ({ steamid }) => steamid
  );

  const numFriends = guildId
    ? await playersDB.countDocuments({
        _id: { $in: friends },
        [`tags.${guildId}.cheater`]: { $exists: true }
      })
    : 0;

  const fields = [
    steamIdsField(summary),
    alertsField(summary, dbdata, guildId, numFriends),
    quickLinksField(summary)
  ];

  if (summary.gameextrainfo) {
    fields.push({
      name: 'Now Playing',
      value:
        summary.gameextrainfo +
        (summary.gameserverip ? ` on \`${summary.gameserverip}\`` : '')
    });
  }

  const buttons: APIButtonComponent[] = [
    {
      type: ComponentType.Button,
      style: ButtonStyle.Primary,
      custom_id: `sourcebans:${summary.steamid}`,
      label: 'Sourcebans'
    },
    {
      type: ComponentType.Button,
      style: ButtonStyle.Primary,
      custom_id: `moreinfo:${summary.steamid}`,
      label: 'More Info'
    }
  ];

  if (guildId) {
    buttons.push({
      type: ComponentType.Button,
      style: ButtonStyle.Primary,
      custom_id: `notifications:${summary.steamid}`,
      label: 'Notifications'
    });
  }

  if (numFriends) {
    buttons.push({
      type: ComponentType.Button,
      style: ButtonStyle.Primary,
      custom_id: `friends:${summary.steamid}`,
      label: 'List Friends'
    });
  }

  const components: APIMessageComponent[] = [
    {
      type: ComponentType.ActionRow,
      components: buttons
    },
    ...tagSelect(summary, dbdata, guildId)
  ];

  // Force fields to be defined
  const embed: APIEmbed & { fields: APIEmbedField[] } = {
    color: 0x386662,
    author: {
      name: summary.personaname,
      url: `https://steamcommunity.com/profiles/${summary.steamid}`
    },
    thumbnail: { url: summary.avatarfull },
    fields
  };

  return {
    embeds: [embed],
    components: components
  };
}

export async function getMoreInfo(
  steamId: string,
  guildId: string | null,
  embed?: Embed
): Promise<APIEmbed> {
  const fields: APIEmbedField[] = [];

  const player = await playersDB.findOne({ _id: steamId });

  if (player) {
    const addedtags = Object.entries(
      (guildId && player.tags?.[guildId]) ?? {}
    ).map(
      ([tag, data]) => `\`${tag}\` - <@${data.addedby}> on <t:${data.date}:D>`
    );

    const namehistory = Object.entries(player.names ?? {}).map(
      ([name, date]) => `\`${JSON.parse(name)}\` - <t:${date}:D>`
    );

    const addresses = Object.entries(player.addresses ?? {}).map(
      ([ip, { game, date }]) => `\`${ip}\` - ${game} on <t:${date}:D>`
    );

    if (addedtags.length) {
      fields.push({
        name: 'Added Tags',
        value: addedtags.join('\n')
      });
    }

    if (namehistory.length) {
      fields.push({
        name: 'Name History',
        value: namehistory.join('\n')
      });
    }

    if (addresses.length) {
      fields.push({
        name: 'Prior Servers',
        value: addresses.join('\n')
      });
    }
  }

  return {
    color: 0x386662,
    title: `More Info for **${embed?.author?.name ?? steamId}**`,
    thumbnail: embed?.thumbnail ?? undefined,
    description: !fields.length ? 'No database info found...' : undefined,
    fields
  };
}

export async function getNotifications(
  userId: string,
  steamId: string,
  guildId: string
): Promise<APIActionRowComponent<APIStringSelectComponent>> {
  const player = await playersDB.findOne({ _id: steamId });

  const options: APISelectMenuOption[] = (
    Object.entries(eventLabels) as [keyof typeof eventLabels, string][]
  ).map(([event, label]) => {
    const hasEvent = (player?.notifications?.[guildId]?.[event] ?? []).includes(
      userId
    );

    return {
      value: hasEvent ? `remove:${event}` : `add:${event}`,
      label: hasEvent ? `Don't notify on ${label}` : `Notify on ${label}`
    };
  });

  return {
    type: ComponentType.ActionRow,
    components: [
      {
        type: ComponentType.StringSelect,
        custom_id: `notifications:${steamId}`,
        placeholder: 'Edit notifications...',
        max_values: Object.keys(eventLabels).length,
        options: options
      }
    ]
  };
}

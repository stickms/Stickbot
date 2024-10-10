import SteamAPI, {
  SteamFriendList,
  SteamPlayerBans,
  SteamProfileSummary
} from './steam-api.js';
import Database, { DatabasePlayerEntry } from './database.js';
import {
  EmbedBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';

import SteamID from 'steamid';

class SteamProfile {
  private steamid: SteamID;
  private guildid: string;

  private dbdata: DatabasePlayerEntry | null;
  private summary: SteamProfileSummary;
  private bandata: SteamPlayerBans;

  private friends: number;

  constructor(
    steamid: SteamID,
    guildid: string,
    dbdata: DatabasePlayerEntry | null,
    summary: SteamProfileSummary,
    bandata: SteamPlayerBans,
    friends: number
  ) {
    this.steamid = steamid;
    this.guildid = guildid;
    this.dbdata = dbdata;
    this.summary = summary;
    this.bandata = bandata;
    this.friends = friends;
  }

  // Use this instead of constructor() to create new SteamProfile instances
  static async create(
    _steamid: string,
    guildid: string = '-1'
  ): Promise<SteamProfile> {
    const steamid = await SteamProfile.resolveSteamId(_steamid);
    if (!steamid) {
      return null;
    }

    const [dbdata, summary, bandata, friends] = await Promise.all([
      Database.playerLookup(steamid.getSteamID64()),
      SteamAPI.getProfileSummaries(steamid.getSteamID64()),
      SteamAPI.getPlayerBans(steamid.getSteamID64()),
      SteamAPI.getFriendList(steamid.getSteamID64())
    ]);

    if (!summary || !bandata) {
      return null;
    }

    let friendcount = 0;

    if (friends) {
      const tables = await Database.playerLookup(
        friends.map((f: SteamFriendList) => {
          return f.steamid;
        })
      );

      tables &&
        tables.forEach((e: DatabasePlayerEntry) => {
          e.tags[guildid]?.cheater && friendcount++;
        });
    }

    return new SteamProfile(
      steamid,
      guildid,
      dbdata,
      summary as SteamProfileSummary,
      bandata as SteamPlayerBans,
      friendcount
    );
  }

  private static async resolveSteamId(steamid: string) {
    const vanity = await SteamAPI.resolveVanityUrl(steamid);
    if (vanity?.steamid) {
      return new SteamID(vanity.steamid);
    }

    try {
      return new SteamID(steamid);
    } catch (error) {
      return null;
    }
  }

  private getSteamIdList() {
    const idlist = [
      this.steamid.getSteamID64(),
      this.steamid.getSteam3RenderedID(),
      this.steamid.getSteam2RenderedID(true)
    ];

    if (this.summary.profileurl?.includes('/id/')) {
      idlist.push(this.summary.profileurl.split('/')[4]);
    }

    return idlist.join('\n');
  }

  private getBanList() {
    const plural = (num: number, label: string) => {
      return `${num} ${label}${num == 1 ? '' : 's'}`;
    };

    return [
      {
        label: `❌ ${plural(this.bandata.NumberOfVACBans, 'VAC Ban')}`,
        valid: this.bandata.NumberOfVACBans > 0
      },
      {
        label: `❌ ${plural(this.bandata.NumberOfGameBans, 'Game Ban')}`,
        valid: this.bandata.NumberOfGameBans > 0
      },
      {
        label: '❌ Community Ban',
        valid: this.bandata.CommunityBanned
      },
      {
        label: '❌ Trade Ban',
        valid: this.bandata.EconomyBan == 'banned'
      }
    ]
      .filter((x) => x.valid)
      .map((x) => x.label);
  }

  // Returns a string of all of the "quick links" of this profile
  private getLinksList() {
    const links = {
      'SteamRep': 'https://steamrep.com/profiles/',
      'SteamID.uk': 'https://steamid.uk/profile/',
      'Backpack.tf': 'https://backpack.tf/profiles/',
      'SteamDB': 'https://steamdb.info/calculator/',
      'Open in Client': 'https://stickbot.net/openprofile/'
    };

    const id64 = this.steamid.getSteamID64();

    return Object.entries(links)
      .map(([k, v]) => {
        return `[${k}](${v}${id64}/)`;
      })
      .join('\n');
  }

  private getAlertList() {
    const alertlist: string[] = [...this.getBanList()];

    // First, add bot tags
    const tags = this.dbdata?.tags[this.guildid] ?? {};

    // Slice last element as banwatch is added after
    for (const tag of this.#profiletags.filter((e) => e.value != 'banwatch')) {
      if (tags[tag.value]) {
        alertlist.push(`⚠️ ${tag.name}`);
      }
    }

    // Next, list any cheater friends
    if (this.friends > 0) {
      const pl = `cheater${this.friends == 1 ? '' : 's'}`;
      alertlist.push(`⚠️ Friends with ${this.friends} ${pl}`);
    }

    // Ban watch/server logs (TODO) last for visibility
    if (tags['banwatch']) {
      alertlist.push('\u2139\uFE0F Ban Watch');
    }

    if (this.summary.timecreated) {
      const created = new Date(this.summary.timecreated * 1000);

      if (created.getFullYear() <= 2006) {
        alertlist.push(`\u2139\uFE0F Made in ${created.getFullYear()}`);
      }
    }

    return alertlist.length ? alertlist.join('\n') : '✅ None';
  }

  private addGameInfo(embed: EmbedBuilder) {
    if (!this.summary.gameextrainfo) {
      return;
    }

    const gameinfo = `**${this.summary.gameextrainfo}**`;
    const gameip = this.summary.gameserverip;

    embed.addFields({
      name: 'Now Playing',
      value: gameinfo + (gameip ? ` on \`${gameip}\`` : '')
    });
  }

  get #profiletags(): { name: string; value: string }[] {
    return [
      { name: 'Cheater', value: 'cheater' },
      { name: 'Suspicious', value: 'suspicious' },
      { name: 'Content Creator', value: 'popular' },
      { name: 'Ban Watch', value: 'banwatch' }
    ];
  }

  // Get embed
  get embed(): EmbedBuilder {
    const profile_url = 'https://steamcommunity.com/profiles/';

    const embed = new EmbedBuilder()
      .setColor(0x3297a8)
      .setThumbnail(this.summary.avatarfull)
      .setAuthor({
        name: this.summary.personaname,
        iconURL: 'https://i.imgur.com/uO7rwHu.png',
        url: profile_url + this.steamid.getSteamID64()
      })
      .addFields(
        {
          name: 'Steam IDs',
          value: this.getSteamIdList(),
          inline: true
        },
        {
          name: 'Alerts',
          value: this.getAlertList(),
          inline: true
        },
        {
          name: 'Quick Links',
          value: this.getLinksList(),
          inline: true
        }
      );

    this.addGameInfo(embed);

    return embed;
  }

  // Return an array of embeds (for cleaner messages)
  get embeds(): EmbedBuilder[] {
    return [this.embed];
  }

  // Get message components (drop down, etc.)
  get components(): (
    | ActionRowBuilder<StringSelectMenuBuilder>
    | ActionRowBuilder<ButtonBuilder>
  )[] {
    const tagdata = this.dbdata?.tags[this.guildid] ?? {};

    const selectmenu = new StringSelectMenuBuilder()
      .setCustomId(`modifytags:${this.steamid}`)
      .setPlaceholder('Modify User Tags')
      .setMaxValues(this.#profiletags.length);

    for (const tag of this.#profiletags) {
      const label = tagdata[tag.value] ? 'Remove ' : 'Add ';
      const value = tagdata[tag.value] ? 'remove:' : 'add:';

      selectmenu.addOptions({
        label: label + tag.name,
        value: value + tag.value
      });
    }

    const dropdown =
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectmenu);

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents([
      new ButtonBuilder()
        .setCustomId(`moreinfo:${this.steamid}`)
        .setLabel('More Info')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`notifybutton:${this.steamid}`)
        .setLabel('Notifications')
        .setStyle(ButtonStyle.Primary)
    ]);

    if (this.friends > 0) {
      buttons.addComponents(
        new ButtonBuilder()
          .setCustomId(`friends:${this.steamid}`)
          .setLabel('List Friends')
          .setStyle(ButtonStyle.Primary)
      );
    }

    return [dropdown, buttons];
  }

  static async moreinfo(
    steamid: string,
    guildid: string
  ): Promise<{ name: string; value: string }[]> {
    const dbdata = await Database.playerLookup(steamid);
    if (!dbdata) {
      return [];
    }

    const fields: { name: string; value: string }[] = [];

    const tagdata = dbdata.tags?.[guildid] ?? {};
    const taglist = Object.entries(tagdata).map(([k, v]) => {
      return `\`${k}\` - <@${v.addedby}> on <t:${v.date}:D>`;
    });

    const namedata = dbdata.names ?? [];
    const namelist = Object.entries(namedata)
      .map(([k, v]) => [k, v])
      .sort(function (a, b) {
        return b[1] - a[1];
      })
      .map(([k, v]) => {
        return `\`${JSON.parse(k)}\` - <t:${v}:D>`;
      });

    const addrdata = dbdata.addresses ?? [];
    const addrlist = Object.entries(addrdata)
      .map(([k, v]) => [k, v])
      .sort(function (a, b) {
        return b[1].date - a[1].date;
      })
      .map(([k, v]) => {
        return `\`${k}\` - *${v.game}* on <t:${v.date}:D>`;
      });

    if (taglist?.length) {
      fields.push({
        name: 'Added Tags',
        value: taglist.join('\n')
      });
    }

    if (namelist?.length) {
      fields.push({
        name: 'Name History',
        value: namelist.join('\n')
      });
    }

    if (addrlist?.length) {
      fields.push({
        name: 'Logged Servers',
        value: addrlist.join('\n')
      });
    }

    return fields;
  }
}

export default SteamProfile;

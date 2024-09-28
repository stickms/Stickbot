import SteamID from 'steamid';
import SteamAPI from './steam-api.js';
import Database from './database.js';
import { EmbedBuilder, StringSelectMenuBuilder, 
  ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

class SteamProfile {
  #steamid;
  #guildid;

  #dbdata;
  #summary;
  #bandata;

  #friends;

  constructor(steamid, guildid, dbdata, summary, bandata, friends) {
    this.#steamid = steamid;
    this.#guildid = guildid;
    this.#dbdata = dbdata;
    this.#summary = summary;
    this.#bandata = bandata;
    this.#friends = friends;
  }

  // Use this instead of constructor() to create new SteamProfile instances
  static async create(steamid, guildid = -1) {
    steamid = await SteamProfile.#resolveSteamId(steamid);
    if (!steamid) {
      return null;
    }

    const dbdata = await Database.lookup(
      steamid.getSteamID64()
    );

    if (!dbdata) {
      return null;
    }

    const summary = await SteamAPI.getProfileSummaries(
      steamid.getSteamID64()
    );

    if (!summary) {
      return null;
    }

    const bandata = await SteamAPI.getPlayerBans(
      steamid.getSteamID64()
    );

    if (!bandata) {
      return null;
    }

    let friends = await SteamAPI.getFriendList(
      steamid.getSteamID64()
    );

    if (!friends) {
      friends = 0;
    } else {
      const tables = await Database.lookup(
        ...friends.map(f => {
          return f.steamid;
        })
      );

      friends = 0;

      tables.forEach(e => {
        e.tags?.[guildid]?.cheater && friends++;
      })
    }

    return new SteamProfile(steamid, guildid, dbdata, 
      summary, bandata, friends);
  }

  static async #resolveSteamId(steamid) {
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

  #getSteamIdList() {
    const idlist = [
      this.#steamid.getSteamID64(),
      this.#steamid.getSteam3RenderedID(),
      this.#steamid.getSteam2RenderedID(true)
    ]

    if (this.#summary.profileurl?.includes('/id/')) {
      idlist.push(this.#summary.profileurl.split('/')[4]);
    }

    return idlist.join('\n');
  }

  #getBanList() {
    const plural = (num, label) => {
      return `${num} ${label}${num == 1 ? ''  : 's'}`;
    };

    return [
      {
        label: `❌ ${plural(this.#bandata.NumberOfVACBans, 'VAC Ban')}`,
        valid: this.#bandata.NumberOfVACBans > 0
      }, {
        label: `❌ ${plural(this.#bandata.NumberOfGameBans, 'Game Ban')}`,
        valid: this.#bandata.NumberOfGameBans > 0
      }, {
        label: '❌ Community Ban',
        valid: this.#bandata.CommunityBanned
      }, {
        label: '❌ Trade Ban',
        valid: this.#bandata.EconomyBan == 'banned'
      }
    ].filter(x => x.valid).map(x => x.label);
  }

  // Returns a string of all of the "quick links" of this profile
  #getLinksList() {
    const links = {
      'SteamRep': 'https://steamrep.com/profiles/',
      'SteamID.uk': 'https://steamid.uk/profile/',
      'Backpack.tf': 'https://backpack.tf/profiles/',
      'SteamDB': 'https://steamdb.info/calculator/',
      'Open in Client': 'https://stickbot.net/openprofile/',
    }

    const id64 = this.#steamid.getSteamID64();

    return Object.entries(links).map(([k, v]) => {
      return `[${k}](${v}${id64}/)`;
    }).join('\n');
  }

  #getAlertList() {
    const alertlist = [ ...this.#getBanList() ];

    // First, add bot tags
    const tags = this.#dbdata.tags?.[this.#guildid] ?? {};

    // Slice last element as banwatch is added after
    for (const tag of this.#profiletags.slice(-1)) {
      if (tags[tag.value]) {
        alertlist.push(`⚠️ ${tag.name}`);
      }
    }

    // Next, list any cheater friends
    if (this.#friends > 0) {
      const pl = `cheater${this.#friends == 1 ? '' : 's'}`;
      alertlist.push(`⚠️ Friends with ${this.#friends} ${pl}`);
    }

    // Ban watch/server logs (TODO) last for visibility
    if (tags['banwatch']) {
      alertlist.push('\u2139\uFE0F Ban Watch');
    }

    if (this.#summary.timecreated) {
      const created = new Date(this.#summary.timecreated * 1000);

      if (created.getFullYear() <= 2006) {
        alertlist.push(`\u2139\uFE0F Made in ${created.getFullYear()}`);
      }
    }

    return alertlist.length ? alertlist.join('\n') : '✅ None';
  }

  #addGameInfo(embed) {
    if (!this.#summary.gameextrainfo) {
      return;
    }

    const gameinfo = `**${this.#summary.gameextrainfo}**`;
    const gameip = this.#summary.gameserverip;

    embed.addFields({
        name: 'Now Playing',
        value: gameinfo + (gameip ? ` on \`${gameip}\`` : '')
    });
  }

  get #profiletags() {
    return [
      { name: 'Cheater', value: 'cheater' },
      { name: 'Suspicious', value: 'suspicious' },
      { name: 'Content Creator', value: 'popular' },
      { name: 'Ban Watch', value: 'banwatch'}
    ];
  }

  get steamid() {
    return this.#steamid;
  }

  // Get embed
  get embed() {
    const profile_url = 'https://steamcommunity.com/profiles/';

    const embed = new EmbedBuilder()
      .setColor(0x3297A8)
      .setThumbnail(this.#summary.avatarfull)
      .setAuthor({
          name: this.#summary.personaname,
          iconURL: 'https://i.imgur.com/uO7rwHu.png',
          url: profile_url + this.#steamid.getSteamID64()
      }).addFields(
          { 
            name: 'Steam IDs', 
            value: this.#getSteamIdList(), 
            inline: true 
          }, { 
            name: 'Alerts', 
            value: this.#getAlertList(), 
            inline: true 
          }, { 
            name: 'Quick Links', 
            value: this.#getLinksList(), 
            inline: true 
          }
      );

    this.#addGameInfo(embed);

    return embed;
  }

  // Return an array of embeds (for cleaner messages)
  get embeds() {
    return [ this.embed ];
  }

  // Get message components (drop down, etc.)
  get components() {
    const tagdata = this.#dbdata.tags?.[this.#guildid] ?? {};

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

    const dropdown = new ActionRowBuilder()
      .addComponents(selectmenu);
    
    const buttons = new ActionRowBuilder()
      .addComponents([
        new ButtonBuilder()
          .setCustomId(`moreinfo:${this.steamid}`)
          .setLabel('More Info')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`notifications:${this.steamid}`)
          .setLabel('Notifications')
          .setStyle(ButtonStyle.Primary)
      ]);

    if (this.#friends > 0) {
      buttonrow.addComponents(
        new ButtonBuilder()
            .setCustomId(`friends:${this.steamid}`)
            .setLabel('List Friends')
            .setStyle(ButtonStyle.Primary)
      );
    }

    return [ dropdown, buttons ];
  }
}

export default SteamProfile;

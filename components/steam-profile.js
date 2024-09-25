import SteamID from 'steamid';
import SteamAPI from './steam-api.js';
import Database from './database.js';
import { EmbedBuilder } from 'discord.js';

class SteamProfile {
  #steamid;
  #guildid;

  #dbdata;
  #summary;
  #bandata;

  constructor(steamid, guildid, dbdata, summary, bandata) {
    this.#steamid = steamid;
    this.#guildid = guildid;
    this.#dbdata = dbdata;
    this.#summary = summary;
    this.#bandata = bandata;
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

    console.log('created profile!');

    return new SteamProfile(steamid, guildid, dbdata, summary, bandata);
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

    return links.map((k, v) => {
      return `[${k}](${v}${id64}/)`;
    }).join('\n');
  }

  #getAlertList() {
    const TAG_NAMES = [
      { name: 'Cheater', value: 'cheater' },
      { name: 'Suspicious', value: 'suspicious' },
      { name: 'Content Creator', value: 'popular' },
    ];
    
    const alertlist = [ ...this.#getBanList() ];

    // First, add bot tags
    const tags = this.#dbdata.tags?.[this.#guildid] ?? {};

    for (const tag of TAG_NAMES) {
      if (tags[tag.value]) {
        alertlist.push(`⚠️ ${tag.name}`);
      }
    }

    // Next, list any cheater friends (TODO)

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
          iconURL: STEAM_ICON,
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

  // Get message components (drop down, etc.)
  get components() {

  }
}

export default SteamProfile;

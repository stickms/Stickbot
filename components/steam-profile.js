import SteamID from 'steamid';
import SteamAPI from './steam-api.js';
import Database from './database.js';

class SteamProfile {
  #steamid;

  #dbdata;
  #summary;
  #bandata;

  constructor(steamid, dbdata, summary, bandata) {
    this.#steamid = steamid;
    this.#dbdata = dbdata;
    this.#summary = summary;
    this.#bandata = bandata;
  }

  // Use this instead of constructor() to create new SteamProfile instances
  static async create(steamid) {
    steamid = await SteamProfile.#resolveSteamId(steamid);
    if (!steamid) {
      return null;
    }

    const dbdata = await Database.lookupSteamId(steamid);
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

    return new SteamProfile(steamid, dbdata, summary, bandata);
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
    ].filter(x => x.valid).map(x => x.label).join('\n');
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
    
  }

  get steamid() {
    return this.#steamid;
  }

  // Get embed
  get embed() {

  }

  // Get message components (drop down, etc.)
  get components() {

  }
}

export default SteamProfile;

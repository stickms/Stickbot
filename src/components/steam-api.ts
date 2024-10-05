import * as path from 'path';

import * as dotenv from 'dotenv';
dotenv.config({ path: path.join(import.meta.dirname, '..', '..', '.env') });

import axios from 'axios';

export type SteamProfileSummary = {
  steamid: string,
  communityvisibilitystate: number,
  profilestate: number,
  personaname: string,
  commentpermission?: number,
  profileurl: string,
  avatar: string,
  avatarmedium: string,
  avatarfull: string,
  avatarhash: string,
  personastate: number,
  realname?: string,
  primaryclanid?: string,
  timecreated?: number,
  personastateflags: number,
  loccountrycode?: string,
  locstatecode?: string
  loccityid?: number,
  gameid?: string,
  gameextrainfo?: string,
  gameserverip?: string
};

export type SteamPlayerBans = {
  SteamId: string,
  CommunityBanned: boolean,
  VACBanned: boolean,
  NumberOfVACBans: number,
  DaysSinceLastBan: number,
  NumberOfGameBans: number,
  EconomyBan: string
};

export type SteamFriendList = {
  steamid: string,
  relationship: string,
  friend_since: number
};

export type SteamVanityURL = {
  steamid?: string,
  success: number,
  message?: string
};

class SteamAPI {
  // We mainly deal with ISteamUser functions
  private static endpoint = 'https://api.steampowered.com/ISteamUser/';

  private static tokenlist: string[] = [];
  private static token: string = '';
  private static tokennum: number = 0;

  static #updateApiKey() {
    if (!this.tokenlist?.length) {
      this.tokenlist = process.env.STEAM_TOKENS.split(',');
    }

    this.token = this.tokenlist[this.tokennum++];

    if (this.tokennum >= this.tokenlist.length) 
      this.tokennum = 0;
  }

  static async #callSteamApi(func: string, params: {}): Promise<{error?: string}> {
    this.#updateApiKey();

    try {
      const resp = await axios.get(this.endpoint + func, {
        timeout: 1000,
        params: {
          ...params,
          key: this.token
        }
      });

      return resp.data;
    } catch (error) {
      return { error: error };
    }
  }

  static async getProfileSummaries(...profiles: string[]): Promise<SteamProfileSummary | SteamProfileSummary[] | null> {
    if (!profiles?.length) {
      return null;
    }

    const data = await this.#callSteamApi('GetPlayerSummaries/v2/', {
      steamids: profiles.join(',')
    });

    if (data.error) {
      return null;
    }

    if (profiles.length == 1) {
      return data['response']?.players?.[0] as SteamProfileSummary;
    }

    return data['response']?.players as SteamProfileSummary[];
  }

  static async getPlayerBans(...profiles: string[]): Promise<SteamPlayerBans | SteamPlayerBans[] | null> {
    if (!profiles?.length) {
      return null;
    }

    const data = await this.#callSteamApi('GetPlayerBans/v1/', {
      steamids: profiles.join(',')
    });

    if (data.error) {
      return null;
    }

    if (profiles.length == 1) {
      return data['players'][0] as SteamPlayerBans;
    }

    return data['players'] as SteamPlayerBans[];
  }

  static async getFriendList(steamid: string): Promise<SteamFriendList[] | null> {
    if (!steamid?.length) {
      return null;
    }

    const data = await this.#callSteamApi('GetFriendList/v1/', {
      steamid: steamid
    });

    if (data.error) {
      return null;
    }

    return data['friendslist'].friends as SteamFriendList[];
  }

  static async resolveVanityUrl(vanity: string) : Promise<SteamVanityURL | null> {
    if (!vanity?.length) {
      return null;
    }

    const data = await this.#callSteamApi('ResolveVanityURL/v1/', {
      vanityurl: vanity
    });

    if (data.error) {
      return null;
    }

    return data['response'] as SteamVanityURL;
  }
}

export default SteamAPI;

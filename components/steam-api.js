import axios from 'axios';

class SteamAPI {
  // We mainly deal with ISteamUser functions
  static #endpoint = 'https://api.steampowered.com/ISteamUser/';

  static #tokenlist = null;
  static #token = null;
  static #tokennum = 0;

  static #updateApiKey() {
    if (!this.#tokenlist) {
      this.#tokenlist = process.env.STEAM_TOKENS.split(',');
    }

    this.#token = this.#tokenlist[this.#tokennum++];

    if (this.#tokennum >= this.#tokenlist.length) 
      this.#tokennum = 0;
  }

  static async #callSteamApi(func, params) {
    this.#updateApiKey();

    try {
      const resp = await axios.get(this.#endpoint + func, {
        timeout: 1000,
        params: {
          ...params,
          key: this.#token
        }
      });

      return resp.data;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  static async getProfileSummaries(...profiles) {
    if (!profiles?.length) {
      return null;
    }

    const data = await this.#callSteamApi('GetPlayerSummaries/v2/', {
      steamids: profiles.join(',')
    });

    if (profiles.length == 1) {
      return data?.response?.players?.[0];
    }

    return data?.response?.players;
  }

  static async getPlayerBans(...profiles) {
    if (!profiles?.length) {
      return null;
    }

    const data = await this.#callSteamApi('GetPlayerBans/v1/', {
      steamids: profiles.join(',')
    });

    if (profiles.length == 1) {
      return data?.players?.[0];
    }

    return data?.players;
  }

  static async getFriendList(steamid) {
    if (!steamid) {
      return null;
    }

    const data = await this.#callSteamApi('GetFriendList/v1/', {
      steamid: steamid
    });

    return data?.friendslist?.friends;
  }

  static async resolveVanityUrl(vanity) {
    if (!vanity?.length) {
      return null;
    }

    const data = await this.#callSteamApi('ResolveVanityURL/v1/', {
      vanityurl: vanity
    });

    return data?.response;
  }
}

export default SteamAPI;

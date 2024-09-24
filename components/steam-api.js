import axios from "axios";

import 'dotenv/config';

class SteamAPI {
  // We mainly deal with ISteamUser functions
  static #endpoint = 'https://api.steampowered.com/ISteamUser/';

  static #tokenlist = null;
  static #token = null;
  static #curtoken = 0;

  static #updateApiKey() {
    if (!this.#tokenlist) {
      this.#tokenlist = process.env.STEAM_TOKENS.split(',');
    }

    this.#token = this.#tokenlist[this.#curtoken++];

    if (this.#curtoken >= this.#tokenlist.length) 
      this.#curtoken = 0;
  }

  static async getProfileSummaries(...profiles) {
    try {
      this.#updateApiKey();

      const resp = await axios.get(this.#endpoint + 'GetPlayerSummaries/v2/', {
        timeout: 1000,
        params: {
          key: this.#token,
          steamids: profiles.join(',')
        }
      });

      console.log(resp.data.response.players);
    } catch (error) {
      console.error(error);
    }
  }
}

SteamAPI.getProfileSummaries('76561197960287930');

export default SteamAPI;

import axios from 'axios';
import SteamID from 'steamid';
import { getRandom } from 'random-useragent';
import { BAN_URL, DPASTE_URL, SUMMARY_URL, VANITY_URL } from './bot-consts.js';

const steam_tokens = process.env.STEAM_TOKENS.split(',');

let apicalls = 0;
let tokennum = 0;

export function getAPICalls() {
  return apicalls;
}

export function getSteamToken() {
  if (tokennum >= steam_tokens.length) tokennum = 0;
  return steam_tokens[tokennum++];
}

export async function httpsGet(url, params={}, timeout=1000, full=false) {
  try {
    if (url.startsWith('https://api.steampowered.com/')) {
      apicalls++;
    }

    const response = await axios.get(url, {
      params: params,
      timeout: timeout
    }, { 
      headers: { 'User-Agent': getRandom() }
    });

    if (!response?.data) {
      return null;
    }

    return full ? response : response.data;
  } catch (error) {
    return null;
  }
}

export async function httpsHead(url, params={}, timeout=1000) {
  try {
    const response = await axios.head(url, { 
      params: params,
      timeout: timeout
    }, { 
      headers: { 'User-Agent': getRandom() }
    });

    if (!response) {
      return null;
    } 

    return response;
  } catch (error) {
    return null;
  }
}

export async function resolveSteamID(steamid) {
  try {
    if (typeof steamid === 'string' && steamid.split('/').length > 4) {
      steamid = steamid.split('/')[4];
    }

    // Try to check if this is a Vanity URL first
    const response = await httpsGet(VANITY_URL, {
      key: getSteamToken(),
      vanityurl: steamid
    });

    if (response?.response?.steamid) {
      return new SteamID(response.response.steamid);
    }    
    else {
      // Check if it's a regular steamid format
      return new SteamID(steamid);
    }
  } catch (error) {
    console.log(error)
    return null;
  }
}

export async function getBanData(steamid) {
  if (typeof steamid === typeof SteamID) {
    steamid = steamid.getSteamID64();
  }

  try {
    let bandata = await httpsGet(BAN_URL, {
      key: getSteamToken(),
      steamids: steamid
    });

    if (!bandata?.players?.[0]) {
      return {};
    }

    bandata = bandata.players[0];

    return {
      vacbans: bandata.NumberOfVACBans,
      gamebans: bandata.NumberOfGameBans,
      communityban: bandata.CommunityBanned,
      tradeban: bandata.EconomyBan == 'banned'
    };
  } catch (error) {
    return {};
  }
}

export async function getPersonaDict(steamid) {
  if (typeof steamid === typeof SteamID) {
    steamid = steamid.getSteamID64();
  }

  try {
    const response = await httpsGet(SUMMARY_URL, {
      key: getSteamToken(),
      steamids: steamid
    });

    if (!response?.response?.players?.[0]) {
      return {};
    }

    const summary = response.response.players[0];
    const persona = JSON.stringify(summary.personaname);

    return {
      [persona]: Math.floor(Date.now() / 1000)
    };
  } catch (error) {
    return {};
  }
}

uploadText('This is a link: [clicky link](https://google.com)');

// Uploads to Hastebin API, used for friends and sourcebans
export async function uploadText(text) {
  try {
    const response = await axios.post(DPASTE_URL, {
      content: text,
      syntax: 'md',
      expiry_days: 7
    }, { 
      timeout: 1000,
      headers: {
        'User-Agent': getRandom(),
        'Content-Type': 'multipart/form-data'
      }
    });

    return response.data.replace('\n', '-preview');
  } catch (e) {
    return null;
  }
}

export function formatWelcomeMessage(message, member) {
  message = message.replaceAll('{mention}', `<@${member.user.id}>`);
  message = message.replaceAll('{id}', member.user.id);
  message = message.replaceAll('{server}', member.guild.name);
  message = message.replaceAll('{guild}', member.guild.name);
  message = message.replaceAll('{name}', member.user.username);
  message = message.replaceAll('{nick}', member.nickname ?? member.user.username);
  return message;
}
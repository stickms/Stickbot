import { parse as HTMLParse } from 'node-html-parser';
import { SOURCEBAN_URLS } from './bot-config.js';
import { SOURCEBAN_EXT } from './bot-consts.js';
import { httpsGet } from './bot-helpers.js';

import SteamID from 'steamid';

export async function getSourceBans(steamid) {
  if (typeof steamid !== typeof SteamID) {
    steamid = new SteamID(steamid);
  }

  let sourcebans = [];

  (await getWebData(steamid)).filter(x => x).forEach(data => {
    const parsed = parseWebHTML(steamid, data.config.url, data.data);
    if (parsed?.length) sourcebans.push(...parsed);
  });

  return sourcebans;
}

async function getWebData(steamid) {
  const gets = Object.entries(SOURCEBAN_URLS).map(entry => {
    let url = entry[0] + SOURCEBAN_EXT;
    if (entry[1] === 3) {
      url += steamid.getSteam3RenderedID();
    } else {
      url += steamid.getSteam2RenderedID().replace('_0:', '__:');
    }

    return httpsGet(url, {}, 3000, true);
  })

  return (await Promise.allSettled(gets)).filter(x => {
    return x.status === 'fulfilled' && x.value;
  }).map(x => x.value);
}

function parseWebHTML(steamid, url, body) {
  const dom = HTMLParse(body);
  if (!dom) {
    return null;
  }

  const div = dom.querySelectorAll('div.opener').length ?
    dom.querySelectorAll('div.opener') : dom.querySelectorAll('div.collapse');

  const reasons = div.filter(div => {
    return div.getElementsByTagName('td').some(td => {
      const regex1 = new RegExp(steamid.getSteamID64());
      const regex2 = new RegExp(steamid.getSteam2RenderedID().replace('_0:', '_.+:'));
      return (td.innerText === 'Steam Community'
        && td.nextElementSibling?.innerText?.match(regex1))
        || (td.innerText === 'Steam ID'
        && td.nextElementSibling?.innerText?.match(regex2));
    });
  }).map(div => {
    for (const td of div.getElementsByTagName('td')) {
      if (td.innerText === 'Reason') {
        return td.nextElementSibling?.innerText;
      }
    }
  });

  return reasons.filter(x => x).map(reason => {
    return {
      url: url,
      reason: reason
    }
  });
}
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

  let divs = dom.querySelectorAll('div.opener').length ?
    dom.querySelectorAll('div.opener') : dom.querySelectorAll('div.collapse');

  let reasons = divs.filter(div => {
    return div.getElementsByTagName('td').some(td => {
      const steamid2 = steamid.getSteam2RenderedID().replace('_0:', '_[01]:');
      const regex1 = new RegExp(steamid.getSteamID64());
      const regex2 = new RegExp(`^${steamid2}$`);
      return (td.innerText === 'Steam Community'
        && regex1.test(td.nextElementSibling?.innerText))
        || (td.innerText === 'Steam ID'
        && regex2.test(td.nextElementSibling?.innerText?.trim()));
    });
  }).map(div => {
    for (const td of div.getElementsByTagName('td')) {
      if (td.innerText === 'Reason') {
        return td.nextElementSibling?.innerText;
      }
    }
  });

  // If we can't find that div, we probably have a "Fluent Design" Theme
  if (!divs.length) {
    divs = dom.querySelectorAll('div.collapse_content');
    
    reasons = divs.filter(div => {
      return div.getElementsByTagName('span').some(span => {
        const regex = new RegExp(steamid.getSteamID64());
        return span.innerText.match(new RegExp('.+Steam Community'))
          && span.nextElementSibling?.innerText?.match(regex);
      });
    }).map(div => {
      for (const span of div.getElementsByTagName('span')) {
        if (span.innerText.match(new RegExp('.+Reason'))) {
          return span.nextElementSibling?.innerText;
        }
      }  
    });
  }

  return reasons.filter(x => x).map(reason => {
    return {
      url: url,
      reason: reason
    }
  });
}
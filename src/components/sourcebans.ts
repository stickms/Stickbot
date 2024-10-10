import { parse as HTMLParse } from 'node-html-parser';
import axios, { AxiosResponse } from 'axios';
import SteamID from 'steamid';

class Sourcebans {
  private static SOURCEBAN_EXT = 'index.php?p=banlist&advType=steam&advSearch=';

  private static SOURCEBAN_URLS = [
    'https://www.skial.com/sourcebans/',
    'https://lazypurple.com/sourcebans/'
  ];

  static async get(
    steamid: string
  ): Promise<{ url: string; reason: string }[]> {
    const conv = new SteamID(steamid);
    const sourcebans = [];

    (await this.getWebData(conv))
      .filter((x) => x)
      .forEach((data) => {
        const parsed = this.parseWebHTML(conv, data.config.url, data.data);

        if (parsed?.length) {
          sourcebans.push(...parsed);
        }
      });

    return sourcebans;
  }

  private static async getWebData(
    steamid: SteamID
  ): Promise<AxiosResponse<any, any>[]> {
    const gets = this.SOURCEBAN_URLS.map((entry) => {
      let url = entry + this.SOURCEBAN_EXT;
      if (entry === 'https://www.skial.com/sourcebans/') {
        url += steamid.getSteam3RenderedID();
      } else {
        url += steamid.getSteam2RenderedID().replace('_0:', '__:');
      }

      return axios.get(url, {
        timeout: 2500
      });
    });

    const fulfilled = <T>(
      p: PromiseSettledResult<T>
    ): p is PromiseFulfilledResult<T> => p.status === 'fulfilled';

    return (await Promise.allSettled(gets))
      .filter(fulfilled)
      .map((x) => x.value);
  }

  private static parseWebHTML(
    steamid: SteamID,
    url: string,
    body: string
  ): { url: string; reason: string }[] {
    const dom = HTMLParse(body);
    if (!dom) {
      return null;
    }

    let divs = dom.querySelectorAll('div.opener').length
      ? dom.querySelectorAll('div.opener')
      : dom.querySelectorAll('div.collapse');

    let reasons: string[] = divs
      .filter((div) => {
        return div.getElementsByTagName('td').some((td) => {
          const steamid2 = steamid
            .getSteam2RenderedID()
            .replace('_0:', '_[01]:');
          const regex1 = new RegExp(steamid.getSteamID64());
          const regex2 = new RegExp(`^${steamid2}$`);
          return (
            (td.innerText === 'Steam Community' &&
              regex1.test(td.nextElementSibling?.innerText)) ||
            (td.innerText === 'Steam ID' &&
              regex2.test(td.nextElementSibling?.innerText))
          );
        });
      })
      .map((div) => {
        for (const td of div.getElementsByTagName('td')) {
          if (td.innerText === 'Reason') {
            return td.nextElementSibling?.innerText;
          }
        }
      });

    // If we can't find that div, we probably have a "Fluent Design" Theme
    if (!divs.length) {
      divs = dom.querySelectorAll('div.collapse_content');

      reasons = divs
        .filter((div) => {
          return div.getElementsByTagName('span').some((span) => {
            const regex = new RegExp(steamid.getSteamID64());
            return (
              span.innerText.match(new RegExp('.+Steam Community')) &&
              span.nextElementSibling?.innerText?.match(regex)
            );
          });
        })
        .map((div) => {
          for (const span of div.getElementsByTagName('span')) {
            if (span.innerText.match(new RegExp('.+Reason'))) {
              return span.nextElementSibling?.innerText;
            }
          }
        });
    }

    return reasons
      .filter((x) => x)
      .map((reason) => {
        return {
          url: url,
          reason: reason
        };
      });
  }
}

export default Sourcebans;

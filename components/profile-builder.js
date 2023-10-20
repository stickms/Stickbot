import { EmbedBuilder, ActionRowBuilder, ButtonBuilder,
        StringSelectMenuBuilder, ButtonStyle } from 'discord.js';
import { getSteamToken, httpsGet, getBanData, uploadText, getPersonaDict } from './bot-helpers.js';
import { getDocument } from './database.js';
import { parse as HTMLParse } from 'node-html-parser';
import { SUMMARY_URL, EMBED_COLOR, STEAM_ICON, PROFILE_URL, PROFILE_TAGS,
        RUST_URL, STEAMREP_URL, FRIEND_URL, SOURCEBAN_EXT } from './bot-consts.js';
import { SOURCEBAN_URLS, SERVER_GUILDS } from './bot-config.js';
import { getSourceBans } from './sourcebans.js';

import SteamID from 'steamid';

class SteamProfile {
  async init(steamid, guildid, options) {
    this.steamid = steamid;
    this.guildid = guildid;
    this.summary = options['summary'];

    if (options['bandata']) {
      this.bandata = {
        vacbans: options['bandata'].NumberOfVACBans,
        gamebans: options['bandata'].NumberOfGameBans,
        communityban: options['bandata'].CommunityBanned,
        tradeban: options['bandata'].EconomyBan == 'banned'
      };
    }

    this.profile = await getDocument(steamid);
    
    await this.countCheaterFriends();
    await this.generateEmbed(!!options['moreinfo'], options['sourcebans']);
    await this.generateComponents();
  }

  getEmbed() {
    return this.embeds;
  }

  getComponents() {
    return this.components;
  }

  async generateEmbed(moreinfo = false, known_sourcebans = null) {
      if (!this.summary) {
          const summary_response = await httpsGet(SUMMARY_URL, {
              key: getSteamToken(),
              steamids: this.steamid
          });

          if (!summary_response?.response?.players?.[0]) {
              return;
          }

          this.summary = summary_response.response.players[0];
      }

      const idlist = this.getSteamIDList();
      const quicklinks = this.getQuicklinks();
      const alertlist = await this.getAlertList();

      const embed = new EmbedBuilder()
          .setColor(EMBED_COLOR)
          .setThumbnail(this.summary.avatarfull)
          .setAuthor({
              name: this.summary.personaname,
              iconURL: STEAM_ICON,
              url: PROFILE_URL + this.steamid
          }).addFields(
              { name: 'Steam IDs', value: idlist, inline: true },
              { name: 'Alerts', value: alertlist, inline: true },
              { name: 'Quick Links', value: quicklinks, inline: true }
          );
      
      if (this.summary.gameextrainfo) {
          const gameinfo = `**${this.summary.gameextrainfo}**`;
          const gameip = this.summary.gameserverip;

          embed.addFields({
              name: 'Now Playing',
              value: gameinfo + (gameip ? ` on \`${gameip}\`` : '')
          });
      }

    if (moreinfo) {
      const tagdata = this.profile.tags?.[this.guildid] ?? {};
      const taglist = Object.entries(tagdata).map(([k, v]) => { 
        return `\`${k}\` - <@${v.addedby}> on <t:${v.date}:D>`;
      });

      const namedata = this.profile.names ?? {};
      const namelist = Object.entries(namedata).map(([k, v]) => [k, v])
        .sort(function (a, b) { return b[1] - a[1]; })
        .map(([k, v]) => { 
        return `\`${JSON.parse(k)}\` - <t:${v}:D>`;
      });

      const addrdata = this.profile.addresses ?? {};
      const addrlist = Object.entries(addrdata).map(([k, v]) => [k, v])
        .sort(function (a, b) { return b[1].date - a[1].date; })
        .map(([k, v]) => { 
        return `\`${k}\` - *${v.game}* on <t:${v.date}:D>`;
      });

      if (taglist?.length) {
        embed.addFields({
          name: 'Added Tags',
          value: taglist.join('\n')
        });
      }
      
      if (namelist?.length) {
        embed.addFields({
          name: 'Name History',
          value: namelist.join('\n')
        });
      }
      
      if (addrlist?.length && SERVER_GUILDS.includes(this.guildid)) {
        embed.addFields({
          name: 'Logged Servers',
          value: addrlist.join('\n')
        });
      }

      const sourcebans = known_sourcebans ?? await this.getSourceBanData();
      embed.addFields({ name: 'Sourcebans', value: sourcebans });
    }

    this.embeds = [ embed ];
  }

  async generateComponents() {
    const tagdata = this.profile.tags?.[this.guildid] ?? {};

    const selectmenu = new StringSelectMenuBuilder()
                        .setCustomId(`modifytags:${this.steamid}`)
                        .setPlaceholder('Modify User Tags')
                        .setMaxValues(PROFILE_TAGS.length);

    for (const tag of PROFILE_TAGS) {
      const op = tagdata[tag.value] ? 'Remove ' : 'Add ';
      selectmenu.addOptions({
        label: op + tag.name, 
        value: tag.value
      });
    }

    const selectrow = new ActionRowBuilder().addComponents(selectmenu);
    
    const buttonrow = new ActionRowBuilder().addComponents([
      new ButtonBuilder()
        .setCustomId(`moreinfo:${this.steamid}`)
        .setLabel('More Info')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`notifybutton:${this.steamid}`)
        .setLabel('Notifications')
        .setStyle(ButtonStyle.Primary)
      ]);

    if (this.cheaterfriends > 0) {
      buttonrow.addComponents(
        new ButtonBuilder()
            .setCustomId(`friendinfo:${this.steamid}`)
            .setLabel('List Friends')
            .setStyle(ButtonStyle.Primary)
      );
    }

    this.components = [ selectrow, buttonrow ];
  }

  getSteamIDList() {
    const resolved = new SteamID(this.steamid);

    let idlist = this.steamid + '\n' + 
      resolved.getSteam3RenderedID() + '\n' + 
      resolved.getSteam2RenderedID(true);

    if (this.summary.profileurl?.includes('/id/')) {
      idlist += '\n' + this.summary.profileurl.split('/')[4];
    }

    return idlist;
  }

  getQuicklinks() {
    const id = this.steamid;
    return `[SteamRep](https://steamrep.com/profiles/${id}/)\n` + 
    `[SteamID.uk](https://steamid.uk/profile/${id}/)\n` +
    `[Backpack.tf](https://backpack.tf/profiles/${id}/)\n` +
    `[SteamDB](https://steamdb.info/calculator/${id}/)\n` + 
    `[Open in Client](https://stickbot.net/openprofile/${id}/)`;
  }

  async getAlertList() {
    const tags = this.profile.tags?.[this.guildid] ?? {};
    const bandata = this.bandata ?? await getBanData(this.steamid);
    const srdata = await this.getSteamRepData();
    
    let alertlist = [];
    
    if (srdata.includes('VALVE ADMIN')) {
      alertlist.push('☑️ Valve Employee');
    } if (srdata.includes('SR ADMIN')) {
      alertlist.push('☑️ SR Admin');
    } if (srdata.some(x => !x.startsWith('VALVE') && 
      !x.startsWith('SR') && x.includes('ADMIN'))) {
      alertlist.push('☑️ Community Admin');
    }

    if (Object.keys(bandata).length == 0) {
      alertlist.push('❓ Unknown Ban Info');
    } else {
      let pluralize = (num, label) => {
        return `❌ ${num} ${label}${num == 1 ? ''  : 's'}`;
      };

      if (bandata.vacbans > 0) {
        alertlist.push(pluralize(bandata.vacbans, 'VAC Ban'));
      } if (bandata.gamebans > 0) {
        alertlist.push(pluralize(bandata.gamebans, 'Game Ban'));
      } if (bandata.communityban) {
        alertlist.push('❌ Community Ban');
      } if (bandata.tradeban) {
        alertlist.push('❌ Trade Ban');
      }
    }

    if (process.env.RUST_TOKEN) {
      const rustdata = await httpsGet(RUST_URL, {
        apikey: process.env.RUST_TOKEN,
        steamid64: this.steamid
      });

      if (rustdata?.response?.[0]?.url) {
        alertlist.push('❌ Rust Ban');
      }
    }

    if (srdata.includes('SR SCAMMER')) {
      alertlist.push('❌ SR Scammer');
    }

    for (const tag of PROFILE_TAGS) {
      if (tags[tag.value] && tag.value != 'banwatch') {
        alertlist.push(`⚠️ ${tag.name}`);
      }
    }

    if (this.cheaterfriends > 0) {
      const plural = `cheater${this.cheaterfriends == 1 ? '' : 's'}`;
      alertlist.push(`⚠️ Friends with ${this.cheaterfriends} ${plural}`);
    }

    // Place Ban Watch/Server Logs Last
    if (tags['banwatch']) {
      alertlist.push('\u2139\uFE0F Ban Watch');
    } if (Object.keys(this.profile.addresses ?? {}).length) {
      if (SERVER_GUILDS.includes(this.guildid)) {
        alertlist.push('\u2139\uFE0F Server Logged');
      }
    }

    const timecreated = this.summary.timecreated;
    if (timecreated) {
      const year = new Date(timecreated * 1000).getFullYear();
      if (year <= 2006) {
        alertlist.push(`\u2139\uFE0F Made in ${year}`);
      }
    }

    return alertlist.length ? alertlist.join('\n') : '✅ None';
  }

  async getSteamRepData() {
    try {
      const url = STEAMREP_URL + this.steamid;
      const response = await httpsGet(url, {
        json: 1,
        extended: 1
      });

      if (!response?.steamrep?.reputation?.full) {
        return [];
      }

      return response.steamrep.reputation.full.split(',');
    } catch (error) {
      return [];
    }
  }

  async countCheaterFriends() {
    try {
      this.cheaterfriends = 0;

      const response = await httpsGet(FRIEND_URL, {
        key: getSteamToken(),
        steamid: this.steamid
      });

      if (!response?.friendslist?.friends) {
        return;
      }

      const frienddata = response.friendslist.friends;
      const idlist = Object.values(frienddata).map(x => {
        return x.steamid;
      });

      (await getDocument(idlist)).forEach(x => {
        if (x.tags?.[this.guildid]?.cheater) this.cheaterfriends++;
      });
    } catch (error) {
      this.cheaterfriends = 0;
    }
  }

  async getSourceBanData() {
    const sourcebans = await getSourceBans(this.steamid);

    let shorttext = '';
    let fulltext = '';

    for (const ban of sourcebans) {
      const label = `${ban.url.split('/')[2]} - ${ban.reason}`;            
      const buffer = `[${label}](${ban.url})\n`;

      fulltext += buffer;

      if ((shorttext + buffer).length <= 950) {
        shorttext += buffer;
      }
    }

    if (fulltext.length > shorttext.length) {
      const url = await uploadText(fulltext.replaceAll('\n', '  \n'));
      if (url) shorttext += `[\`Click to view more bans\`](${url})`;
      else shorttext += '\`Error when uploading more sourcebans\`';
    } else if (!shorttext) {
      shorttext = '✅ None';
    }

    return shorttext;
  }
}

export async function getProfile(steamid, guildid, options={}) {
  const profile = new SteamProfile();
  await profile.init(steamid, guildid, options);
  return profile;
}
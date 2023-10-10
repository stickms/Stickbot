const { EmbedBuilder, ActionRowBuilder, ButtonBuilder,
        StringSelectMenuBuilder, ButtonStyle } = require('discord.js');
const { rust_token, sourceban_urls, address_guilds } = require('./config.json');
const { getSteamToken, httpsGet, getBanData } = require('./bot-helpers.js');
const { getTags, getNames, getAddrs } = require('./database');

const CONSTS = require('./bot-consts.js');
const HTMLParser = require('node-html-parser');
const SteamID = require('steamid');

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

  getAttachments() {
    return this.banfile;
  }

  async generateEmbed(moreinfo = false, known_sourcebans = null) {
      if (!this.summary) {
          const summary_response = await httpsGet(CONSTS.SUMMARY_URL, {
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
          .setColor(CONSTS.EMBED_CLR)
          .setThumbnail(this.summary.avatarfull)
          .setAuthor({
              name: this.summary.personaname,
              iconURL: CONSTS.STEAM_ICON,
              url: CONSTS.PROFILE_URL + this.steamid
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
      const tagdata = getTags(this.steamid, this.guildid);
      const taglist = Object.entries(tagdata).map(([k, v]) => { 
        return `\`${k}\` - <@${v.addedby}> on <t:${v.date}:D>`;
      });

      const namedata = getNames(this.steamid, this.guildid);
      const namelist = Object.entries(namedata).map(([k, v]) => [k, v])
        .sort(function (a, b) { return b[1] - a[1]; })
        .map(([k, v]) => { 
        return `\`${JSON.parse(k)}\` - <t:${v}:D>`;
      });

      const addrdata = getAddrs(this.steamid);
      const iplist = Object.entries(addrdata).map(([k, v]) => [k, v])
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
      
      if (iplist?.length && address_guilds.includes(this.guildid)) {
        embed.addFields({
          name: 'Logged IPs',
          value: iplist.join('\n')
        });
      }

      const sourcebans = known_sourcebans ?? await this.getSourceBanData();
      embed.addFields({ name: 'Sourcebans', value: sourcebans });
    }

    this.embeds = [ embed ];
  }

  async generateComponents() {
    const tagdata = getTags(this.steamid, this.guildid);
    
    const selectmenu = new StringSelectMenuBuilder()
                        .setCustomId(`modifytags:${this.steamid}`)
                        .setPlaceholder('Modify User Tags')
                        .setMaxValues(CONSTS.TAGS.length);

    for (const tag of CONSTS.TAGS) {
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
    `[SteamDB](https://steamdb.info/calculator/${id}/)`;
  }

  async getAlertList() {
    const tags = getTags(this.steamid, this.guildid);
    const ipdata = getAddrs(this.steamid);
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

    if (rust_token) {
      const rustdata = await httpsGet(CONSTS.RUST_URL, {
        apikey: rust_token,
        steamid64: this.steamid
      });

      if (rustdata?.response?.[0]?.url) {
        alertlist.push('❌ Rust Ban');
      }
    }

    if (srdata.includes('SR SCAMMER')) {
      alertlist.push('❌ SR Scammer');
    }

    for (const tag of CONSTS.TAGS) {
      if (tags[tag.value] && tag.value != 'banwatch') {
        alertlist.push(`⚠️ ${tag.name}`);
      }
    }

    if (this.cheaterfriends > 0) {
      const plural = `cheater${this.cheaterfriends == 1 ? '' : 's'}`;
      alertlist.push(`⚠️ Friends with ${this.cheaterfriends} ${plural}`);
    }

    // Place Ban Watch/IP Logs Last
    if (tags['banwatch']) {
      alertlist.push('\u2139\uFE0F Ban Watch');
    } if (Object.keys(ipdata).length) {
      if (address_guilds.includes(this.guildid)) {
        alertlist.push('\u2139\uFE0F IP Logged');
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
      const url = CONSTS.STEAMREP_URL + this.steamid;
      const response = await httpsGet(url, {
        json: 1,
        extended: 1
      });

      if (!response?.steamrep?.reputation?.full) {
        return [];
      }

      return response.steamrep.reputation.full.split(',');
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  async countCheaterFriends() {
    try {
      const response = await httpsGet(CONSTS.FRIEND_URL, {
        key: getSteamToken(),
        steamid: this.steamid
      });

      if (!response?.friendslist?.friends) {
        return;
      }

      const frienddata = response.friendslist.friends;
      this.cheaterfriends = 0;

      for (const val of Object.values(frienddata)) {
        const tags = getTags(val.steamid, this.guildid);
        if (tags['cheater']) this.cheaterfriends++;
      } 
    } catch (error) {
      console.error(error);
      this.cheaterfriends = 0;
    }
  }

  async getSourceBanData() {
    const sourcebans = await this.getSourceBans();

    let requireupload = false;
    let shorttext = '';
    let fulltext = '';

    for (const ban of sourcebans) {
      const label = `${ban.url.split('/')[2]} - ${ban.reason}`;            
      const buffer = `[${label}](${ban.url})\n`;

      fulltext += label + '\n';

      if ((shorttext + buffer).length > 950) {
        requireupload = true;
      } else {
        shorttext += buffer;
      }
    }

    if (requireupload) {
      this.banfile = [{
        attachment: Buffer.from(fulltext),
        name: 'bans.txt'
      }];

      shorttext += '\`Check Attachment for full list\`';
    } else if (!shorttext) {
      shorttext = '✅ None';
    }

    return shorttext;
  }

  async getSourceBans() {
    let url_list = []; 
  
    const converted = new SteamID(this.steamid);
  
    for (let url of Object.keys(sourceban_urls)) {
      let idfmt = sourceban_urls[url];
      if (idfmt === 3) {
        url += CONSTS.SRCBAN_EXT + converted.getSteam3RenderedID();
      } else {
        const id2 = converted.getSteam2RenderedID();
        url += CONSTS.SRCBAN_EXT + id2.substring(id2.indexOf(':') + 1);
      }
  
      url_list.push(url);
    }

    const results = await Promise.allSettled(url_list.map(url => {
      return httpsGet(url, {}, 3000, true);
    }));
  
    let sourcebans = [];
  
    for (const result of results) {    
      if (result.status !== 'fulfilled') {
        continue;
      }

      if (!result.value?.data) {
        continue;
      }
  
      let dom = HTMLParser.parse(result.value.data);
      if (!dom) {
        continue;
      }
  
      const tables = dom.getElementsByTagName('table');
  
      for (const table of tables) {
        var tds = table.getElementsByTagName('td');
        if (!tds.length) {
          continue;
        }
  
        var trs = table.getElementsByTagName('tr');
        for (const row of trs) {
          var nodes = row.getElementsByTagName('td');
          if (nodes.length < 2) {
            continue;
          }
  
          if (nodes[0].innerText?.toLowerCase() !== 'reason') {
            continue;
          }
  
          const key = result.value.config.url;
          const value = nodes[1].innerText ?? 'Unknown Reason';
  
          if (sourcebans.some(x => x.url === key && x.reason === value)) {
            continue;
          }
  
          sourcebans.push({ url: key, reason: value });
        }
      }
    }
  
    return sourcebans;
  }
}

module.exports = { 
  // Options: moreinfo, sourcebans, summary, bandata
  async getProfile(steamid, guildid, options={}) {
    const profile = new SteamProfile();
    await profile.init(steamid, guildid, options);
    return profile;
  }
};
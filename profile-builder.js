const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, SelectMenuBuilder, ButtonStyle } = require('discord.js')
const { steam_token, rust_token, sourceban_urls } = require('./config.json');
const { resolveSteamID, getBanData } = require('./bot-helpers.js');
const { getTags, getAddrs } = require('./database');

const axios = require('axios');
const CONSTS = require('./bot-consts.js');
const HTMLParser = require('node-html-parser');

class ProfileBuilder {
    static async initialize(steamid, guildid) {
        let pb = new ProfileBuilder();
        pb.steamid = await resolveSteamID(steamid);
        pb.guildid = guildid;

        pb.cheatercount = await pb.getCheaterFriendCount();
        pb.srcbansfile = null;
        return pb;
    }

    async getProfileEmbed(moreinfo = false, sourcebans = null) {
        if (this.steamid == null) {
            return [];
        }

        const id64 = this.steamid.getSteamID64();
        let data = {};

        try {
            let response = await axios.get(CONSTS.SUMMARY_URL, { params: { key: steam_token, steamids: id64 } });
            data = response.data.response.players[0];
        } catch (error) {
            return [];
        }
    
        let idlist = `${id64}\n${this.steamid.getSteam3RenderedID()}\n${this.steamid.getSteam2RenderedID(true)}\n`;
    
        if(data.profileurl.includes('id/')) {
            idlist += data.profileurl.split('/')[4];
        }
    
        const quicklinks =  `[SteamRep](https://steamrep.com/profiles/${id64}/)\n` + 
                            `[SteamID.uk](https://steamid.uk/profile/${id64}/)\n` +
                            `[Backpack.tf](https://backpack.tf/profiles/${id64}/)\n` +
                            `[SteamDB](https://steamdb.info/calculator/${id64}/)`;
        
        const alertlist = await this.getAlertList(data.timecreated);
    
        const embed = new EmbedBuilder()
            .setColor(CONSTS.EMBED_CLR)
            .setAuthor({ name: data.personaname, iconURL: CONSTS.STEAM_ICON, url: `${CONSTS.PROFILE_URL}${id64}/`})
            .setThumbnail(data.avatarfull)
            .addFields(
                { name: 'Steam IDs', value: idlist, inline: true },
                { name: 'Alerts', value: alertlist, inline: true},
                { name: 'Quick Links', value: quicklinks, inline: true}
            );

        if (data.gameextrainfo != null) {
            if (data.gameserverip != null) {
                embed.addFields({ 
                    name: 'Now Playing', 
                    value: `**${data.gameextrainfo}** on \`${data.gameserverip}\``
                });
            } else {
                embed.addFields({ 
                    name: 'Now Playing', 
                    value: `**${data.gameextrainfo}**`
                });
            }
        }
    
        if (moreinfo == true) {
            let taglist = '';
            let iplist = '';
    
            let tagdata = getTags(id64, this.guildid);
            for (let tag in tagdata) {
                taglist += `\`${tag}\` - <@${tagdata[tag].addedby}> on <t:${tagdata[tag].date}:D>\n`;
            } 

            let addrdata = getAddrs(id64);
            for (let addr in addrdata) {
                iplist += `\`${addr}\` - *${addrdata[addr].game}* on <t:${addrdata[addr].date}:D>\n`;
            }
    
            if (taglist) embed.addFields({ name: 'Added Tags', value: taglist });
            if (iplist) embed.addFields({ name: 'Logged IPs', value: iplist });
    
            if (sourcebans == null) {
                sourcebans = await this.getSourceBans();
                let requireupload = false;
                let banlist = '';
                let bantext = '';

                for (let i = 0; i < sourcebans.length; i++) {
                    let ban = sourcebans[i];

                    let text = `${ban.url.split('/')[2]} - ${ban.reason}`;
                    bantext += text + '\n';

                    text = `[${text}](${ban.url})\n`;

                    if ((banlist + text).length > 950) {
                        requireupload = true;
                    } else {
                        banlist += text;
                    }
                }

                if (!banlist) {
                    banlist = '✅ None';
                } else if (requireupload) {
                    this.srcbansfile = { attachment: Buffer.from(bantext), name: 'bans.txt' };
                    banlist += `\`Check Attachment for full list\``;
                }

                embed.addFields({ name: 'Sourcebans', value: banlist }); 
            } else {
                embed.addFields({ name: 'Sourcebans', value: sourcebans }); 
            }
        }
    
        return [ embed ];
    }
    
    async getProfileComponents() {
        if (this.steamid == null) {
            return [];
        }

        const id64 = this.steamid.getSteamID64();
    
        var selectmenu = new SelectMenuBuilder()
                            .setCustomId(`modifytags:${this.steamid.getSteamID64()}`)
                            .setPlaceholder('Modify User Tags')
                            .setMaxValues(CONSTS.TAGS.length);
    
        let taglist = getTags(id64, this.guildid);
        for (let tag of CONSTS.TAGS) {
            selectmenu.addOptions({
                label: `${taglist[tag.value] ? 'Remove' : 'Add'} ${tag.name}`, 
                value: tag.value
            });
        }

        let selectrow = new ActionRowBuilder().addComponents(selectmenu);
        
        let buttonrow = new ActionRowBuilder().addComponents([
            new ButtonBuilder()
                .setCustomId(`moreinfo:${this.steamid.getSteamID64()}`)
                .setLabel('More Info')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`notifybutton:${this.steamid.getSteamID64()}`)
                .setLabel('Notifications')
                .setStyle(ButtonStyle.Primary)
            ]);

        if (this.cheatercount > 0) {
            buttonrow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`friendinfo:${this.steamid.getSteamID64()}`)
                    .setLabel('List Friends')
                    .setStyle(ButtonStyle.Primary)
            );
        }

        return [ selectrow, buttonrow ];
    }    

    getSourceBansFile() {
        return this.srcbansfile ? [ this.srcbansfile ] : null;
    }

    async getAlertList(timecreated = null) {
        const id64 = this.steamid.getSteamID64();
    
        let bandata = await getBanData(id64);
        let alertlist = '';

        if (bandata.vacbans > 0) {
            alertlist += `❌ ${bandata.vacbans} VAC Ban${(bandata.vacbans == 1 ? '' : 's')}\n`;
        } if (bandata.gamebans > 0) {
            alertlist += `❌ ${bandata.gamebans} Game Ban${(bandata.gamebans == 1 ? '' : 's')}\n`;
        } if (rust_token) {
            try {
                let rustdata = await axios.get(CONSTS.RUST_URL, { 
                    params: { apikey: rust_token, steamid64: id64 },
                    headers: { 'User-Agent': 'node-js-app' },
                    timeout: 1000,
                    validateStatus: () => true
                });

                if (!rustdata.data.error && rustdata.data.response[0].url) {
                    alertlist += '❌ Rust Ban\n';
                }
            } catch (error) {
                console.log('Error grabbing Rust Bandata');
            }
        } 
        
        if (bandata.communityban) {
            alertlist += '❌ Community Ban\n';
        } if (bandata.tradeban) {
            alertlist += '❌ Trade Ban\n';
        }
        
        const tags = getTags(id64, this.guildid);

        for (let i = 0; i < CONSTS.TAGS.length - 1; i++) {
            if (tags[CONSTS.TAGS[i].value]) {
                alertlist += `⚠️ ${CONSTS.TAGS[i].name}\n`;
            }    
        }

        if (this.cheatercount > 0) {
            alertlist += `⚠️ Friends with ${this.cheatercount} cheater${this.cheatercount == 1 ? '' : 's'}`;
        }    

        // Place Ban Watch/IP Logs Last
        if (tags['banwatch']) {
            alertlist += '\u2139\uFE0F Ban Watch\n';
        } if (Object.keys(getAddrs(id64)).length) {
            alertlist += '\u2139\uFE0F IP Logged\n';
        }
    
        if (timecreated != null) {
            let date = new Date(timecreated * 1000);
            if (date.getFullYear() <= 2006) {
                alertlist += `\u2139\uFE0F Made in ${date.getFullYear()}\n`;
            }
        }
    
        return alertlist.length ? alertlist : '✅ None';
    }    

    async getCheaterFriendCount() {
        let frienddata = {};
        
        try {
            let response = await axios.get(CONSTS.FRIEND_URL, { 
                params: { key: steam_token, steamid: this.steamid.getSteamID64() }, 
                validateStatus: () => true,
                timeout: 1500
            });

            frienddata = response.data;
        } catch (error) {
            return 0;
        }
    
        let cheatercount = 0;
    
        if (frienddata?.['friendslist']?.['friends']) {
            frienddata = frienddata.friendslist.friends;
            for (let i = 0; i < frienddata.length; i++) {
                const tags = getTags(frienddata[i].steamid, this.guildid);
                if (tags['cheater']) cheatercount++;
            } 
        }
    
        return cheatercount;
    }    

    async getSourceBans() {
        let sourcebans = [];
        let tasks = [];
        let data = [];
    
        for (let url of Object.keys(sourceban_urls)) {
            if (sourceban_urls[url] == 3) {
                url += CONSTS.SRCBAN_EXT + this.steamid.getSteam3RenderedID();
            } else if (sourceban_urls[url] == 2.1) {
                url += CONSTS.SRCBAN_EXT + this.steamid.getSteam2RenderedID(true);
            } else {
                url += CONSTS.SRCBAN_EXT + this.steamid.getSteam2RenderedID(false);
            }
            
            tasks.push(axios.get(url, { timeout: 3000, validateStatus: () => true }));
        }
    
        await Promise.allSettled(tasks).then(async (results) => {
            for (let i = 0; i < results.length; i++) {
                if (results[i].status == 'fulfilled') {
                    data.push(results[i]);
                }
            }
        },
        (rejected) => console.log(`${rejected.length} url errors`));
    
        for (let i in data) {
            if (!data[i].value.data) {
                continue;
            }
            
            let htmldata = HTMLParser.parse(data[i].value.data);
            let tables = htmldata.getElementsByTagName('table');
    
            for (let t in tables) {
                var tds = tables[t].getElementsByTagName('td');
                if (tds.length == 0 || !tds[0].innerText.includes('Ban Details')) {
                    continue;
                }
    
                var trs = tables[t].getElementsByTagName('tr');
                for (let row in trs) {
                    var nodes = trs[row].getElementsByTagName('td');
    
                    if (nodes.length > 1 && nodes[0].innerText == 'Reason') {
                        sourcebans.push({ url: data[i].value.config.url, reason: nodes[1].innerText });
                    }
                }
            }
        }
    
        return sourcebans;
    }    
}

module.exports = { 
    async createProfile(steamid, guildid) {
        return await ProfileBuilder.initialize(steamid, guildid);
    } 
};
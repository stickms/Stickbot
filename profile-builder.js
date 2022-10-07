const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, SelectMenuBuilder, ButtonStyle } = require('discord.js')
const { steam_token, sourceban_urls } = require('./config.json');
const { resolveSteamID, getBanData } = require('./bot-helpers.js');

const axios = require('axios').default;
const CONSTS = require('./bot-consts.js');

const HTMLParser = require('node-html-parser');
const SteamID = require('steamid');
const fs = require('fs');

class ProfileBuilder {
    constructor() {
        this.plist = JSON.parse(fs.readFileSync('./playerlist.json'));
    }

    static async create(steamid) {
        let r = new ProfileBuilder();
        r.steamid = await resolveSteamID(steamid);
        r.cheaterfriends = await r.getCheaterFriendCount();
        return r;
    }

    async getProfileEmbed(moreinfo = false, sourcebans = null) {
        if (this.steamid == null) {
            return null;
        }

        const id64 = this.steamid.getSteamID64();
    
        let response = await axios.get(CONSTS.SUMMARY_URL, { params: { key: steam_token, steamids: id64 } });
        let data = response.data.response.players[0];
    
        let idlist =   `${id64}
                        ${this.steamid.getSteam3RenderedID()}
                        ${this.steamid.getSteam2RenderedID(true)}\n`;
    
        if(data.profileurl.includes('id/')) {
            idlist += data.profileurl.split('/')[4];
        }
    
        const quicklinks = `[SteamRep](https://steamrep.com/profiles/${id64}/)
                            [SteamID.uk](https://steamid.uk/profile/${id64}/)
                            [Backpack.tf](https://backpack.tf/profiles/${id64}/)
                            [SteamDB](https://steamdb.info/calculator/${id64}/)`;
        
        const alertlist = await this.getAlertList(data.timecreated);
    
        const embed = new EmbedBuilder()
            .setColor(0xADD8E6)
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
    
            if (this.plist.hasOwnProperty(id64)) {
                let tagdata = this.plist[id64].tags;
                for (let tag in tagdata) {
                    taglist += `\`${tag}\` - <@${tagdata[tag].addedby}> on <t:${tagdata[tag].date}:D>\n`;
                }
                let addrdata = this.plist[id64].addresses;
                for (let addr in addrdata) {
                    iplist += `\`${addr}\` - *${addrdata[addr].game}* on <t:${addrdata[addr].date}:D>\n`;
                }
            }
    
            if (taglist) {
                embed.addFields({ name: 'Added Tags', value: taglist });
            } if (iplist) {
                embed.addFields({ name: 'Logged IPs', value: iplist });
            }
    
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
                    let hasteurl = await axios.post(CONSTS.PASTE_URL, bantext, { 
                        timeout: 1500, 
                        headers: { 'Content-Type': 'text/plain' } 
                    });        

                    if (hasteurl.data) {
                        banlist += `[\`Click to show all bans\`](${hasteurl.data.raw})`;
                    } else {
                        banlist += `\`Error when trying to upload ban list\``;
                    }        
                }

                embed.addFields({ name: 'Sourcebans', value: banlist }); 
            } else {
                embed.addFields({ name: 'Sourcebans', value: sourcebans }); 
            }
        }
    
        return embed;
    }
    
    async getProfileComponents() {
        if (this.steamid == null) {
            return null;
        }

        const id64 = this.steamid.getSteamID64();
    
        var selectmenu = new SelectMenuBuilder()
                            .setCustomId(`modifytags:${this.steamid.getSteamID64()}`)
                            .setPlaceholder('Modify User Tags')
                            .setMaxValues(CONSTS.TAGS.length);
    
        if (this.plist.hasOwnProperty(id64)) {
            let taglist = this.plist[id64].tags;
            for (let tag of CONSTS.TAGS) {
                selectmenu.addOptions({
                    label: `${taglist.hasOwnProperty(tag.value) ? 'Remove' : 'Add'} ${tag.name}`, 
                    value: tag.value
                });
            }
        }
        else {
            for (let tag of CONSTS.TAGS) {
                selectmenu.addOptions({label: `Add ${tag.name}`, value: tag.value});
            }
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

        if (this.cheaterfriends > 0) {
            buttonrow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`friendinfo:${this.steamid.getSteamID64()}`)
                    .setLabel('List Friends')
                    .setStyle(ButtonStyle.Primary)
            );
        }

        return [ selectrow, buttonrow ];
    }    

    async getAlertList(timecreated = null) {
        const id64 = this.steamid.getSteamID64();
    
        let alertlist = '';
    
        let bandata = await getBanData(id64);
        
        if (bandata.vacbans > 0) {
            alertlist += `❌ ${bandata.vacbans} VAC Ban${(bandata.vacbans == 1 ? '' : 's')}\n`;
        } if (bandata.gamebans > 0) {
            alertlist += `❌ ${bandata.gamebans} Game Ban${(bandata.gamebans == 1 ? '' : 's')}\n`;
        } if (bandata.communityban) {
            alertlist += '❌ Community Ban\n';
        } if (bandata.tradeban) {
            alertlist += '❌ Trade Ban\n';
        }
    
        let cheatercount = this.cheaterfriends;
    
        if (this.plist.hasOwnProperty(id64)) {
            for (let i = 0; i < CONSTS.TAGS.length - 1; i++) {
                if (this.plist[id64].tags.hasOwnProperty(CONSTS.TAGS[i].value)) {
                    alertlist += `⚠️ ${CONSTS.TAGS[i].name}\n`;
                }    
            }

            if (cheatercount > 0) {
                alertlist += `⚠️ Friends with ${cheatercount} cheater${cheatercount == 1 ? '' : 's'}`;
            }    

            // Place Ban Watch/IP Logs Last
            if (this.plist[id64].tags.hasOwnProperty('banwatch')) {
                alertlist += '\u2139\uFE0F Ban Watch\n';
            } if (this.plist[id64].addresses.length > 0) {
                alertlist += '\u2139\uFE0F IP Logged\n';
            }
        }
        else if (cheatercount > 0) {
            alertlist += `⚠️ Friends with ${cheatercount} cheater${cheatercount == 1 ? '' : 's'}`;
        }
    
        if (timecreated != null) {
            let date = new Date(timecreated * 1000);
            if (date.getFullYear() <= 2006) {
                alertlist += `\u2139\uFE0F Made in ${date.getFullYear()}\n`;
            }
        }
    
        if (!alertlist) {
            return '✅ None';
        }
    
        return alertlist;
    }    

    async getCheaterFriendCount() {
        let response = await axios.get(CONSTS.FRIEND_URL, { 
            params: { key: steam_token, steamid: this.steamid.getSteamID64() }, 
            validateStatus: () => true 
        });
    
        let frienddata = response.data;
        let cheatercount = 0;
    
        if (frienddata.hasOwnProperty('friendslist')) {
            frienddata = frienddata.friendslist.friends;
            for (let i = 0; i < frienddata.length; i++) {
                if (this.plist.hasOwnProperty(frienddata[i].steamid) && 
                    this.plist[frienddata[i].steamid].tags.hasOwnProperty('cheater')) {
                    cheatercount++;
                }
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
                url += CONSTS.SRCBAN_URL + this.steamid.getSteam3RenderedID();
            } else if (sourceban_urls[url] == 2.1) {
                url += CONSTS.SRCBAN_URL + this.steamid.getSteam2RenderedID(true);
            } else {
                url += CONSTS.SRCBAN_URL + this.steamid.getSteam2RenderedID(false);
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

module.exports = { ProfileBuilder };
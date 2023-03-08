const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, ButtonStyle } = require('discord.js')
const { steam_token, rust_token, sourceban_urls, address_guilds } = require('./config.json');
const { httpsGet, resolveSteamID, getBanData } = require('./bot-helpers.js');
const { getTags, getAddrs } = require('./database');

const CONSTS = require('./bot-consts.js');
const HTMLParser = require('node-html-parser');
const SteamID = require('steamid');

class SteamProfile {
    async init(steamid, guildid, moreinfo=false, known_sourcebans=null) {
        this.steamid = steamid;
        this.guildid = guildid;

        this.embeds = null;
        this.components = null;
        this.banfile = null;

        await this.countCheaterFriends();
        await this.generateEmbed(moreinfo, known_sourcebans);
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
        const summary_response = await httpsGet(CONSTS.SUMMARY_URL, {
            key: steam_token,
            steamids: this.steamid
        });

        if (!summary_response?.data?.response?.players?.[0]) {
            return;
        }

        this.summary = summary_response.data.response.players[0];

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
            const gameip = this.summary.gameserverip;
            const gameinfo = `**${data.gameextrainfo}**` +
                gameip ? ` on \`${gameip}\`` : '';
            
            embed.addFields({
                name: 'Now Playing',
                value: gameinfo
            });
        }

        if (moreinfo) {
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
        const bandata = await getBanData(this.steamid);
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

            if (rustdata?.data?.response?.[0]?.url) {
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
            const plural = $`cheater${this.cheaterfriends == 1 ? '' : 's'}`;
            alertlist.push(`⚠️ Friends with ${this.cheaterfriends}${plural}`);
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

            if (!response?.data?.steamrep?.reputation?.full) {
                return [];
            }

            return response.data.steamrep.reputation.full.split(',');
        } catch (error) {
            console.error(error);
            return [];
        }
    }

    async countCheaterFriends() {
        try {
            const response = await httpsGet(CONSTS.FRIEND_URL, {
                key: steam_token,
                steamid: this.steamid
            });

            if (!response?.data?.friendslist?.friends) {
                return;
            }

            const frienddata = response.data.friendslist.friends;

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

            shorttext += `\`Check Attachment for full list\``;
        } else if (!shorttext) {
            shorttext = '✅ None';
        }

        return shorttext;
    }

    async getSourceBans() {
        let sourcebans = [];
        let tasks = [];

        const converted = new SteamID(this.steamid);
    
        for (let url of Object.keys(sourceban_urls)) {
            const idfmt = sourceban_urls[url];
            url += CONSTS.SRCBAN_EXT;
            
            if (idfmt == 3) {
                url += converted.getSteam3RenderedID();
            } else if (idfmt == 2.1) {
                url += converted.getSteam2RenderedID(true);
            } else {
                url += converted.getSteam2RenderedID(false);
            }

            // Extended timeout because some bans sites are slow
            tasks.push(httpsGet(url, {}, 3000));
        }
    
        const results = await Promise.allSettled(tasks);
        if (!results?.length) {
            return [];
        }
    
        for (const result of results) {
            if (result?.status != 'fulfilled') {
                continue;
            }

            if (!result?.value?.data) {
                continue;
            }

            let htmldata = HTMLParser.parse(result.value.data);
            if (!htmldata) {
                continue;
            }

            let tables = htmldata.getElementsByTagName('table');
    
            for (const table of tables) {
                var tds = table.getElementsByTagName('td');
                if (!tds?.length) {
                    continue;
                }

                if (!tds[0].innerText.includes('Ban Details')) {
                    continue;
                }
    
                var trs = table.getElementsByTagName('tr');
                for (const row of trs) {
                    var nodes = row.getElementsByTagName('td');
    
                    if (nodes.length > 1 && nodes[0].innerText == 'Reason') {
                        sourcebans.push({
                            url: result.value.config.url,
                            reason: nodes[1].innerText
                        });
                    }
                }
            }
        }
    
        return sourcebans;
    }
}

module.exports = { 
    async getProfile(steamid, guildid, moreinfo=false, known_sourcebans=null) {
        const profile = new SteamProfile();
        await profile.init(steamid, guildid, moreinfo, known_sourcebans);
        return profile;
    } 
};
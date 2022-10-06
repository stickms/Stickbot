const { ProfileBuilder } = require('./profile-builder.js');
const { steam_token, banwatch_channel } = require('./config.json');
const axios = require('axios').default;
const fs = require('node:fs');

const CONSTS = require('./bot-consts.js');

async function updatePlayerData(client) {
	let plist = JSON.parse(fs.readFileSync('./playerlist.json'));
	let players = Object.keys(plist);

	let summarytasks = [];
	let bantasks = [];
	
	let summaries = [];
	let bandata = [];

    for (let i = 0; i < players.length; i += 100) {
		let idlist = players.slice(i, i + 100).join(',');

		summarytasks.push(axios.get(CONSTS.SUMMARY_URL, { 
			params: { 
				key: steam_token, 
				steamids: idlist 
			},
			timeout: 2000  
		}));

		bantasks.push(axios.get(CONSTS.BAN_URL, { 
			params: { 
				key: steam_token, 
				steamids: idlist 
			},
			timeout: 2000  
		}));
	}

	await Promise.allSettled(summarytasks).then(result => {
		for (let res of result) {
            if (res.status == 'fulfilled') {
				summaries.push(...res.value.data.response.players);
            }
        }
	}, rejected => console.log(`${rejected.length} banwatch errors`));

	await Promise.allSettled(bantasks).then(result => {
		for (let res of result) {
			if (res.status == 'fulfilled') {
				bandata.push(...res.value.data.players);
            }
        }
	}, rejected => console.log(`${rejected.length} banwatch errors`));

	let plupdates = []; 

	for (let bans of bandata) {
		let localbans = plist[bans.SteamId].bandata;
		let banmessages = [];

		if (bans.NumberOfVACBans != localbans.vacbans) {
			banmessages.push(bans.NumberOfVACBans > localbans.vacbans ? 'VAC Banned' : 'Un-VAC Banned');
			plist[bans.SteamId].bandata.vacbans = bans.NumberOfVACBans;
		} if (bans.NumberOfGameBans != localbans.gamebans) {
			banmessages.push(bans.NumberOfGameBans > localbans.gamebans ? 'Game Banned' : 'Un-Game Banned');
			plist[bans.SteamId].bandata.gamebans = bans.NumberOfGameBans;
		} if (bans.CommunityBanned != localbans.communityban) {
			banmessages.push(bans.CommunityBanned ? 'Community Banned' : 'Un-Community Banned');
			plist[bans.SteamId].bandata.communityban = bans.CommunityBanned;
		} if ((bans.EconomyBan == 'banned') != localbans.tradeban) {
			banmessages.push((bans.EconomyBan == 'banned') ? 'Trade Banned' : 'Un-Trade Banned');
			plist[bans.SteamId].bandata.tradeban = (bans.EconomyBan == 'banned');
		}

		if (banmessages.length) {
			plupdates.push({ steamid: bans.SteamId, message: banmessages.join(', ') });
		}
	}

	for (let profile of summaries) {
		let localaddr = plist[profile.steamid].addresses;

		if (!profile.hasOwnProperty('gameserverip')) {
			continue;
		}

		if (profile.gameserverip.split(':')[1] != '0') {
			continue;
		}

		localaddr[profile.gameserverip] = {
			game: profile.gameextrainfo ?? 'Unknown Game',
			date: Math.floor(Date.now() / 1000)
		};

		if (Object.keys(localaddr).length > 6) {
			let sorted = Object.entries(localaddr).sort(([,a], [,b]) => a.date - b.date);
			delete localaddr[sorted[0][0]];
		}

		plist[profile.steamid].addresses = localaddr;
	}

	fs.writeFileSync('./playerlist.json', JSON.stringify(plist, null, '\t'));

	let channel = client.channels.cache.get(banwatch_channel);
	for (let update of plupdates) {
		let profile = await ProfileBuilder.create(update.steamid);
		let embed = await profile.getProfileEmbed();
		let comps = await profile.getProfileComponents();
	
		await channel.send({
			content: `**${update.steamid}** has been **${update.message}**`,
			embeds: [ embed ],
			components: comps
		});
	}
}

module.exports = { updatePlayerData };
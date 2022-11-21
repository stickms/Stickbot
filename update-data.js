const { createProfile } = require('./profile-builder.js');
const { steam_token, banwatch_channel } = require('./config.json');
const axios = require('axios');
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
			timeout: 2000,
			validateStatus: () => true  
		}));

		bantasks.push(axios.get(CONSTS.BAN_URL, { 
			params: { 
				key: steam_token, 
				steamids: idlist 
			},
			timeout: 2000,
			validateStatus: () => true 
		}));
	}

	try {
		await Promise.allSettled(summarytasks).then(result => {
			for (const get of result) {
				if (get.status == 'fulfilled' && get.value?.data?.response?.players) {
					summaries.push(...get.value.data.response.players);
				}
			}
		});

		await Promise.allSettled(bantasks).then(result => {
			for (const get of result) {
				if (get.status == 'fulfilled' && get.value?.data?.players) {
					bandata.push(...get.value.data.players);
				}
			}
		});
	} catch(error) {
		console.log('Error occurred in Banwatch update');
	}

	let updatemessages = [];

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
			for (let guildid in plist[bans.SteamId].tags) {
				let builder = await createProfile(guildid, bans.SteamId);
				let message = {
					content: `**${bans.SteamId}** has been **${banmessages.join(', ')}**\n`,
					embeds: await builder.getProfileEmbed(),
					components: await builder.getProfileComponents(),
				};		

				if (plist[bans.SteamId].notifications[guildid]) {
					for (let userid of plist[bans.SteamId].notifications[guildid].ban) {
						message.content += `<@${userid}> `;
					}
				}

				updatemessages.push({ snowflake: banwatch_channel, message: message });
			}
		}
	}

	for (let profile of summaries) {
		let localaddr = plist[profile.steamid].addresses;

		if (!localaddr) {
			localaddr = plist[profile.steamid].addresses = {};
		}

		if (!profile.hasOwnProperty('gameserverip') || profile.gameserverip.split(':')[1] != '0') {
			continue;
		}

		localaddr[profile.gameserverip] = {
			game: profile.gameextrainfo ?? 'Unknown Game',
			date: Math.floor(Date.now() / 1000)
		};

		for (let guildid in plist[profile.steamid].tags) {
			if (plist[profile.steamid].notifications[guildid]) {
				let builder = await createProfile(guildid, profile.steamid);
				let message = {
					content: `**${profile.steamid}** has had a new IP Logged\n`,
					embeds: await builder.getProfileEmbed(),
					components: await builder.getProfileComponents(),
				};		

				for (let userid of plist[profile.steamid].notifications[guildid].log) {
					message.content += `<@${userid}> `;
				}

				updatemessages.push({ snowflake: banwatch_channel, message: message });
			}
		}

		// Delete oldest log if we have more than 6
		if (Object.keys(localaddr).length > 6) {
			let sorted = Object.entries(localaddr).sort(([,a], [,b]) => a.date - b.date);
			delete localaddr[sorted[0][0]];
		}

		plist[profile.steamid].addresses = localaddr;
	}

	fs.writeFileSync('./playerlist.json', JSON.stringify(plist, null, '\t'));

	for (let update of updatemessages) {
		let channel = await client.channels.fetch(update.snowflake);

		try {
			if (channel) await channel.send(update.message);
		} catch (error) {
			console.log(`Could not send update ${update}`);
		}
	}
}

module.exports = { updatePlayerData };
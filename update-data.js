const { createProfile } = require('./profile-builder.js');
const { steam_token, banwatch_channel } = require('./config.json');
const { db, getNotis, setBans, getBans, getAddrs, setAddrs } = require('./database');

const axios = require('axios');
const CONSTS = require('./bot-consts.js');

async function updatePlayerData(client) {
	let summarytasks = [];
	let bantasks = [];
	
	let summaries = [];
	let bandata = [];

	try {
		let players = Object.keys(db.players);

		for (let i = 0; i < players.length; i += 100) {
			let idlist = players.slice(i, i + 100).join(',');

			summarytasks.push(axios.get(CONSTS.SUMMARY_URL, { 
				params: { 
					key: steam_token, 
					steamids: idlist 
				},
				timeout: 2000,
				validateStatus: () => true  
			}).catch(e => e));

			bantasks.push(axios.get(CONSTS.BAN_URL, { 
				params: { 
					key: steam_token, 
					steamids: idlist 
				},
				timeout: 2000,
				validateStatus: () => true 
			}).catch(e => e));
		}

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
		//return console.log('Error occurred in Banwatch update');
	}

	let updatemessages = [];

	for (let data of bandata) {
		const curbans = getBans(data.SteamId);
		let bans = curbans;
		let banmessages = [];

		if (data.NumberOfVACBans != bans.vacbans) {
			banmessages.push(data.NumberOfVACBans > bans.vacbans ? 'VAC Banned' : 'Un-VAC Banned');
			bans.vacbans = data.NumberOfVACBans;
		} if (data.NumberOfGameBans != bans.gamebans) {
			banmessages.push(data.NumberOfGameBans > bans.gamebans ? 'Game Banned' : 'Un-Game Banned');
			bans.gamebans = data.NumberOfGameBans;
		} if (data.CommunityBanned != bans.communityban) {
			banmessages.push(data.CommunityBanned ? 'Community Banned' : 'Un-Community Banned');
			bans.communityban = data.CommunityBanned;
		} if ((data.EconomyBan == 'banned') != bans.tradeban) {
			banmessages.push((data.EconomyBan == 'banned') ? 'Trade Banned' : 'Un-Trade Banned');
			bans.tradeban = (data.EconomyBan == 'banned');
		}

		if (bans != curbans) {
			await setBans(steamid, bans);
		}

		if (banmessages.length) {
			for (let guildid in db.players[data.SteamId].tags) {
				let builder = await createProfile(guildid, bans.SteamId);
				let message = {
					content: `**${bans.SteamId}** has been **${banmessages.join(', ')}**\n`,
					embeds: await builder.getProfileEmbed(),
					components: await builder.getProfileComponents(),
				};		

				const notis = getNotis(bans.SteamId, guildid);

				if (notis.ban) {
					for (let userid of notis.ban) {
						message.content += `<@${userid}> `;
					}
				}

				updatemessages.push({ snowflake: banwatch_channel, message: message });
			}
		}
	}

	for (let profile of summaries) {
		if (!profile.hasOwnProperty('gameserverip') || profile.gameserverip.split(':')[1] != '0') {
			continue;
		}

		let addrs = getAddrs(profile.steamid);

		addrs[profile.gameserverip] = {
			game: profile.gameextrainfo ?? 'Unknown Game',
			date: Math.floor(Date.now() / 1000)
		};

		for (let guildid in db.players[profile.steamid].tags) {
			const notis = getNotis(profile.steamid, guildid);

			if (notis.log) {
				let builder = await createProfile(guildid, profile.steamid);
				let message = {
					content: `**${profile.steamid}** has had a new IP Logged\n`,
					embeds: await builder.getProfileEmbed(),
					components: await builder.getProfileComponents(),
				};		

				for (let userid of notis.log) {
					message.content += `<@${userid}> `;
				}	

				updatemessages.push({ snowflake: banwatch_channel, message: message });
			}
		}

		// Delete oldest log if we have more than 6
		if (Object.keys(addrs).length > 6) {
			let sorted = Object.entries(addrs).sort(([,a], [,b]) => a.date - b.date);
			delete addrs[sorted[0][0]];
		}

		await setAddrs(profile.steamid, addrs);
	}

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
const { createProfile } = require('./profile-builder.js');
const { steam_token, address_guilds } = require('./config.json');
const { getPlayers, getGuilds, getNotis, setBans, getBans, getAddrs, setAddrs, getBanwatch } = require('./database');

const axios = require('axios');
const CONSTS = require('./bot-consts.js');

async function updatePlayerData(client) {
	let summarytasks = [];
	let bantasks = [];
	
	let summaries = [];
	let bandata = [];

	try {
		const players = Object.keys(getPlayers());

		for (let i = 0; i < players.length; i += 100) {
			let idlist = players.slice(i, i + 100).join(',');

			summarytasks.push(axios.get(CONSTS.SUMMARY_URL, { 
				params: { 
					key: steam_token, 
					steamids: idlist 
				},
				timeout: 2000,
			}).catch(e => e));

			bantasks.push(axios.get(CONSTS.BAN_URL, { 
				params: { 
					key: steam_token, 
					steamids: idlist 
				},
				timeout: 2000,
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
		return;
	}

	let updatemessages = [];

	for (let data of bandata) {
		let bans = await getBans(data.SteamId, false);
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

		if (banmessages.length) {
			await setBans(data.SteamId, bans);

			for (let guildid of getGuilds(data.SteamId)) {
				let builder = await createProfile(data.SteamId, guildid);
				let message = {
					content: `**${data.SteamId}** has been **${banmessages.join(', ')}**\n`,
					embeds: await builder.getProfileEmbed(),
					components: await builder.getProfileComponents()
				};		

				const notis = getNotis(data.SteamId, guildid);

				if (notis.ban) {
					for (let userid of notis.ban) {
						message.content += `<@${userid}> `;
					}
				}

				const channel = getBanwatch(guildid);
				if (channel) {
					updatemessages.push({ snowflake: channel, message: message });
				}
			}
		}
	}

	for (let profile of summaries) {
		if (!profile['gameserverip'] || profile.gameserverip.split(':')[1] != '0') {
			continue;
		}

		let addrs = getAddrs(profile.steamid);
		const ipaddr = profile.gameserverip.split(':')[0];

		if (!addrs[ipaddr]) {
			for (let guildid of getGuilds(profile.steamid)) {
				const notis = getNotis(profile.steamid, guildid);

				if (notis.log && address_guilds.includes(guildid)) {
					let builder = await createProfile(profile.steamid, guildid);
					let message = {
						content: `**${profile.steamid}** has a new Address Log`,
						embeds: await builder.getProfileEmbed(true)
					};
	
					for (let userid of notis.log) {
						updatemessages.push({ snowflake: userid, message: message, dm: true });
					}	
	
				}
			}	
		}

		addrs[ipaddr] = {
			game: profile.gameextrainfo ?? 'Unknown Game',
			date: Math.floor(Date.now() / 1000)
		};

		// Delete oldest log if we have more than 6
		if (Object.keys(addrs).length > 6) {
			let sorted = Object.entries(addrs).sort(([,a], [,b]) => a.date - b.date);
			delete addrs[sorted[0][0]];
		}

		await setAddrs(profile.steamid, addrs);
	}

	for (let update of updatemessages) {
		try {
			let channel = update.dm ? await client.users.fetch(update.snowflake, { force: true }) : 
				await client.channels.fetch(update.snowflake);

			if (channel) await channel.send(update.message);
		} catch (error) {
			console.log(`Could not send update ${update}`);
		}
	}
}

module.exports = { updatePlayerData };
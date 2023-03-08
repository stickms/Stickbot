const { steam_token, address_guilds } = require('./config.json');
const { httpsGet, resolveSteamID } = require('./bot-helpers')
const { getProfile } = require('./profile-builder.js');
const { getPlayers, getGuilds, getNotis, setBans, getBans, 
		getAddrs, setAddrs, getBanwatch } = require('./database');

const CONSTS = require('./bot-consts.js');

async function updatePlayerData(client) {
	let summaries = [];
	let bandata = [];

	try {
		const players = Object.keys(getPlayers());

		for (let i = 0; i < players.length; i += 100) {
			let idlist = players.slice(i, i + 100).join(',');

			summaries.push(httpsGet(CONSTS.SUMMARY_URL, {
				key: steam_token, 
				steamids: idlist
			}));

			bandata.push(httpsGet(CONSTS.BAN_URL, {
				key: steam_token, 
				steamids: idlist
			}));
		}

		summaries = (await Promise.allSettled(summaries)).filter(x => {
			return x.status == 'fulfilled' && x.value?.data?.response?.players;
		}).map(x => x.value.data.response.players).flat();

		bandata = (await Promise.allSettled(bandata)).filter(x => {
			return x.status == 'fulfilled' && x.value?.data?.players;
		}).map(x => x.value.data.players).flat();
	} catch (error) {
		return;
	}

	let updatemessages = [];

	for (let data of bandata) {
		let bans = await getBans(data.SteamId);
		
		if (Object.keys(bans).length == 0) {
            continue;
        }

		let banmessages = [];

		if (data.NumberOfVACBans != bans.vacbans) {
			banmessages.push((data.NumberOfVACBans > bans.vacbans ? '' : 'Un-') + 'VAC Banned');
			bans.vacbans = data.NumberOfVACBans;
		} if (data.NumberOfGameBans != bans.gamebans) {
			banmessages.push((data.NumberOfGameBans > bans.gamebans ? '' : 'Un-') + 'Game Banned');
			bans.gamebans = data.NumberOfGameBans;
		} if (data.CommunityBanned != bans.communityban) {
			banmessages.push((data.CommunityBanned ? '' : 'Un-') + 'Community Banned');
			bans.communityban = data.CommunityBanned;
		} if ((data.EconomyBan == 'banned') != bans.tradeban) {
			banmessages.push(((data.EconomyBan == 'banned') ? '' : 'Un-') + 'Trade Banned');
			bans.tradeban = (data.EconomyBan == 'banned');
		}

		if (banmessages.length) {
			await setBans(data.SteamId, bans);

			for (let guildid of getGuilds(data.SteamId)) {
				const profile = await getProfile(data.SteamId, guildid);
				let message = {
					content: `**${data.SteamId}** has been **${banmessages.join(', ')}**\n`,
					embeds: profile.getEmbed(),
					components: profile.getComponents()
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

		if (addrs[ipaddr]) {
			continue;
		}

		for (const guildid of getGuilds(profile.steamid)) {
			const notis = getNotis(profile.steamid, guildid);
			if (!notis.log || !address_guilds.includes(guildid)) {
				continue;
			}

			const builder = await getProfile(profile.steamid, guildid);
			let message = {
				content: `**${profile.steamid}** has a new Address Log`,
				embeds: builder.getEmbed()
			};

			for (let userid of notis.log) {
				updatemessages.push({
					snowflake: userid,
					message: message,
					dm: true
				});
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
			console.error(error);
			// May be lacking perms, or user does not allow DMs
		}
	}
}

module.exports = { updatePlayerData };
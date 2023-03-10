const { steam_token, address_guilds } = require('./config.json');
const { httpsGet } = require('./bot-helpers')
const { getProfile } = require('./profile-builder.js');
const { getPlayers, getGuilds, getNotis, setBans, getBans, getAddrs, 
	setAddrs, getNames, setNames, getBanwatch } = require('./database');

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
			const prefix = data.NumberOfVACBans > bans.vacbans ? '' : 'Un-';
			banmessages.push(prefix + 'VAC Banned');
			bans.vacbans = data.NumberOfVACBans;
		} if (data.NumberOfGameBans != bans.gamebans) {
			const prefix = data.NumberOfGameBans > bans.gamebans ? '' : 'Un-';
			banmessages.push(prefix + 'Game Banned');
			bans.gamebans = data.NumberOfGameBans;
		} if (data.CommunityBanned != bans.communityban) {
			const prefix = data.CommunityBanned ? '' : 'Un-';
			banmessages.push(prefix + 'Community Banned');
			bans.communityban = data.CommunityBanned;
		} if ((data.EconomyBan == 'banned') != bans.tradeban) {
			const prefix = (data.EconomyBan == 'banned') ? '' : 'Un-';
			banmessages.push(prefix + 'Trade Banned');
			bans.tradeban = (data.EconomyBan == 'banned');
		}

		if (!banmessages.length) {
			continue;
		}

		await setBans(data.SteamId, bans);
		banmessages = banmessages.join(', ');

		for (let guildid of getGuilds(data.SteamId)) {
			const channel = getBanwatch(guildid);
			if (!channel) {
				continue;
			}

			const profile = await getProfile(data.SteamId, guildid);
			let message = {
				content: `**${data.SteamId}** has been **${banmessages}**\n`,
				embeds: profile.getEmbed(),
				components: profile.getComponents()
			};

			const notis = getNotis(data.SteamId, guildid);

			if (notis.ban) {
				for (const userid of notis.ban) {
					message.content += `<@${userid}> `;
				}
			}

			updatemessages.push({
				snowflake: channel,
				message: message
			});
		}
	}	

	for (let summary of summaries) {
		const addrupdates = await updateAddresses(summary);
		if (addrupdates?.length) {
			updatemessages.push(...addrupdates);
		}

		const nameupdates = await updateNames(summary);
		if (nameupdates?.length) {
			updatemessages.push(...nameupdates);
		}
	}

	for (let update of updatemessages) {
		try {
			const channel = !update.dm ? await client.channels.fetch(update.snowflake)
				: await client.users.fetch(update.snowflake, { force: true }); 

			if (channel) await channel.send(update.message);
		} catch (error) {
			console.error(error);
			// May be lacking perms, or user does not allow DMs
		}
	}
}

async function updateAddresses(summary) {
	if (!summary.gameserverip) {
		return;
	}

	if (summary.gameserverip.split(':')[1] != '0') {
		return;
	}

	let addrs = getAddrs(summary.steamid);
	const ipaddr = summary.gameserverip.split(':')[0];

	addrs[ipaddr] = {
		game: summary.gameextrainfo ?? 'Unknown Game',
		date: Math.floor(Date.now() / 1000)
	};

	// Delete oldest log if we have more than 6
	if (Object.keys(addrs).length > 6) {
		let sorted = Object.entries(addrs).sort(([,a], [,b]) => a.date - b.date);
		delete addrs[sorted[0][0]];
	}

	await setAddrs(summary.steamid, addrs);

	if (addrs[ipaddr]) {
		return;
	}

	let updatemessages = [];

	for (const guildid of getGuilds(summary.steamid)) {
		const notis = getNotis(summary.steamid, guildid);
		if (!notis.log || !address_guilds.includes(guildid)) {
			continue;
		}

		const profile = await getProfile(summary.steamid, guildid);
		let message = {
			content: `**${summary.steamid}** has a new Address Log`,
			embeds: profile.getEmbed()
		};

		for (let userid of notis.log) {
			updatemessages.push({
				snowflake: userid,
				message: message,
				dm: true
			});
		}
	}

	return updatemessages;
}

async function updateNames(summary) {
	let names = getNames(summary.steamid);
	const persona = JSON.stringify(summary.personaname);

	names[persona] = Math.floor(Date.now() / 1000);

	// Delete oldest log if we have more than 10
	if (Object.keys(names).length > 10) {
		let sorted = Object.entries(names).sort(([,a], [,b]) => a - b);
		delete names[sorted[0][0]];
	}

	await setNames(summary.steamid, names);

	if (Object.keys(names).length) {
		const current = Object.entries(names).sort(([,a], [,b]) => b - a)[0];
		if (current == persona) {
			return;
		}	
	}

	let updatemessages = [];

	for (const guildid of getGuilds(summary.steamid)) {
		const notis = getNotis(summary.steamid, guildid);
		if (!notis.name) {
			continue;
		}

		const profile = await getProfile(summary.steamid, guildid);
		let message = {
			content: `**${summary.steamid}** has changed his profile name`,
			embeds: profile.getEmbed()
		};

		for (let userid of notis.name) {
			updatemessages.push({
				snowflake: userid,
				message: message,
				dm: true
			});
		}
	}

	return updatemessages;
}

module.exports = { updatePlayerData };
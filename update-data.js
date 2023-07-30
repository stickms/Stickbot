const { address_guilds } = require('./config.json');
const { httpsGet, getSteamToken } = require('./bot-helpers')
const { getProfile } = require('./profile-builder.js');
const { getPlayers, getGuilds, getNotis, setBans, getBans, getAddrs, 
	setAddrs, getNames, setNames, getBanwatch } = require('./database');

const CONSTS = require('./bot-consts.js');

async function updatePlayerData(client) {
	const [ profiles, bandata ] = await getSummaries();
	if (!profiles || !bandata) {
		return;
	}

	let updates = [];

	for (const summary of bandata) {
		updates.push(updateBans(summary));
	}	

	for (const summary of profiles) {
		updates.push(updateAddresses(summary));
		updates.push(updateNames(summary));
	}

	updates = (await Promise.allSettled(updates)).filter(x => {
		return x.status == 'fulfilled' && x.value;
	}).map(x => x.value).flat();

	for (let update of updates) {
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

async function getSummaries() {
	try {
		let profiles = [];
		let bandata = [];

		const players = Object.keys(getPlayers());

		for (let i = 0; i < players.length; i += 100) {
			let idlist = players.slice(i, i + 100).join(',');

			profiles.push(httpsGet(CONSTS.SUMMARY_URL, {
				key: getSteamToken(), 
				steamids: idlist
			}));

			bandata.push(httpsGet(CONSTS.BAN_URL, {
				key: getSteamToken(), 
				steamids: idlist
			}));
		}

		profiles = (await Promise.allSettled(profiles)).filter(x => {
			return x.status == 'fulfilled' && x.value?.response?.players;
		}).map(x => x.value.response.players).flat();

		bandata = (await Promise.allSettled(bandata)).filter(x => {
			return x.status == 'fulfilled' && x.value?.players;
		}).map(x => x.value.players).flat();

		return [ profiles, bandata ];
	} catch (error) {
		return [ null, null ];
	}
}

async function updateBans(summary) {
	let bans = await getBans(summary.SteamId);
		
	if (Object.keys(bans).length == 0) {
		return;
	}

	let banmessages = [];

	if (summary.NumberOfVACBans != bans.vacbans) {
		const prefix = summary.NumberOfVACBans > bans.vacbans ? '' : 'Un-';
		banmessages.push(prefix + 'VAC Banned');
		bans.vacbans = summary.NumberOfVACBans;
	} if (summary.NumberOfGameBans != bans.gamebans) {
		const prefix = summary.NumberOfGameBans > bans.gamebans ? '' : 'Un-';
		banmessages.push(prefix + 'Game Banned');
		bans.gamebans = summary.NumberOfGameBans;
	} if (summary.CommunityBanned != bans.communityban) {
		const prefix = summary.CommunityBanned ? '' : 'Un-';
		banmessages.push(prefix + 'Community Banned');
		bans.communityban = summary.CommunityBanned;
	} if ((summary.EconomyBan == 'banned') != bans.tradeban) {
		const prefix = (summary.EconomyBan == 'banned') ? '' : 'Un-';
		banmessages.push(prefix + 'Trade Banned');
		bans.tradeban = (summary.EconomyBan == 'banned');
	}

	if (!banmessages.length) {
		return;
	}

	await setBans(summary.SteamId, bans);
	banmessages = banmessages.join(', ');

	let updatemessages = [];

	for (const guildid of getGuilds(summary.SteamId)) {
		const channel = getBanwatch(guildid);
		if (!channel) {
			continue;
		}

		const profile = await getProfile(summary.SteamId, guildid);
		let message = {
			content: `**${summary.SteamId}** has been **${banmessages}**\n`,
			embeds: profile.getEmbed(),
			components: profile.getComponents()
		};

		const notis = getNotis(summary.SteamId, guildid);

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

	return updatemessages;
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

	if (Object.keys(names).length) {
		const current = Object.entries(names).sort(([,a], [,b]) => b - a)[0][0];
		if (current == persona) {
			return;
		}	
	}

	names[persona] = Math.floor(Date.now() / 1000);

	// Delete oldest log if we have more than 10
	if (Object.keys(names).length > 6) {
		let sorted = Object.entries(names).sort(([,a], [,b]) => a - b);
		delete names[sorted[0][0]];
	}

	await setNames(summary.steamid, names);

	let updatemessages = [];

	for (const guildid of getGuilds(summary.steamid)) {
		const notis = getNotis(summary.steamid, guildid);
		if (!notis.name) {
			continue;
		}

		const profile = await getProfile(summary.steamid, guildid);
		let message = {
			content: `**${summary.steamid}** has changed their profile name`,
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
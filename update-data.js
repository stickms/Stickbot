const { address_guilds } = require('./config.json');
const { httpsGet, getSteamToken } = require('./bot-helpers')
const { getProfile } = require('./profile-builder.js');
const { getPlayers, getGuilds, getNotis, setBans, getBans, getAddrs, 
	setAddrs, getNames, setNames, getBanwatch } = require('./database');

const CONSTS = require('./bot-consts.js');

async function updatePlayerData(client) {
	const data = await getSummaries();
	if (!data) {
		return;
	}

	let updates = [];

	for (const entry of Object.entries(data)) {
		updates.push(updateBans(entry));
		updates.push(updateAddresses(entry));
		updates.push(updateNames(entry));
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
		let data = {};

		const players = Object.keys(getPlayers());

		for (let i = 0; i < players.length; i++) {
			data[players[i]] = { summary: {}, bandata: {} };

			if (i % 100 == 0) {
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
		}

		(await Promise.allSettled(profiles)).filter(x => {
			return x.status == 'fulfilled' && x.value?.response?.players?.player;
		}).map(x => { 
			for (const profile of x.value.response.players.player) {
				data[profile.steamid].summary = profile
			}
		});

		(await Promise.allSettled(bandata)).filter(x => {
			return x.status == 'fulfilled' && x.value?.players;
		}).map(x => { 
			//x.value.players;
			for (const profile of x.value.players) {
				data[profile.SteamId].bandata = profile
			}
		});

		return data;
	} catch (error) {
		console.log(error);
		return null;
	}
}

async function updateBans(entry) {
	let summary = entry[1].summary;
	let bandata = entry[1].bandata;

	let bans = await getBans(bandata.SteamId);
		
	if (Object.keys(bans).length == 0) {
		return;
	}

	let banmessages = [];

	if (bandata.NumberOfVACBans != bans.vacbans) {
		const prefix = bandata.NumberOfVACBans > bans.vacbans ? '' : 'Un-';
		banmessages.push(prefix + 'VAC Banned');
		bans.vacbans = bandata.NumberOfVACBans;
	} if (bandata.NumberOfGameBans != bans.gamebans) {
		const prefix = bandata.NumberOfGameBans > bans.gamebans ? '' : 'Un-';
		banmessages.push(prefix + 'Game Banned');
		bans.gamebans = bandata.NumberOfGameBans;
	} if (bandata.CommunityBanned != bans.communityban) {
		const prefix = bandata.CommunityBanned ? '' : 'Un-';
		banmessages.push(prefix + 'Community Banned');
		bans.communityban = bandata.CommunityBanned;
	} if ((bandata.EconomyBan == 'banned') != bans.tradeban) {
		const prefix = (bandata.EconomyBan == 'banned') ? '' : 'Un-';
		banmessages.push(prefix + 'Trade Banned');
		bans.tradeban = (bandata.EconomyBan == 'banned');
	}

	if (!banmessages.length) {
		return;
	}

	await setBans(bandata.SteamId, bans);
	banmessages = banmessages.join(', ');

	let updatemessages = [];

	for (const guildid of getGuilds(bandata.SteamId)) {
		const channel = getBanwatch(guildid);
		if (!channel) {
			continue;
		}

		const profile = await getProfile(bandata.SteamId, guildid, { 'summary': summary, 'bandata': bandata });
		let message = {
			content: `**${bandata.SteamId}** has been **${banmessages}**\n`,
			embeds: profile.getEmbed(),
			components: profile.getComponents()
		};

		const notis = getNotis(bandata.SteamId, guildid);

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

async function updateAddresses(entry) {
	let summary = entry[1].summary;
	let bandata = entry[1].bandata;

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

		const profile = await getProfile(summary.steamid, guildid, { 'summary': summary, 'bandata': bandata });
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

async function updateNames(entry) {
	let summary = entry[1].summary;
	let bandata = entry[1].bandata;

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

		const profile = await getProfile(summary.steamid, guildid, { 'summary': summary, 'bandata': bandata });
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
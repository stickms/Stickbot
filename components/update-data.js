import { httpsGet, getSteamToken } from './bot-helpers.js';
import { SUMMARY_URL, BAN_URL } from './bot-consts.js';
import { getProfile } from './profile-builder.js';
import { getAllDocuments, setBans, setServers, setNames, getBanwatch } from './database.js'
import { SERVER_GUILDS, LOCAL_SERVER_ONLY } from './bot-config.js';

export async function updatePlayerData(client) {
	const data = await getSummaries();
	if (!data) {
		return;
	}

	let updates = [];

	Object.values(data).forEach(entry => {
		if (!entry.dbdata) return;

		updates.push(updateBans(entry));
		updates.push(updateServers(entry));
		updates.push(updateNames(entry));
	});

	updates = (await Promise.allSettled(updates)).filter(x => {
		return x.status == 'fulfilled' && x.value;
	}).map(x => x.value).flat();

	updates.forEach(async update => {
		try {
			const channel = !update.dm ? await client.channels.fetch(update.snowflake)
				: await client.users.fetch(update.snowflake, { force: true });

			if (channel) await channel.send(update.message);
		} catch (error) {
			// May be lacking perms, or user does not allow DMs
		}
	});
}

async function getSummaries() {
	try {
		let profiles = [];
		let bandata = [];

		let data = {};

		const documents = await getAllDocuments();
		const players = documents.map(x => x._id);

		for (let i = 0; i < players.length; i++) {
			data[players[i]] = { summary: {}, bandata: {}, dbdata: {} };

			if (i % 100 == 0) {
				let idlist = players.slice(i, i + 100).join(',');

				profiles.push(httpsGet(SUMMARY_URL, {
					key: getSteamToken(), 
					steamids: idlist
				}));
	
				bandata.push(httpsGet(BAN_URL, {
					key: getSteamToken(), 
					steamids: idlist
				}));

				await new Promise(x => setTimeout(x, 5_000));
			}
		}

		(await Promise.allSettled(profiles)).filter(x => {
			return x.status == 'fulfilled' && x.value?.response?.players;
		}).forEach(x => { 
			for (const profile of x.value.response.players) {
				data[profile.steamid].summary = profile
			}
		});

		(await Promise.allSettled(bandata)).filter(x => {
			return x.status == 'fulfilled' && x.value?.players;
		}).forEach(x => { 
			for (const profile of x.value.players) {
				data[profile.SteamId].bandata = profile
			}
		});

		documents.forEach(x => {
			data[x._id].dbdata = x;
		});

		return data;
	} catch (error) {
		return null;
	}
}

async function updateBans(entry) {
	const summary = entry.summary;
	const bandata = entry.bandata;
	const dbdata = entry.dbdata;

	let bans = dbdata.bandata;
		
	if (Object.keys(bans ?? {}).length == 0) {
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

	for (const guildid of Object.keys(dbdata.tags ?? {})) {
		const channel = await getBanwatch(guildid);
		if (!channel) {
			continue;
		}

		const profile = await getProfile(bandata.SteamId, guildid, { 'summary': summary, 'bandata': bandata });
		let message = {
			content: `**${bandata.SteamId}** has been **${banmessages}**\n`,
			embeds: profile.getEmbed(),
			components: profile.getComponents()
		};

		const notis = dbdata.notifications?.[guildid];

		if (notis?.ban) {
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

async function updateServers(entry) {
	const summary = entry.summary;
	const bandata = entry.bandata;
	const dbdata = entry.dbdata;

	if (!summary.gameserverip) {
		return;
	}

	if (LOCAL_SERVER_ONLY && summary.gameserverip.split(':')[1] != '0') {
		return;
	}

	let servers = dbdata.servers ?? {};
	const server = LOCAL_SERVER_ONLY ? summary.gameserverip.split(':')[0] : summary.gameserverip;

	servers[server] = {
		game: summary.gameextrainfo ?? 'Unknown Game',
		date: Math.floor(Date.now() / 1000)
	};

	// Delete oldest log if we have more than 6
	if (Object.keys(servers).length > 6) {
		let sorted = Object.entries(servers).sort(([,a], [,b]) => a.date - b.date);
		delete servers[sorted[0][0]];
	}

	await setServers(summary.steamid, servers);

	if (servers[server]) {
		return;
	}

	let updatemessages = [];

	for (const guildid of Object.keys(dbdata.tags ?? {})) {
		const notis = dbdata.notifications?.[guildid];
		if (!notis?.log || !SERVER_GUILDS.includes(guildid)) {
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
	const summary = entry.summary;
	const bandata = entry.bandata;
	const dbdata = entry.dbdata;

	let names = dbdata.names ?? {};
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

	for (const guildid of Object.keys(dbdata.tags ?? {})) {
		const notis = dbdata.notifications?.[guildid];
		if (!notis?.name) {
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
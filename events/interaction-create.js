import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { setTags, getTags, setNotis, getNotis, getDocument } from '../components/database.js';
import { httpsGet, getSteamToken, uploadText } from '../components/bot-helpers.js';
import { getProfile } from '../components/profile-builder.js';
import { FRIEND_URL, SUMMARY_URL, PROFILE_URL, 
				EMBED_COLOR, NOTIFICATIONS } from '../components/bot-consts.js';
import { SERVER_GUILDS } from '../components/bot-config.js';

export const name = 'interactionCreate';

export async function execute(interaction) {
	const customid = interaction.customId;
	if (!customid?.includes(':')) {
		return;
	}

	switch (customid.split(':')[0]) {
		case 'moreinfo':
			return handleMoreInfo(interaction).catch(console.error);
		case 'friendinfo':
			return handleListFriends(interaction).catch(console.error);
		case 'notifybutton':
			return handleNotifyButton(interaction).catch(console.error);
		case 'modifytags':
			return handleModifyTags(interaction).catch(console.error);
		case 'notifymenu':
			return handleNotifyMenu(interaction).catch(console.error);
	}
}

async function handleMoreInfo(interaction) {
	let steamid = interaction.customId.split(':')[1];
	const oldcontent = interaction.message.content;

	if (oldcontent.startsWith('Fetching')) {
		return await interaction.reply({ 
			content: '❌ Error: Already fetching more info.', 
			ephemeral: true 
		});
	}

	await interaction.update({ 
		content: 'Fetching additional profile info...'
	});

	const profile = await getProfile(steamid, interaction.guildId, { 'moreinfo': true });
	await interaction.editReply({
		content: oldcontent,
		embeds: profile.getEmbed(),
		components: profile.getComponents()
	});
}

async function handleListFriends(interaction) {	
	let steamid = interaction.customId.split(':')[1];

	await interaction.deferReply();

	let friends = await httpsGet(FRIEND_URL, {
		key: getSteamToken(),
		steamid: steamid
	});

	friends = friends?.friendslist?.friends;

	if (!friends) {
		return await interaction.editReply({
			content: '❌ Error grabbing friends.'
		});
	}
	
	friends = friends.map(x => x.steamid);

	const cheaters = (await getDocument(friends)).filter(x => {
		return x.tags?.[interaction.guildId]?.cheater;
	}).map(x => x._id);

	let personadata = []; 

	for (let i = 0; i < cheaters.length; i += 100) {
		const chunk = cheaters.slice(i, i + 100);
		const chunkdata = await httpsGet(SUMMARY_URL, {
			key: getSteamToken(), 
			steamids: chunk.join(',')
		});

		if (chunkdata?.response?.players) {
			personadata.push(...chunkdata.response.players);	
		}
	}

	if (personadata.length == 0) {
		return await interaction.editReply({
			content: '❌ Error checking friend data.'
		});
	}

	personadata.sort((a, b) => { return a.steamid > b.steamid ? 1 : -1; });

	let shorttext = '';
	let fulltext = '';

	for (let data of personadata) {
		const label = `${data.steamid} - ${data.personaname}`;
		const buffer = `[${label}](${PROFILE_URL}${data.steamid}/)\n`
		
		fulltext += buffer;

		if ((shorttext + buffer).length <= 950) {
			shorttext += buffer;
		}
	} 

	if (fulltext.length > shorttext.length) {
		const url = await uploadText(fulltext.replaceAll('\n', '  \n'));
		if (url) shorttext += `[\`Click to view more friends\`](${url})`;
		else shorttext += '\`Error when uploading more friends\`';
	}

	let original = interaction.message.embeds[0];

	let embed = new EmbedBuilder()
		.setColor(EMBED_COLOR)
		.setAuthor(original.author)
		.setThumbnail(original.thumbnail.url)
		.addFields({ 
			name: `${original.author.name}\'s Cheater Friends`, 
			value: shorttext 
		});

	await interaction.editReply({ content: null, embeds: [ embed ] });
}

async function handleModifyTags(interaction) {
	await interaction.deferReply({ ephemeral: true });

	const steamid = interaction.customId.split(':')[1];
	let usertags = await getTags(steamid, interaction.guildId);

	interaction.values.forEach(value => {
		const op = value.split(':')[0];
		const tag = value.split(':')[1];

		if (usertags[tag] && op === 'rem') {
			delete usertags[tag];
		} else if (!usertags[tag] && op === 'add') {
			usertags[tag] = {
				addedby: interaction.user.id,
				date: Math.floor(Date.now() / 1000)
			};
		}
	});

	await setTags(steamid, interaction.guildId, usertags);

	const original = interaction.message.embeds[0];
	const banfield = original.fields.filter(x => x.name == 'Sourcebans');
	const sourcebans = banfield?.[0]?.value;

	const profile = await getProfile(steamid, interaction.guildId, {
		'moreinfo': !!sourcebans,
		'sourcebans': sourcebans
	});

	await interaction.message.edit({
		embeds: profile.getEmbed(),
		components: profile.getComponents()
	});

	await interaction.editReply({
		content: `✅ Modified tags for **${steamid}**`
	});
}

async function handleNotifyButton(interaction) {
	let steamid = interaction.customId.split(':')[1];
	let usernotis = await getNotis(steamid, interaction.guildId);

	const showlog = SERVER_GUILDS.includes(interaction.guildId);
	var selectmenu = new StringSelectMenuBuilder()
		.setCustomId(`notifymenu:${steamid}`)
		.setPlaceholder('Notification Settings')
		.setMaxValues(showlog ? NOTIFICATIONS.length : NOTIFICATIONS.length - 1);

	for (let noti of NOTIFICATIONS) {
		if (noti.value == 'log' && !showlog) {
			continue;
		}

		let hasnoti = usernotis[noti.value]?.includes(interaction.user.id);
		selectmenu.addOptions({
			label: `${hasnoti ? 'Don\'t notify on:' : 'Notify on:'} ${noti.name}`,
			value: noti.value
		});
	}

	await interaction.reply({
		content: `Change notifications for **${steamid}**`,
		components: [ new ActionRowBuilder().addComponents(selectmenu) ],
		ephemeral: true
	});
}

async function handleNotifyMenu(interaction) {
	let steamid = interaction.customId.split(':')[1];
	let usernotis = await getNotis(steamid, interaction.guildId);
	let userid = interaction.user.id;

	for (let event of interaction.values) {
		if (usernotis[event]?.includes(userid)) {
			usernotis[event] = usernotis[event].filter(x => x != userid);
		} else if (usernotis[event]) {
			usernotis[event].push(userid);
		} else {
			usernotis[event] = [ userid ];
		}
	}

	await setNotis(steamid, interaction.guildId, usernotis);
	await interaction.update({
		content: `✅ Modified notification settings for **${steamid}**`,
		components: []
	});
}
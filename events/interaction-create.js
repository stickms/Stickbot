const { steam_token, address_guilds } = require('../config.json');
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { setTags, getTags, setNotis, getNotis } = require('../database');
const { httpsGet } = require('../bot-helpers');
const { getProfile } = require('../profile-builder.js');
const CONSTS = require('../bot-consts.js');

module.exports = {
	name: 'interactionCreate',
	async execute(interaction) {
		const customid = interaction.customId;
		if (!customid?.includes(':')) {
			return;
		}

		switch (customid.split(':')[0]) {
			case 'moreinfo':
				return handleMoreInfo(interaction);
			case 'friendinfo':
				return handleListFriends(interaction);
			case 'notifybutton':
				return handleNotifyButton(interaction);
			case 'modifytags':
				return handleModifyTags(interaction);
			case 'notifymenu':
				return handleNotifyMenu(interaction);
		}
	},
};

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

	const profile = await getProfile(steamid, interaction.guildId, true);
	await interaction.editReply({
		content: oldcontent,
		embeds: profile.getEmbed(),
		components: profile.getComponents(),
		files: profile.getAttachments()
	});
}

async function handleListFriends(interaction) {	
	let steamid = interaction.customId.split(':')[1];

	await interaction.deferReply();

	let friends = await httpsGet(CONSTS.FRIEND_URL, {
		key: steam_token,
		steamid: steamid
	});

	if (!friends?.data?.friendslist?.friends) {
		return await interaction.editReply({
			content: '❌ Error grabbing friends.'
		});
	}

	let personadata = []; 

	friends = friends.data.friendslist.friends.filter(x => { 
		return getTags(x.steamid, interaction.guildId)['cheater'];
	});

	for (let i = 0; i < friends.length; i += 100) {
		try {
			const chunk = friends.slice(i, i + 100);
			const chunkdata = await httpsGet(CONSTS.SUMMARY_URL, {
				key: steam_token, 
				steamids: chunk.map(val => val.steamid).join(',') 
			});

			if (chunkdata?.data?.response?.players) {
				personadata.push(...chunkdata.data.response.players);	
			}
		} catch (error) {
			// Error with this API request
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
	let requireupload = false;
	let file = null;

	for (let data of personadata) {
		const label = `${data.steamid} - ${data.personaname}`;
		const buffer = `[${label}](${CONSTS.PROFILE_URL}${data.steamid}/)\n`
		
		fulltext += label + '\n';

		if ((shorttext + buffer).length > 950) {
			requireupload = true;
		} else {
			shorttext += buffer;
		}
	} 

	if (requireupload) {
        file = [ { attachment: Buffer.from(fulltext), name: 'friends.txt' } ];
		shorttext += '\`Check Attachment for full list\`';
	}

	let original = interaction.message.embeds[0];

	let embed = new EmbedBuilder()
		.setColor(CONSTS.EMBED_CLR)
		.setAuthor(original.author)
		.setThumbnail(original.thumbnail.url)
		.addFields({ 
			name: `${original.author.name}\'s Cheater Friends`, 
			value: shorttext 
		});

	await interaction.editReply({ content: null, embeds: [ embed ], files: file });
}

async function handleModifyTags(interaction) {
	const steamid = interaction.customId.split(':')[1];
	let usertags = getTags(steamid, interaction.guildId);

	for (let tag of interaction.values) {
		if (usertags[tag]) {
			delete usertags[tag];
		} else {
			usertags[tag] = {
				addedby: interaction.user.id,
				date: Math.floor(Date.now() / 1000)
			};
		}
	}

	await setTags(steamid, interaction.guildId, usertags);

	const original = interaction.message.embeds[0];
	const banfield = original.fields.filter(x => x.name == 'Sourcebans');
	const sourcebans = banfield?.[0]?.value;

	const profile = await getProfile(steamid, interaction.guildId, !!sourcebans, sourcebans);
	await interaction.update({
		embeds: profile.getEmbed(),
		components: profile.getComponents(),
		files: profile.getAttachments()
	});

	await interaction.followUp({
		content: `✅ Modified tags for **${steamid}**`,
		ephemeral: true
	});
}

async function handleNotifyButton(interaction) {
	let steamid = interaction.customId.split(':')[1];
	let usernotis = getNotis(steamid, interaction.guildId);

	var selectmenu = new StringSelectMenuBuilder()
		.setCustomId(`notifymenu:${steamid}`)
		.setPlaceholder('Notification Settings')
		.setMaxValues(CONSTS.NOTIFICATIONS.length);

	for (let noti of CONSTS.NOTIFICATIONS) {
		if (noti.value == 'log' && !address_guilds.includes(interaction.guildId)) {
			noti.name = 'Unimplemented';
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
	let usernotis = getNotis(steamid, interaction.guildId);
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
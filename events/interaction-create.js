const { steam_token, address_guilds } = require('../config.json');
const { createProfile } = require('../profile-builder.js');
const { EmbedBuilder, ActionRowBuilder, SelectMenuBuilder } = require('discord.js');
const { setTags, getTags, setNotis, getNotis } = require('../database');

const axios = require('axios');
const CONSTS = require('../bot-consts.js');

module.exports = {
	name: 'interactionCreate',
	async execute(interaction) {
		let customid = interaction.customId;

		try {
			if (interaction.isButton()) {
				if (customid.startsWith('moreinfo')) {
					await handleMoreInfo(interaction);
				} else if (customid.startsWith('friendinfo')) {
					await handleListFriends(interaction);
				} else if (customid.startsWith('notifybutton')) {
					await handleNotifyButton(interaction);
				}
			} else if (interaction.isSelectMenu()) {
				if (customid.startsWith('modifytags')) {
					await handleModifyTags(interaction);
				} else if (customid.startsWith('notifymenu')) {
					await handleNotifyMenu(interaction);
				}
			} 
		} catch (error) {
			try {
				await interaction.editReply({ 
					content: '❌ Error: Unknown Error while handling this interaction.' 
				});
			} catch (error2) {
				await interaction.reply({ 
					content: '❌ Error: Unknown Error while handling this interaction.', 
					ephemeral: true 
				});
			}	
		}
	},
};

async function handleMoreInfo(interaction) {
	let steamid = interaction.customId.split(':')[1];
	let original = interaction.message;

	if (original.content.startsWith('Fetching')) {
		return await interaction.reply({ 
			content: '❌ Error: Already fetching more info.', 
			ephemeral: true 
		});
	}

	const oldcontent = original.content;
	await interaction.update({ content: 'Fetching Source Bans...' });

	let builder = await createProfile(steamid, interaction.guildId);
	let embed = await builder.getProfileEmbed(true);
	let comps = await builder.getProfileComponents();
	let file = builder.getSourceBansFile(); 

	await interaction.editReply({ content: oldcontent, embeds: embed, components: comps, files: file });
}

async function handleListFriends(interaction) {
	await interaction.deferReply();
	
	let steamid = interaction.customId.split(':')[1];
	let friends = {};

	try {
		friends = (await axios.get(CONSTS.FRIEND_URL, { 
			params: { key: steam_token, steamid: steamid }, 
			timeout: CONSTS.REQ_TIMEOUT,
			validateStatus: () => true 
		})).data.friendslist.friends;
	} catch (error) {
		return await interaction.editReply({ content: '❌ Error grabbing friends.' });
	}

	let personadata = []; 

	friends = friends.filter(x => { 
		return getTags(x.steamid, interaction.guildId)['cheater'];
	});

	for (let i = 0; i < friends.length; i += 100) {
		try {
			let chunk = friends.slice(i, i + 100);
			let chunkdata = await axios.get(CONSTS.SUMMARY_URL, { 
				params: { 
					key: steam_token, 
					steamids: chunk.map(val => val.steamid).join(',') 
				}, 
				timeout: CONSTS.REQ_TIMEOUT,
				validateStatus: () => true 
			});

			personadata.push(...chunkdata.data.response.players);	
		} catch (error) {
			return await interaction.editReply({ content: '❌ Error checking friend data.' });
		}
	}

	personadata.sort((a, b) => { return a.steamid > b.steamid ? 1 : -1; });

	let friendslist = '';
	let friendstext = '';
	let requireupload = false;
	let file = null;

	for (let data of personadata) {
		let text = `${data.steamid} - ${data.personaname}`;
		friendstext += text + '\n';

		text = `[\`${data.steamid}\`](${CONSTS.PROFILE_URL}${data.steamid}/) - ${data.personaname}\n`;

		if ((friendslist + text).length > 950) {
			requireupload = true;
		} else {
			friendslist += text;
		}
	} 

	if (requireupload) {
        file = [ { attachment: Buffer.from(friendstext), name: 'friends.txt' } ];
		friendslist += `\`Check Attachment for full list\``;
	}

	let original = interaction.message.embeds[0];

	let embed = new EmbedBuilder()
		.setColor(CONSTS.EMBED_CLR)
		.setAuthor(original.author)
		.setThumbnail(original.thumbnail.url)
		.addFields({ 
			name: `${original.author.name}\'s Cheater Friends`, 
			value: friendslist 
		});

	await interaction.editReply({ content: null, embeds: [ embed ], files: file });
}

async function handleModifyTags(interaction) {
	let steamid = interaction.customId.split(':')[1];
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

	let original = interaction.message.embeds[0];
	let sourcebans = original.fields.filter(x => x.name == 'Sourcebans');

	let builder = await createProfile(steamid, interaction.guildId);
	let comps = await builder.getProfileComponents();
	let embed = null;

	if (sourcebans[0]) {
		embed = await builder.getProfileEmbed(true, sourcebans[0].value);
	} else {
		 embed = await builder.getProfileEmbed();
	}

	await interaction.update({ embeds: embed, components: comps });
	await interaction.followUp({ content: `✅ Modified tags for **${steamid}**`, ephemeral: true });
}

async function handleNotifyButton(interaction) {
	let steamid = interaction.customId.split(':')[1];
	let usernotis = getNotis(steamid, interaction.guildId);

	var selectmenu = new SelectMenuBuilder()
		.setCustomId(`notifymenu:${steamid}`)
		.setPlaceholder('Notification Settings')
		.setMaxValues(CONSTS.NOTIFICATIONS.length);

	for (let noti of CONSTS.NOTIFICATIONS) {
		if (noti.value == 'log' && !address_guilds.includes('963546826861080636')) {
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
	await interaction.update({ content: `✅ Modified notification settings for **${steamid}**`, components: [] });
}
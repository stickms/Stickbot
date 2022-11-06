const { steam_token, sourceban_urls } = require('../config.json');
const { createProfile } = require('../profile-builder.js');
const { EmbedBuilder, ActionRowBuilder, SelectMenuBuilder } = require('discord.js');
const { getProfileEntry, setProfileEntry, uploadText } = require('../bot-helpers.js');

const axios = require('axios').default;
const fs = require('fs');
const CONSTS = require('../bot-consts.js');

module.exports = {
	name: 'interactionCreate',
	async execute(interaction) {
		let customid = interaction.customId;

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
	},
};

async function handleMoreInfo(interaction) {
	let steamid = interaction.customId.split(':')[1];
	let original = interaction.message;

	if (original.content.startsWith('Fetching')) {
		await interaction.reply({ content: '❌ Error: Already fetching more info.', ephemeral: true });
		return;
	}

	await interaction.update({ content: 'Fetching Source Bans...' });

	let builder = await createProfile(interaction.guildId, steamid);
	
	let embed = await builder.getProfileEmbed(true);
	let comps = await builder.getProfileComponents();

	await interaction.editReply({ content: null, embeds: embed, components: comps });
}

async function handleListFriends(interaction) {
	let steamid = interaction.customId.split(':')[1];

	await interaction.deferReply();

	let plist = JSON.parse(fs.readFileSync('./playerlist.json'));
	let friends = {};

	try {
		friends = (await axios.get(CONSTS.FRIEND_URL, { 
			params: { key: steam_token, steamid: steamid }, 
			validateStatus: () => true 
		})).data.friendslist.friends;
	} catch (error) {
		await interaction.editReply({ content: '❌ Error grabbing friends.' });
		return;
	}

	let personadata = []; 

	friends = friends.filter(x => { 
		return plist[x.steamid] && 
			plist[x.steamid].tags[interaction.guildId] && 
			plist[x.steamid].tags[interaction.guildId]['cheater']
		});

	for (let i = 0; i < friends.length; i += 100) {
		try {
			let chunk = friends.slice(i, i + 100);
			let chunkdata = await axios.get(CONSTS.SUMMARY_URL, { 
				params: { 
					key: steam_token, 
					steamids: chunk.map(val => val.steamid).join(',') 
				}, 
				timeout: 1500
			} );

			personadata.push(...chunkdata.data.response.players);	
		} catch (error) {
			await interaction.editReply({ content: '❌ Error checking friend data.' });
			return;
		}
	}

	personadata.sort((a, b) => { return a.steamid > b.steamid ? 1 : -1; });

	let friendslist = '';
	let friendstext = '';
	let requireupload = false;

	for (let i in personadata) {
		let sid = personadata[i].steamid;
		let text = `${sid} - ${personadata[i].personaname}`;
		friendstext += text + '\n';

		text = `[\`${sid}\`](${CONSTS.PROFILE_URL}${sid}/) - ${personadata[i].personaname}\n`;

		if ((friendslist + text).length > 950) {
			requireupload = true;
		} else {
			friendslist += text;
		}
	} 

	if (requireupload) {
		let hasteurl = await uploadText(friendstext);

		if (hasteurl) {
			friendslist += `[\`Click to show all friends\`](${hasteurl})`;
		} else {
			friendslist += `\`Error when trying to upload friends list\``;
		}
	}

	let original = interaction.message.embeds[0];

	let embed = new EmbedBuilder()
		.setColor(0xADD8E6)
		.setAuthor(original.author)
		.setThumbnail(original.thumbnail.url)
		.addFields({ 
			name: `${original.author.name}\'s Cheater Friends`, 
			value: friendslist 
		});

	await interaction.editReply({ embeds: [ embed ] });
}

async function handleModifyTags(interaction) {
	let steamid = interaction.customId.split(':')[1];
	let pdata = await getProfileEntry(steamid);
	let guildid = interaction.guildId;

	for (let tag of interaction.values) {
		if (pdata.tags[guildid] && pdata.tags[guildid][tag]) {
			delete pdata.tags[guildid][tag];
		} else {
			pdata.tags[guildid] = { 
				[tag] : {
					addedby: interaction.user.id,
					date: Math.floor(Date.now() / 1000)
				}
			};
		}
	}

	await setProfileEntry(steamid, pdata);

	let original = interaction.message.embeds[0];
	let sourcebans = original.fields.filter(x => x.name == 'Sourcebans');

	let builder = await createProfile(interaction.guildId, steamid);
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
	let pdata = await getProfileEntry(steamid);
	let guildid = interaction.guildId;

	var selectmenu = new SelectMenuBuilder()
		.setCustomId(`notifymenu:${steamid}`)
		.setPlaceholder('Notification Settings')
		.setMaxValues(CONSTS.NOTIFICATIONS.length);

	if (pdata.notifications && pdata.notifications[guildid]) {
		let nolist = pdata.notifications[guildid];

		for (let noti of CONSTS.NOTIFICATIONS) {
			let hasnoti = nolist[noti.value] && nolist[noti.value].includes(interaction.user.id);
			selectmenu.addOptions({
				label: `${hasnoti ? 'Don\'t notify on:' : 'Notify on:'} ${noti.name}`, 
				value: noti.value
			});
		}
	}
	else {
		for (let noti of CONSTS.NOTIFICATIONS) {
			selectmenu.addOptions({label: `Notify on: ${noti.name}`, value: noti.value});
		}
	}

	await interaction.reply({
		content: `Change notifications for **${steamid}**`,
		components: [ new ActionRowBuilder().addComponents(selectmenu) ],
		ephemeral: true
	});
}

async function handleNotifyMenu(interaction) {
	let steamid = interaction.customId.split(':')[1];
	let pdata = await getProfileEntry(steamid);

	let userid = interaction.user.id;
	let guildid = interaction.guildId;

	if (!pdata.notifications[guildid]) {
		pdata.notifications[guildid] = {};
	}

	for (let event of interaction.values) {
		let arr = pdata.notifications[guildid][event];

		if (!arr) arr = [ userid ];
		else if (arr.includes(userid)) arr = arr.filter(x => x != userid);
		else arr.push(userid);

		pdata.notifications[guildid][event] = arr;
	}

	await setProfileEntry(steamid, pdata);

	await interaction.reply({ content: `✅ Modified notification settings for **${steamid}**`, ephemeral: true });
}
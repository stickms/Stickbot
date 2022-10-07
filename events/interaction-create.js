const { steam_token, sourceban_urls } = require('../config.json');
const { ProfileBuilder } = require('../profile-builder.js');
const { EmbedBuilder, ActionRowBuilder, SelectMenuBuilder } = require('discord.js');
const { newProfileEntry } = require('../bot-helpers.js');

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

	let builder = await ProfileBuilder.create(steamid);
	
	let embed = await builder.getProfileEmbed(true);
	let comps = await builder.getProfileComponents();

	await interaction.editReply({ content: null, embeds: embed, components: comps });
}

async function handleListFriends(interaction) {
	let steamid = interaction.customId.split(':')[1];

	await interaction.deferReply();

	let plist = JSON.parse(fs.readFileSync('./playerlist.json'));

    let friends = (await axios.get(CONSTS.FRIEND_URL, { 
        params: { key: steam_token, steamid: steamid }, 
        validateStatus: () => true 
    })).data.friendslist.friends;

	let personadata = []; 

	friends = friends.filter(x => { 
		return plist.hasOwnProperty(x.steamid) && 
			plist[x.steamid].tags.hasOwnProperty('cheater')
		});

	for (let i = 0; i < friends.length; i += 100) {
		let chunk = friends.slice(i, i + 100);
		let chunkdata = await axios.get(CONSTS.SUMMARY_URL, { 
			params: { 
				key: steam_token, 
				steamids: chunk.map(val => val.steamid).join(',') 
			} 
		} );

		personadata.push(...chunkdata.data.response.players);	
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
		let hasteurl = await axios.post(CONSTS.PASTE_URL, friendstext, { 
			timeout: 1500, 
			headers: { 'Content-Type': 'text/plain' } 
		});

		if (hasteurl.data) {
			friendslist += `[\`Click to show all friends\`](${hasteurl.data.raw})`;
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

	let plist = JSON.parse(fs.readFileSync('./playerlist.json'));

	if (!plist.hasOwnProperty(steamid)) {
		plist[steamid] = await newProfileEntry(steamid);
	}

	for (let tag of interaction.values) {
		if (plist[steamid].tags.hasOwnProperty(tag)) {
			delete plist[steamid].tags[tag];
		} else {
			plist[steamid].tags[tag] = {
				addedby: interaction.user.id,
				date: Math.floor(Date.now() / 1000)
			}
		}
	}

	fs.writeFileSync('./playerlist.json', JSON.stringify(plist, null, '\t'));

	let original = interaction.message.embeds[0];
	let sourcebans = original.fields.filter(x => x.name == 'Sourcebans');

	let builder = await ProfileBuilder.create(steamid);
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
	let plist = JSON.parse(fs.readFileSync('./playerlist.json'));
	let steamid = interaction.customId.split(':')[1];

	var selectmenu = new SelectMenuBuilder()
		.setCustomId(`notifymenu:${steamid}`)
		.setPlaceholder('Notification Settings')
		.setMaxValues(CONSTS.NOTIFICATIONS.length);

	if (plist.hasOwnProperty(steamid) && plist[steamid].notifications) {
		let nolist = plist[steamid].notifications;
		for (let noti of CONSTS.NOTIFICATIONS) {
			let hasnoti = nolist.hasOwnProperty(noti.value) && nolist[noti.value].includes(interaction.user.id);
			selectmenu.addOptions({
				label: `${hasnoti ? 'Remove notification for:' : 'Get notified on:'} ${noti.name}`, 
				value: noti.value
			});
		}
	}
	else {
		for (let noti of CONSTS.NOTIFICATIONS) {
			selectmenu.addOptions({label: `Get notified on: ${noti.name}`, value: noti.value});
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
	let plist = JSON.parse(fs.readFileSync('./playerlist.json'));

	if (!plist.hasOwnProperty(steamid)) {
		plist[steamid] = await newProfileEntry(steamid);
	}

	for (let event of interaction.values) {
		let arr = plist[steamid].notifications[event];
		if (!arr){
			arr = [ interaction.user.id ];
		} else if (arr.includes(interaction.user.id)) {
			arr = arr.filter(x => x != interaction.user.id);
		} else {
			arr.push(interaction.user.id);
		}
		plist[steamid].notifications[event] = arr;
	}

	fs.writeFileSync('./playerlist.json', JSON.stringify(plist, null, '\t'));

	await interaction.reply({ content: `✅ Modified notification settings for **${steamid}**`, ephemeral: true });
}
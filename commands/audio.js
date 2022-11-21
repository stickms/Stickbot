const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioResource, createAudioPlayer, getVoiceConnection, NoSubscriberBehavior, AudioPlayerStatus } = require('@discordjs/voice')
const CONSTS = require('../bot-consts')
const play = require('play-dl');

let queue = {};

module.exports = {
	data: [ 
		new SlashCommandBuilder()
		.setName('play')
		.setDescription('Play a song from a search query or url!')
		.addStringOption(option => 
			option.setName('query')
			.setDescription('Search from YouTube')
			.setRequired(true)
		),

		new SlashCommandBuilder()
		.setName('leave')
		.setDescription('Forces the bot to leave the current voice channel.'),

		new SlashCommandBuilder()
		.setName('skip')
		.setDescription('Skips the currently playing track.'),

		new SlashCommandBuilder()
		.setName('queue')
		.setDescription('Shows all of the current tracks in queue.')
		.addIntegerOption(option => 
			option.setName('page')
			.setDescription('Which page of queue should be shown?')
			.setRequired(false)
			.setMinValue(1)
		),

		new SlashCommandBuilder()
		.setName('nowplaying')
		.setDescription('Shows the currently playing track.')	 	 
	],

	async execute(interaction) {
		if (interaction.commandName == 'play') {
			commandPlay(interaction);
		} else if (interaction.commandName == 'leave') {
			commandLeave(interaction);
		} else if (interaction.commandName == 'skip') {
			commandSkip(interaction);
		} else if (interaction.commandName == 'nowplaying') {
			commandNowPlaying(interaction);
		} else if (interaction.commandName == 'queue') {
			commandQueue(interaction);
		}
	}
};

async function playAudio(guildId, url) {
	if (!url) return;

	const connection = getVoiceConnection(guildId);
	if (!connection) return;

	let stream = await play.stream(url);

	let resource = createAudioResource(stream.stream, { inputType: stream.type });
	let player = createAudioPlayer({
		behaviors: { noSubscriber: NoSubscriberBehavior.Play }
	});

	// TODO: Maybe add a "now playing" notification?
	// player.on(AudioPlayerStatus.Playing, () => {
	// });	

	player.on(AudioPlayerStatus.Idle, () => {
		queue[guildId].shift();
		playAudio(guildId, queue[guildId][0]); // Play next song in queue
	});	

	player.play(resource);
	connection.subscribe(player);
}

async function commandPlay(interaction) {
	if (!interaction.member.voice?.channel)  {
		return await interaction.reply('❌ Error: Please join a voice channel first.');
	}

	let connection = getVoiceConnection(interaction.guildId);
	if (!connection) {
		connection = joinVoiceChannel({
			channelId: interaction.member.voice.channel.id,
			guildId: interaction.guildId,
			adapterCreator: interaction.guild.voiceAdapterCreator
		});
	}

	let search = await play.search(interaction.options.getString('query'), { limit: 1 });
	if (!search[0]?.url) {
		return await interaction.reply('❌ Error: Could not find a related video.');
	}

	if (!queue[interaction.guildId]) queue[interaction.guildId] = [];

	queue[interaction.guildId].push(search[0].url);
	if (queue[interaction.guildId].length == 1) {
		playAudio(interaction.guildId, search[0].url);
	}

	try {
		const info = await play.video_basic_info(search[0].url);

		let embed = new EmbedBuilder()
			.setColor(CONSTS.EMBED_CLR)
			.setAuthor({ name: 'Queued Track', iconURL: 'https://i.imgur.com/h6tq25c.png' })
			.setThumbnail(info.video_details.thumbnails.pop().url)
			.setDescription(`[${info.video_details.title}](${info.video_details.url})`);

		await interaction.reply({ embeds: [ embed ] });
	} catch (error) {
		await interaction.reply('❌ Error: Could not find a related video.');
	}
}

async function commandLeave(interaction) {
	const connection = getVoiceConnection(interaction.guildId);
	connection.destroy();
}

async function commandSkip(interaction) {
	const connection = getVoiceConnection(interaction.guildId);
	if (!connection) {
		return await interaction.reply('❌ Error: Not currently playing any tracks.');
	}

	queue[interaction.guildId].shift();

	if (queue[interaction.guildId][0]) {
		await playAudio(interaction.guildId, queue[interaction.guildId][0]); 
	} else {
		// TODO: There's probably a better way of doing this, but
		// I don't want to have to keep track of all my AudioPlayers
		connection.state = { ...connection.state, subscription: null };
	}
}

async function commandNowPlaying(interaction) {
	const connection = getVoiceConnection(interaction.guildId);
	if (!connection || !queue[interaction.guildId]?.[0]) {
		return await interaction.reply('❌ Error: Not currently playing any tracks.');
	}

	const info = await play.video_basic_info(queue[interaction.guildId][0]);

	let embed = new EmbedBuilder()
		.setColor(EMBED_CLR)
		.setAuthor({ name: 'Now Playing', iconURL: 'https://i.imgur.com/h6tq25c.png' })
		.setThumbnail(info.video_details.thumbnails.pop().url)
		.setDescription(`[${info.video_details.title}](${info.video_details.url})`);

	await interaction.reply({ embeds: [ embed ] });
}

async function commandQueue(interaction) {
	let embed = new EmbedBuilder()
		.setColor(EMBED_CLR)
		.setAuthor({ name: 'Queue', iconURL: 'https://i.imgur.com/h6tq25c.png' });

	const length = queue[interaction.guildId]?.length;
	if (!length) {
		embed.setDescription('❌ Nothing in Queue');
		embed.setFooter({ text: 'Page 1/1' });
		return await interaction.reply({ embeds: [ embed ] });
	}

	const maxpages = Math.max(Math.ceil(length / 10), 1);
	const curpage = Math.min(Math.max(interaction.options.getInteger('page'), 1), maxpages);

	let infotasks = [];
	for (let i = (curpage - 1) * 10; i < Math.min(curpage * 10, length); i++) {
		infotasks.push(play.video_basic_info(queue[interaction.guildId][i]));
	}

	let infos = [];
	await Promise.allSettled(infotasks).then((result) => {
		for (let res of result) {
			if (res.status == 'fulfilled') {
				infos.push(res.value.video_details);
			} else {
				infos.push({
					title: '❌ Error: Unknown Track',
					url: 'https://youtube.com/'
				});
			}
		}
	});

	let desctext = '';

	for (let i = (curpage - 1) * 10; i < Math.min(curpage * 10, length); i++) {
		const curinfo = infos[i - (curpage - 1) * 10];
		if(!curinfo) continue;

		title = curinfo.title;
		if (title.length > 40) {
			title = title.substring(0, 40) + '...';
		}
		
		if (i == 0) {
			desctext += `**Now Playing:** [${title}](${curinfo.url})\n\n`;
		} else {
			desctext += `**${i + 1}.** [${title}](${curinfo.url})\n`;
		}
	}

	embed.setDescription(desctext);
	embed.setFooter({ text: `Page ${curpage}/${maxpages}` });
	await interaction.reply({ embeds: [ embed ] });
}
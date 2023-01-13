const { SlashCommandBuilder, EmbedBuilder, SlashCommandSubcommandBuilder } = require('discord.js');
const { soundcloud_id, spotify_id } = require('../config.json');
const { audiobot } = require('../audio-bot');
const CONSTS = require('../bot-consts');
const play = require('play-dl');

const { joinVoiceChannel, getVoiceConnection, 
		entersState, VoiceConnectionStatus } = require('@discordjs/voice');

play.setToken({
	spotify : {
        ...spotify_id
    },
	soundcloud: {
		client_id: soundcloud_id
	}
});

module.exports = {
	data: new SlashCommandBuilder()
	.setName('music')
	.setDescription('Music Bot commands!')
	.setDMPermission(false)
	.addSubcommand(command => command
		.setName('play')
		.setDescription('Play a song from a search query or url!')
		.addStringOption(option => option
			.setName('query')
			.setDescription('Search from YouTube, Spotify, or SoundCloud')
			.setRequired(true)
		).addBooleanOption(option => option
			.setName('shuffle')
			.setDescription('Shuffles the imported playlist/album')
		),
	).addSubcommand(command => command
		.setName('join')
		.setDescription('Have the bot join your current voice channel!'),
	).addSubcommand(command => command
		.setName('leave')
		.setDescription('Forces the bot to leave the current voice channel.'),
	).addSubcommand(command => command
		.setName('skip')
		.setDescription('Skips the currently playing track.'),
	).addSubcommand(command => command
		.setName('move')
		.setDescription('Moves a track to a new position in the queue.')
		.addIntegerOption(option => option
			.setName('track')
			.setDescription('Position of track to move')
			.setMinValue(2)
			.setRequired(true)
		).addIntegerOption(option => option
			.setName('position')
			.setDescription('Where to move the track')
			.setMinValue(2)
			.setRequired(true)
		)
	).addSubcommand(command => command
		.setName('clear')
		.setDescription('Clears the entire playlist.'),
	).addSubcommand(command => command
		.setName('loop')
		.setDescription('Clears the entire playlist.')
		.addStringOption(option => option
			.setName('mode')
			.setDescription('Loop mode')
			.setRequired(true)
			.addChoices(
				{ name: 'Disabled', value: 'off' },
				{ name: 'One Track', value: 'one' },
				{ name: 'All Tracks', value: 'all' },
			)
		)
	).addSubcommand(command => command
		.setName('queue')
		.setDescription('Shows all of the current tracks in queue.')
		.addIntegerOption(option => 
			option.setName('page')
			.setDescription('Which page of queue should be shown?')
			.setRequired(false)
			.setMinValue(1)
		)
	).addSubcommand(command => command
		.setName('nowplaying')
		.setDescription('Shows the currently playing track.')
	),

	async execute(interaction) {
		const command = interaction.options.getSubcommand();

		if (command == 'play') {
			commandPlay(interaction);
		} else if (command == 'join') {
			commandJoin(interaction);
		} else if (command == 'leave') {
			commandLeave(interaction);
		} else if (command == 'skip') {
			commandSkip(interaction);
		} else if (command == 'move') {
			commandMove(interaction);
		} else if (command == 'clear') {
			commandClear(interaction);
		} else if (command == 'loop') {
			commandLoop(interaction);
		} else if (command == 'nowplaying') {
			commandNowPlaying(interaction);
		} else if (command == 'queue') {
			commandQueue(interaction);
		}	
	}
};

async function commandPlay(interaction) {
	if (!interaction.member.voice?.channel)  {
		return await interaction.reply('❌ Error: Please join a voice channel first.');
	}

	await interaction.deferReply();

	let connection = getVoiceConnection(interaction.guildId);
	if (!connection) {
		connection = joinVoiceChannel({
			channelId: interaction.member.voice.channel.id,
			guildId: interaction.guildId,
			adapterCreator: interaction.guild.voiceAdapterCreator
		});

		connection.subscribe(audiobot.get(interaction.guildId).getPlayer());
	}

	// Handle disconnects
	connection.on(VoiceConnectionStatus.Disconnected, async (oldState, newState) => {
		try {
			await Promise.race([
				entersState(connection, VoiceConnectionStatus.Signalling, 2000),
				entersState(connection, VoiceConnectionStatus.Connecting, 2000),
			]);
		} catch (error) {
			connection.destroy();
			audiobot.get(interaction.guildId).resetAll();
		}
	});	

	const query = interaction.options.getString('query');
	let data = await resolveQuery(query);

	if (interaction.options.getBoolean('shuffle')) {
		// Technically not a truly random sort
		data.tracks.sort(() => Math.random() - 0.5);
	}

	if (!data.url) {
		return await interaction.editReply('❌ Error: Could not find that track.');
	}

	for (const track of data.tracks) {
		audiobot.get(interaction.guildId).addQueue(track, interaction.channelId);
	}

	try {
		const info = await trackData(data.url);
		if (!info.fields) {
			return await interaction.editReply('❌ Error: Could not load track info.');
		}

		let embed = new EmbedBuilder()
			.setColor(CONSTS.EMBED_CLR)
			.setThumbnail(info.thumbnail)
			.setAuthor({ 
				name: `Queued ${data.spotify ?? info.fields[0].name}`, 
				iconURL: CONSTS.MUSIC_ICON 
			});

		if (data.spotify) {
			embed.addFields({
				name: data.spotify,
				value: `Added \`${data.tracks.length}\` tracks to queue from Spotify`,
			});
		} else {
			embed.addFields(info.fields);
		}
		
		await interaction.editReply({ embeds: [ embed ] });
	} catch (error) {
		console.log(error);
		await interaction.editReply('❌ Error: Could not load video info.');
	}
}

async function commandJoin(interaction) {
	if (!interaction.member.voice?.channel)  {
		return await interaction.reply('❌ Error: Please join a voice channel first.');
	}

	const connection = joinVoiceChannel({
		channelId: interaction.member.voice.channel.id,
		guildId: interaction.guildId,
		adapterCreator: interaction.guild.voiceAdapterCreator
	});

	connection.on(VoiceConnectionStatus.Disconnected, async (oldState, newState) => {
		try {
			await Promise.race([
				entersState(connection, VoiceConnectionStatus.Signalling, 2000),
				entersState(connection, VoiceConnectionStatus.Connecting, 2000),
			]);
		} catch (error) {
			connection.destroy();
		}
	});	

	connection.subscribe(audiobot.get(interaction.guildId).getPlayer());
	await interaction.reply(`🎵 Joined voice channel <#${interaction.member.voice.channel.id}>`);
}

async function commandLeave(interaction) {
	const connection = getVoiceConnection(interaction.guildId);
	connection.destroy();

	await interaction.reply('🎵 Left the voice channel.');
}

async function commandSkip(interaction) {
	const connection = getVoiceConnection(interaction.guildId);
	const queue = audiobot.get(interaction.guildId).getQueue();
	if (!connection || !queue.length) {
		return await interaction.reply('❌ Error: Not currently playing any tracks.');
	}

	const info = await trackData(queue[0]);
	const title = info.fields[0].value.substring(1, info.fields[0].value.indexOf(']'));
	await interaction.reply(`🎵 Skipping **${title}**...`);

	audiobot.get(interaction.guildId).skip();
}

async function commandMove(interaction) {
	const connection = getVoiceConnection(interaction.guildId);

	// Not constant to allow for modifications
	let queue = audiobot.get(interaction.guildId).getQueue();

	const length = queue.length;
	if (!connection || !length) {
		return await interaction.reply('❌ Error: There are currently no tracks in queue.');
	}

	const tracknum = interaction.options.getInteger('track');
	const position = interaction.options.getInteger('position');

	if (tracknum > length) {
		return await interaction.reply('❌ Error: There is no track at that position in queue.');
	} else if (position > length) {
		position = length; // Clamp max value (so people can put '999' if they just want to put a track at the end)
	}

	const track = queue.splice(tracknum - 1, 1);
	queue.splice(position - 1, 0, ...track);

	const info = await trackData(queue[position - 1]);
	const title = info.fields[0].value.substring(1, info.fields[0].value.indexOf(']'));
	await interaction.reply(`🎵 Moved **${title}** to position \`[${position}]\``);
}

async function commandClear(interaction) {
	const connection = getVoiceConnection(interaction.guildId);
	const queue = audiobot.get(interaction.guildId).getQueue();
	if (!connection || !queue.length) {
		return await interaction.reply('❌ Error: There are currently no tracks in queue.');
	}

	audiobot.get(interaction.guildId).clear();
	await interaction.reply('🎵 Cleared Playlist!');
}

async function commandLoop(interaction) {
	const mode = interaction.options.getString('mode');
	audiobot.get(interaction.guildId).setLoop(mode);

	if (mode == 'one') {
		await interaction.reply('🎵 Playlist will now loop the current track.');
	} else if (mode == 'all') {
		await interaction.reply('🎵 Playlist will now loop all tracks.');
	} else {
		await interaction.reply('🎵 Playlist looping is now disabled.');
	}
}

async function commandNowPlaying(interaction) {
	const connection = getVoiceConnection(interaction.guildId);
	const queue = audiobot.get(interaction.guildId).getQueue();
	if (!connection || !queue.length) {
		return await interaction.reply('❌ Error: Not currently playing any tracks.');
	}

	const info = await trackData(queue[0]);
	if (!info.fields) {
		return await interaction.reply('❌ Error: Could not load track info.');
	}

	let embed = new EmbedBuilder()
		.setColor(CONSTS.EMBED_CLR)
		.setAuthor({ name: 'Now Playing', iconURL: CONSTS.MUSIC_ICON })
		.setThumbnail(info.thumbnail)
		.addFields(info.fields)
	
	await interaction.reply({ embeds: [ embed ] });
}

async function commandQueue(interaction) {
	let embed = new EmbedBuilder()
		.setColor(CONSTS.EMBED_CLR)
		.setAuthor({ name: 'Queue', iconURL: CONSTS.MUSIC_ICON });

	const queue = audiobot.get(interaction.guildId).getQueue();
	if (!queue.length) {
		embed.setDescription('❌ Nothing in Queue');
		embed.setFooter({ text: 'Page 1/1' });
		return await interaction.reply({ embeds: [ embed ] });
	}

	await interaction.deferReply();

	const maxpages = Math.max(Math.ceil(queue.length / 10), 1);
	const curpage = Math.min(Math.max(interaction.options.getInteger('page'), 1), maxpages);

	let infotasks = [];
	for (let i = (curpage - 1) * 10; i < Math.min(curpage * 10, queue.length); i++) {
		infotasks.push(trackData(queue[i]).catch(e => e));
	}

	let infos = [];
	await Promise.allSettled(infotasks).then((result) => {
		for (let res of result) {
			if (res.status == 'fulfilled') {
				infos.push(res.value.fields[0].value);
			} else {
				infos.push('❌ Error: Unknown Track');
			}
		}
	});

	let desctext = '';

	for (let i = (curpage - 1) * 10; i < Math.min(curpage * 10, queue.length); i++) {
		const curinfo = infos[i - (curpage - 1) * 10];
		if(!curinfo) continue;
		
		if (i == 0) {
			desctext += `**Now Playing:** ${curinfo}\n\n`;
		} else {
			desctext += `**${i + 1}.** ${curinfo}\n`;
		}
	}

	let thumbnail = await (await trackData(queue[0])).thumbnail;
	embed.setDescription(desctext);
	embed.setThumbnail(thumbnail);
	embed.setFooter({ text: `Page ${curpage}/${maxpages}` });

	await interaction.editReply({ embeds: [ embed ] });
}

// Resolves query as YT, SoundCloud, or Spotify*
// Anything unknown is assumed to be a YouTube search
// Returns an array of URLs
// Can be length one if a single video or track is requested
// *Spotify streaming not a thing, so it will search for Spotify tracks on YT
async function resolveQuery(query) {
	let valid = play.sp_validate(query);
	if (valid && valid != 'search') {
		const spot = await play.spotify(query);
		if (spot.type == 'track') {
			const search = await play.search(`${spot.artists[0].name} ${spot.name}`, { limit: 1 });
			return {
				url: search[0]?.url,
				tracks: search[0]?.url ? [ search[0]?.url ] : {}
			};
		} else { // 'album' or 'playlist'
			let promises = [];
			let data = [];
			for (const track of await spot.all_tracks()) {
				promises.push(play.search(`${track.artists[0].name} ${track.name}`, { limit: 1 }).catch(e => e));
			}

			await Promise.allSettled(promises).then((result) => {
				for (let res of result) {
					if (res.status == 'fulfilled' && res.value?.[0]?.url) {
						data.push(res.value?.[0]?.url);
					}
				}		
			});

			return {
				url: data[0],
				tracks: data,
				spotify: spot.type == 'album' ? 'Album' : 'Playlist'
			};
		}
	}

	valid = await play.so_validate(query);
	if (valid && valid != 'search') {
		const sound = await play.soundcloud(query);
		if (sound.type == 'track') {
			return {
				url: sound.url,
				tracks: [ query ]
			};
		} else if (sound.type == 'playlist') { // 'playlist'
			const tracks = await sound.all_tracks();
			return {
				url: sound.url,
				tracks: tracks.map(x => x.url)
			};
		} else { // 'user'
			return {};
		}
	}

	valid = play.yt_validate(query);
	if (query.startsWith('https') && valid && valid != 'search') {
		const type = play.yt_validate(query);
		if (type == 'video') {
			return {
				url: query,
				tracks: [ query ]
			};
		} else if (type == 'playlist') {
			const playlist = await play.playlist_info(query, { incomplete : true });
			const tracks = await playlist.all_videos();
			return {
				url: playlist.url,
				tracks: tracks.map(x => x.url)
			};
		}
	}

	// Otherwise, return a YouTube search query for it
	const search = await play.search(query, { limit: 1 });
	return {
		url: search[0]?.url,
		tracks: search[0]?.url ? [ search[0]?.url ] : {}
	};
}

function toDuration(str) {
	const num = parseInt(str);
	const secs = String(num % 60).padStart(2, '0');
	const mins = String(Math.floor((num / 60) % 60)).padStart(2, '0');
	const hrs = String(Math.floor(num / 3600)).padStart(2, '0');
	return `${hrs > 0 ? hrs : ''}:` + `${mins}:${secs}`;
}

// For use in embeds
// Spotify is here even though it's not fully supported streaming-wise
async function trackData(url) {
	let thumbnail = null;
	let fields = null;

	if (play.sp_validate(url)) {
		const spot = await play.spotify(url);
		thumbnail = spot.thumbnail;
		
		if (spot.type == 'track') {
			fields = [
				{
					name: 'Track', 
					value: `[${spot.name}](${spot.url})`,
					inline: true
				}, {
					name: 'Album', 
					value: `[${spot.album.name}](${spot.album.url})`,
					inline: true
				}, {
					name: 'Statistics', 
					value: `Duration: \`[${toDuration(spot.durationInSec)}]\``,
					inline: true
				}
			];
		} else if (spot.type == 'playlist') {
			fields = [
				{
					name: 'Playlist', 
					value: `[${spot.name}](${spot.url})`,
					inline: true
				}, {
					name: 'Created By', 
					value: `[${spot.owner.name}](${spot.owner.url})`,
					inline: true
				}, {
					name: 'Statistics', 
					value: `Tracks: ${spot.tracksCount}
					Description: \`[${spot.description ?? 'none'}]\``,
					inline: !!spot.description
				}
			];
		} else { // 'album'
			fields = [
				{
					name: 'Album', 
					value: `[${spot.name}](${spot.url})`,
					inline: true
				}, {
					name: 'Artist' + (spot.artists.length > 1 ? 's' : ''), 
					value: spot.artists.map(x => `[${x.name}](${x.url})`),
					inline: true
				}, {
					name: 'Statistics', 
					value: `Tracks: ${spot.tracksCount}
					Released: [${spot.release_date}]`,
					inline: true
				}
			];
		}
	} else if (await play.so_validate(url)) {
		const sound = await play.soundcloud(url);
		thumbnail = sound.thumbnail ?? sound.user.thumbnail;
		
		if (sound.type == 'track') {
			fields = [
				{
					name: 'Track', 
					value: `[${sound.name}](${sound.permalink})`,
					inline: true
				}, {
					name: 'Uploaded By', 
					value: `[${sound.user.name}](${sound.user.url})`,
					inline: true
				}, {
					name: 'Statistics', 
					value: `Duration: \`[${toDuration(sound.durationInSec)}]\``,
					inline: true
				}
			];
		} else if (sound.type == 'playlist') {
			fields = [
				{
					name: sound.sub_type == 'album' ? 'Album' : 'Playlist', 
					value: `[${sound.name}](${sound.url})`,
					inline: true
				}, {
					name: sound.sub_type == 'album' ? 'Artist' : 'Created By',  
					value: `[${sound.user.name}](${sound.user.url})`,
					inline: true
				}, {
					name: 'Statistics', 
					value: `Tracks: \`[${sound.tracksCount}]\``,
					inline: true
				}
			];
		}
	} else if (play.yt_validate(url)) {
		const type = play.yt_validate(url);
		if (type == 'video') {
			const info = (await play.video_basic_info(url)).video_details;
			thumbnail = info.thumbnails.pop().url;
			fields = [
				{
					name: 'Video', 
					value: `[${info.title}](${info.url})`,
					inline: true
				}, {
					name: 'Uploaded By', 
					value: `[${info.channel.name}](${info.channel.url})`,
					inline: true
				}, {
					name: 'Statistics', 
					value: `Views: ${info.views.toLocaleString("en-US")}
					Likes: ${info.likes.toLocaleString("en-US")}
					Duration: \`[${info.durationRaw}]\``,
					inline: false
				}
			];
		} else if (type == 'playlist') {
			const playlist = await play.playlist_info(url, { incomplete : true });
			thumbnail = playlist.thumbnail?.url;
			fields = [
				{
					name: 'Playlist', 
					value: `[${playlist.title}](${playlist.url})`,
					inline: true
				}, {
					name: 'Uploaded By', 
					value: `[${playlist.channel.name}](${playlist.channel.url})`,
					inline: true
				}, {
					name: 'Statistics', 
					value: `Views: ${playlist.views}
					Last Updated: \`${playlist.lastUpdate}\`
					Videos: \`[${playlist.videoCount}]\``,
					inline: false
				}
			];

			if (!playlist.channel.name) { // Likely a YouTube 'Mix' which has everything else null
				fields = [fields[0]];
			}
		}
	}

	return { 'thumbnail': thumbnail, 'fields': fields };
}
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { audiobot } from '../components/audio-bot.js';
import { httpsHead } from '../components/bot-helpers.js';
import { EMBED_COLOR, MUSIC_ICON } from '../components/bot-consts.js';
import { joinVoiceChannel, getVoiceConnection, 
				entersState, VoiceConnectionStatus } from '@discordjs/voice';
import jsmediatags from 'jsmediatags';
import axios from 'axios';

jsmediatags.Config.setDisallowedXhrHeaders(['Range']);

export const data = new SlashCommandBuilder()
	.setName('music')
	.setDescription('Music Bot commands!')
	.setDMPermission(false)
	.addSubcommand(command => command
		.setName('play')
		.setDescription('Play a song from a search query or url!')
		.addStringOption(option => option
			.setName('query')
			.setDescription('Search from YouTube, Spotify, SoundCloud, or direct file link!')
			.setRequired(true)
		)
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
	);

export async function execute(interaction) {
	switch (interaction.options.getSubcommand()) {
		case 'play':
			return commandPlay(interaction);
		case 'join':
			return commandJoin(interaction);
		case 'leave':
			return commandLeave(interaction);
		case 'skip':
			return commandSkip(interaction);
		case 'move':
			return commandMove(interaction);
		case 'clear':
			return commandClear(interaction);
		case 'loop':
			return commandLoop(interaction);
		case 'nowplaying':
			return commandNowPlaying(interaction);
		case 'queue':
			return commandQueue(interaction);
	}
}

async function commandPlay(interaction) {
	if (!interaction.member.voice?.channel)  {
		return await interaction.reply('❌ Error: Please join a voice channel first.');
	}

	await interaction.deferReply();

	let connection = getVoiceConnection(interaction.guildId);
	if (!connection) {
		try {
			connection = joinVoiceChannel({
				channelId: interaction.member.voice.channel.id,
				guildId: interaction.guildId,
				adapterCreator: interaction.guild.voiceAdapterCreator
			});
	
			connection.subscribe(audiobot.get(interaction.guildId).getPlayer());	
		} catch (error) {
			return await interaction.reply('❌ Error: Could not join voice channel.');
		}
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

	if (!data?.stream_url) {
		return await interaction.editReply('❌ Error: Could not find or load that track.');
	}

	audiobot.get(interaction.guildId).addQueue(data.url, data.stream_url, interaction.channelId);

	try {
		const info = await trackData(data.url);
		if (!info.fields) {
			return await interaction.editReply('❌ Error: Could not load track info.');
		}

		let embed = new EmbedBuilder()
			.setColor(EMBED_COLOR)
			.setThumbnail(info.thumbnail)
			.setAuthor({ 
				name: `Queued ${info.fields[0].name}`, 
				iconURL: MUSIC_ICON 
			})
			.addFields(info.fields);
		
		await interaction.editReply({ embeds: [ embed ], files: info.files });
	} catch (error) {
		await interaction.editReply('❌ Error: Could not load video info.');
	}
}

async function commandJoin(interaction) {
	if (!interaction.member.voice?.channel)  {
		return await interaction.reply('❌ Error: Please join a voice channel first.');
	}

	try {
		let connection = joinVoiceChannel({
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
	} catch (error) {
		return await interaction.reply('❌ Error: Could not join voice channel.');
	}
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
	const value = info.fields[0].value;
	const title = !value.startsWith('[') ? value : value.substring(1, value.indexOf(']'));
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
		return await interaction.reply(`❌ Error: There is no track at position \`${tracknum}\` in queue.`);
	} else if (position > length) {
		position = length; // Clamp max value (so people can put '999' if they just want to put a track at the end)
	}

	const track = queue.splice(tracknum - 1, 1);
	queue.splice(position - 1, 0, ...track);

	const info = await trackData(queue[position - 1]);
	const value = info.fields[0].value;
	const title = !value.startsWith('[') ? value : value.substring(1, value.indexOf(']'));
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
		.setColor(EMBED_COLOR)
		.setAuthor({ name: 'Now Playing', iconURL: MUSIC_ICON })
		.setThumbnail(info.thumbnail)
		.addFields(info.fields)
	
	await interaction.reply({ embeds: [ embed ], files: info.files });
}

async function commandQueue(interaction) {
	let embed = new EmbedBuilder()
		.setColor(EMBED_COLOR)
		.setAuthor({ name: 'Queue', iconURL: MUSIC_ICON });

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
		infotasks.push(trackData(queue[i]).catch(() => null));
	}

	const infos = (await Promise.allSettled(infotasks)).map(x => {
		if (x.status == 'fulfilled') {
			return x.value.fields[0].value;
		} else {
			return '❌ Error: Unknown Track';
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

	const leadinfo = await trackData(queue[0]);
	embed.setDescription(desctext);
	embed.setThumbnail(leadinfo.thumbnail);
	embed.setFooter({ text: `Page ${curpage}/${maxpages}` });

	await interaction.editReply({ embeds: [ embed ], files: leadinfo.files });
}

// Resolves query as YT, SoundCloud, or Spotify*
// Anything unknown is assumed to be a YouTube search
// Returns an array of URLs
// Can be length one if a single video or track is requested
async function resolveQuery(query) {
	const resp = await axios.post('https://downr.org/.netlify/functions/download', {
		'url': query
	});

	if (resp.status !== 200) {
		return null;
	}

	const data = resp.data;

	return {
		url: data.url,
		stream_url: data.medias.find((media) => media.type === 'audio')?.url ?? null
	}
}

function toDuration(str) {
	const num = parseInt(str);
	const secs = String(num % 60).padStart(2, '0');
	const mins = String(Math.floor((num / 60) % 60)).padStart(2, '0');
	const hrs = String(Math.floor(num / 3600)).padStart(2, '0');
	return `${hrs > 0 ? `${hrs}:` : ''}` + `${mins}:${secs}`;
}

// For use in embeds
// Spotify is here even though it's not fully supported streaming-wise
async function trackData(url) {
	let thumbnail = null;
	let fields = null;
	let files = null;

	const resp = await axios.post('https://downr.org/.netlify/functions/download', {
		url: url
	});

	if (resp.status !== 200) {
		return { 'thumbnail': thumbnail, 'fields': fields, 'files': files };
	}

	const data = resp.data;

	thumbnail = data.thumbnail;
	fields = [
		{
			name: 'Track',
			value: `[${data.title}](${data.url})`,
			inline: true
		}
	];

	// if (play.sp_validate(url)) {
	// 	const spot = await play.spotify(url);
	// 	thumbnail = spot.thumbnail;
		
	// 	if (spot.type == 'track') {
	// 		fields = [
	// 			{
	// 				name: 'Track', 
	// 				value: `[${spot.name}](${spot.url})`,
	// 				inline: true
	// 			}, {
	// 				name: 'Album', 
	// 				value: `[${spot.album.name}](${spot.album.url})`,
	// 				inline: true
	// 			}, {
	// 				name: 'Statistics', 
	// 				value: `Duration: \`[${toDuration(spot.durationInSec)}]\``,
	// 				inline: true
	// 			}
	// 		];
	// 	} else if (spot.type == 'playlist') {
	// 		fields = [
	// 			{
	// 				name: 'Playlist', 
	// 				value: `[${spot.name}](${spot.url})`,
	// 				inline: true
	// 			}, {
	// 				name: 'Created By', 
	// 				value: `[${spot.owner.name}](${spot.owner.url})`,
	// 				inline: true
	// 			}, {
	// 				name: 'Statistics', 
	// 				value: `Tracks: ${spot.tracksCount}
	// 				Description: \`[${spot.description ?? 'none'}]\``,
	// 				inline: !!spot.description
	// 			}
	// 		];
	// 	} else { // 'album'
	// 		fields = [
	// 			{
	// 				name: 'Album', 
	// 				value: `[${spot.name}](${spot.url})`,
	// 				inline: true
	// 			}, {
	// 				name: 'Artist' + (spot.artists.length > 1 ? 's' : ''), 
	// 				value: spot.artists.map(x => `[${x.name}](${x.url})`).join(', '),
	// 				inline: true
	// 			}, {
	// 				name: 'Statistics', 
	// 				value: `Tracks: ${spot.tracksCount}
	// 				Released: [${spot.release_date}]`,
	// 				inline: true
	// 			}
	// 		];
	// 	}
	// } else if (await play.so_validate(url)) {
	// 	const sound = await play.soundcloud(url);
	// 	thumbnail = sound.thumbnail ?? sound.user.thumbnail;
		
	// 	if (sound.type == 'track') {
	// 		fields = [
	// 			{
	// 				name: 'Track', 
	// 				value: `[${sound.name}](${sound.permalink})`,
	// 				inline: true
	// 			}, {
	// 				name: 'Uploaded By', 
	// 				value: `[${sound.user.name}](${sound.user.url})`,
	// 				inline: true
	// 			}, {
	// 				name: 'Statistics', 
	// 				value: `Duration: \`[${toDuration(sound.durationInSec)}]\``,
	// 				inline: true
	// 			}
	// 		];
	// 	} else if (sound.type == 'playlist') {
	// 		fields = [
	// 			{
	// 				name: sound.sub_type == 'album' ? 'Album' : 'Playlist', 
	// 				value: `[${sound.name}](${sound.url})`,
	// 				inline: true
	// 			}, {
	// 				name: sound.sub_type == 'album' ? 'Artist' : 'Created By',  
	// 				value: `[${sound.user.name}](${sound.user.url})`,
	// 				inline: true
	// 			}, {
	// 				name: 'Statistics', 
	// 				value: `Tracks: \`[${sound.tracksCount}]\``,
	// 				inline: true
	// 			}
	// 		];
	// 	}
	// } else if (play.yt_validate(url) != false && play.yt_validate(url) != 'search') {
	// 	const type = play.yt_validate(url);
	// 	if (type == 'video') {
	// 		const info = (await play.video_basic_info(url)).video_details;
	// 		thumbnail = info.thumbnails.pop().url;
	// 		fields = [
	// 			{
	// 				name: 'Video', 
	// 				value: `[${info.title}](${info.url})`,
	// 				inline: true
	// 			}, {
	// 				name: 'Uploaded By', 
	// 				value: `[${info.channel?.name}](${info.channel?.url})`,
	// 				inline: true
	// 			}, {
	// 				name: 'Statistics', 
	// 				value: `Views: ${info.views.toLocaleString("en-US")}
	// 				Likes: ${info.likes.toLocaleString("en-US")}
	// 				Duration: \`[${info.durationRaw}]\``,
	// 				inline: false
	// 			}
	// 		];
	// 	} else if (type == 'playlist') {
	// 		const playlist = await play.playlist_info(url, { incomplete : true });
	// 		thumbnail = playlist.thumbnail?.url;
	// 		fields = [
	// 			{
	// 				name: 'Playlist', 
	// 				value: `[${playlist.title}](${playlist.url})`,
	// 				inline: true
	// 			}, {
	// 				name: 'Uploaded By', 
	// 				value: `[${playlist.channel?.name}](${playlist.channel?.url})`,
	// 				inline: true
	// 			}, {
	// 				name: 'Statistics', 
	// 				value: `Views: ${playlist.views}
	// 				Last Updated: \`${playlist.lastUpdate}\`
	// 				Videos: \`[${playlist.videoCount}]\``,
	// 				inline: false
	// 			}
	// 		];

	// 		if (!playlist.channel?.name) { // Likely a YouTube 'Mix' which has everything else null
	// 			fields = [ fields[0] ];
	// 		}
	// 	}
	// } else { // Likely a direct file upload
	// 	fields = [{
	// 		name: 'Uploaded File',
	// 		value: `[${url.substring(url.lastIndexOf('/') + 1)}](${url})`,
	// 	}]

	// 	const tag = await new Promise((resolve, reject) => {
	// 		jsmediatags.read(url, {
	// 			onSuccess: tag => resolve(tag),
	// 			onError: error => resolve(error) // Resolve since we handle this error later anyways
	// 		})
	// 	});
		
	// 	if (tag.tags) {
	// 		if (tag.tags.title) {
	// 			fields = [{
	// 				name: 'Uploaded File',
	// 				value: `[${tag.tags.title}](${url})`,
	// 				inline: true
	// 			}]
	// 		}

	// 		if (tag.tags.artist) {
	// 			fields.push({
	// 				name: 'Artist',
	// 				value: tag.tags.artist,
	// 				inline: true
	// 			})
	// 		}

	// 		if (tag.tags.year) {
	// 			fields.push({
	// 				name: 'Year',
	// 				value: tag.tags.year,
	// 				inline: true
	// 			})
	// 		}

	// 		if (tag.tags.picture) {
	// 			const fmt = tag.tags.picture.format;
	// 			const type = fmt.substr(fmt.lastIndexOf('/') + 1);

	// 			files = [{
	// 				attachment: Buffer.from(tag.tags.picture.data),
	// 				name: `thumbnail.${type}`
	// 			}]

	// 			thumbnail = `attachment://thumbnail.${type}`;
	// 		}
	// 	}
	// }

	return { 'thumbnail': thumbnail, 'fields': fields, 'files': files };
}
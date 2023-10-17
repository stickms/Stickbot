// List of bot constants I use regularly

export const EMBED_COLOR = 0x3297A8;

export const SUMMARY_URL = 'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/';
export const FRIEND_URL = 'https://api.steampowered.com/ISteamUser/GetFriendList/v1/';
export const VANITY_URL = 'https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/';
export const BAN_URL = 'https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/';
export const STEAMREP_URL = 'https://steamrep.com/api/beta3/reputation/';
export const RUST_URL = 'https://rustbanned.com/api/eac_ban_check_v2.php';
export const DPASTE_URL = 'https://dpaste.com/api/v2/';

export const SOURCEBAN_EXT = 'index.php?p=banlist&advType=steam&advSearch=';
export const PROFILE_URL = 'https://steamcommunity.com/profiles/';
export const STEAM_ICON = 'https://i.imgur.com/uO7rwHu.png';
export const MUSIC_ICON = 'https://i.imgur.com/T3BQLEd.png';
export const INFO_ICON = 'https://i.imgur.com/5QESPfY.png';

export const PROFILE_TAGS = [
  { name: 'Cheater', value: 'cheater' },
  { name: 'Suspicious', value: 'suspicious' },
  { name: 'Content Creator', value: 'popular' },
  { name: 'Ban Watch', value: 'banwatch' }
];

export const NOTIFICATIONS = [
  { name: 'Ban', value: 'ban' },
  { name: 'Server Log', value: 'log' },
  { name: 'Name Change', value: 'name' }
];
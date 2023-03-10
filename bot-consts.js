// List of bot constants I use regularly

module.exports = {
    EMBED_CLR: 0x0398FC,

    SUMMARY_URL: 'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/',
    FRIEND_URL: 'https://api.steampowered.com/ISteamUser/GetFriendList/v1/',
    VANITY_URL: 'https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/',
    BAN_URL: 'https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/',
    STEAMREP_URL: 'https://steamrep.com/api/beta3/reputation/',
    RUST_URL: 'https://rustbanned.com/api/eac_ban_check_v2.php',

    SRCBAN_EXT: 'index.php?p=banlist&advType=steamid&advSearch=',
    PROFILE_URL: 'https://steamcommunity.com/profiles/',
    STEAM_ICON: 'https://i.imgur.com/uO7rwHu.png',
    MUSIC_ICON: 'https://i.imgur.com/T3BQLEd.png',

    TAGS: [
        { name: 'Cheater', value: 'cheater' },
        { name: 'Suspicious', value: 'suspicious' },
        { name: 'Content Creator', value: 'popular' },
        { name: 'Ban Watch', value: 'banwatch' }
    ],

    NOTIFICATIONS: [
        { name: 'Ban', value: 'ban' },
        { name: 'Address Log', value: 'log' },
        { name: 'Name Change', value: 'name' }
    ],
};
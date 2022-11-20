// List of bot constants I use regularly

module.exports = {
    SUMMARY_URL: 'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/',
    FRIEND_URL: 'https://api.steampowered.com/ISteamUser/GetFriendList/v1/',
    VANITY_URL: 'https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/',
    BAN_URL: 'https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/',
    RUST_URL: 'https://rustbanned.com/api/eac_ban_check_v2.php',

    SRCBAN_EXT: 'index.php?p=banlist&advType=steamid&advSearch=',
    PROFILE_URL: 'https://steamcommunity.com/profiles/',
    STEAM_ICON: 'https://i.imgur.com/uO7rwHu.png',
    PASTE_URL: 'https://hastebin.com/documents',

    TAGS: [
        { name: 'Cheater', value: 'cheater' },
        { name: 'Suspcious', value: 'suspicious' },
        { name: 'Content Creator', value: 'popular' },
        { name: 'Ban Watch', value: 'banwatch' }
    ],

    NOTIFICATIONS: [
        { name: 'Ban', value: 'ban' },
        { name: 'Address Log', value: 'log' }
    ],
};
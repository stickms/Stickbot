const { updatePlayerData } = require('../update-data.js');

module.exports = {
	name: 'ready',
	once: true,
	execute(client) {
		console.log(`Ready! Logged in as ${client.user.tag}`);
		setInterval(_ => { updatePlayerData(client).catch(e => e); }, 5 * 60 * 1000); // Every 5 minutes
	},
};
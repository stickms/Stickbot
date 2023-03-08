const { updatePlayerData } = require('../update-data.js');

module.exports = {
	name: 'ready',
	once: true,
	execute(client) {
		console.log(`Ready! Logged in as ${client.user.tag}`);
		setInterval(updatePlayerData, 300_000, client); // Every 5 minutes
	},
};
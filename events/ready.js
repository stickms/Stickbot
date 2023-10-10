const { updatePlayerData } = require('../update-data.js');

module.exports = {
	name: 'ready',
	once: true,

	execute(client) {
		console.log(`Ready! Logged in as ${client.user.tag}`);
		setInterval(updatePlayerData, 7_200_000, client); // every 2 hours
		client.user.setPresence({
			activities: [ { name: 'Slash Commands!', type: 2 } ]
		});
	},
};
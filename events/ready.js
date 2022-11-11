const { updatePlayerData } = require('../update-data.js');

module.exports = {
	name: 'ready',
	once: true,
	execute(client) {
		console.log(`Ready! Logged in as ${client.user.tag}`);
		updatePlayerData(client); 
		//setInterval(_ => { updatePlayerData(client); }, 5 * 60 * 1000); // Every 5 minutes
	},
};
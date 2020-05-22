/*
Deals with user commands and permissions.
*/
'use strict';

const SQLite = require('better-sqlite3');
const config = require('../config.json');
const userDB = new SQLite(config.userDB);

/*
Creates a userDB for a specific guild
@param {Discord.Guild} guild
*/
async function createUserDB(guild) {
	const dbCheck = await userDB.prepare('SELECT 1 FROM sqlite_master WHERE type=\'table\' AND name= ?;').get(guild.id);
	if(!dbCheck) {
		userDB.prepare('CREATE TABLE ? (userid INTEGER PRIMARY KEY, commandsUsed INTEGER, money INTEGER);').run(guild.id);
		userDB.prepare('CREATE UNIQUE INDEX idx_filename ON ? (userid);').run(guild.id);
		userDB.pragma('synchronous = 1');
		userDB.pragma('journal_mode = wal');
		console.log('User DB created for ' + guild.id);
	}
}
/*
Helper function to display top 10 users from a sql query in the userDB(not for 'trusted')
@param {Discord.message} message
@query [{userid INTEGER, commandsUsed INTEGER, money INTEGER}] query
*/
async function displayTop(message, query) {
	let result = '```';
	let limit = 10;
	for(let i = 0; i < Math.min(query.length, limit); i++) {
		if(message.guild.members.cache.get(query[i].userid)) {
			result += await message.guild.members.cache.get(query[i].userid).displayName + ': ' + query[i].commandsUsed + (query[i].commandsUsed === 1 ? '\n' : 's\n');
		}
		else{
			console.log(query[i].userid + ' not found! Deleting related entries.');
			userDB.prepare('DELETE FROM ? WHERE filename = ?').run(message.guild, query[i].userid);
			limit++;
		}
	}
	result += '```';
	return result;
}

module.exports = {
	createUserDB: createUserDB,
	displayTop: displayTop,
};
/*
Adds user to the trusted list "addTrustedUser *userid*"
@param {Discord.Message}
*/
module.exports.addTrustedUser = async function(message) {
	const command = message.content.split(' ');
	if(command.length !== 2) {
		message.channel.send('Incorrect syntax');
		return;
	}
	userDB.prepare('INSERT OR REPLACE INTO trusted (userid, permissions) VALUES (@username, @permissions);')
		.run({ username: command[1], permissions: 1 });
};

/*
Increment amount user has used command in guild.
@param {Discord.Guild} guild: guild where user is to be incremented
@param {Discord.User} user: user to be incremented
*/
module.exports.incrementUser = async function(guild, user) {
	if(!userDB.prepare('SELECT 1 FROM ? WHERE userid= ?;').get(guild.id, user.id)) {
		await userDB.prepare('INSERT INTO TABLE ? (userid, commandsUsed, money) VALUES (@userid, @commandsUsed, @money);').run(guild.id, { userid: user.id, commandsUsed: 1, money: 100 });
		console.log('User ' + user.id + ' created for ' + guild.id);
	}
	else {
		await userDB.prepare('UPDATE ? SET commandsUsed = commandUsed + 1 WHERE userid = ?').run(guild.id, user.id);
	}
};

/*
Display top users based on commands used in guild
@param {Discord.Message} message
*/
module.exports.mostUsed = async function(message) {
	const query = await userDB.prepare('SELECT * FROM ? ORDER BY commandsUsed DESC').all(message.guild.id);
	const result = await displayTop(message, query);
	message.channel.send('Top users by commands:\n' + result);
};

/*
Display top users based on money in guild
@param {Discord.Message} message
*/
module.exports.mostMoney = async function(message) {
	const query = await userDB.prepare('SELECT * FROM ? ORDER BY money DESC').all(message.guild.id);
	const result = await displayTop(message, query);
	message.channel.send('Top users by money:\n' + result);
};

/*
Prepares User DB, creating one for each guild and a trusted members list.
*/
module.exports.prepareUsers = async function(client) {
	client.guilds.map((guild) => {
		module.exports.createUserDB(guild);
	});
	const dbCheck = await userDB.prepare('SELECT 1 FROM sqlite_master WHERE type=\'table\' AND name= ?;').get('trusted');
	if(!dbCheck) {
		userDB.prepare('CREATE TABLE ? (userid INTEGER PRIMARY KEY, permissions INTEGER);').run('trusted');
		userDB.prepare('CREATE UNIQUE INDEX idx_filename ON ? (userid);').run('trusted');
		userDB.pragma('synchronous = 1');
		userDB.pragma('journal_mode = wal');
		console.log('User DB created for ' + 'trusted');
	}
};
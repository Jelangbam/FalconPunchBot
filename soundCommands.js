/*
File that handles the commands related to the audio functionality of the bot.
*/
'use strict';
const SQLite = require('better-sqlite3');
const config = require('./config.json');
const soundDB = new SQLite(config.soundDB);
const fs = require('fs');
const audioHandler = require('./audioHandler.js');
/*
Takes in a soundDB query using the all() and
returns string with filename, times played, alias, and description
@param {filename, description, timesPlayed} query
*/
async function printSoundQuery(query) {
	let result = '';
	for(let i = 0; i < Math.min(query.length, 10); i++) {
		result += (i + 1) + '. ' + query[i].filename + ': ' + query[i].description + '\n'
			+ 'Aliases: ';
		const aliases = await soundDB.prepare('SELECT * FROM aliases WHERE filename = ?')
			.all(query[i].filename);
		for(const answer of aliases) {
			result += answer.alias + ', ';
		}
		result = result.slice(0, -2) + ' | Times Played:' + query[i].timesPlayed + '\n' ;
	}
	return result;
}
/*
Takes in a soundDB query using the all() and
returns string with just filename and times played
@param [{filename, description, timesPlayed}] query
*/
function printShortSoundQuery(query) {
	let result = '';
	for(let i = 0; i < Math.min(query.length, 20); i++) {
		result += (i + 1) + '. ' + query[i].filename + ': ' + query[i].timesPlayed + ' time'
			+ (query[i].timesPlayed === 1 ? '' : 's') + '\n';
	}
	return result;
}

module.exports = {
	printSoundQuery: printSoundQuery,
	printShortSoundQuery: printShortSoundQuery,
};

module.exports.dbSize = function(message) {
	message.channel.send(soundDB.prepare('SELECT count(*) FROM sounds')
		.get()['count(*)']);
};

module.exports.mostPlayed = async function(message) {
	const query = await soundDB.prepare('SELECT * FROM sounds ORDER BY timesPlayed DESC').all();
	const result = module.exports.printShortSoundQuery(query);
	message.channel.send('Most Played Sound Clips:\n' + result);
};

module.exports.mostPlayedDetailed = async function(message) {
	const query = await soundDB.prepare('SELECT * FROM sounds ORDER BY timesPlayed DESC').all();
	const result = await module.exports.printSoundQuery(query);
	message.channel.send('Most Played Sound Clips:\n' + result);
};

module.exports.search = async function(message) {
	const query = await soundDB.prepare('SELECT * FROM sounds WHERE ' +
	'LOWER(filename || \' \' || description) LIKE ?')
		.all('%' + message.content.split(' ').slice(1).join(' ').toLowerCase() + '%');
	const result = await module.exports.printSoundQuery(query);
	// 10 results maximum for now... will adjust later?
	message.channel.send(query.length + ' record' + (query.length === 1 ? '' : 's')
		+ ' found!\n' + result);
};

module.exports.prepareSound = function(client) {
	const soundCheck = soundDB.prepare('SELECT count(*) FROM sqlite_master WHERE type=\'table\' AND name=\'sounds\';').get();
	if(!soundCheck['count(*)']) {
		soundDB.prepare('CREATE TABLE sounds (filename TEXT PRIMARY KEY, description TEXT, timesPlayed INTEGER);').run();
		soundDB.prepare('CREATE UNIQUE INDEX idx_filename ON sounds (filename);').run();
		soundDB.prepare('CREATE TABLE aliases (alias TEXT PRIMARY KEY, filename TEXT);').run();
		soundDB.prepare('CREATE UNIQUE INDEX idx_alias ON aliases (alias);').run();
		soundDB.pragma('synchronous = 1');
		soundDB.pragma('journal_mode = wal');
		console.log('Sound DB created!');
	}
	const checkSound = soundDB.prepare('SELECT count(*) FROM sounds WHERE filename = ?');
	const addSound = soundDB.prepare('INSERT OR REPLACE INTO sounds (filename, description, timesPlayed) VALUES (@filename, @description, @timesPlayed);');
	const addAlias = soundDB.prepare('INSERT OR REPLACE INTO aliases (alias, filename) VALUES (@alias, @filename);');
	for(const file of fs.readdirSync(config.soundDirectory)) {
		if(/.*(?:wav|mp3|ogg)/.test(file) && !(checkSound.get(file)['count(*)'])) {
			addSound.run({ filename: file, description: 'Change Me', timesPlayed: 0 });
			addAlias.run({ alias: `${file.slice(0, -4)}`, filename: file });
			console.log('added ' + file + ' to database!');
		}
	}
	client.guilds.map(guild => client.audioQueue.set(guild.id, []));
};

module.exports.soundFragment = function(client, message) {
	const combined = message.content.slice(config.prefix.length);
	if(soundDB.prepare('SELECT count(*) FROM aliases WHERE alias = ? OR filename = ?')
		.get(combined, combined)['count(*)']
		&& message.guild) {
		const voiceChannel = message.member.voice.channel;
		const filename = soundDB.prepare('SELECT filename FROM aliases WHERE alias = ? OR filename = ?')
			.get(combined, combined).filename;
		const fullPath = config.soundDirectory + filename;
		if(!voiceChannel) {
			message.channel.send('Please connect to a channel first!');
			return;
		}
		if(fs.existsSync(fullPath)) {
			soundDB.prepare('UPDATE sounds SET timesPlayed = timesPlayed + 1 WHERE filename = ?').run(filename);
			audioHandler.addAudio(client, voiceChannel, fullPath);
		}
		else {
			console.log(filename + ' not found! Deleting related entries.');
			soundDB.prepare('DELETE FROM sounds WHERE filename = ?').run(filename);
			soundDB.prepare('DELETE FROM aliases WHERE filename = ?').run(filename);
			message.channel.send('Sound file not found, sorry about that!'
				+ ' I deleted the command from the list to make you feel better.');
		}
	}
};
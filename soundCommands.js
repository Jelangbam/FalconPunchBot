/*
This file handles all commands related to sound features.
Commands handled: "alias add", "alias remove", "cleardata", "dbsize", "description",
"mostplayed", "mostplayeddetailed", "search", "searchword", "update"
*/

'use strict';
const SQLite = require('better-sqlite3');
const config = require('./config.json');
const soundDB = new SQLite(config.soundDB);
const fs = require('fs');
const audioHandler = require('./audioHandler.js');
const Discord = require('discord.js');

/*
message.content should have the format: -add alias "alias" "filename"
@param {Discord.Message} message
*/
async function aliasAdd(message) {
	const fragments = message.content.slice(config.prefix.length).split(' "');
	if(fragments.length !== 3) {
		message.channel.send('Invalid arguments! usage:' + config.prefix + 'alias add "*alias*" "*filename*"');
		return;
	}
	const alias = fragments[1].slice(0, -1);
	const filename = fragments[2].slice(0, -1);
	const fileQuery = await soundDB.prepare('SELECT 1 FROM sounds WHERE filename = ?').get(filename);
	const aliasQuery = await soundDB.prepare('SELECT 1 FROM aliases WHERE alias = ?').get(alias);
	if(aliasQuery) {
		message.channel.send('Error: Alias already used by ' + aliasQuery.filename);
		return;
	}
	if(!fileQuery) {
		message.channel.send('Error: File not found!');
		return;
	}
	soundDB.prepare('INSERT INTO aliases (alias, filename) VALUES (@alias, @filename);').run({ alias: alias, filename: filename });
	message.channel.send('Alias "' + alias + '" added for "' + filename + '"!');
}

/*
message.content should have the format: -remove alias "alias"
@param {Discord.Message} message
*/
async function aliasRemove(message) {
	const alias = message.content.slice(config.prefix.length).split('"')[1];
	const aliasQuery = await soundDB.prepare('SELECT * FROM aliases WHERE alias = ?').get(alias);
	if(!aliasQuery) {
		message.channel.send('Error: Alias not found!');
		return;
	}
	soundDB.prepare('DELETE FROM aliases WHERE alias = ?').run(alias);
	message.channel.send('Removed alias "' + alias + '" from db!');
}

/*
Takes in a soundDB query using the all() and
returns string with filename, times played, alias, and description
@param [{filename STRING, description STRING, timesPlayed INTEGER}] query
*/
async function printSoundQuery(query, offset = 0) {
	let result = '';
	if(query.length > 0) {
		result += '```';
		for(let i = offset; i < Math.min(query.length, 10 + offset); i++) {
			result += (i + 1) + '. ' + query[i].filename + ': ' + query[i].description + '\n'
				+ 'Aliases: ';
			const aliases = await soundDB.prepare('SELECT * FROM aliases WHERE filename = ?')
				.all(query[i].filename);
			for(const answer of aliases) {
				result += answer.alias + ', ';
			}
			result = result.slice(0, -2) + ' | Times Played: ' + query[i].timesPlayed + '\n' ;
		}
		result += '```';
	}
	return result;
}

/*
Takes in a soundDB query using the all() and
returns string with just filename and times played
@param [{filename STRING, description STRING, timesPlayed INTEGER}] query
*/
function printShortSoundQuery(query) {
	let result = '';
	if(query.length > 0) {
		result += '```';
		for(let i = 0; i < Math.min(query.length, 20); i++) {
			result += (i + 1) + '. ' + query[i].filename + ': ' + query[i].timesPlayed + ' time'
				+ (query[i].timesPlayed === 1 ? '' : 's') + '\n';
		}
		result += '```';
	}
	return result;
}
/*
Used to define helper functions for the remaining functions
*/
module.exports = {
	aliasAdd: aliasAdd,
	aliasRemove: aliasRemove,
	printSoundQuery: printSoundQuery,
	printShortSoundQuery: printShortSoundQuery,
};

/*
Handle both "alias add" and "alias remove"
@param {Discord.Message} message
*/
module.exports.alias = function(message) {
	const command = message.content.slice(config.prefix.length).toLowerCase().split(' ');
	if(command[1] === 'add') {
		module.exports.aliasAdd(message);
		return;
	}
	if(command[1] === 'remove') {
		module.exports.aliasRemove(message);
		return;
	}
	message.channel.send('Invalid alias command!');
};

/*
Clears timesPlayed in the database
@param {Discord.Message} message
*/
module.exports.clearData = function(message) {
	soundDB.prepare('UPDATE sounds SET timesPlayed = 0').run();
	message.channel.send('Sound data cleared!');
};
/*
Closes the sound database for shutdown
*/
module.exports.closeSound = async function() {
	await soundDB.close();
};
/*
Reports number of sound files in the DB
@param {Discord.Message} message
*/
module.exports.dbSize = function(message) {
	message.channel.send(soundDB.prepare('SELECT count(*) FROM sounds')
		.get()['count(*)']);
};

/*
Modifies description in the database with the filename given.
@param {Discord.Message} message
*/
module.exports.modifyDescription = function(message) {
	const fragments = message.content.slice(config.prefix.length).split(' "');
	if(fragments.length < 3) {
		message.channel.send('Invalid arguments! usage:' + config.prefix + 'description "*description*" "*filename*"');
		return;
	}
	const filename = fragments.pop().slice(0, -1);
	fragments.shift();
	const description = fragments.join(' "').slice(0, -1);
	if(!soundDB.prepare('SELECT 1 FROM sounds WHERE filename = ?').get(filename)) {
		message.channel.send('Error: File not found!');
		return;
	}
	soundDB.prepare('UPDATE sounds SET description = ? WHERE filename = ?').run(description, filename);
	message.channel.send('Description of "' + filename + '" changed to "' + description + '"!');
};

/*
Displays the top 20 most played files into the channel
@param {Discord.Message} message
*/
module.exports.mostPlayed = async function(message) {
	const query = await soundDB.prepare('SELECT * FROM sounds ORDER BY timesPlayed DESC').all();
	const result = module.exports.printShortSoundQuery(query);
	message.channel.send('Most Played Sound Clips:\n' + result);
};

/*
Displays the 10 most played files in more detail
@param {Discord.Message} message
*/
module.exports.mostPlayedDetailed = async function(message) {
	const query = await soundDB.prepare('SELECT * FROM sounds ORDER BY timesPlayed DESC').all();
	const result = await module.exports.printSoundQuery(query);
	message.channel.send('Most Played Sound Clips:\n' + result);
};

/*
Startup procedure to create DB and update it with new sound files
@param {Discord.Client} client
*/
module.exports.prepareSound = async function(client) {
	const soundCheck = soundDB.prepare('SELECT 1 FROM sqlite_master WHERE type=\'table\' AND name=\'sounds\';').get();
	if(!soundCheck) {
		soundDB.prepare('CREATE TABLE sounds (filename TEXT PRIMARY KEY, description TEXT, timesPlayed INTEGER);').run();
		soundDB.prepare('CREATE UNIQUE INDEX idx_filename ON sounds (filename);').run();
		soundDB.prepare('CREATE TABLE aliases (alias TEXT PRIMARY KEY, filename TEXT);').run();
		soundDB.prepare('CREATE UNIQUE INDEX idx_alias ON aliases (alias);').run();
		soundDB.pragma('synchronous = 1');
		soundDB.pragma('journal_mode = wal');
		console.log('Sound DB created!');
	}
	const checkSound = soundDB.prepare('SELECT 1 FROM sounds WHERE filename = ?');
	const addSound = soundDB.prepare('INSERT OR REPLACE INTO sounds (filename, description, timesPlayed) VALUES (@filename, @description, @timesPlayed);');
	const addAlias = soundDB.prepare('INSERT OR REPLACE INTO aliases (alias, filename) VALUES (@alias, @filename);');
	for(const file of fs.readdirSync(config.soundDirectory)) {
		if(/.*(?:\.wav|\.mp3|\.ogg)/.test(file) && !(checkSound.get(file))) {
			await addSound.run({ filename: file, description: 'Change Me', timesPlayed: 0 });
			await addAlias.run({ alias: `${file.slice(0, -4)}`, filename: file });
			console.log('added ' + file + ' to database!');
		}
	}
	if(fs.existsSync('./update.txt')) {
		const readline = require('readline');
		const rl = readline.createInterface({
			input: fs.createReadStream('./update.txt'),
			crlfDelay: Infinity,
		});
		rl.on('line', (line) => {
			const parts = line.split(',');
			const filename = parts[0] + '.' + parts[1];
			const description = parts.slice(2).join(',');
			if(soundDB.prepare('SELECT 1 FROM sounds WHERE filename = ?').get(filename)) {
				soundDB.prepare('UPDATE sounds SET description = ? WHERE filename = ?').run(description, filename);
				console.log('Successfully updated ' + filename + ' with description: ' + description);
			}
			else {
				console.log('Failed to find file ' + filename + '.');
			}
		});
		fs.rename('./update.txt', './completed-update.txt', function(err) {
			err ? console.log('ERROR: ' + err) : null;
		});
	}
	client.guilds.map(guild => client.audioQueue.set(guild.id, []));
};

/*
Searches DB for given string in aliases, filename, or description
@param {Discord.Message} message
*/
module.exports.search = async function(message) {
	const query = await soundDB.prepare('SELECT aliases.filename, sounds.description, sounds.timesPlayed, '
		+ 'GROUP_CONCAT(aliases.alias) as list FROM aliases ' +
		'INNER JOIN sounds ON aliases.filename = sounds.filename ' +
		'GROUP BY aliases.filename HAVING (aliases.filename || \' \' || description || \' \' || list) LIKE ?')
		.all('%' + message.content.split(' ').slice(1).join(' ') + '%');
	async function displayResult(offset) {
		const result = await module.exports.printSoundQuery(query, offset);
		await message.channel.send(query.length + ' record' + (query.length === 1 ? '' : 's')
			+ ' found! ' + (query.length > (10 + offset) ? 'Type `next` for next page:' : '') + '\n' + result);
		if(query.length > 10 + offset) {
			const collector = new Discord.MessageCollector(message.channel,
				(newMessage) =>	(newMessage.author.id === message.author.id),
				{ max: 20, maxMatches: 1 });
			collector.on('collect', (newMessage) => {
				if(newMessage.content.toLowerCase() === 'next') {
					displayResult(offset + 10);
				}
				collector.stop();
			});
		}
	}
	displayResult(0);
};

/*
Searches DB for given string as an isolated word in aliases, filename, or description
@param {Discord.Message} message
*/
module.exports.searchWord = async function(message) {
	const query = await soundDB.prepare('SELECT aliases.filename, sounds.description, sounds.timesPlayed, '
		+ 'GROUP_CONCAT(aliases.alias, \', \') as list FROM aliases ' +
		'INNER JOIN sounds ON aliases.filename = sounds.filename ' +
		'GROUP BY aliases.filename HAVING LOWER(aliases.filename || \' \' || description || \' \' || list || \' \') GLOB ?')
		.all('*[^a-z0-9]' + message.content.split(' ').slice(1).join(' ').toLowerCase() + '[^a-z0-9]*');
	async function displayResult(offset) {
		const result = await module.exports.printSoundQuery(query, offset);
		await message.channel.send(query.length + ' record' + (query.length === 1 ? '' : 's')
			+ ' found! ' + (query.length > (10 + offset) ? 'Type `next` for next page:' : '') + '\n' + result);
		if(query.length > 10 + offset) {
			const collector = new Discord.MessageCollector(message.channel,
				(newMessage) =>	(newMessage.author.id === message.author.id),
				{ max: 20, maxMatches: 1 });
			collector.on('collect', (newMessage) => {
				if(newMessage.content.toLowerCase() === 'next') {
					displayResult(offset + 10);
				}
				collector.stop();
			});
		}
	}
	displayResult(0);
};

/*
Checks the command for an associated sound file, if it exists then play the clip, otherwise ignore command.
@param {Discord.Client} client
@param {Discord.Message} message
*/
module.exports.soundFragment = function(client, message) {
	const combined = message.content.slice(config.prefix.length).toLowerCase();
	if(message.guild && soundDB.prepare('SELECT 1 FROM aliases WHERE LOWER(alias) = ? OR LOWER(filename) = ?')
		.get(combined, combined)) {
		const filename = soundDB.prepare('SELECT filename FROM aliases WHERE LOWER(alias) = ? OR LOWER(filename) = ?')
			.get(combined, combined).filename;
		const fullPath = config.soundDirectory + filename;
		if(!message.member.voice.channel) {
			message.channel.send('Please connect to a channel first!');
			return;
		}
		if(fs.existsSync(fullPath)) {
			soundDB.prepare('UPDATE sounds SET timesPlayed = timesPlayed + 1 WHERE filename = ?').run(filename);
			audioHandler.addAudio(client, message, fullPath);
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

/*
Checks the sound directory for new sound files.
*/
module.exports.updateSound = async function() {
	const checkSound = soundDB.prepare('SELECT 1 FROM sounds WHERE filename = ?');
	const addSound = soundDB.prepare('INSERT OR REPLACE INTO sounds (filename, description, timesPlayed) VALUES (@filename, @description, @timesPlayed);');
	const addAlias = soundDB.prepare('INSERT OR REPLACE INTO aliases (alias, filename) VALUES (@alias, @filename);');
	for(const file of fs.readdirSync(config.soundDirectory)) {
		if(/.*(?:\.wav|\.mp3|\.ogg)/.test(file) && !(checkSound.get(file))) {
			await addSound.run({ filename: file, description: 'Change Me', timesPlayed: 0 });
			await addAlias.run({ alias: `${file.slice(0, -4)}`, filename: file });
			console.log('added ' + file + ' to database!');
		}
	}
};
var Discord = require('discord.js');
var logger = require('winston');
var auth = require('./auth.json');
const ytdl = require('ytdl-core');
var fetchVideoInfo = require('youtube-info');
const util = require('util')

var global_volume = 0.5;
var global_play_duration = 15000;
var last_song_data = "";
var current_timer = "";


// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';


// Initialize the ff url data
var ffcount = 14;
var ff_url_data = [];

for (i = 1; i <= ffcount; i++) {
    ff_url_data[i] = get_ff_data(i);
}
logger.info("Data loaded..");


// Initialize Discord Bot
var bot = new Discord.Client();
bot.login(auth.token);

bot.on('ready', (message) => {
    logger.info('Connected to server');
});

bot.on('message', (message) => {
    if (message.content.substring(0, 1) == '!') {
        var args = message.content.substring(1).split(' ');
        var cmd = args[0].toLowerCase();
        logger.info("-----");
        logger.info("got message: !" + cmd);
        logger.info("-----");

        args = args.splice(1);
        switch(cmd) {
            case 'help':
                message.channel.send(" **!ffsong** will choose a random FF game and a random song, then join your voice channel and play that song.")
                message.channel.send(" **!duration X** will set the song to play for X seconds. (default 15 seconds)");
                message.channel.send(" **!replay** will replay the last song for its entire duration.");
                message.channel.send(" **!stop** or **!boot** will make the bot stop playing and leave the channel immediately.");
                message.channel.send(" **!volume X** Will set the global volume, 0 to 100.");
            break;
            case 'volume':
                var volume_changed = set_global_volume(args[0]);
                if (volume_changed) {
                    message.channel.send("Volume set to: " + global_volume * 100);
                } else {
                    message.channel.send("Pick a valid volume");
                }

            break;
            case 'stop':
            case 'boot':
                if (current_timer) {
                    clearTimeout(current_timer);
                }
                var voiceChannel = message.member.voiceChannel;
                try {
                    voiceChannel.leave();
                } catch (ex) {
                    logger.info(ex);
                }

            break;
            case 'duration':
                set_global_play_duration(args[0]);
                message.channel.send("All next songs will be played for: " + (global_play_duration / 1000) + " seconds");
            break;
            case 'replay':
                if(last_song_data == "") {
                    message.channel.send("No last song saved.");
                    return;
                }

                var voiceChannel = message.member.voiceChannel;
                if (!voiceChannel) {
                    message.channel.send("You must be in a voice channel to use this bot.");
                    return;
                }

                logger.info(util.inspect(last_song_data));
                message.channel.send("Replaying " + last_song_data.title);

                voiceChannel.join().then(connection => {
                    logger.info("joined channel");
                    const stream = ytdl(last_song_data.url, { filter : 'audioonly' });
                    const dispatcher = connection.playStream(stream, { seek: 0, volume: global_volume });

                    var stop = function stop_playback() {
                        logger.info("stopped playback");
                        dispatcher.end(); // or pause!
                        stream.destroy();
                        voiceChannel.leave();
                        current_timer = "";
                    }
                    logger.info("setting delay to video info duration: " + last_song_data.duration * 1000 + "s");
                    current_timer = setTimeout(stop, last_song_data.duration * 1000);
                }).catch(err => logger.error(err));

            break;
            case 'ffsong':
                var song_data = new SongData();

                fetchVideoInfo(song_data.url_id).then(function(videoInfo) {
                    var voiceChannel = message.member.voiceChannel;
                    if (!voiceChannel) {
                        message.channel.send("You must be in a voice channel to use this bot.");
                        return;
                    }
                    song_data.set_yt_data(videoInfo.title, videoInfo.duration);
                    last_song_data = song_data;
                    logger.info(util.inspect(song_data));

                    voiceChannel.join().then(connection => {
                        logger.info("joined channel");
                        const stream = ytdl(song_data.url, { filter : 'audioonly' });
                        const dispatcher = connection.playStream(stream, { seek: 0, volume: global_volume });

                        var stop = function stop_playback() {
                            logger.info("stopped playback");
                            dispatcher.end(); // or pause!
                            stream.destroy();
                            voiceChannel.leave();
                            message.channel.send("[" + song_data.roman_numeral + "] " + song_data.title);
                            message.channel.send(song_data.url);
                            current_timer = "";
                        }
                        current_timer = setTimeout(stop, song_data.play_duration_ms);
                    }).catch(err => logger.error(err));
                });
            break;
            default:
                message.channel.send("Not a valid command. Use the **!help** command.");
            }
    }
});


function SongData() {
    this.ff_game_number = get_random_int(1, ffcount);

    this.init = function() {
        ff_song_count = ff_url_data[this.ff_game_number].urls.length;
        this.song_index = get_random_int(0, ff_song_count - 1);
        this.url_id = ff_url_data[this.ff_game_number].urls[this.song_index];
        this.url = "https://www.youtube.com/watch?v=" + this.url_id;
        this.roman_numeral =  ff_url_data[this.ff_game_number].roman_numeral;
    };

    this.set_yt_data = function(title, duration) {
        this.title = title;
        this.duration = duration;
        this.play_duration_ms = this.determine_song_play_duration_ms();
    }

    this.determine_song_play_duration_ms = function() {
        return (global_play_duration > this.duration ? global_play_duration : this.duration * 1000 );
    }

    this.duration_ms = function() {
        return (this.duration * 1000);
    }

    this.init();
}

function set_global_play_duration(text) {
    try {
        var num = parseInt(text);
        global_play_duration = num * 1000;
    } catch(ex) {
        logger.error(ex);
    }
};
function set_global_volume(text) {
    try {
        var num = parseInt(text);
        logger.info("volume is: " + num / 100);
        if ((num <= 100) && (num >= 0)) {
            global_volume = num / 100;
            return true;
        } else {
            return false;
        }
    } catch(ex) {
        logger.error(ex);
        return false;
    }
};
/**
 * Returns a random integer between min (inclusive) and max (inclusive)
 * Using Math.round() will give you a non-uniform distribution!
 */
function get_random_int(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};


function get_ff_data(number) {
    var fs = require('fs');
    var file = JSON.parse(fs.readFileSync( 'data/' + number + '.json', 'utf8'));
    return file;
};

function get_ff_url() {
    var ff_game_number = get_random_int(1, ffcount);
    logger.info('ff# = ' + ff_game_number);

    ff_song_count = ff_url_data[ff_game_number].urls.length;
    var song_index = get_random_int(0, ff_song_count - 1);

    ff_url_id = ff_url_data[ff_game_number].urls[song_index];
    ff_url = "https://www.youtube.com/watch?v=" + ff_url_id;
    logger.info("RNG -- Game: " + ff_game_number + ", song_count: " + ff_song_count);
    var ff_numeral = ff_url_data[ff_game_number].roman_numeral;
    return [ff_url, ff_url_id, ff_numeral];
};
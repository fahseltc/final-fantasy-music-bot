var Discord = require('discord.js');
var logger = require('winston');
var auth = require('./auth.json');
const ytdl = require('ytdl-core');
var fetchVideoInfo = require('youtube-info');
const util = require('util')

const streamOptions = { seek: 0, volume: 0.5 };

var song_duration = 15000;

var last_song_data = "";
var current_timer = "";

// option to swap ff 4 and 2? because playlists are poopy


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
logger.info(ff_url_data);


// Initialize Discord Bot
var bot = new Discord.Client();
bot.login(auth.token);

bot.on('ready', (message) => {
    logger.info('Connected');
});

bot.on('message', (message) => {
    logger.info('got message ' + message.content);
    if (message.content.substring(0, 1) == '!') {
        var args = message.content.substring(1).split(' ');
        var cmd = args[0];

        args = args.splice(1);
        switch(cmd) {
            case 'help':
                message.channel.send(" **!ffsong** will choose a random FF game and a random song, then join your voice channel and play that song.")
                message.channel.send(" **!duration X** will set the song to play for X seconds. (default 15 seconds)");
                message.channel.send(" **!replay** will replay the last song for its entire duration.");
                message.channel.send(" **!stop** or **!boot** will make the bot stop playing and leave the channel immediately.");
            break;
            case 'stop':
            case 'boot':
            logger.info("timer: " + current_timer);
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
                set_play_duration(args[0]);
                message.channel.send("All next songs will be played for: " + (song_duration / 1000) + " seconds");
            break;
            case 'replay':
                if(last_song_data != "") {
                    fetchVideoInfo(last_song_data.url_id).then(function(videoInfo) {
                    message.channel.send("Replaying " + videoInfo.title);

                    logger.info("song duration " + videoInfo.duration);
                    logger.info("title " + videoInfo.title);
                    //logger.info(util.inspect(videoInfo));

                    var voiceChannel = message.member.voiceChannel;
                    if (voiceChannel) {
                        voiceChannel.join().then(connection => {
                        logger.info("joined channel");
                        const stream = ytdl(last_song_data.url, { filter : 'audioonly' });
                        const dispatcher = connection.playStream(stream, streamOptions);

                        var stop = function stop_playback() {
                            logger.info("stopped playback");
                            dispatcher.end(); // or pause!
                            stream.destroy();
                            voiceChannel.leave();
                            current_timer = "";
                        }
                        logger.info("setting delay to video info duration: " + videoInfo.duration + "s");
                        current_timer = setTimeout(stop, videoInfo.duration * 1000);
                    }).catch(err => logger.error(err));
                    } else {
                        message.channel.send("You must be in a voice channel to use this bot.");
                    }
                });
                } else {
                    message.channel.send("No last song saved.");
                }
            break;
            case 'ffsong':
                var song_data = new SongData();
                last_song_data = song_data;

                logger.info(util.inspect(song_data));

                fetchVideoInfo(song_data.url_id).then(function(videoInfo) {
                    logger.info("song duration " + videoInfo.duration);
                    logger.info("title " + videoInfo.title);
                    //logger.info(util.inspect(videoInfo));

                    var voiceChannel = message.member.voiceChannel;
                    if (voiceChannel) {
                        voiceChannel.join().then(connection => {
                        logger.info("joined channel");
                        const stream = ytdl(song_data.url, { filter : 'audioonly' });
                        const dispatcher = connection.playStream(stream, streamOptions);

                        var stop = function stop_playback() {
                            logger.info("stopped playback");
                            dispatcher.end(); // or pause!
                            stream.destroy();
                            voiceChannel.leave();
                            message.channel.send("[" + song_data.roman_numeral + "] " + videoInfo.title);
                            message.channel.send(videoInfo.url);
                            current_timer = "";
                        }
                        logger.info("video info duration: " + videoInfo.duration + "s");
                        logger.info("global max song duration: " + song_duration / 1000 + "s");
                        var setting_delay_to = (videoInfo.duration < (song_duration / 1000) ? videoInfo.duration * 1000 : song_duration)
                        logger.info("setting delay to: " + setting_delay_to + "ms");
                        current_timer = setTimeout(stop, setting_delay_to);
                    }).catch(err => logger.error(err));
                    } else {
                        message.channel.send("You must be in a voice channel to use this bot.");
                    }
                });
            break;
            default:
                message.channel.send("not a valid command");
            }
    }
});

function get_ff_url() {
    var ff_game_number = getRandomInt(1, ffcount);
    logger.info('ff# = ' + ff_game_number);

    ff_song_count = ff_url_data[ff_game_number].urls.length;
    var song_index = getRandomInt(0, ff_song_count - 1);

    ff_url_id = ff_url_data[ff_game_number].urls[song_index];
    ff_url = "https://www.youtube.com/watch?v=" + ff_url_id;
    logger.info("RNG -- Game: " + ff_game_number + ", song_count: " + ff_song_count);
    var ff_numeral = ff_url_data[ff_game_number].roman_numeral;
    return [ff_url, ff_url_id, ff_numeral];
};

function SongData() {
    this.ff_game_number = getRandomInt(1, ffcount);

    this.init = function() {
        ff_song_count = ff_url_data[this.ff_game_number].urls.length;
        this.song_index = getRandomInt(0, ff_song_count - 1);
        this.url_id = ff_url_data[this.ff_game_number].urls[this.song_index];
        this.url = "https://www.youtube.com/watch?v=" + this.url_id;
        this.roman_numeral =  ff_url_data[this.ff_game_number].roman_numeral;
        logger.info("RNG -- Game: " + this.ff_game_number + ", song index / total songs: " + song_index + " / " + ff_song_count);
    };

    this.init();
}

function set_play_duration(text) {
    try {
        var num = parseInt(text);
        song_duration = num * 1000;
    } catch(ex) {
        logger.error(ex);
    }
}

/**
 * Returns a random integer between min (inclusive) and max (inclusive)
 * Using Math.round() will give you a non-uniform distribution!
 */
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

function get_ff_data(number) {
    var fs = require('fs');
    var file = JSON.parse(fs.readFileSync( 'data/' + number + '.json', 'utf8'));
    return file;
};


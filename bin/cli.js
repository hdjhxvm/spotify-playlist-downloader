#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const { downloadPlaylist, getPlaylistInfo } = require('../index');

const program = new Command();

program
  .name('spotify-dl')
  .description('Network-grade automation tool to download Spotify playlists as MP3s with lyrics.')
  .version('1.0.0')
  .argument('[url]', 'Spotify Playlist, Album, or Track URL')
  .option('-o, --output <dir>', 'Output directory', './downloads')
  .option('-q, --quality <quality>', 'Audio bitrate quality (128k, 192k, 256k, 320k)', '320k')
  .option('--no-lyrics', 'Disable lyrics downloading and tagging')
  .option('--no-lrc', 'Disable saving separate .lrc synced lyrics files')
  .action(async (urlInput, options) => {
    let url = urlInput;

    console.log(chalk.bold.cyan('\n🎵 Spotify Playlist Downloader & Automation CLI\n'));

    // Interactive prompt if URL argument wasn't provided
    if (!url) {
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      url = await new Promise((resolve) => {
        readline.question(chalk.yellow('🔗 Enter Spotify Playlist / Track URL: '), (answer) => {
          readline.close();
          resolve(answer.trim());
        });
      });
    }

    if (!url) {
      console.log(chalk.red('❌ Error: No Spotify URL provided.'));
      process.exit(1);
    }

    const spinner = ora('Parsing Spotify URL metadata...').start();

    try {
      const playlist = await getPlaylistInfo(url);
      spinner.succeed(chalk.green(`Found ${chalk.bold(playlist.title)} (${playlist.totalTracks} tracks)\n`));

      const downloadOpts = {
        outputDir: path.resolve(options.output),
        quality: options.quality,
        embedLyrics: options.lyrics,
        saveLrcFile: options.lrc,
        onTrackStart: (track, idx, total) => {
          console.log(chalk.blue(`[${idx}/${total}]`) + ` Downloading ${chalk.bold(track.artist)} - ${chalk.bold(track.title)}...`);
        },
        onTrackEnd: (track, success, filePath, error) => {
          if (success) {
            console.log(chalk.green(`  ✔ Downloaded & tagged: ${filePath}`));
          } else {
            console.log(chalk.red(`  ✖ Failed: ${error}`));
          }
        }
      };

      console.log(chalk.dim(`Output Folder: ${downloadOpts.outputDir}`));
      console.log(chalk.dim(`Audio Bitrate: ${downloadOpts.quality}`));
      console.log(chalk.dim(`Embed Lyrics:  ${downloadOpts.embedLyrics}`));
      console.log('--------------------------------------------------\n');

      const results = await downloadPlaylist(url, downloadOpts);

      const successful = results.filter(r => r.success).length;
      console.log(chalk.bold.green(`\n🎉 Task Completed! Successfully downloaded ${successful}/${results.length} tracks.`));
    } catch (err) {
      spinner.fail(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

program.parse(process.argv);

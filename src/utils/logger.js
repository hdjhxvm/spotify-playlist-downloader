const chalk = require('chalk');

/**
 * Centralized Logger Utility
 * Provides structured, leveled logging with optional debug mode.
 * 
 * Usage:
 *   const log = require('./utils/logger');
 *   log.info('spotify', 'Found 3 tracks');
 *   log.warn('tagger', 'Cover art download failed', err.message);
 *   log.error('ytdlp', 'Process crashed', err);
 *   log.debug('downloader', 'Track metadata', { title, artist });
 * 
 * Set DEBUG=true environment variable to enable debug output.
 * Set SILENT=true or call log.setSilent(true) to suppress all output (library mode).
 */

let silent = process.env.SILENT === 'true';
const isDebug = process.env.DEBUG === 'true';

function timestamp() {
  return new Date().toISOString().slice(11, 19);
}

function formatPrefix(level, module) {
  const ts = chalk.dim(timestamp());
  const mod = chalk.cyan(`[${module}]`);
  return `${ts} ${level} ${mod}`;
}

const logger = {
  /**
   * Enable or disable all log output (useful when used as a library).
   */
  setSilent(value) {
    silent = value;
  },

  /**
   * Informational messages — always shown unless silent.
   */
  info(module, message, ...args) {
    if (silent) return;
    const prefix = formatPrefix(chalk.blue('INFO'), module);
    console.log(`${prefix} ${message}`, ...args);
  },

  /**
   * Warning messages — non-fatal issues that should be noticed.
   */
  warn(module, message, ...args) {
    if (silent) return;
    const prefix = formatPrefix(chalk.yellow('WARN'), module);
    console.warn(`${prefix} ${message}`, ...args);
  },

  /**
   * Error messages — always shown (even in silent mode for critical failures).
   */
  error(module, message, ...args) {
    const prefix = formatPrefix(chalk.red('ERR!'), module);
    console.error(`${prefix} ${message}`, ...args);
  },

  /**
   * Debug messages — only shown when DEBUG=true environment variable is set.
   */
  debug(module, message, ...args) {
    if (silent || !isDebug) return;
    const prefix = formatPrefix(chalk.magenta('DBUG'), module);
    console.log(`${prefix} ${message}`, ...args);
  }
};

module.exports = logger;

#!/usr/bin/env node
'use strict';

 const sh = require("shelljs");
 const program = require("commander");
 const appInfo = require('../package.json');

 const relatedPath = './node_modules/ftnt-devops-ci-test';
 const prettierPath = relatedPath + '/node_modules/.bin/prettier';
 const prettierConfigPath = relatedPath + '/.prettierrc';
 const eslintPath = relatedPath + '/node_modules/.bin/eslint';
 const eslintConfigPath = relatedPath + '/.eslintrc';

 program
 .version(appInfo.version)
 .usage('\tChecking and fixing format and linting.');

 program
 .command('check <path>')
 .alias('c')
 .description('Checking files format and linting through <path>.')
.option('-f, --format', 'Only check format.')
.option('-l, --lint', 'Only check linting.')
.option('-F, --format_ignore <path>', 'Path to prettier ignore file.')
.option('-L, --lint_ignore <path>', 'Path to eslint ignore file.')
.action( (path, options) => {
    const no_options = !(options.format || options.lint);
    if (options.format || no_options) {
        if (options.format_ignore) {
            sh.exec(prettierPath + ' --config ' + prettierConfigPath + ' --ignore-path ' + options.format_ignore + ' --check ' + path);
        } else {
            sh.exec(prettierPath + ' --config ' + prettierConfigPath + ' --check ' + path);
        }
    }
    if (options.lint || no_options) {
        if (options.lint_ignore) {
            sh.exec(eslintPath + ' -c ' + eslintConfigPath + ' --ignore-pattern ' + options.lint_ignore + ' ' + path);
        } else {
            sh.exec(eslintPath + ' -c ' + eslintConfigPath + ' ' + path);
        }
    }
}).on('--help', () => {
    console.log('\nTry this:\n  check [-f, -l] <path>');
});

program
.command('fix <path>')
.alias('f')
.description('Fixing files format and linting through <path>.')
.option('-f, --format', 'Only fix format')
.option('-l, --lint', 'Only fix linting')
.option('-F, --format_ignore <path>', 'Path to prettier ignore file.')
.option('-L, --lint_ignore <path>', 'Path to eslint ignore file.')
.action( (path, options) => {
    const no_options = !(options.format || options.lint);
    if (options.format || no_options) {
        if (options.format_ignore) {
            sh.exec(prettierPath + ' --config ' + prettierConfigPath + ' --ignore-path ' + options.format_ignore + ' --write ' + path);
        } else {
            sh.exec(prettierPath + ' --config ' + prettierConfigPath + ' --write ' + path);
        }
    }
    if (options.lint || no_options) {
        if (options.lint_ignore) {
            sh.exec(eslintPath + ' -c ' + eslintConfigPath + ' --ignore-pattern ' + options.lint_ignore + ' --fix ' + path);
        } else {
            sh.exec(eslintPath + ' -c ' + eslintConfigPath + ' --fix ' + path);
        }
    }
}).on('--help', () => {
   console.log('\nTry this:\n  fix [-f, -l] <path>');
});

program.parse(process.argv);

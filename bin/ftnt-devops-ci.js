#!/usr/bin/env node
'use strict';

const fs = require('fs');
const pa = require('path');
const sh = require('shelljs');
const program = require('commander');
const appInfo = require('../package.json');

const relatedPath = pa.normalize(`${__dirname}/..`);
const templatesPath = `${relatedPath}/templates`;

// Prettier config files path
const prettierLocalPath = pa.normalize(`${__dirname}/../../.bin/prettier`);
const prettierPath = fs.existsSync(prettierLocalPath)
    ? prettierLocalPath
    : `${relatedPath}/node_modules/.bin/prettier`;
const prettierConfigPath = fs.existsSync(`${process.cwd()}/.prettierrc`)
    ? `${process.cwd()}/.prettierrc`
    : `${relatedPath}/.prettierrc`;
const prettierIgnorePath = fs.existsSync(`${process.cwd()}/.prettierignore`)
    ? `${process.cwd()}/.prettierignore`
    : `${relatedPath}/.prettierignore`;

// Eslint config files path
const eslintLocalPath = pa.normalize(`${__dirname}/../../.bin/eslint`);
const eslintPath = fs.existsSync(eslintLocalPath)
    ? eslintLocalPath
    : `${relatedPath}/node_modules/.bin/eslint`;
const eslintConfigPath = fs.existsSync(`${process.cwd()}/.eslintrc`)
    ? `${process.cwd()}/.eslintrc`
    : `${relatedPath}/.eslintrc`;
const eslintIgnorePath = fs.existsSync(`${process.cwd()}/.eslintignore`)
    ? `${process.cwd()}/.eslintignore`
    : `${relatedPath}/.eslintignore`;

// Tslint config files path
const tslintLocalPath = pa.normalize(`${__dirname}/../../.bin/tslint`);
const tslintPath = fs.existsSync(tslintLocalPath)
    ? tslintLocalPath
    : `${relatedPath}/node_modules/.bin/tslint`;
const tslintConfigPath = fs.existsSync(`${process.cwd()}/tslint.json`)
    ? `${process.cwd()}/tslint.json`
    : `${relatedPath}/tslint.json`;
const tslintProjectPath = fs.existsSync(`${process.cwd()}/tsconfig.json`)
    ? `${process.cwd()}/tsconfig.json`
    : `${relatedPath}/tsconfig.json`;

// Program general information
program.version(appInfo.version).usage('\tChecking and fixing format and linting.');

// Init command
program
    .command('init')
    .description('Initial and create default config files in work directory.')
    .option('-J, --JavaScript', 'Initial for JavaScript project.')
    .option('-T, --TypeScript', 'Initial for TypeScript project.')
    .action(options => {
        fs.copyFile(`${templatesPath}/.prettierrc`, `${process.cwd()}/.prettierrc`, err => {
            if (err) {
                throw err;
            }
            console.log('.prettierrc is created successfully.');
        });
        fs.copyFile(`${templatesPath}/.prettierignore`, `${process.cwd()}/.prettierignore`, err => {
            if (err) {
                throw err;
            }
            console.log('.prettierignore is created successfully.');
        });
        if (options.JavaScript) {
            fs.copyFile(`${templatesPath}/.eslintrc`, `${process.cwd()}/.eslintrc`, err => {
                if (err) {
                    throw err;
                }
                console.log('.eslintrc is created successfully.');
            });
            fs.copyFile(`${templatesPath}/.eslintignore`, `${process.cwd()}/.eslintignore`, err => {
                if (err) {
                    throw err;
                }
                console.log('.eslintignore is created successfully.');
            });
        }
        if (options.TypeScript) {
            fs.copyFile(`${templatesPath}/tsconfig.json`, `${process.cwd()}/tsconfig.json`, err => {
                if (err) {
                    throw err;
                }
                console.log('tsconfig.json is created successfully.');
            });
            fs.copyFile(`${templatesPath}/tslint.json`, `${process.cwd()}/tslint.json`, err => {
                if (err) {
                    throw err;
                }
                console.log('tslint.json is created successfully.');
            });
        }
    })
    .on('--help', () => {
        console.log('\nJavaScript project use: init -J\nTypeScript project use: init -T');
    });

// Check command
program
    .command('check <path>')
    .alias('c')
    .description('Checking files format and linting through <path>.')
    .option('-f, --format', 'Only check format.')
    .option('-l, --lint', 'Only check linting.')
    .option('-t, --tslint', 'Only check typescript files linting')
    .option('-F, --format_ignore <path>', 'Path to prettier ignore file.')
    .option('-L, --lint_ignore <path>', 'Path to eslint ignore file.')
    .option('-T, --tslint_ignore <glob>', 'Glob pattern for tslint ignore.')
    .action((path, options) => {
        path = `"${path}"`;
        const no_options = !(options.format || options.lint || options.tslint);
        if (options.format || no_options) {
            const ignorePath = options.format_ignore ? options.format_ignore : prettierIgnorePath;
            if (
                sh.exec(
                    `${prettierPath} --config ${prettierConfigPath} --ignore-path ${ignorePath} --check ${path}`
                ).code !== 0
            ) {
                sh.echo('Format checking failed. Try this: ftnt-devops-ci fix -f "**/*.js"');
                sh.exit(1);
            }
        }
        if (options.lint || no_options) {
            sh.echo('Checking linting...');
            const ignorePath = options.lint_ignore ? options.lint_ignore : eslintIgnorePath;
            if (
                sh.exec(
                    `${eslintPath} -c ${eslintConfigPath} --ignore-path ${ignorePath} --ignore-pattern "**/*.json" ${path}`
                ).code !== 0
            ) {
                sh.echo('Linting checking is failed. Try this: ftnt-devops-ci fix -l "**/*.js"');
                sh.exit(1);
            } else {
                sh.echo('All matched files pass linting checks!');
            }
        }
        if (options.tslint || (no_options && fs.existsSync(`${process.cwd()}/tsconfig.json`))) {
            const ignoreGlob = options.tslint_ignore ? ` -e ${options.tslint_ignore}` : '';
            if (
                sh.exec(
                    `${tslintPath} -c ${tslintConfigPath} -p ${tslintProjectPath}${ignoreGlob} ${path}`
                ).code !== 0
            ) {
                sh.echo('Tslint checking is failed. Try this: ftnt-devops-ci fix -t "**/*.ts"');
                sh.exit(1);
            }
        }
    })
    .on('--help', () => {
        console.log('\nTry this:\n  check [options] <path>');
    });

// Fix command
program
    .command('fix <path>')
    .alias('f')
    .description('Fixing files format and linting through <path>.')
    .option('-f, --format', 'Only fix format')
    .option('-l, --lint', 'Only fix linting')
    .option('-t, --tslint', 'Only fix typescript files linting')
    .option('-F, --format_ignore <path>', 'Path to prettier ignore file.')
    .option('-L, --lint_ignore <path>', 'Path to eslint ignore file.')
    .option('-T, --tslint_ignore <glob>', 'Glob pattern for tslint ignore.')
    .action((path, options) => {
        path = `"${path}"`;
        const no_options = !(options.format || options.lint || options.tslint);
        if (options.format || no_options) {
            const ignorePath = options.format_ignore ? options.format_ignore : prettierIgnorePath;
            sh.exec(
                `${prettierPath} --config ${prettierConfigPath} --ignore-path ${ignorePath} --write ${path}`
            );
        }
        if (options.lint || no_options) {
            console.log('Fixing linting...');
            const ignorePath = options.lint_ignore ? options.lint_ignore : eslintIgnorePath;
            sh.exec(
                `${eslintPath} -c ${eslintConfigPath} --ignore-path ${ignorePath} --ignore-pattern "**/*.json" --fix ${path}`
            );
        }
        if (options.tslint || (no_options && fs.existsSync(`${process.cwd()}/tsconfig.json`))) {
            const ignoreGlob = options.tslint_ignore ? ` -e ${options.tslint_ignore}` : '';
            sh.exec(
                `${tslintPath} -c ${tslintConfigPath} -p ${tslintProjectPath}${ignoreGlob} --fix ${path}`
            );
        }
    })
    .on('--help', () => {
        console.log('\nTry this:\n  fix [options] <path>');
    });

program.parse(process.argv);

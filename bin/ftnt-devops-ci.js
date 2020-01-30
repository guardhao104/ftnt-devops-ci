#!/usr/bin/env node
'use strict';

const fs = require('fs');
const https = require('https');
const pa = require('path');
const sh = require('shelljs');
const iq = require('inquirer');
const cj = require('comment-json');
const ck = require('chalk');
const program = require('commander');
const appInfo = require('../package.json');

const moduleRoot = pa.resolve(`${__filename}`, '../../');
const relatedPath = pa.normalize(`${__dirname}/..`);
const templatesPath = `${relatedPath}/templates`;
const FS_STAT_IS_FILE = 'f', FS_STAT_IS_DIR = 'd';

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

const loadTextFileFromGitHub = (account, repo, filePath, branch = 'master') => {
    return new Promise((resolve, reject)=>{
        https.get('https://raw.githubusercontent.com/'+
            `${account}/${repo}/${branch}/${pa.normalize(filePath)}`, (res)=>{
                res.on('data', d => {
                    if (res.statusCode !== 200) {
                        throw new Error(res.statusMessage);
                    }
                    resolve(d.toString('utf8').trim());
                });
                res.on('error', e =>reject(e));
            });
    });
}

const readFile = (filePath, printStdErr = true) => {
    try {
        const file = fs.readFileSync(pa.resolve(filePath));
        return file.toString('utf8');
    } catch (error) {
        if (printStdErr) {
            console.error(error);
        }
        return null;
    }
}

const fileExist = (filePath, printStdErr = true) => {
    try {
        const stat = fs.statSync(pa.resolve(filePath));
        return stat.isFile() && 'f' || stat.isDirectory() && 'd' || null;
    } catch (error) {
        if (printStdErr) {
            console.error(error);
        }
        return false;
    }
};

const writeFile = async (filePath, content, promptForOverwrite = true) => {
    let question = {
        type: 'confirm',
        name: 'confirm',
        message: `${filePath} already exists, overwrite it?`,
        default: false
    };

    // check file existence and decide whether prompt for overwrite file confirmation or not
    let answer = promptForOverwrite
        &&  FS_STAT_IS_FILE === fileExist(filePath) && await iq.prompt(question) || null;
    if (!answer || answer && answer.confirm) {
        try {
            fs.writeFileSync(filePath, `${content}\n`);
            return true;
        } catch (error) {
            console.error(error);
            return false;
        }
    }
}

const update = async (options) => {
    let [, domain, repo] =
        new RegExp('(?<=git\\+https:\\/\\/github\\.com\\/)([^\\/]+)\\/([^\\/\\s]+).git', 'g')
        .exec(appInfo.repository.url);
    const [prettierrc, eslintrc, tslint] =await Promise.all([
        loadTextFileFromGitHub(domain, repo, '.prettierrc'),
        loadTextFileFromGitHub(domain, repo, '.eslintrc'),
        loadTextFileFromGitHub(domain, repo, 'tslint.json'),
    ]);

    // check write file directory is global or current directory
    let filePathFormat = pa.resolve(!!options.global && moduleRoot || process.cwd(), '.prettierrc');
    let filePathLint = pa.resolve(!!options.global && moduleRoot || process.cwd(), '.eslintrc');
    let filePathTsLint = pa.resolve(!!options.global && moduleRoot || process.cwd(), 'tslint.json');

    let writeBoth = !options.format && !options.lint && !options.tslint;
    let written = false;

    if (writeBoth || options.format) {
        written = await writeFile(filePathFormat, prettierrc, !options.overwrite);
        if (written) {
            console.log(`${filePathFormat} is now up-to-date.`);
        }
    }
    if (writeBoth || options.lint) {
        written = await writeFile(filePathLint, eslintrc, !options.overwrite);
        if (written) {
            console.log(`${filePathLint} is now up-to-date.`);
        }
    }
    if (writeBoth || options.tslint) {
        written = await writeFile(filePathTsLint, tslint, !options.overwrite);
        if (written) {
            console.log(`${filePathTsLint} is now up-to-date.`);
        }
    }
}

const askForExtensions = async () => {
    let predefExt = ['.js', '.json', '.ts'];
    let fileExt = [];
    let answer;

    do {
        let question = {
            name: 'ext',
            message: 'Enter one file extension you wish to format and lint ' +
                '(or enter n/a to end adding):',
            validate: (input)=> {
                return input === 'n/a' || input.trim().match(/^\.[0-9a-z]+$/) && true || false;
            }
        };
        if(predefExt.length > 0) {
            question.default = predefExt[0];
        }
        answer = await iq.prompt(question);

        if(answer.ext === 'n/a') {
            break;
        }
        let ext = answer.ext.trim();

        if(predefExt.includes(ext)) {
            predefExt.splice(predefExt.indexOf(ext), 1);
        }

        if(!fileExt.includes(ext)) {
            fileExt.push(ext);
        }

        let added = fileExt.length > 0 && 'You\'ve added extension: ' +
        `${fileExt.map(e=>ck.cyan(e)).join(', ')}\n` || '';
        if(added) {
            console.info(added);
        }

        answer = await iq.prompt({
            type: 'confirm',
            name: 'add',
            message: 'add another extension?',
            default: false
        });
    } while (answer.add)
    return fileExt;
}

const askForGlobPattern = async () => {
    let predefGlobs = ['node_modules'];
    let globs = [];
    let answer;

    do {
        let question = {
            name: 'glob',
            message: 'Enter a directory you wish to ignore from checking (or enter n/a to end adding):'
        };
        if(predefGlobs.length > 0 && !globs.includes(predefGlobs[0])) {
            question.default = predefGlobs[0];
        }
        answer = await iq.prompt(question);

        if(answer.glob === 'n/a') {
            break;
        }
        let glob = answer.glob.trim();

        if(!globs.includes(glob)) {
            predefGlobs.splice(predefGlobs.indexOf(glob), 1);
        }

        if(!globs.includes(glob)) {
            globs.push(glob);
        }

        let added = globs.length > 0 && 'You\'ve added directories: ' +
            `${globs.map(g=>ck.cyan(g)).join(', ')}\n` || '';

        if(added) {
            console.info(added);
        }

        answer = await iq.prompt({
            type: 'confirm',
            name: 'add',
            message: 'add another directory?',
            default: false
        });
    } while (answer.add)
    return globs;
}

const createVsCodeTask = (extentions, globPatterns, taskType, taskLabel) => {
    const task = {
        label: taskLabel,
        type: 'shell',
        command: null,
        problemMatcher: []
    };

    let ext;
    if(extentions.length > 0) {
        ext = extentions.join(',');
        if(extentions.length > 1) {
            ext = `{${ext}}`;
        }
    }
    ext = `*${ext}`;

    let glob;
    if(globPatterns.length > 0) {
        glob = globPatterns.join('|');
        glob = `{**/!(${glob}),!(${glob})}`;
    } else {
        glob = '**'
    }

    task.command = `ftnt-devops-ci ${taskType === 'check' && 'c' || 'f'} "${glob}/${ext}"`;
    return task;
}

const configVsCode = async (options) => {
    const codeDir = pa.resolve('.vscode');
    const taskFile = pa.resolve(codeDir, 'tasks.json');
    let answer;
    // check the vscode folder existence
    if(FS_STAT_IS_DIR !== await fileExist(codeDir, false)) {
        answer = await iq.prompt({
            type: 'confirm',
            name: 'confirm',
            message: `.vscode folder not found in the current directory: ${process.cwd()}.\n` +
                'Create one and continue?',
            default: false
        });
        if(!answer.confirm) {
            console.log('You can also manually create the .vscode folder and run the tool again.');
            return false;
        }
        try {
            fs.mkdirSync(codeDir);
        } catch (error) {
            console.error(error);
            return false;
        }
    }
    let extensions;
    let globPatterns;
    extensions = await askForExtensions();
    globPatterns = await askForGlobPattern();
    answer = await iq.prompt({
        type: 'confirm',
        name: 'confirm',
        message: 'Proceed to create two tasks in vscode?',
        default: true
    });
    if(!answer.confirm) {
        return false;
    }

    // read tasks.json
    let tasksText = readFile(taskFile);
    let tasksJson;
    try {
        // parse text which might contain comments to json
        tasksJson = cj.parse(tasksText);
        let taskLabelCheck = `${appInfo.name}:check`;
        let taskLabelFix = `${appInfo.name}:fix`;
        // go over each task and look for the existence of the two we want to add
        let foundTaskCheck = false;
        let foundTaskFix = false;
        if(tasksJson.tasks) {
            tasksJson.tasks = tasksJson.tasks.map(task=>{
                if(task.label && (task.label === taskLabelCheck || task.label === taskLabelFix)) {
                    if(task.label === taskLabelCheck) {
                        foundTaskCheck = true;
                    } else if (task.label === taskLabelFix) {
                        foundTaskFix = true;
                    }
                    task = createVsCodeTask(extensions, globPatterns,
                        task.label === taskLabelCheck && 'check' || 'fix',
                        task.label === taskLabelCheck && taskLabelCheck || taskLabelFix);
                }
                return task;
            });
        }
        if(!foundTaskCheck) {
            tasksJson.tasks.push(createVsCodeTask(extensions, globPatterns, 'check', taskLabelCheck));
        }
        if(!foundTaskFix) {
            tasksJson.tasks.push(createVsCodeTask(extensions, globPatterns, 'fix', taskLabelFix));
        }
        writeFile(taskFile, cj.stringify(tasksJson, null, 4), false);
        console.info('The following tasks are created: ' +
            `${ck.cyan(taskLabelCheck)}, ${ck.cyan(taskLabelFix)}`);
    } catch (error) {
        console.error(error);
        return false;
    }
}

const config = async (options) => {
    if(options.vscode) {
        await configVsCode(options);
    }
}

const main = async () => {
    await program.parseAsync(process.argv);
    console.log('program ends.');
}

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
    .description('Fixing files format and linting through <path>. <path> support glob patterns defined by the glob npm.')
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

// Update command
program
    .command('update')
    .alias('u')
    .description('Update to use the latest format checking and linting rules.')
    .option('-o, --overwrite', 'Overwrite existing file(s) without prompting for confirmation.', false)
    .option('-g, --global', 'Update the files in the tool instead of in the current directory.')
    .option('-f, --format', 'Update .prettierrc only.')
    .option('-l, --lint', 'Update .eslintrc only.')
    .option('-t, --tslint', 'Update tslint.json only.')
    .action(update);

program
    .command('config')
    .description('Configure the tool in some popular IDEs. Type -h for more information.')
    .option('--vscode', 'start a wizzard to add two VSCode tasks in the .vscode/tasks.json ' +
        'of the current directory. This command assumes the current directory is the root of' +
        ' a VSCode project.')
    .action(config)

main();

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

const fileExist = (filePath, printStdErr = true) => {
    try {
        const stat = fs.statSync(pa.resolve(filePath));
        return (stat.isFile() && 'f') || (stat.isDirectory() && 'd') || null;
    } catch (error) {
        if (printStdErr) {
            console.error(error);
        }
        return false;
    }
};

const moduleRoot = pa.resolve(`${__filename}`, '../../'); // the module directory. not the directory where it's been called.
const modulePackagePath = pa.resolve(moduleRoot, 'package.json'); // the file path of the module package.json
const modulePackageJson = require(modulePackagePath); // the content of the module package.json

const appPackagePath = pa.resolve(process.cwd(), 'package.json');

// TODO: file may not exist. solve this problem
const appInfo = fileExist(appPackagePath) && require(pa.resolve(process.cwd(), 'package.json'));

const relatedPath = pa.normalize(`${__dirname}/..`);
const templatesPath = `${relatedPath}/templates`;
const FS_STAT_IS_FILE = 'f',
    FS_STAT_IS_DIR = 'd',
    INSTALL_SCOPE_LOCAL = 'local',
    INSTALL_SCOPE_GLOBAL = 'global',
    EXIT_CODE_ERROR = 1;
const [, packageScopedName, packageScope, packageName] = (modulePackageJson.repository &&
    new RegExp(`\\/(([^\\/]*)\\/(${modulePackageJson.name})).git`, 'g').exec(
        modulePackageJson.repository.url
    )) || [null, null, null, null];

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
    return new Promise((resolve, reject) => {
        https.get(
            'https://raw.githubusercontent.com/' +
                `${account}/${repo}/${branch}/${pa.normalize(filePath)}`,
            res => {
                res.on('data', d => {
                    if (res.statusCode !== 200) {
                        throw new Error(res.statusMessage);
                    }
                    resolve(d.toString('utf8').trim());
                });
                res.on('error', e => reject(e));
            }
        );
    });
};

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
};

const writeFile = async (filePath, content, promptForOverwrite = true) => {
    let question = {
        type: 'confirm',
        name: 'confirm',
        message: `${filePath} already exists, overwrite it?`,
        default: false
    };

    // check file existence and decide whether prompt for overwrite file confirmation or not
    let answer =
        (promptForOverwrite &&
            FS_STAT_IS_FILE === fileExist(filePath) &&
            (await iq.prompt(question))) ||
        null;
    if (!answer || (answer && answer.confirm)) {
        try {
            fs.writeFileSync(filePath, `${content}\n`);
            return true;
        } catch (error) {
            console.error(error);
            return false;
        }
    }
};

const isPackageInstalledScoped = async (pkgName, scope) => {
    return await new Promise(resolve => {
        const command = `npm list${(scope === INSTALL_SCOPE_GLOBAL && ' -g') ||
            ''} --depth 0 ${pkgName}`;
        sh.exec(command, { silent: true }, (code, stdout) => {
            if (code !== 0) {
                resolve({ name: null, version: null });
            }
            const [, name, version] = new RegExp(`(${pkgName})@(\\S*)`, 'gmi').exec(stdout) || [
                null,
                null,
                null
            ];
            resolve({ name: name, version: version });
        });
    });
};

const update = async options => {
    const [prettierrc, eslintrc, tslint] = await Promise.all([
        loadTextFileFromGitHub(packageScope, packageName, '.prettierrc'),
        loadTextFileFromGitHub(packageScope, packageName, '.eslintrc'),
        loadTextFileFromGitHub(packageScope, packageName, 'tslint.json')
    ]);

    // check write file directory is global or current directory
    let filePathFormat = pa.resolve(
        (!!options.global && moduleRoot) || process.cwd(),
        '.prettierrc'
    );
    let filePathLint = pa.resolve((!!options.global && moduleRoot) || process.cwd(), '.eslintrc');
    let filePathTsLint = pa.resolve(
        (!!options.global && moduleRoot) || process.cwd(),
        'tslint.json'
    );

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
};

const askForExtensions = async () => {
    let predefExt = ['.js', '.json', '.ts'];
    let fileExt = [];
    let answer;

    do {
        let question = {
            name: 'ext',
            message:
                'Enter one file extension you wish to format and lint ' +
                '(or enter n/a to end adding):',
            validate: input => {
                return input === 'n/a' || (input.trim().match(/^\.[0-9a-z]+$/) && true) || false;
            }
        };
        if (predefExt.length > 0) {
            question.default = predefExt[0];
        }
        answer = await iq.prompt(question);

        if (answer.ext === 'n/a') {
            break;
        }
        let ext = answer.ext.trim();

        if (predefExt.includes(ext)) {
            predefExt.splice(predefExt.indexOf(ext), 1);
        }

        if (!fileExt.includes(ext)) {
            fileExt.push(ext);
        }

        let added =
            (fileExt.length > 0 &&
                "You've added extension: " + `${fileExt.map(e => ck.cyan(e)).join(', ')}\n`) ||
            '';
        if (added) {
            console.info(added);
        }

        answer = await iq.prompt({
            type: 'confirm',
            name: 'add',
            message: 'add another extension?',
            default: false
        });
    } while (answer.add);
    return fileExt;
};

const askForGlobPattern = async () => {
    let predefGlobs = ['node_modules','.*'];
    let globs = [];
    let answer;

    do {
        let question = {
            name: 'glob',
            message:
                'Enter a directory or glob pattern you wish to ignore from checking (or enter n/a to end adding):'
        };
        if (predefGlobs.length > 0 && !globs.includes(predefGlobs[0])) {
            question.default = predefGlobs[0];
        }
        answer = await iq.prompt(question);

        if (answer.glob === 'n/a') {
            break;
        }
        let glob = answer.glob.trim();

        if (!globs.includes(glob)) {
            predefGlobs.splice(predefGlobs.indexOf(glob), 1);
        }

        if (!globs.includes(glob)) {
            globs.push(glob);
        }

        let added =
            (globs.length > 0 && "You've added: " + `${globs.map(g => ck.cyan(g)).join(', ')}\n`) ||
            '';

        if (added) {
            console.info(added);
        }

        answer = await iq.prompt({
            type: 'confirm',
            name: 'add',
            message: 'add another one?',
            default: false
        });
    } while (answer.add);
    return globs;
};

const createCommand = (
    extentions,
    globPatterns,
    args = [],
    modulePath = '',
    globalModule = true
) => {
    let ext;
    if (extentions.length > 0) {
        ext = extentions.join(',');
        if (extentions.length > 1) {
            ext = `{${ext}}`;
        }
    }

    let glob;
    if (globPatterns.length > 0) {
        glob = globPatterns.join('|');
        glob = `{*,**/!(${glob})/*}`;
    } else {
        glob = '**/*';
    }

    const scriptPath =
        (globalModule && packageName) || `node ${pa.join(modulePath, packageName)}.js`;
    return `${scriptPath} ${args.join(' ')} "${glob}${ext}"`;
};

const createVsCodeTask = (
    extentions,
    globPatterns,
    taskType,
    taskLabel,
    modulePath,
    globalModule = false
) => {
    const task = {
        label: taskLabel,
        type: 'shell',
        command: null,
        problemMatcher: []
    };

    if (taskType === 'check') {
        task.command = createCommand(extentions, globPatterns, ['c'], modulePath, globalModule);
    } else if (taskType === 'fix') {
        task.command = createCommand(extentions, globPatterns, ['f'], modulePath, globalModule);
    }

    return task;
};

const detectModule = async options => {
    let globalModule = false,
        localModule = false;
    let modulePath = '';
    const [detectLocalModule, detectGlobalModule] = await Promise.all([
        isPackageInstalledScoped(packageName, INSTALL_SCOPE_LOCAL),
        isPackageInstalledScoped(packageName, INSTALL_SCOPE_GLOBAL)
    ]);

    globalModule = (detectGlobalModule && detectGlobalModule.name && true) || false;
    localModule = (detectLocalModule && detectLocalModule.name && true) || false;

    const precedences = (options.global && [INSTALL_SCOPE_GLOBAL, INSTALL_SCOPE_LOCAL]) || [
        INSTALL_SCOPE_LOCAL,
        INSTALL_SCOPE_GLOBAL
    ];

    let referenceScope;

    precedences.forEach((scope, index) => {
        if (scope === INSTALL_SCOPE_LOCAL && !referenceScope) {
            // detected locally
            if (localModule) {
                modulePath = pa.join('node_modules', packageName, 'bin');
                console.info(`${ck.cyan(packageName)} is found in ${ck.cyan('local')} module.`);
                // if not want to use global, can use the local scope.
                // or if scope undetermined and no more scope to check, must use the local scope.
                if (!options.global || index === precedences.length - 1) {
                    referenceScope = INSTALL_SCOPE_LOCAL;
                }
            }
        }
        if (scope === INSTALL_SCOPE_GLOBAL && !referenceScope) {
            // detected globally
            if (globalModule) {
                modulePath = ''; // can call global module without a specific path
                console.info(`${ck.cyan(packageName)} is found in ${ck.cyan('global')} module.`);
                // if want to use global module, can use global scope.
                // or if scope undetermined nad no more scope to check, must use the global scope.
                if (options.global || index === precedences.length - 1) {
                    referenceScope = INSTALL_SCOPE_GLOBAL;
                }
            }
        }
    });

    return {
        globalModule: globalModule,
        localModule: localModule,
        referenceScope: referenceScope,
        modulePath: modulePath
    };
};

const configVsCode = async options => {
    const codeDir = pa.resolve('.vscode');
    const taskFile = pa.resolve(codeDir, 'tasks.json');
    let answer;
    // check the vscode folder existence
    if (FS_STAT_IS_DIR !== (await fileExist(codeDir, false))) {
        answer = await iq.prompt({
            type: 'confirm',
            name: 'confirm',
            message:
                `.vscode folder not found in the current directory: ${process.cwd()}.\n` +
                'Create one and continue?',
            default: false
        });
        if (!answer.confirm) {
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
    if (!answer.confirm) {
        return false;
    }

    let { referenceScope, modulePath } = await detectModule(options);

    // read tasks.json
    let tasksText = readFile(taskFile);
    let tasksJson;
    try {
        // parse text which might contain comments to json
        tasksJson = cj.parse(tasksText);
        let taskLabelCheck = `${packageName}:check`;
        let taskLabelFix = `${packageName}:fix`;
        // go over each task and look for the existence of the two we want to add
        let foundTaskCheck = false;
        let foundTaskFix = false;
        if (tasksJson.tasks) {
            tasksJson.tasks = tasksJson.tasks.map(task => {
                if (task.label && (task.label === taskLabelCheck || task.label === taskLabelFix)) {
                    if (task.label === taskLabelCheck) {
                        foundTaskCheck = true;
                    } else if (task.label === taskLabelFix) {
                        foundTaskFix = true;
                    }
                    task = createVsCodeTask(
                        extensions,
                        globPatterns,
                        (task.label === taskLabelCheck && 'check') || 'fix',
                        (task.label === taskLabelCheck && taskLabelCheck) || taskLabelFix,
                        modulePath,
                        referenceScope === INSTALL_SCOPE_GLOBAL
                    );
                }
                return task;
            });
        }
        if (!foundTaskCheck) {
            tasksJson.tasks.push(
                createVsCodeTask(
                    extensions,
                    globPatterns,
                    'check',
                    taskLabelCheck,
                    modulePath,
                    referenceScope === INSTALL_SCOPE_GLOBAL
                )
            );
        }
        if (!foundTaskFix) {
            tasksJson.tasks.push(
                createVsCodeTask(
                    extensions,
                    globPatterns,
                    'fix',
                    taskLabelFix,
                    modulePath,
                    referenceScope === INSTALL_SCOPE_GLOBAL
                )
            );
        }
        writeFile(taskFile, cj.stringify(tasksJson, null, 4), false);
        console.info(
            'The following tasks are created: ' +
                `${ck.cyan(taskLabelCheck)}, ${ck.cyan(taskLabelFix)}`
        );
    } catch (error) {
        console.error(error);
        return false;
    }
};

const configNpm = async options => {
    let answer;

    // check if it is a node module in the current working directory
    if (!fileExist(pa.resolve(process.cwd(), 'package.json'), false)) {
        console.info(
            "It looks like the current directory isn't a valid node module." +
                ' You can run the following command to create a node module:'
        );
        console.info(ck.cyan('npm init'));
        sh.exit(EXIT_CODE_ERROR);
    }

    let { referenceScope, modulePath } = await detectModule(options);

    if (referenceScope === INSTALL_SCOPE_GLOBAL) {
        console.info(`Will reference ${ck.cyan(packageName)} from ${ck.cyan('global')}.`);
    } else if (referenceScope === INSTALL_SCOPE_LOCAL) {
        console.info(`Will reference ${ck.cyan(packageName)} from ${ck.cyan(modulePath)}.`);
    } else {
        console.info(
            `${ck.cyan(packageName)} isn't installed in the ${ck.cyan(
                'current'
            )} directory nor globally. Try running one of the following commands to install it first?`
        );
        console.info(
            `${ck.cyan('npm i ') + ck.cyan(packageScopedName)}\n${ck.cyan('npm i -g ') +
                ck.cyan(packageScopedName)}`
        );
    }

    // ask for user's consent.
    answer = await iq.prompt({
        type: 'confirm',
        name: 'confirm',
        message: `This command will update the package.json in the ${ck.cyan(
            'current'
        )} directory. Are you sure you want to continue?`,
        default: false
    });
    if (!answer.confirm) {
        console.info('Okay! No change has been made.');
        return;
    }

    // ask user to ensure to save the package.json before continue
    // because any unsaved change will be ignored.
    console.info(
        `You must ensure no unsaved changes in the package.json in the ${ck.cyan(
            'current'
        )} directory before continue. Any unsaved change will be ignored and may cause errors.`
    );
    answer = await iq.prompt({
        name: 'input',
        message: `Type ${ck.cyan('OK')} to procced, or ${ck.cyan('NO')} to end.`,
        validate: input => input === 'OK' || input === 'NO'
    });
    if (answer.input === 'NO') {
        return;
    }

    let extensions;
    let globPatterns;
    extensions = await askForExtensions();
    globPatterns = await askForGlobPattern();

    // create scripts
    const scripts = new Map();
    // script: format
    scripts.set(
        'format:check',
        createCommand(
            extensions,
            globPatterns,
            ['c', '-f'],
            modulePath,
            referenceScope === INSTALL_SCOPE_GLOBAL
        )
    );
    scripts.set(
        'eslint:check',
        createCommand(
            extensions.filter(e => e !== '.ts'),
            globPatterns,
            ['c', '-l'],
            modulePath,
            referenceScope === INSTALL_SCOPE_GLOBAL
        )
    );
    scripts.set(
        'tslint:check',
        createCommand(
            extensions.filter(t => t !== '.js'),
            globPatterns,
            ['c', '-t'],
            modulePath,
            referenceScope === INSTALL_SCOPE_GLOBAL
        )
    );
    scripts.set(
        'format:fix',
        createCommand(
            extensions,
            globPatterns,
            ['f', '-f'],
            modulePath,
            referenceScope === INSTALL_SCOPE_GLOBAL
        )
    );
    scripts.set(
        'eslint:fix',
        createCommand(
            extensions.filter(e => e !== '.ts'),
            globPatterns,
            ['f', '-l'],
            modulePath,
            referenceScope === INSTALL_SCOPE_GLOBAL
        )
    );
    scripts.set(
        'tslint:fix',
        createCommand(
            extensions.filter(t => t !== '.js'),
            globPatterns,
            ['f', '-t'],
            modulePath,
            referenceScope === INSTALL_SCOPE_GLOBAL
        )
    );

    // read pacakge.json

    const f = async () => {
        for (let [k, v] of Object.entries(appInfo.scripts)) {
            if (scripts.has(k)) {
                answer = await iq.prompt({
                    type: 'confirm',
                    name: 'confirm',
                    message: `script already exists: ${ck.cyan(k)} : ${ck.cyan(v)}\nOverwrite it?`,
                    default: false
                });
                if (answer.confirm) {
                    appInfo.scripts[k] = scripts.get(k);
                    console.info(`${ck.cyan(k)} is ${ck.cyan('overwritten')}:: ${scripts.get(k)}`);
                }
            }
        }
    };

    await f();

    scripts.forEach((v1, k1) => {
        if (!appInfo.scripts[k1]) {
            appInfo.scripts[k1] = v1;
            console.info(`${ck.cyan(k1)} is ${ck.cyan('added')}:: ${v1}`);
        }
    });

    answer = await iq.prompt({
        type: 'list',
        name: 'choice',
        choices: ['YES', 'NO'],
        message: `Save changes to file: ${ck.cyan(appPackagePath)}?`,
        default: 1
    });

    if (answer.choice === 'YES') {
        await writeFile(appPackagePath, JSON.stringify(appInfo, null, 4), false);
        console.info('scripts are saved.');
    } else {
        console.info('No change has been saved.');
    }
};

const config = async options => {
    if (options.vscode) {
        await configVsCode(options);
    } else if (options.npm) {
        await configNpm(options);
    }
};

const main = async () => {
    await program.parseAsync(process.argv);
    console.log('program ends.');
};

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
            // TODO: should use async / await to better catch errors.
            sh.exec(
                `${prettierPath} --config ${prettierConfigPath} --ignore-path ${ignorePath} --check ${path}`,
                null,
                // eslint-disable-next-line no-unused-vars
                (code, stdout, stderr) => {
                    if (code !== 0) {
                        console.error(stderr);
                        sh.echo(
                            'Format checking failed. Try this: ftnt-devops-ci fix -f "**/*.js"'
                        );
                        sh.exit(EXIT_CODE_ERROR);
                    } else {
                        console.log('All matched files pass format checks!');
                    }
                }
            );
        }
        if (options.lint || no_options) {
            sh.echo('Checking linting...');
            const ignorePath = options.lint_ignore ? options.lint_ignore : eslintIgnorePath;
            // TODO: should use async / await to better catch errors.
            sh.exec(
                `${eslintPath} -c ${eslintConfigPath} --ignore-path ${ignorePath} --ignore-pattern "**/*.json" ${path}`,
                null,
                // eslint-disable-next-line no-unused-vars
                (code, stdout, stderr) => {
                    if (code !== 0) {
                        console.error(stderr);
                        sh.echo(
                            'Linting checking is failed. Try this: ftnt-devops-ci fix -l "**/*.js"'
                        );
                        sh.exit(EXIT_CODE_ERROR);
                    } else {
                        console.log('All matched files pass linting checks!');
                    }
                }
            );
        }
        if (options.tslint || (no_options && fs.existsSync(`${process.cwd()}/tsconfig.json`))) {
            const ignoreGlob = options.tslint_ignore ? ` -e ${options.tslint_ignore}` : '';
            // TODO: should use async / await to better catch errors.
            sh.exec(
                `${tslintPath} -c ${tslintConfigPath} -p ${tslintProjectPath}${ignoreGlob} ${path}`,
                null,
                // eslint-disable-next-line no-unused-vars
                (code, stdout, stderr) => {
                    if (code !== 0) {
                        console.error(stderr);
                        sh.echo(
                            'Tslint checking is failed. Try this: ftnt-devops-ci fix -t "**/*.ts"'
                        );
                        sh.exit(EXIT_CODE_ERROR);
                    } else {
                        console.log('All matched files pass linting checks!');
                    }
                }
            );
        }
    })
    .on('--help', () => {
        console.log('\nTry this:\n  check [options] <path>');
    });

// Fix command
program
    .command('fix <path>')
    .alias('f')
    .description(
        'Fixing files format and linting through <path>. <path> support glob patterns defined by the glob npm.'
    )
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
    .option(
        '-o, --overwrite',
        'Overwrite existing file(s) without prompting for confirmation.',
        false
    )
    .option(
        '-g, --global',
        'Update the files in the tool module directory instead of in the current directory.'
    )
    .option('-f, --format', 'Update .prettierrc only.')
    .option('-l, --lint', 'Update .eslintrc only.')
    .option('-t, --tslint', 'Update tslint.json only.')
    .action(update);

program
    .command('config')
    .description('Configure the tool in some popular IDEs. Type -h for more information.')
    .option(
        '-g, --global',
        'Config to use the tool installed globally. This argument has effects only when using with some other arguments.'
    )
    .option(
        '--npm',
        'Start a wizzard to add a few npm scripts that help you fix and check files. This argument will detect the tool installation scope automatically, and will try to reference it in precedences: node module in current directory > node module in global. Using with --global can flip the precedences.'
    )
    .option(
        '--vscode',
        'start a wizzard to add two VSCode tasks in the .vscode/tasks.json ' +
            'of the current directory. This command assumes the current directory is the root of' +
            ' a VSCode project.'
    )
    .action(config);

main();

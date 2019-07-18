# ftnt-devops-ci

This a project for Fortinet devops team internal usage.

A Node.js project format checking and linting tool for CI practices.

## Installation

Use github link:

    $ npm install --save-dev guardhao104/ftnt-devops-ci

Install globally:

    $ sudo npm install -g guardhao104/ftnt-devops-ci

## Usage

### Local

Add scripts as follow to `package.json`:

```
    "scripts": {
        ...
        "check": "ftnt-devops-ci check \"**/*.{js,json}\"",
        "fix": "ftnt-devops-ci fix \"**/*.{js,json}\"",
        ...
    }
```

### Global

Check format and linting:

    $ ftnt-devops-ci check "**/*.{js,json}"

Fix format and linting:

    $ ftnt-devops-ci fix "**/*.{js,json}"

## Options

- **`--format` or `-f`:**           Only duel with format.
- **`--lint` or `-l`:**             Only duel with linting.
- **`--format_ignore` or `-F`:**    Specify prettierignore file.
- **`--lint_ignore` or `-L`:**      Specify eslintignore file.
- **`--version` or `-V`:**          Get version number.
- **`--help` or `-h`:**             Get help document.

## Config Files

If the current directory already has `.prettierrc` or `.eslintrc` file, it/them will be used as config file when running check and fix commends. Otherwise, the default config will be used.

## Ignore Files

If the current directory already has `.prettierignore` or `.eslintignore` file, it/them will be used as ignore file when running check and fix commends. Otherwise, the default ignore config will be used.

You are allowed to use `--format_ignore <path>` or `-F <path>` to specify format checking ignore file, and use `--lint_ignore <path>` or `-L <path>` to specify linting ignore file.

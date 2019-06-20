#!/usr/bin/env node

const yargs = require("yargs");

const importCommand = require("./commands/import");

const args = yargs
    .command(
        'import',
        'Import a new revision of your API to cassette',
        {
            "project-id": {
                number: true,
                required: true,
            },
            "project-access-token": {
                string: true,
                required: true,
            },
            "branch-name": {
                string: true,
                required: true,
            },
            "revision-name": {
                string: true,
            },
            "command": {
                string: true,
                required: true,
            },
            "verbose": {
                boolean: true,
            }
        },
    )
    .argv;

const commands = {
    import: importCommand,
}

const commandName = args._[0];
const Command = commands[commandName];
if (!Command) {
    yargs.exit(1, new Error("command not found"));
}

new Command(args).execute();

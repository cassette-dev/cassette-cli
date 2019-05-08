#!/usr/bin/env node

const yargs = require("yargs");

const recordCommand = require("./commands/record");

const args = yargs
    .command(
        'record',
        'Start a recording session',
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
    record: recordCommand,
}

const commandName = args._[0];
const Command = commands[commandName];
if (!Command) {
    yargs.exit(1, new Error("command not found"));
}

new Command(args).execute();

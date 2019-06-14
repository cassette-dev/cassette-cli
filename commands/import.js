const yargs = require("yargs");
const process = require("process");
const fs = require("fs");
const tmp = require("tmp");
const request = require("request-promise-native");
const cp = require("child_process");
const ora = require("ora");

class Client {

    constructor(token) {
        this.token = token;
        this.baseUrl = process.env.API_URL || "https://api.cassette.dev/api";
    }

    url(parts) {
        return `${this.baseUrl}/${parts.join('/')}`;
    }


    get(urlParts) {
        return request.get(this.url(urlParts), {
            resolveWithFullResponse: true,
            headers: {
                authorization: `Project ${this.token}`,
            },
            json: true,
        });
    }

    put(urlParts, options) {
        return request.put(this.url(urlParts), {
            resolveWithFullResponse: true,
            headers: {
                authorization: `Project ${this.token}`,
            },
            json: true,
            ...options
        })
    }

    post(urlParts, options) {
        return request.post(this.url(urlParts), {
            resolveWithFullResponse: true,
            headers: {
                authorization: `Project ${this.token}`,
            },
            json: true,
            ...options
        })
    }

}

class ImportCommand {
    constructor(options) {
        this.options = options;
        this.client = new Client(options.projectAccessToken);
        this.ora = ora("Initializing cassette").start();
    }

    async createNewRevision() {
        const projectId = this.options.projectId;
        const branchName = this.options.branchName;

        let projectResponse;
        try {
            projectResponse = await this.client.get(["projects", projectId]);
        } catch (e) {
            this.ora.fail(`Failed to get project with id ${projectId}`)
            if (this.options.verbose) {
                console.error(`[Error ${e.statusCode}]: ${e}`);
            }
            yargs.exit(1);
        }

        let branchResponse;
        try {
            branchResponse = await this.client.put(["projects", projectId, "branches"], { json: { name: branchName } });
        } catch (e) {
            this.ora.fail(`Failed to get or create branch in project ${projectResponse.body.project.name}`)
            if (this.options.verbose) {
                console.error(`[Error ${e.statusCode}]: ${e}`);
            }
            yargs.exit(1);
        }

        let revisionResponse;
        try {
            revisionResponse = await this.client.post(["branches", branchResponse.body.branch.id, "revisions"])
        } catch (e) {
            this.ora.fail(`Failed to create new revision in branch ${branchResponse.body.branch.name}`)
            if (this.options.verbose) {
                console.error(`[Error ${e.statusCode}]: ${e.toString().substr(0, 1000)}`);
            }
            yargs.exit(1);
        }

        return {
            projectId,
            branchId: branchResponse.body.branch.id,
            id: revisionResponse.body.revision.id,
        };
    }

    createBulkFile() {
        return tmp.fileSync();
    }

    createBulkFileSeparator() {
        let hash = ""
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        for (var i = 0; i < 32; i++) {
            hash += chars[Math.floor(Math.random() * chars.length)];
        }
        return `separator--${hash}`;
    }

    callCommand(env) {
        return new Promise((resolve, reject) => {
            let stderr = "";

            const child = cp.spawn(this.options.command, {
                shell: true,
                env: {
                    ...process.env,
                    ...env,
                }
            });

            child.stdout.on("data", (chunk) => {
                if (this.options.verbose) {
                    this.ora.frame();
                    this.ora.clear();
                    console.error(">  " + Buffer.from(chunk).toString());
                }
            });

            child.stderr.on("data", (chunk) => {
                stderr += Buffer.from(chunk).toString();
            });

            child.on("exit", (code) => {
                if (code === 0) {
                    this.ora.succeed("Test run succeeded.");
                    resolve();
                } else {
                    this.ora.fail(`Command "${this.options.command}" returned with exit code ${code}.`)
                    this.ora.frame();
                    this.ora.clear();
                    console.error("\n  Command error output:");
                    console.error(stderr + "\n");
                    yargs.exit(1);
                }
            });
        })        
    }

    assertHasRequestTransactions() {
        const stat = fs.statSync(this.bulkFile.name);
        if (stat.size === 0) {
            this.ora.fail("Couldn't find any request transactions after test run. Make sure you have selected a test suite with integration tests.")
            yargs.exit(1);
        }
    }

    async import() {
        try {
            await this.client.post(["revisions", this.revision.id, "request-transactions"], {
                formData: {
                    "request-transactions": {
                        value: fs.createReadStream(this.bulkFile.name),
                        options: {
                            filename: "request-transactions.txt",
                            contentType: "text/plain",
                        }
                    },
                },
            });
            this.ora.succeed("Imported request transactions to cassette.")
        } catch (e) {
            this.ora.fail(`Failed to upload recordings to revision ${this.revision.id} on branch ${this.options.branchName}.`)
            if (this.options.verbose) {
                console.error(`[Error ${e.statusCode}]: ${e}`);
            }
            yargs.exit(1);
        }
    }

    async completeRevision() {
        let completeRevisionResponse;
        try {
            completeRevisionResponse = await this.client.post(
                ["revisions", this.revision.id, "complete"],
            );
        } catch (e) {
            this.ora.fail(`Failed to complete revision ${this.revision.id} on branch ${this.options.branchName}.`)
            if (this.options.verbose) {
                console.error(`[Error ${e.statusCode}]: ${e}`);
            }
            yargs.exit(1);
        }

        if (completeRevisionResponse.body.created_new_revision) {
            this.ora.succeed(`Completed new revision for '${this.options.branchName}' (cassette://project/${this.revision.projectId}/branch/${this.revision.branchId}/revision/${this.revision.id})`)
        } else {
            this.ora.info(`No changes made. Didn't create a new revision for '${this.options.branchName}'`)
        }
    }

    async execute() {
        this.ora.start(`Creating new revision for branch ${this.options.branchName}`);
        this.revision = await this.createNewRevision();
        this.bulkFile = this.createBulkFile();
        const bulkFileSeparator = this.createBulkFileSeparator();

        if (this.options.verbose) {
            this.ora.succeed(`Created import file at: ${this.bulkFile.name}`);
        }

        this.ora.succeed(`Created a new temporary revision for branch ${this.options.branchName}`);

        try {
            this.ora.start(`Running command: "${this.options.command}"`)
            await this.callCommand({
                CASSETTE_RECORDING: 1,
                CASSETTE_BULK_FILE_PATH: this.bulkFile.name,
                CASSETTE_BULK_FILE_SEPARATOR: bulkFileSeparator,
            });
        } catch (e) {
            this.ora.fail("Failed to import documentation, encountered error during test run.")
            console.error(e);
            yargs.exit(1);
        }
        this.assertHasRequestTransactions();
        this.ora.start("Importing request transactions to cassette.");
        await this.import();
        await this.completeRevision();
    }
}

module.exports = ImportCommand;
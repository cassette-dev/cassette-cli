## Cassette CLI

Cassette records your request and responses to automatically generated API documentation for your application.

#### Install

`npm install @cassette.dev/cassette-cli`

#### Import

1. Download the Cassette Desktop client (currently in private beta) and create a project.
2. Install one of our middlewares in your application:
[cassette-django](https://pypi.org/project/cassette-django/#description)
3. Run the import command:
`cassette import --project-id=<project-id> --project-access-token=<token> --branch-name=<branch-name> --command=<your-test-command-for-integration-tests>`
4. If the import succeeded you can reload in the desktop app and you will see your API documentation.



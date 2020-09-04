import * as path from 'path';

import * as core from '@actions/core';
import * as command from '@actions/core/lib/command';
import * as exec from '@actions/exec';
import * as io from '@actions/io';

const IS_WINDOWS = process.platform == 'win32';
const msvc_regex = /^(.*)\((\d+)(?:,(\d+))?\): (warning|error|fatal error) \S\d+: .*$/i;
const gcc_regex = /^(.*):(\d+):(\d+): (warning|error): .*(?:\[.*\])?$/i;

function asBoolean(input: string | number | boolean) {
    switch (input) {
        case true:
        case 'true':
        case 1:
        case '1':
        case 'on':
        case 'yes':
            return true;
        default:
            return false;
    }
}

interface Properties {
    file?: string,
    line?: Number,
    col?: Number
};

class Annotation {
    file: string;
    line: Number;
    column: Number | -1;
    is_warning: boolean;
    message: string;

    constructor(rootFolder: string, regexMatch: Array<any>) {
				this.file = path.relative(rootFolder, regexMatch[1]);
				this.line = Number(regexMatch[2]);
this.column = Number(regexMatch[3] || -1);
this.is_warning = regexMatch[4] == 'warning';
this.message = regexMatch[0];
    }

    public issue() {
        let props: Properties = {};
        if (!this.file.startsWith('..') && !path.isAbsolute(this.file)) {
						props = {
							file: this.file,
							line: this.line,
						};
						if (this.column >= 0)
							props.col = this.column;
        }

        command.issueCommand(this.is_warning ? 'warning' : 'error', props, this.message);
    }
};

async function buildProject() {
    const rootFolder = process.env.GITHUB_WORKSPACE || '.';
    const buildFolder = path.join(rootFolder, core.getInput('build-folder', { required: true }));

    // Configure the common child process options.
    const commonOptions: exec.ExecOptions = {
        cwd: buildFolder, // All of the commands must be executed in the build folder.
        silent: false,
        ignoreReturnCode: false,
        failOnStdErr: false
    };

    // Create the build folder.
    await io.mkdirP(buildFolder);
	
	const orphan = 'I AM AN ORPHAN!';
	const failure = 'THIS SHOULD FAIL!'

    // Configure the project for building (via AMBuild 2)
    let configureArgs = core.getInput('configure-args');
    await core.group('Configure the project', async () => {
        return await exec.exec('python', [
            path.relative(buildFolder, path.join(rootFolder, core.getInput('project-root', { required: true }), 'configure.py')),
            ...(configureArgs ? configureArgs.split(' ') : [])
        ], { ...commonOptions, ignoreReturnCode: true, failOnStdErr: true });
    });

    await core.group('Build the project', async () => {
        function issueAnnotation(data: string) {
            let result = data.match(gcc_regex);
            if (!result && IS_WINDOWS)
                result = data.match(msvc_regex);

            if (result)
                new Annotation(rootFolder, result).issue();
        }

        const buildOptions: exec.ExecOptions = {
            ...commonOptions,
            listeners: {
                errline: issueAnnotation,
                stdline: IS_WINDOWS ? issueAnnotation : undefined
            }
        };

        try { return await exec.exec('ambuild', undefined, buildOptions); }
        catch {
            process.exitCode = core.ExitCode.Failure;
            return 1;
        }
    });

    if (asBoolean(core.getInput('delete-build'))) {
        core.info('Deleting the build output');
        await io.rmRF(buildFolder);
    }
};

buildProject().catch((error) => core.setFailed(error));

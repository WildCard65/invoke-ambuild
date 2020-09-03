import * as path from 'path';

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as io from '@actions/io';

import * as utils from './utils';

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
            let result = data.match(utils.gcc_regex);
            if (!result && utils.IS_WINDOWS)
                result = data.match(utils.msvc_regex);

            if (result)
                new utils.Annotation(rootFolder, result).issue();
        }

        const buildOptions: exec.ExecOptions = {
            ...commonOptions,
            listeners: {
                errline: issueAnnotation,
                stdline: utils.IS_WINDOWS ? issueAnnotation : undefined
            }
        };

        return await exec.exec('ambuild', undefined, buildOptions);
    });

    if (utils.asBoolean(core.getInput('delete-build'))) {
        core.info('Deleting the build output');
        await io.rmRF(buildFolder);
    }
};

buildProject().catch((error) => core.setFailed(error));

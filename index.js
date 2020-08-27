import { join } from 'path';

import { mkdirP, rmRF } from '@actions/io';
import { getInput, group, info, setFailed } from '@actions/core';
import { exec } from '@actions/exec';
import { getOctokit } from '@actions/github';

const action_dir = process.env.GITHUB_WORKSPACE;
const IS_WINDOWS = process.platform == 'win32';
const gmap = {error: 'failure', warning: 'warning'}

const msvc_regex = new RegExp('^(.*)\\((\\d+)\\): (error|warning) \\S\\d+: (.*)$', 'igm');
const gcc_regex = new RegExp('^(.*):(\\d+):\\d+: (warning|error): (.*\\[.*\\])$', 'igm');

function getBoolean(value) {
    switch (value) {
        case true:
        case "true":
        case 1:
        case "1":
        case "on":
        case "yes":
            return true;
        default:
            return false;
    }
}

async function doAction() {
    const ghc = getOctokit(getInput('gh-token', { required: true }));
    const { check_data } = await ghc.checks.create({
        ...github.context.repo,
        name: github.context.action,
        head_sha: github.context.sha,
        started_at: new Date().toString(),
    });

    const build_dir = join(action_dir, getInput('build-folder', { required: true }));
    await mkdirP(build_dir);

    var python_args = [join(action_dir, getInput('project-root', { required: true }), 'configure.py')];
    {
        var script_args = getInput('configure-args', { required: false });
        if (script_args && script_args != '')
            python_args = [...python_args, ...(script_args.split(' '))]
    }

    // TODO: Implement annotation support.
    await group('Configuring the project', async () => { await exec('python', python_args, { cwd: build_dir, silent: false }); });
    await group('Building the project', async () => {
        var fail_annotations = [];

        await exec('ambuild', undefined, {
            cwd: build_dir,
            silent: false,
            listensers: {
                stderr: (data) => {
                    const msg = data.toString();
                    var rdata = [...msg.matchAll(gcc_regex)];
                    if (rdata.length == 0 && IS_WINDOWS)
                        rdata = [...msg.matchAll(msvc_regex)];

                    rdata.forEach(element => {
                        fail_annotations.push({
                            title: 'C/C++ Compile Error',
                            path: element[1],
                            start_line: element[2],
                            end_line: element[2],
                            annotation_level: gmap[element[3]],
                            message: element[4],
                            raw_details: element[0]
                        });
                    });
                }
            }
        });

        if (fail_annotations.length > 0) {
            await ghc.checks.update({
                ...github.context.repo,
                check_run_id: check_data.id,
                completed_at: new Date().toString(),
                status: 'completed',
                conclusion: 'failure',
                output: {
                    title: github.context.action,
                    summary: 'C/C++ Build VIA AMBuild',
                    annotations: fail_annotations
                }
            });
        }
    });

    if (getBoolean(getInput('delete-build', { required: false }))) {
        info('Deleting the build output')
        await rmRF(build_dir);
    }
}

doAction().catch((reason) => {
    setFailed(reason);
    process.exit(1);
});

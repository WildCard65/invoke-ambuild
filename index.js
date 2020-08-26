import { join } from 'path';

import { mkdirP, rmRF } from '@actions/io';
import { getInput, group, info, setFailed } from '@actions/core';
import { exec } from '@actions/exec';

const action_dir = process.env.GITHUB_WORKSPACE;

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
    const build_dir = join(action_dir, getInput('build-folder', { required: true }));
    const options = { cwd: build_dir, silent: false };

    await mkdirP(build_dir);

    var python_args = [join(action_dir, getInput('project-root', { required: true }), 'configure.py')];
    {
        var script_args = getInput('configure-args', { required: false });
        if (script_args && script_args != '')
            python_args = [...python_args, ...(script_args.split(' '))]
    }

    // TODO: Implement annotation support.
    await group('Configuring the project', async () => { await exec('python', python_args, options); });
    await group('Building the project', async () => { await exec('ambuild', undefined, options); });

    if (getBoolean(getInput('delete-build', { required: false }))) {
        info('Deleting the build output')
        await rmRF(build_dir);
    }
}

doAction().catch((reason) => {
    setFailed(reason);
    process.exit(1);
});

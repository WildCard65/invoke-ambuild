const node_path = require('path')

const ga_io = require('@actions/io');
const ga_core = require('@actions/core');
const ga_exec = require('@actions/exec')

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

async function installAMBuild() {
    const ambuild_dir = node_path.join(action_dir, 'ambuild');
    const options = { cwd: action_dir, silent: false };

    ga_core.startGroup('Downloading AMBuild');
    await ga_exec.exec('git', ['clone', '--progress', 'https://github.com/alliedmodders/ambuild.git', ambuild_dir], options); // TODO: Should this be configurable?
    ga_core.endGroup();

    ga_core.startGroup('Installing AMBuild with PIP');
    await ga_exec.exec('pip', ['install', ambuild_dir], options);
    ga_core.endGroup();
}

async function buildProject() {
    if (getBoolean(ga_core.getInput('auto-install', { required: true })))
        await installAMBuild();

    const build_dir = node_path.join(action_dir, ga_core.getInput('build-folder', { required: true }));
    const options = { cwd: build_dir, silent: false };

    await ga_io.mkdirP(build_dir);

    var python_args = [node_path.join(action_dir, ga_core.getInput('project-root', { required: true }), 'configure.py')];
    {
        var script_args = ga_core.getInput('configure-args', { required: false });
        if (script_args && script_args != '')
            python_args = [...python_args, ...(script_args.split(' '))]
    }

    ga_core.startGroup('Configuring the project');
    await ga_exec.exec('python', python_args, options);
    ga_core.endGroup();

    ga_core.startGroup('Building the project');
    await ga_exec.exec('ambuild', undefined, options);
    ga_core.endGroup();

    if (getBoolean(ga_core.getInput('delete-build', { required: false }))) {
        ga_core.info('Deleting the build output')
        await ga_io.rmRF(build_dir);
    }
}

buildProject().catch((reason) => {
    ga_core.setFailed(reason);
    process.exit(1);
});

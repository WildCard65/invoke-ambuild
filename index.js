const node_path = require('path')
const fs = require('fs');
const { spawn } = require('child_process')

const ga_io = require('@actions/io');
const ga_core = require('@actions/core');

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

function failTheAction(error) {
    ga_core.setFailed(error);
    process.exit(ga_core.ExitCode.Failure);
}

function onChildProcessExit(childProcess, taskName) {
    return new Promise((resolve, reject) => {
        childProcess.on('exit', (exitCode, signal) => {
            if (exitCode != 0) {
                if (exitCode == null) {
                    if (signal == null)
                        reject(new Error(`${taskName} has failed for an unknown reason`));
                    else
                        reject(new Error(`'${taskName} has terminated by a signal: ${signal}`));
                }
                else
                    reject(new Error(`${taskName} has failed with exit code: ${exitCode}`));
            }
            else
                resolve(undefined);
        });
        childProcess.on('error', (errorObj) => { reject(errorObj); });
    });
}

async function installAMBuild() {
    const ambuild_dir = node_path.join(action_dir, 'ambuild');

    {
        ga_core.info("Cloning AMBuild from 'https://github.com/alliedmodders/ambuild.git'");
        const clone_proc = spawn('git', ['clone', 'https://github.com/alliedmodders/ambuild.git', ambuild_dir], {
            cwd: action_dir,
            stdio: ['inherit', 'inherit', 'inherit'],
            detached: false,
            shell: true,
            windowsVerbatimArguments: true,
            windowsHide: true
        });

        await onChildProcessExit(clone_proc, 'Cloning of AMBuild').catch(failTheAction);
    }

    {
        ga_core.info('Installing AMBuild with PIP');
        const install_proc = spawn('pip', ['install', ambuild_dir], {
            cwd: action_dir,
            stdio: ['inherit', 'inherit', 'inherit'],
            detached: false,
            shell: false,
            windowsVerbatimArguments: true,
            windowsHide: true
        });

        await onChildProcessExit(install_proc, 'Installation of AMBuild').catch(failTheAction);
    }
}

async function buildProject() {
    const build_dir = node_path.join(action_dir, ga_core.getInput('build-folder', { required: true }));
    await ga_io.mkdirP(build_dir).catch(failTheAction);

    var python_args = [node_path.join(action_dir, ga_core.getInput('project-root', { required: true }), 'configure.py')];
    {
        var script_args = ga_core.getInput('args', { required: false });
        if (script_args != null && script_args != '')
            python_args = python_args.concact(script_args.split(' '));
    }

    await fs.promises.access(build_dir, fs.constants.F_OK).catch(failTheAction);

    ga_core.info('Configuring the project for building');
    ga_core.info(`> python ${python_args.join(' ')}`);
    const configure_proc = spawn('python', python_args, {
        cwd: build_dir,
        stdio: ['inherit', 'inherit', 'inherit'],
        detached: false,
        shell: false,
        windowsVerbatimArguments: true,
        windowsHide: true
    });
    await onChildProcessExit(configure_proc, 'Configuring the build').catch(failTheAction);

    ga_core.info('Executing the build process');
    ga_core.info('> ambuild');
    const build_proc = spawn('ambuild', undefined, {
        cwd: build_dir,
        stdio: ['inherit', 'inherit', 'inherit'],
        detached: false,
        shell: false,
        windowsVerbatimArguments: true,
        windowsHide: true
    });
    await onChildProcessExit(build_proc, 'Running the build').catch(failTheAction);

    if (getBoolean(ga_core.getInput('delete-build', { required: false }))) {
        ga_core.info('Deleting the build output')
        await ga_io.rmRF(build_dir).catch(failTheAction);
    }
}

async function action_main() {
    if (getBoolean(ga_core.getInput('auto-install', { required: true })))
        await installAMBuild();

    await buildProject();
}

action_main();

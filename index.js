const node_path = require('path')
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
    process.exit(1);
}

function onChildProcessExit(childProcess) {
    return new Promise((resolve, reject) => {
        childProcess.on('exit', (exitCode, signal) => {
            if (exitCode != 0) {
                if (exitCode == null) {
                    if (signal == null)
                        reject(new Error('Cloning of AMBuild has failed for an unknown reason'));
                    else
                        reject(new Error('Cloning of AMBuild has terminated by a signal: ' + signal));
                }
                else
                    reject(new Error('Cloning of AMBuild has failed with exit code: ' + exitCode));
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
            shell: false,
            windowsVerbatimArguments: true,
            windowsHide: true
        });

        await onChildProcessExit(clone_proc).catch(failTheAction);
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

        await onChildProcessExit(install_proc).catch(failTheAction);
    }
}


if (getBoolean(ga_core.getInput('install-ambuild', { required: true })))
    installAMBuild();


async function buildProject() {
    const build_folder = ga_core.getInput('build-path', { required: true });
    const project_root = ga_core.getInput('project-root', { required: true });

    const build_dir = node_path.join(action_dir, build_folder);
    const configure_script = node_path.join(action_dir, project_root, 'configure.py');

    ga_io.mkdirP(build_dir).catch(failTheAction);

    var python_args = [configure_script];
    {
        var script_args = ga_core.getInput('args', { required: false });
        if (script_args != null && script_args != '')
            python_args = python_args.concact(script_args.split(' '));
    }

    console.log('Configuring the project for building');
    const configure_proc = spawn('python', python_args, {
        cwd: build_dir,
        stdio: ['inherit', 'inherit', 'inherit'],
        detached: false,
        shell: false,
        windowsVerbatimArguments: true,
        windowsHide: true
    });
    await onChildProcessExit(configure_proc).catch(failTheAction);

    console.log('Executing the build process');
    const build_proc = spawn('ambuild', undefined, {
        cwd: build_dir,
        stdio: ['inherit', 'inherit', 'inherit'],
        detached: false,
        shell: false,
        windowsVerbatimArguments: true,
        windowsHide: true
    });
    await onChildProcessExit(build_proc).catch(failTheAction);

    if (getBoolean(ga_core.getInput('delete-build', { required: false }))) {
        console.log('Deleting the build output')
        ga_io.rmRF(build_dir).catch((error) => { ga_core.setFailed(error) });
    }
}

buildProject();

const node_path = require('path')
const child_process = require('child_process')

const ga_io = require('@actions/io');
const ga_core = require('@actions/core');

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

{
    const install_ambuild = getBoolean(ga_core.getInput('install-ambuild', { required: true }));
    if (install_ambuild) {
        const ambuild_path = node_path.join(process.env.GITHUB_WORKSPACE, 'ambuild');

        ga_core.startGroup('Installing AMBuild from GitHub');

        var cmd_res = child_process.spawnSync('git', ['clone', 'https://github.com/alliedmodders/ambuild.git', ambuild_path], {
            cwd: process.env.GITHUB_WORKSPACE,
            stdio: [process.stdin, process.stdout, process.stderr],
            shell: true,
            windowsHide: true
        });
        if (cmd_res.status != 0) {
            if (cmd_res.status == null)
                ga_core.setFailed('Cloning of AMBuild failed with signal: ' + cmd_res.signal);
            else
                ga_core.setFailed('Cloning of AMBuild failed with error code: ' + cmd_res.signal);
        }

        cmd_res = child_process.spawnSync('pip', ['install', ambuild_path], {
            cwd: ambuild_path,
            stdio: [process.stdin, process.stdout, process.stderr],
            shell: true,
            windowsHide: true
        });
        if (cmd_res.status != 0) {
            if (cmd_res.status == null)
                ga_core.setFailed('Installation of AMBuild failed with signal: ' + cmd_res.signal);
            else
                ga_core.setFailed('Installation of AMBuild failed with error code: ' + cmd_res.signal);
        }

        ga_core.endGroup();
    }
}

const build_folder = ga_core.getInput('build-path', { required: true });
const project_root = ga_core.getInput('project-root', { required: true });

ga_core.startGroup('Building the project');

const build_dir = node_path.join(process.env.GITHUB_WORKSPACE, build_folder);
ga_io.mkdirP(build_dir).catch((error) => { ga_core.setFailed(error) });

const configure_script = node_path.join(process.env.GITHUB_WORKSPACE, project_root, 'configure.py');
var configure_args = ga_core.getInput('args', { required: false });


var py_args = [configure_script]
if (configure_args != null && configure_args != '')
    py_args = py_args.concat(configure_args.split(' '))

cmd_res = child_process.spawnSync('python', py_args, {
    cwd: build_dir,
    stdio: [process.stdin, process.stdout, process.stderr],
    shell: true,
    windowsHide: true
});
if (cmd_res.status != 0) {
    if (cmd_res.status == null)
        ga_core.setFailed("Invocation of 'configure.py' failed with signal:" + cmd_res.signal);
    else
        ga_core.setFailed("Invocation of 'configure.py' failed with error code: " + cmd_res.status);
}

cmd_res = child_process.spawnSync('ambuild', [], {
    cwd: build_dir,
    stdio: [process.stdin, process.stdout, process.stderr],
    shell: true,
    windowsHide: true
});
if (cmd_res.status != 0) {
    if (cmd_res.status == null)
        ga_core.setFailed('Build failed with signal: ' + cmd_res.signal);
    else
        ga_core.setFailed('Build failed with error code: ' + cmd_res.signal);
}


ga_core.endGroup();

const delete_build = getBoolean(ga_core.getInput('delete-build', { required: false }))
if (delete_build) {
    console.log('Deleting the build output')
    ga_io.rmRF(build_dir).catch((error) => { ga_core.setFailed(error) });
}

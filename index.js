import { join } from 'path';

const child_process = require('child_process');
const readline = require('readline');

const core = require('@actions/core');
const io = require('@actions/io');
const github = require('@actions/github');

const IS_WINDOWS = process.platform == 'win32';

const msvc_regex = /^(.*)\((\d+)\): (error|warning) \S\d+: (.*)$/i;
const gcc_regex = /^(.*):(\d+):\d+: (warning|error): (.*\[.*\])$/i;

function asBoolean(value) {
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

function handleLine(logger, handler)
{
    return function(line) {
        logger(line);
        if (handler != null)
            handler(line);
    };
}

function waitForProcessExit(childProcess, handlers = { stdout: null, stderr: null })
{
    return new Promise((resolve, reject) => {
        childProcess.on('close', (code, signal) => {
            if (code != 0)
            {
                if (code == null)
                    reject(new Error(`The child process has exited with signal ${signal}`));
                else
                    reject(new Error(`The child process has exited with exit code ${code}`));
            }
            else
                resolve(code);
        });
        childProcess.on('error', (error) => reject(error));
        readline.createInterface(childProcess.stdout).on('line', handleLine(core.info, handlers.stdout));
        readline.createInterface(childProcess.stderr).on('line', handleLine(core.error, handlers.stderr));
    });
}

async function doOctokit(action, post_data)
{
    const { data } = await action(post_data);
    return data;
}

async function buildProject() {
    const root_folder = process.env.GITHUB_WORKSPACE;

    const githubClient = github.getOctokit(core.getInput('gh-token', { required: true }));
    const dbg_data = {
        ...github.context.repo,
        name: github.context.action,
        head_sha: github.context.sha,
        started_at: new Date().toISOString(),
    };
    core.debug(`invoke-ambuild: ${JSON.stringify(dbg_data)}`);
    const check_data = await doOctokit(githubClient.checks.create, dbg_data);
    core.debug(`invoke-ambuild: ${JSON.stringify(check_data)}`);

    const build_folder = join(root_folder, core.getInput('build-folder', { required: true }));
    await io.mkdirP(build_folder);

    var pythonArgs = [join(root_folder, core.getInput('project-root', { required: true }), 'configure.py')];
    {
        var configureArgs = core.getInput('configure-args', { required: false });
        if (configureArgs && configureArgs != '')
            pythonArgs = [...pythonArgs, ...(configureArgs.split(' '))]
    }


    const procOptions = {
        cwd: build_folder,
        windowsHide: true,
        detached: false,
        shell: false
    };

    await core.group('Configuring the project', async () => {
        var configureProc = child_process.spawn('python', pythonArgs, procOptions);
        try { await waitForProcessExit(configureProc); }
        catch (error) { throw new Error(configureProc.stderr.toString()); }
    });

    var build_annotations = [];
    var build_failed = false;
    var build_fail_reason = null;

    const fill_annotations = function(line) {
        var regRes = line.match(gcc_regex);
        if (regRes == null && IS_WINDOWS)
            regRes = line.match(msvc_regex);

        core.debug(`Regex result: ${regRes}`);
        if (regRes != null)
        {
            core.debug("Building an annotation!");
            regRes[2] = Number(regRes[2]);

            if (regRes[3] == 'warning')
                core.warning(regRes[0]);
            else
                core.error(regRes[0]);

            build_annotations.push({
                path:regRes[1],
                start_line: regRes[2],
                end_line: regRes[2],
                annotation_level: regRes[3] == 'warning' ? 'warning' : 'failure',
                message: regRes[4]
            });
        }
    };

    await core.group('Building the project', async () => {
        var buildProc = child_process.spawn('ambuild', undefined, procOptions);
        try { await waitForProcessExit(buildProc, { stdout: fill_annotations, stderr: fill_annotations }); }
        catch (error) {
            build_failed = true;
            build_fail_reason = error;
        }
    });

    if (!build_failed && asBoolean(core.getInput('delete-build', { required: false }))) {
        core.info('Deleting the build output');
        await io.rmRF(build_folder);
    }

    core.debug(build_annotations.join(' #|# '));
    const dbg_data_x ={
        ...github.context.repo,
        check_run_id: check_data.id,
        completed_at: new Date().toISOString(),
        status: 'completed',
        conclusion: build_failed ? 'failure' : 'success',
        output: {
            title: github.context.action,
            summary: 'C/C++ Build VIA AMBuild',
            annotations: build_annotations
        }
    };
    core.debug(`invoke-ambuild: ${JSON.stringify(dbg_data_x)}`);
    const update_data = await doOctokit(githubClient.checks.update, dbg_data_x);
    core.debug(`invoke-ambuild: ${JSON.stringify(update_data)}`);

    if (build_failed)
        core.setFailed(build_fail_reason);
}

buildProject().catch((error) => core.setFailed(error));

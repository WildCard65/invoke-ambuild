import { join, relative } from 'path';

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

function injectHandler(cpIO, logger, handler)
{
    if (handler != null)
        readline.createInterface(cpIO).on('line', handler);
    else
        cpIO.on('data', logger);
}

function waitForProcessExit(childProcess, stdout=null, stderr=null)
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
        injectHandler(childProcess.stdout, core.info, stdout);
        injectHandler(childProcess.stderr, core.error, stderr);
    });
}

async function buildProject() {
    const githubClient = github.getOctokit(core.getInput('repository-token', { required: true }));

    const root_folder = process.env.GITHUB_WORKSPACE;
    const build_folder = join(root_folder, core.getInput('build-folder', { required: true }));
    await io.mkdirP(build_folder);

    const processOptions = {
        cwd: build_folder,
        windowsHide: true,
        detached: false,
        shell: false
    };

    {
        var pythonArgs = [relative(build_folder, join(root_folder, core.getInput('project-root', { required: true }), 'configure.py'))];
        {
            var configureArgs = core.getInput('configure-args', { required: false });
            if (configureArgs && configureArgs != '')
                pythonArgs = [...pythonArgs, ...(configureArgs.split(' '))]
        }
        await core.group('Configuring the project', async () => {
            var configureAction = child_process.spawn('python', pythonArgs, processOptions);
            try { await waitForProcessExit(configureAction); }
            catch (error) { throw new Error(configureAction.stderr.toString()); }
        });
    }

    const build_result = {
        failed: false,
        annotations: []
    };

    await core.group('Building the project', async () => {
        var buildProc = child_process.spawn('ambuild', undefined, processOptions);
        try { await waitForProcessExit(buildProc, { stdout: (line) => {
            var regexResult = line.match(gcc_regex);
            if (regexResult == null && IS_WINDOWS)
                regexResult = line.match(msvc_regex);

            if (regexResult != null)
            {
                regexResult[1] = relative(root_folder, regexResult[1]);
                regexResult[2] = Number(regexResult[2]);

                build_result.annotations.push({
                    path: regexResult[1],
                    start_line: regexResult[2],
                    end_line: regexResult[2],
                    annotation_level: regexResult[3] == 'warning' ? 'warning' : 'failure',
                    message: regexResult[0],
                    title: `C/C++ Compiler ${regexResult[3] == 'warning' ? 'Warning' : 'Error'}`
                })
            }
        }, stderr: null }); }
        catch (error) { build_result.failed = true; }
    });

    if (!build_result.failed && asBoolean(core.getInput('delete-build', { required: false }))) {
        core.info('Deleting the build output');
        await io.rmRF(build_folder);
    }

    const update_info = {
        ...github.context.repo,
        check_run_id: github.context.runNumber,
        completed_at: new Date().toISOString(),
        status: 'completed',
        conclusion: build_result.failed ? 'failure' : 'success',
        output: {
            title: github.context.eventName,
            summary: 'C/C++ Build VIA AMBuild',
            annotations: build_result.annotations
        }
    };

    core.debug(`check-input: ${JSON.stringify(update_info)}`);
    const { data } = await githubClient.checks.update(update_info);
    core.debug(`check-update: ${JSON.stringify(data)}`);

    if (build_result.failed)
        process.exitCode = core.ExitCode.Failure;
}

buildProject().catch((error) => core.setFailed(error));

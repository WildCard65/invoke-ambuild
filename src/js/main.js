"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const io = __importStar(require("@actions/io"));
const utils = __importStar(require("./utils"));
async function buildProject() {
    const rootFolder = process.env.GITHUB_WORKSPACE;
    const buildFolder = path.join(rootFolder || '.', core.getInput('build-folder', { required: true }));
    // Configure the common child process options.
    const commonOptions = {
        cwd: buildFolder,
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
            path.relative(buildFolder, path.join(rootFolder || '.', core.getInput('project-root', { required: true }))),
            ...(configureArgs ? configureArgs.split(' ') : [])
        ], { ...commonOptions, ignoreReturnCode: true, failOnStdErr: true });
    });
    await core.group('Build the project', async () => {
        function issueAnnotation(data) {
            let result = data.match(utils.gcc_regex);
            if (!result && utils.IS_WINDOWS)
                result = data.match(utils.msvc_regex);
            if (result)
                new utils.Annotation(result).issue();
        }
        const buildOptions = {
            ...commonOptions,
            listeners: {
                errline: issueAnnotation,
                stdline: utils.IS_WINDOWS ? issueAnnotation : undefined
            }
        };
        return await exec.exec('ambuild', undefined, buildOptions);
    });
    if (!utils.asBoolean(core.getInput('delete-build'))) {
        core.info('Deleting the build output');
        await io.rmRF(buildFolder);
    }
}
;
buildProject().catch((error) => core.setFailed(error));

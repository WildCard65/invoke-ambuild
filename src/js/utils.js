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
exports.Annotation = exports.asBoolean = exports.gcc_regex = exports.msvc_regex = exports.IS_WINDOWS = void 0;
const command = __importStar(require("@actions/core/lib/command"));
exports.IS_WINDOWS = process.platform == 'win32';
exports.msvc_regex = /^(.*)\((\d+)\): (warning|error|fatal error) \S\d+: .*$/i;
exports.gcc_regex = /^(.*):(\d+):\d+: (warning|error): .*\[.*\]$/i;
function asBoolean(input) {
    switch (input) {
        case true:
        case 'true':
        case 1:
        case '1':
        case 'on':
        case 'yes':
            return true;
        default:
            return false;
    }
}
exports.asBoolean = asBoolean;
;
class Annotation {
    constructor(regexMatch) {
        this.file = regexMatch[1];
        this.line = Number(regexMatch[2]);
        this.column = Number(regexMatch[3] || -1);
        this.is_warning = regexMatch[4] == 'warning';
        this.message = regexMatch[0];
    }
    issue() {
        let props = {
            file: this.file,
            line: this.line,
        };
        if (this.column >= 0)
            props.col = this.column;
        command.issueCommand(this.is_warning ? 'warning' : 'error', props, this.message);
    }
}
exports.Annotation = Annotation;
;

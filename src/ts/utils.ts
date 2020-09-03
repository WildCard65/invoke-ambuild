import * as command from '@actions/core/lib/command';

export const IS_WINDOWS = process.platform == 'win32';
export const msvc_regex = /^(.*)\((\d+)\): (warning|error|fatal error) \S\d+: .*$/i;
export const gcc_regex = /^(.*):(\d+):\d+: (warning|error): .*\[.*\]$/i;

export function asBoolean(input: string | number | boolean) {
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

interface Properties {
    file: string,
    line: Number,
    col?: Number | undefined
};

export class Annotation {
    file: string;
    line: Number;
    column: Number | -1;
    is_warning: boolean;
    message: string;

    constructor(regexMatch: Array<any>) {
        this.file = regexMatch[1];
        this.line = Number(regexMatch[2]);
        this.column = Number(regexMatch[3] || -1);
        this.is_warning = regexMatch[4] == 'warning';
        this.message = regexMatch[0];
    }

    public issue() {
        let props: Properties = {
            file: this.file,
            line: this.line,
        };
        if (this.column >= 0)
            props.col = this.column;

        command.issueCommand(this.is_warning ? 'warning' : 'error', props, this.message);
    }
};

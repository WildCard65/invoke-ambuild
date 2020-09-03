export declare const IS_WINDOWS: boolean;
export declare const msvc_regex: RegExp;
export declare const gcc_regex: RegExp;
export declare function asBoolean(input: string | number | boolean): boolean;
export declare class Annotation {
    file: string;
    line: Number;
    column: Number | -1;
    is_warning: boolean;
    message: string;
    constructor(rootFolder: string, regexMatch: Array<any>);
    issue(): void;
}

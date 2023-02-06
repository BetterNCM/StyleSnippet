import { SnippetInfo } from "./model";

export class StylesheetSnippet {
    constructor(public readonly stylesheet:string,
                public readonly info: SnippetInfo) {}
}

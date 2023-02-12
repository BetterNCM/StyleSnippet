import { SnippetInfo } from "./model";

export type ConfigType = "checkbox" | "input"

export interface ConfigKey {
    key: string,
    type: ConfigType,
    name: string,
    attrs: any,
    defaultValue: string
}

// https://stackoverflow.com/questions/6842795/dynamic-deep-setting-for-a-javascript-object
function setValue(obj, path, value) {
    var a = path.split('.')
    var o = obj
    while (a.length - 1) {
        var n = a.shift()
        if (!(n in o)) o[n] = {}
        o = o[n]
    }
    o[a[0]] = value
}

function getValue(obj, path) {
    path = path.replace(/\[(\w+)\]/g, '.$1')
    path = path.replace(/^\./, '')
    var a = path.split('.')
    var o = obj
    while (a.length) {
        var n = a.shift()
        if (!(n in o)) return
        o = o[n]
    }
    return o
}

function parseConfigLine(line: string): ConfigKey | null {
    line = line.trim();
    if (!line.startsWith("@")) return null;
    if (line.toLowerCase().includes("//:")) {
        const [lessDef, configDef] = line.split("//:").map(v => v.trim());
        const [key, defaultValue] = lessDef.split(":").map(v => v.trim().replace(";", ""));
        const configBlocks = configDef.split("|").map(v => v.trim());

        const config: ConfigKey = {
            key,
            name: key,
            type: "checkbox",
            attrs: {},
            defaultValue
        };

        for (const configBlock of configBlocks) {
            const [path, value] = configBlock.split(":").map(v => v.trim());
            setValue(config, path, value);
        }

        return config;
    }
    return null;
}

export class StylesheetSnippet {
    configs: [ConfigKey, number][] = []
    constructor(public readonly stylesheet: string,
        public readonly info: SnippetInfo) {
        const lines = stylesheet.split("\n");
        for (const lineNum in lines) {
            const line = lines[lineNum];
            const config = parseConfigLine(line);
            if (config)
                this.configs.push([config, +lineNum]);
        }
    }

    getStylesheet(configProvider: ((key: string) => string | undefined)) {
        const lines = this.stylesheet.split("\n");
        for (const [config, lineNum] of this.configs){
            lines[lineNum] = `${config.key}: ${configProvider(config.key) ?? config.defaultValue};`
        }
            
        return lines.join("\n");
    }
}

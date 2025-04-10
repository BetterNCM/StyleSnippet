/**
 * @fileoverview
 * 此处的脚本将会在插件管理器加载插件期间被加载
 * 一般情况下只需要从这个入口点进行开发即可满足绝大部分需求
 */

import { render } from "less";
import { FILE_BASE_URL, SNIPPETS_URL } from "./api";
import { useLocalStorage } from "./hooks";
import "./index.scss";
import { SnippetInfo } from "./model";
import { StylesheetSnippet } from "./stylesheet";
import { editor } from "monaco-editor";
import { CrossWindowEventListener } from "./CrossWindowEventListener";

let configElement;


const PLUGIN_ONLINE_BASE_URL = BETTERNCM_FILES_PATH + plugin.pluginPath.split(/[/,\\]\./)[1];
const PLUGIN_ONLINE_EDITOR_URL = PLUGIN_ONLINE_BASE_URL + "/editor.html";

let self;

plugin.onLoad(function (selfPlugin) {
    self = this.mainPlugin;
    configElement = document.createElement("div");
    ReactDOM.render(<Menu />, configElement);
});

let cache = {};

async function fetchWithCache(url: string) {
    if (cache[url]) {
        return { text: cache[url] };
    }

    try {
        const response = await fetch(`${url}?${new Date().getTime()}`);
        const text = await response.text();
        cache[url] = text;
        return { text };
    } catch (error) {
        return { error };
    }
}

function Menu() {
    const CheckBox = ({ onChange, checked, name, id }) => (<>
        <div>
            <input type="checkbox" checked={checked} onChange={onChange} id={id} className="snippet-checkbox" />
            <label htmlFor={id} className="snippet-checkbox-label" style={{ float: "left" }}>
                <span />
            </label>

            <span onClick={() => document.querySelector(id).click()} style={{ marginLeft: "8px", minWidth: "70px" }}>{name}</span>
        </div>
    </>)

    const readLocalSnippetList = () =>
        betterncm_native.fs.readDir('./StyleSnippets').map(path => ({
            name: path.split(/[/,\\]/).pop().split('.')[0],
            file: path,
            id: path.split(/[/,\\]/).pop().split('.')[0],
            local: true
        }));

    const [onlineSnippetList, setOnlineSnippetList] =
        React.useState<Array<SnippetInfo>>([]);

    const [localSnippetList, setLocalSnippetList] = React.useState<Array<SnippetInfo>>([]);

    const [externalSnippetList, setExternalSnippetList] = React.useState<Array<StylesheetSnippet>>([]);

    self.addExternalSnippet = (stylesheet, name, id) => {
        setExternalSnippetList([...externalSnippetList, new StylesheetSnippet(
            stylesheet, {
            name,
            file: "external_" + id,
            id,
            local: false,
            hidden: false,
        }
        )]);
    };

    const reloadLocalSnippetList = () => {
        try {
            setLocalSnippetList(readLocalSnippetList());
        } catch (e) {
            betterncm.fs.mkdir('./StyleSnippets');
            setLocalSnippetList([])
        }
    };
    React.useEffect(reloadLocalSnippetList, []);
    React.useEffect(() => {
        setOnlineSnippetList(mapOnlineSnippets(onlineSnippetList))
    }, [localSnippetList]);

    const [outputStylesheet, setOutputStylesheet] = React.useState("");

    const stylesheet = React.useMemo(
        () =>
            betterncm_native.fs.readFileText(`${plugin.pluginPath}/index.css`),
        [],
    );

    const [editorWin, setEditorWin] = React.useState<Window | null>(null);

    const [enabledSnippets, setEnabledSnippets] = useLocalStorage<
        Array<String>
    >("enabledSnippets", []);

    // @ts-ignore
    const is300 = APP_CONF.appver.startsWith('3.');

    function mapOnlineSnippets(snippets) {
        return snippets?.map(v => {
            return {
                ...v, hidden: (localSnippetList.findIndex(loc => loc.id === v.id) !== -1) || (is300 && !v.ncm3) || (!is300 && v.ncm3)
            };
        })!
    }

    React.useEffect(() => {
        !(async () => {
            const resp = await (
                await fetch(`${SNIPPETS_URL}?${new Date().getTime()}`)
            ).json();
            setOnlineSnippetList(mapOnlineSnippets(resp));
        })();
    }, []);

    React.useEffect(() => {
        calcStylesheets();
    }, [enabledSnippets, localSnippetList, onlineSnippetList, externalSnippetList]);

    async function readSnippet(id) {
        const snippetListFull = [...localSnippetList, ...onlineSnippetList ?? []];
        const snippet = snippetListFull?.find((v) => v.id === id);
        if (snippet) {
            let code;
            if (snippet.local)
                code = {
                    text: await betterncm.fs.readFileText(snippet.file)
                };
            else
                code = await fetchWithCache(
                    `${FILE_BASE_URL}${snippet.file}`,
                );
            if (code.text !== undefined)
                return new StylesheetSnippet(code.text, snippet);
        }
    }

    const getSnippetConfig = (id, key) => {
        const configs = JSON.parse(localStorage[getSnippetConfigKey(id)] ?? "{}");
        return configs[key];
    }

    const setSnippetConfig = (id, key, value) => {
        const configs = JSON.parse(localStorage[getSnippetConfigKey(id)] ?? "{}");
        configs[key] = value;
        localStorage[getSnippetConfigKey(id)] = JSON.stringify(configs);
        return configs;
    }

    const [loadedSnippets, setLoadedSnippets] = React.useState<StylesheetSnippet[]>([]);

    async function calcStylesheets() {
        const snippets: StylesheetSnippet[] = [...externalSnippetList];

        for (const enabledSnippet of enabledSnippets) {
            const s = await readSnippet(enabledSnippet);
            if (s)
                snippets.push(s)
        }

        setLoadedSnippets(snippets);

        const stylesheet = await reCompileStylesheets(snippets);
        setOutputStylesheet(stylesheet.join("\n\n"));
    };
    async function reCompileStylesheets(snippets: StylesheetSnippet[]) {
        return await Promise.all(
            snippets.map(async (snippet) => {
                return `
                /* StyleSnippet ${snippet.info.id} */
                ${(await render(snippet.getStylesheet((key) => getSnippetConfig(snippet.info.id, key)))).css}
                
                `;
            }),
        );
    }

    function toggleSnippet(snippetId) {
        console.log("toggle", snippetId)
        if (enabledSnippets.includes(snippetId)) {
            setEnabledSnippets(
                enabledSnippets.filter((id) => id !== snippetId),
            );
        } else {
            setEnabledSnippets([...enabledSnippets, snippetId]);
        }
    }

    React.useEffect(() => {
        let styleElement = document.querySelector("style#StyleSnippetStyles");
        if (!styleElement) {
            styleElement = document.createElement("style");
            styleElement.id = "StyleSnippetStyles";
            document.head.appendChild(styleElement);
        }

        styleElement.innerHTML = outputStylesheet;
    }, [outputStylesheet]);

    const [editorWinEvt, setEditorWinEvt] = React.useState<null | CrossWindowEventListener>(null);

    const checkEditorOpen = async () => {
        let editorWin_ = editorWin;
        if (!editorWin || editorWin.closed) {
            editorWin_ = window.open(PLUGIN_ONLINE_EDITOR_URL)
            setEditorWin(editorWin_);
            const evt = new CrossWindowEventListener(editorWin_, "stylesnippet.editorWin")
            setEditorWinEvt(evt);

            evt.addEventListener("savefile", async (evt: CustomEvent) => {
                const info: SnippetInfo = evt.detail.info;
                betterncm.fs.writeFile(info.file, new Blob([evt.detail.stylesheet]))
                await betterncm.utils.delay(100);
                calcStylesheets();
            })

            return evt;
        }
        editorWin_?.focus();
        return editorWinEvt;
    }

    const editLocalSnippet = async (id) => {
        const snippet = await readSnippet(id);
        if (snippet?.info.local) {
            const evt = await checkEditorOpen();
            evt?.dispatchEvent(new CustomEvent("openfile", {
                detail: {
                    info: snippet.info,
                    stylesheet: snippet.stylesheet
                }
            }))
        } else {
            alert("Cannot edit online snippet!")
        }
    }

    const removeLocalSnippet = async (id) => {
        const snippet = await readSnippet(id);

        if (snippet?.info.file) {
            await betterncm.fs.remove(snippet?.info.file);
            reloadLocalSnippetList();
        }
    }


    const forkSnippet = async (id) => {
        const snippet = await readSnippet(id);
        betterncm_native.fs.writeFileText('./StyleSnippets/' + id + "_backup.less", snippet?.stylesheet);
        betterncm_native.fs.writeFileText('./StyleSnippets/' + id + ".less", snippet?.stylesheet);
        reloadLocalSnippetList();
    }

    const getSnippetConfigKey = (id) => `cc.microblock.betterncm.stylesnippets.snippetsConfig.${id}`;


    const getConfigElement = (id) => {
        const snippet = loadedSnippets.find(v => v.info.id === id);

        if (snippet) {
            return snippet.configs.map(v => {
                if (v[0].type === "checkbox") {
                    return (<>
                        <CheckBox onChange={(e) => { setSnippetConfig(id, v[0].key, e.target.checked); calcStylesheets(); }}
                            checked={getSnippetConfig(id, v[0].key) ?? v[0].defaultValue}
                            name={v[0].name}
                            id={"stylesnippet-" + id + "-" + v[0].key}
                        /><br />
                    </>);
                }
            });
        }
    }

    return (
        <div className="stylesnippet-config">
            <h1>StyleSnippet</h1>
            {onlineSnippetList.filter(snippet => !snippet.hidden).map((snippet) => (
                <>
                    <div
                        className="snippet-container">

                        <CheckBox id={snippet.id + "-enable"} name={snippet.name}
                            checked={enabledSnippets.includes(snippet.id)}
                            onChange={() => toggleSnippet(snippet.id)}
                        />
                        <span className="snippet-btn" onClick={() => forkSnippet(snippet.id)} style={{ marginTop: "3px", marginLeft: "10px", width: 17, fill: 'currentColor' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>source-fork</title><path d="M6,2A3,3 0 0,1 9,5C9,6.28 8.19,7.38 7.06,7.81C7.15,8.27 7.39,8.83 8,9.63C9,10.92 11,12.83 12,14.17C13,12.83 15,10.92 16,9.63C16.61,8.83 16.85,8.27 16.94,7.81C15.81,7.38 15,6.28 15,5A3,3 0 0,1 18,2A3,3 0 0,1 21,5C21,6.32 20.14,7.45 18.95,7.85C18.87,8.37 18.64,9 18,9.83C17,11.17 15,13.08 14,14.38C13.39,15.17 13.15,15.73 13.06,16.19C14.19,16.62 15,17.72 15,19A3,3 0 0,1 12,22A3,3 0 0,1 9,19C9,17.72 9.81,16.62 10.94,16.19C10.85,15.73 10.61,15.17 10,14.38C9,13.08 7,11.17 6,9.83C5.36,9 5.13,8.37 5.05,7.85C3.86,7.45 3,6.32 3,5A3,3 0 0,1 6,2M6,4A1,1 0 0,0 5,5A1,1 0 0,0 6,6A1,1 0 0,0 7,5A1,1 0 0,0 6,4M18,4A1,1 0 0,0 17,5A1,1 0 0,0 18,6A1,1 0 0,0 19,5A1,1 0 0,0 18,4M12,18A1,1 0 0,0 11,19A1,1 0 0,0 12,20A1,1 0 0,0 13,19A1,1 0 0,0 12,18Z" /></svg>
                        </span>


                    </div>
                    <div className="snippet-container snippet-container-config">
                        {getConfigElement(snippet.id)}
                    </div>
                </>
            ))}

            <h1>External 其他插件添加的</h1>
            {
                externalSnippetList.map(snippet => (<>
                    <div
                        className="snippet-container"
                    >
                        <div style={{ fontSize: '20px', }}>{snippet.info.name}</div>

                    </div>
                    <div
                        className="snippet-container snippet-container-config"
                    >
                        {getConfigElement(snippet.info.id)}
                    </div>
                </>))
            }

            <h1> Local 本地的 <span onClick={() => {
                betterncm_native.fs.writeFileText('./StyleSnippets/' + prompt("Id") + ".less", "");
                reloadLocalSnippetList();
            }} style={{ color: "gray" }}>+</span></h1>

            {localSnippetList.map((snippet) => (
                <>
                    <div
                        className="snippet-container"
                    >
                        <CheckBox id={snippet.id + "-enable"} name={snippet.name}
                            checked={enabledSnippets.includes(snippet.id)}
                            onChange={() => toggleSnippet(snippet.id)}
                        />

                        <span className="snippet-btn" onClick={() => editLocalSnippet(snippet.id)} style={{ marginTop: "3px", marginLeft: "10px", width: 17, fill: 'currentColor' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>file-edit-outline</title><path d="M10 20H6V4H13V9H18V12.1L20 10.1V8L14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H10V20M20.2 13C20.3 13 20.5 13.1 20.6 13.2L21.9 14.5C22.1 14.7 22.1 15.1 21.9 15.3L20.9 16.3L18.8 14.2L19.8 13.2C19.9 13.1 20 13 20.2 13M20.2 16.9L14.1 23H12V20.9L18.1 14.8L20.2 16.9Z" /></svg>
                        </span>
                        <span className="snippet-btn" onClick={() => removeLocalSnippet(snippet.id)} style={{ marginTop: "3px", marginLeft: "10px", width: 17, fill: 'currentColor' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>file-remove-outline</title><path d="M13.81 22H6C4.89 22 4 21.11 4 20V4C4 2.9 4.89 2 6 2H14L20 8V13.09C19.67 13.04 19.34 13 19 13S18.33 13.04 18 13.09V9H13V4H6V20H13.09C13.21 20.72 13.46 21.39 13.81 22M22.54 21.12L20.41 19L22.54 16.88L21.12 15.47L19 17.59L16.88 15.47L15.47 16.88L17.59 19L15.47 21.12L16.88 22.54L19 20.41L21.12 22.54L22.54 21.12Z" /></svg>       </span>
                    </div>

                    <div className="snippet-container snippet-container-config">
                        {getConfigElement(snippet.id)}
                    </div>
                </>
            ))}

            <style>{stylesheet}</style>


        </div>
    );
}

plugin.onConfig(() => {
    return configElement;
});

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

let configElement;

plugin.onLoad((selfPlugin) => {
    configElement = document.createElement("div");
    ReactDOM.render(<Menu />, configElement);
});

let cache = {};

async function fetchWithCache(url:string) {
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
    const [snippetList, setSnippetList] =
        React.useState<null | Array<SnippetInfo>>(null);
    const [outputStylesheet, setOutputStylesheet] = React.useState("");

    const stylesheet = React.useMemo(
        () =>
            betterncm_native.fs.readFileText(`${plugin.pluginPath}/index.css`),
        [],
    );

    const [enabledSnippets, setEnabledSnippets] = useLocalStorage<
        Array<String>
    >("enabledSnippets", []);

    React.useEffect(() => {
        !(async () => {
            const resp = await (
                await fetch(`${SNIPPETS_URL}?${new Date().getTime()}`)
            ).json();
            setSnippetList(resp);
        })();
    }, []);

    React.useEffect(() => {
        calcStylesheets();
    }, [enabledSnippets]);
    calcStylesheets();



    async function calcStylesheets() {
        const snippets: StylesheetSnippet[] = [];
        for (const enabledSnippet of enabledSnippets) {
            const snippet = snippetList?.find((v) => v.id === enabledSnippet);
            if (snippet) {
                const code = await fetchWithCache(
                    `${FILE_BASE_URL}${snippet.file}`,
                );
                if (code.text)
                    snippets.push(new StylesheetSnippet(snippet.id, code.text));
            }
        }

        const stylesheet = await reCompileStylesheets(snippets);
        setOutputStylesheet(stylesheet.join("\n\n"));
    }
    async function reCompileStylesheets(snippets: StylesheetSnippet[]) {
        return await Promise.all(
            snippets.map(async (snippet) => {
                return `/* StyleSnippet ${
                    snippet.id
                } */${(await render(snippet.stylesheet)).css}`;
            }),
        );
    }

    function toggleSnippet(snippetId) {
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

    if (!snippetList) {
        return <div>Loading...</div>;
    }
    return (
        <div className="stylesnippet-config">
            <h1>StyleSnippet</h1>
            {snippetList.map((snippet) => (
                // rome-ignore lint/a11y/useKeyWithClickEvents: <explanation>
                <div
                    className="snippet-container"
                    onClick={() => toggleSnippet(snippet.id)}
                >
                    <input
                        type="checkbox"
                        className="snippet-checkbox"
                        checked={enabledSnippets.includes(snippet.id)}
                    />
                    <span className="snippet-name">{snippet.name}</span>
                </div>
            ))}

            <style>{stylesheet}</style>
        </div>
    );
}

plugin.onConfig(() => {
    return configElement;
});

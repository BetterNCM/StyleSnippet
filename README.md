# BetterNCM 插件模板（TypeScript + React + Stylus + ESBuild 组合）

一个插件模板，可以用来快速开发一个基于 TypeScript + React + Stylus + ESBuild 的 [BetterNCM](https://github.com/MicroCBer/BetterNCM) 插件。

本仓库自带 BetterNCM API 的类型定义文件和相关的辅助变量。

推荐使用 VSCode + Rome 进行开发。

## 开发方式

克隆本仓库，使用 `yarn` 或 `npm i` 安装依赖，然后在 `src` 文件夹内进行开发。

开发之后，可以通过在仓库文件夹内执行 `yarn build:dev` 或 `npm run build:dev` 执行开发构建指令，可构建出自带 Source Map 的脚本和样式表。

完成之后，可以通过在仓库文件夹内执行 `yarn build` 或 `npm run build` 执行构建指令，可构建出无 Source Map 且压缩后的最小脚本和样式表。

更详细的开发流程和发布流程请参阅 [BetterNCM Wiki](https://github.com/MicroCBer/BetterNCM/wiki)

## 开发注意事项

请使用全局变量定义的 React/ReactDOM，而不是使用 `import` 语句引入的 React。否则会导致编译时会引入自己的 React 或 ReactDOM，导致产物变大：

```tsx
// 这样是可以的
const SomeComponent: React.FC = () => {
    const [state, setState] = React.useState('');
    return <>{state}</>;
}

ReactDOM.render(<SomeComponent />, someElement);
```

```tsx
// 这样是不可以的
import { useState } from "react";
import { render } from "react-dom";

const SomeComponent: React.FC = () => {
    const [state, setState] = useState('');
    return <>{state}</>;
}

render(<SomeComponent />, someElement);
```

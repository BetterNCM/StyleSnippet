export class CrossWindowEventListener extends EventTarget {
    #targetWindow: Window | null = null;
    #name = "";
    constructor(targetWindow, name) {
        super();
        if (!targetWindow) throw "No parent window!";
        this.#targetWindow = targetWindow;
        this.#name = name;
        console.log(this.#targetWindow)
        this.#targetWindow?.postMessage({
            type: "__PING__",
            __cross_window_evt__: this.#name
        }, '*');
        window.addEventListener("message", ev => {
            if (ev.data.__cross_window_evt__ === this.#name) {

                if (ev.data.type === "__PING__" && !this.#inited) {
                    this.#inited = true;
                    this.#targetWindow?.postMessage({
                        type: "__PING__",
                        __cross_window_evt__: this.#name
                    }, '*');
                    this.#processQueue();
                }

                super.dispatchEvent(new CustomEvent(ev.data.type, {
                    detail: ev.data.detail
                }))
            }
        })
    }
    #queue: CustomEvent[] = [];
    #inited = false;
    #processQueue() {
        if (!this.#inited) return;
        while (this.#queue.length > 0) {
            const event = this.#queue.pop();
            if (!event) continue;
            this.#targetWindow?.postMessage({
                type: event.type,
                detail: event.detail,
                __cross_window_evt__: this.#name,
            }, '*');
        }
    }
    dispatchEvent(event: CustomEvent) {
        this.#queue.push(event);
        this.#processQueue();
        return true;
    }
}
/**
 * Web Component entry point.
 *
 * Defines <ask-tetr-widget tenant-id="123"> that:
 *  1. Attaches a Shadow DOM for CSS isolation
 *  2. Injects Tailwind + app CSS into the shadow root
 *  3. Renders the full React app inside the shadow root
 *  4. Reads the `tenant-id` attribute and passes it to TenantProvider
 */

import { createRoot, type Root } from "react-dom/client";
import App from "./App";

// Vite `?inline` import — returns CSS as a string instead of injecting into <head>
import appStyles from "./index.css?inline";

// Google Fonts CSS (loaded as inline string)
const FONT_CSS = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');`;

class AskTetrWidget extends HTMLElement {
  private _root: Root | null = null;
  private _shadowContainer: HTMLDivElement | null = null;

  static get observedAttributes() {
    return ["tenant-id"];
  }

  connectedCallback() {
    // Create shadow root
    const shadow = this.attachShadow({ mode: "open" });

    // Inject styles into shadow DOM
    const style = document.createElement("style");
    style.textContent = `${FONT_CSS}\n${appStyles}`;
    shadow.appendChild(style);

    // Mount container
    this._shadowContainer = document.createElement("div");
    this._shadowContainer.id = "ask-tetr-root";
    this._shadowContainer.style.cssText = "width:100%;height:100%;";
    shadow.appendChild(this._shadowContainer);

    this._mount();
  }

  disconnectedCallback() {
    this._root?.unmount();
    this._root = null;
  }

  attributeChangedCallback(_name: string, oldVal: string | null, newVal: string | null) {
    if (oldVal !== newVal) {
      this._mount();
    }
  }

  private _mount() {
    if (!this._shadowContainer) return;

    const tenantId = this.getAttribute("tenant-id") || undefined;

    // Unmount previous tree if re-rendering
    if (this._root) {
      this._root.unmount();
    }

    this._root = createRoot(this._shadowContainer);

    // Pass tenantId and shadow host element to the App so TenantProvider
    // can inject CSS variables into the shadow root instead of <html>
    this._root.render(
      <App tenantId={tenantId} styleRoot={this._shadowContainer} />
    );
  }
}

// Register the custom element (idempotent)
if (!customElements.get("ask-tetr-widget")) {
  customElements.define("ask-tetr-widget", AskTetrWidget);
}

export { AskTetrWidget };

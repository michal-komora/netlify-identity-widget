import { h, render } from "preact";
import { observe } from "mobx";
import { Provider } from "mobx-preact";
import GoTrue from "gotrue-js";
import App from "./components/app";
import store from "./state/store";
import Controls from "./components/controls";
import modalCSS from "./components/modal.css";


console.log("\n\n====================netlify-identity====================\n\n")

const callbacks = {};
function trigger(callback) {
  console.log(`trigger: ${callback}`)
  const cbMap = callbacks[callback] || new Set();
  Array.from(cbMap.values()).forEach((cb) => {
    cb.apply(cb, Array.prototype.slice.call(arguments, 1));
  });
}

const validActions = {
  login: true,
  signup: true,
  error: true
};

const netlifyIdentity = {
  on: (event, cb) => {
    console.log(`netlifyIdentity.on(${event})`)
    callbacks[event] = callbacks[event] || new Set();
    callbacks[event].add(cb);
  },
  off: (event, cb) => {
    if (callbacks[event]) {
      if (cb) {
        callbacks[event].delete(cb);
      } else {
        callbacks[event].clear();
      }
    }
  },
  open: (action) => {
    console.log(`netlifyIdentity.open(${action})`)
    action = action || "login";
    if (!validActions[action]) {
      throw new Error(`Invalid action for open: ${action}`);
    }
    store.openModal(store.user ? "user" : action);
  },
  close: () => {
    store.closeModal();
  },
  currentUser: () => {
    return store.gotrue && store.gotrue.currentUser();
  },
  logout: () => {
    return store.logout();
  },
  get gotrue() {
    if (!store.gotrue) {
      store.openModal("login");
    }
    return store.gotrue;
  },
  refresh(force) {
    if (!store.gotrue) {
      console.log("Gonna openModal login")
      store.openModal("login");
    }
    return store.gotrue.currentUser().jwt(force);
  },
  init: (options) => {
    init(options);
  },
  setLocale: (locale) => {
    if (locale) {
      store.locale = locale;
    }
  },
  store
};

let queuedIframeStyle = null;
function setStyle(el, css) {
  let style = "";
  for (const key in css) {
    style += `${key}: ${css[key]}; `;
  }
  if (el) {
    el.setAttribute("style", style);
  } else {
    queuedIframeStyle = style;
  }
}

const localHosts = {
  localhost: true,
  "127.0.0.1": true,
  "0.0.0.0": true
};

function instantiateGotrue(APIUrl) {
  const isLocal = localHosts[document.location.hostname];
  if (APIUrl) {
    return new GoTrue({ APIUrl, setCookie: !isLocal });
  }
  if (isLocal) {
    store.setIsLocal(isLocal);
    const siteURL = localStorage.getItem("netlifySiteURL");
    if (siteURL) {
      // setting a siteURL will invoke instantiateGotrue again with the relevant APIUrl
      store.setSiteURL(siteURL);
    }
    return null;
  }

  return new GoTrue({ setCookie: !isLocal });
}

let root;
let iframe;
const iframeStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  border: "none",
  width: "100%",
  height: "100%",
  overflow: "visible",
  background: "transparent",
  display: "none",
  "z-index": 99
};

observe(store.modal, "isOpen", () => {
  console.log(`store.modal.isOpen = ${store.modal.isOpen}`)
  if (!store.settings) {
    console.log("calling loadSettings from observe(store.modal, isOpen) - (netlify-identity.js)")
    store.loadSettings();
  }
  setStyle(iframe, {
    ...iframeStyle,
    display: store.modal.isOpen ? "block !important" : "none"
  });
  if (store.modal.isOpen) {
    trigger("open", store.modal.page);
  } else {
    trigger("close");
  }
});

observe(store, "siteURL", () => {
  console.log(`store.siteURL = ${store.siteURL}`)
  if (store.siteURL === null || store.siteURL === undefined) {
    localStorage.removeItem("netlifySiteURL");
  } else {
    localStorage.setItem("netlifySiteURL", store.siteURL);
  }

  let apiUrl;
  if (store.siteURL) {
    const siteUrl = store.siteURL.replace(/\/$/, "");
    apiUrl = `${siteUrl}/.netlify/identity`;
  }
  console.log("calling init from observe(store, siteURL) - (netlify-identity.js)")
  store.init(instantiateGotrue(apiUrl), true);
});

observe(store, "user", () => {
  console.log(`store.user = ${store.user}`)
  if (store.user) {
    console.log("Gonna trigger login")
    trigger("login", store.user);
  } else {
    trigger("logout");
  }
});

observe(store, "gotrue", () => {
  console.log(`store.gotrue = ${store.gotrue}`)
  store.gotrue && trigger("init", store.gotrue.currentUser());
});

observe(store, "error", () => {
  trigger("error", store.error);
});

const routes = /(confirmation|invite|recovery|email_change)_token=([^&]+)/;
const errorRoute = /error=access_denied&error_description=403/;
const accessTokenRoute = /access_token=/;

function runRoutes() {
  console.log("runRoutes")
  const hash = (document.location.hash || "").replace(/^#\/?/, "");
  if (!hash) {
    return;
  }

  const m = hash.match(routes);
  if (m) {
    store.verifyToken(m[1], m[2]);
    document.location.hash = "";
  }

  const em = hash.match(errorRoute);
  if (em) {
    store.openModal("signup");
    document.location.hash = "";
  }

  const am = hash.match(accessTokenRoute);
  if (am) {
    const params = {};
    hash.split("&").forEach((pair) => {
      const [key, value] = pair.split("=");
      params[key] = value;
    });
    if (!!document && params["access_token"]) {
      document.cookie = `nf_jwt=${params["access_token"]}`;
    }
    if (params["state"]) {
      try {
        // skip initialization for implicit auth
        const state = decodeURIComponent(params["state"]);
        const { auth_type } = JSON.parse(state);
        if (auth_type === "implicit") {
          return;
        }
        // eslint-disable-next-line no-empty
      } catch (e) {}
    }
    document.location.hash = "";
    store.openModal("login");
    console.log("calling completeExternalLogin from runRoutes(netlify-identity.js)")
    console.log(params)
    store.completeExternalLogin(params);
  }
}

function init(options = {}) {
  console.log("init")
  const { APIUrl, logo = true, namePlaceholder, locale } = options;

  if (locale) {
    store.locale = locale;
  }

  const controlEls = document.querySelectorAll(
    "[data-netlify-identity-menu],[data-netlify-identity-button]"
  );
  Array.prototype.slice.call(controlEls).forEach((el) => {
    let controls = null;
    const mode =
      el.getAttribute("data-netlify-identity-menu") === null
        ? "button"
        : "menu";
    console.log("rendering controls")
    render(
      <Provider store={store}>
        <Controls mode={mode} text={el.innerText.trim()} />
      </Provider>,
      el,
      controls
    );
  });
  console.log("calling store.init from init(netlify-identity.js)")
  store.init(instantiateGotrue(APIUrl));
  store.modal.logo = logo;
  store.setNamePlaceholder(namePlaceholder);
  iframe = document.createElement("iframe");
  iframe.id = "netlify-identity-widget";
  iframe.title = "Netlify identity widget";
  iframe.onload = () => {
    const styles = iframe.contentDocument.createElement("style");
    styles.innerHTML = modalCSS.toString();
    iframe.contentDocument.head.appendChild(styles);
    console.log("rendering app")
    root = render(
      <Provider store={store}>
        <App />
      </Provider>,
      iframe.contentDocument.body,
      root
    );
    runRoutes();
  };
  setStyle(iframe, iframeStyle);
  iframe.src = "about:blank";
  const container = options.container
    ? document.querySelector(options.container)
    : document.body;
  container.appendChild(iframe);
  /* There's a certain case where we might have called setStyle before the iframe was ready.
	   Make sure we take the last style and apply it */
  if (queuedIframeStyle) {
    iframe.setAttribute("style", queuedIframeStyle);
    queuedIframeStyle = null;
  }
}

export default netlifyIdentity;

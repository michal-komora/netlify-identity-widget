import { observable, action } from "mobx";
import { defaultLocale, getTranslation } from "../translations";


console.log("\n\n====================store====================\n\n")

const store = observable({
  user: null,
  recovered_user: null,
  message: null,
  settings: null,
  gotrue: null,
  error: null,
  siteURL: null,
  remember: true,
  saving: false,
  invite_token: null,
  email_change_token: null,
  namePlaceholder: null,
  modal: {
    page: "login",
    isOpen: false,
    logo: true
  },
  locale: defaultLocale
});

store.setNamePlaceholder = action(function setNamePlaceholder(namePlaceholder) {
  console.log("store.js: store.setNamePlaceholder is called")
  console.log(namePlaceholder)
  store.namePlaceholder = namePlaceholder;
});

store.startAction = action(function startAction() {
  console.log("store.js: store.startAction is called")
  store.saving = true;
  store.error = null;
  store.message = null;
});

store.setError = action(function setError(err) {
  console.log("store.js: store.setError is called")
  store.saving = false;
  store.error = err;
});

store.init = action(function init(gotrue, reloadSettings) {
  console.log("store.js: store.init is called")
  console.log(gotrue)
  console.log(reloadSettings)
  if (gotrue) {
    store.gotrue = gotrue;
    store.user = gotrue.currentUser();
    if (store.user) {
      store.modal.page = "user";
    }
  }
  if (reloadSettings) {
    store.loadSettings();
  }
});

store.loadSettings = action(function loadSettings() {
  console.log("store.js: store.loadSettings is called")
  if (store.settings) {
    return;
  }
  if (!store.gotrue) {
    return;
  }

  store.gotrue
    .settings()
    .then(action((settings) => (store.settings = settings)))
    .catch(
      action((err) => {
        store.error = new Error(
          `Failed to load settings from ${store.gotrue.api.apiURL}`
        );
      })
    );
});

store.setIsLocal = action(function setIsLocal(isLocal) {
  console.log("store.js: store.setIsLocal is called")
  console.log(isLocal)
  store.isLocal = isLocal;
});

store.setSiteURL = action(function setSiteURL(url) {
  console.log("store.js: store.setSiteURL is called")
  console.log(url)
  store.siteURL = url;
});

store.clearSiteURL = action(function clearSiteURL() {
  console.log("store.js: store.clearSiteURL is called")
  store.gotrue = null;
  store.siteURL = null;
  store.settings = null;
});

store.login = action(function login(email, password) {
  console.log("store.js: store.login is called")
  store.startAction();

  return store.gotrue
    .login(email, password, store.remember)
    .then(
      action((user) => {
        console.log(`store.gotrue.login(${email}, ${password}, ${store.remember})`)
        console.log(`user: ${user}`)
        store.user = user;
        store.modal.page = "user";
        store.invite_token = null;
        if (store.email_change_token) {
          store.doEmailChange();
        }
        store.saving = false;
      })
    )
    .catch(store.setError);
});

store.externalLogin = action(function externalLogin(provider) {
  // store.startAction();
  console.log("store.js: store.externalLogin is called")
  console.log(provider)           // github
  console.log(store.invite_token) // null
  store.error = null;
  store.message = null;
  if(store.invite_token){
    console.log("Accept Invite External Url")
    console.log(store.gotrue.acceptInviteExternalUrl)
    console.log(store.gotrue.acceptInviteExternalUrl(provider, store.invite_token))
  } else {
    console.log("Login External Url")
    console.log(store.gotrue.loginExternalUrl)
    console.log(store.gotrue.loginExternalUrl(provider))
  }
  const url = store.invite_token
    ? store.gotrue.acceptInviteExternalUrl(provider, store.invite_token)
    : store.gotrue.loginExternalUrl(provider);
  window.location.href = url;
});

store.completeExternalLogin = action(function completeExternalLogin(params) {
  console.log("store.js: store.completeExternalLogin is called")
  console.log(params)
  store.startAction();
  store.gotrue
    .createUser(params, store.remember)
    .then((user) => {
      console.log("User is created")
      console.log(user)
      store.user = user;
      store.modal.page = "user";
      store.saving = false;
    })
    .catch(store.setError);
});

store.signup = action(function signup(name, email, password) {
  console.log("store.js: store.signup is called")
  console.log(name)
  console.log(email)
  console.log(password)
  store.startAction();
  return store.gotrue
    .signup(email, password, { full_name: name })
    .then(
      action(() => {
        if (store.settings.autoconfirm) {
          store.login(email, password, store.remember);
        } else {
          store.message = "confirm";
        }
        store.saving = false;
      })
    )
    .catch(store.setError);
});

store.logout = action(function logout() {
  console.log("store.js: store.logout is called")
  if (store.user) {
    store.startAction();
    return store.user
      .logout()
      .then(
        action(() => {
          store.user = null;
          store.modal.page = "login";
          store.saving = false;
        })
      )
      .catch(store.setError);
  } else {
    store.modal.page = "login";
    store.saving = false;
  }
});

store.updatePassword = action(function updatePassword(password) {
  console.log("store.js: store.updatePassword is called")
  console.log(password)
  store.startAction();
  const user = store.recovered_user || store.user;
  user
    .update({ password })
    .then((user) => {
      store.user = user;
      store.recovered_user = null;
      store.modal.page = "user";
      store.saving = false;
    })
    .catch(store.setError);
});

store.acceptInvite = action(function acceptInvite(password) {
  console.log("store.js: store.acceptInvite is called")
  console.log(password)
  store.startAction();
  store.gotrue
    .acceptInvite(store.invite_token, password, store.remember)
    .then((user) => {
      store.saving = false;
      store.invite_token = null;
      store.user = user;
      store.modal.page = "user";
    })
    .catch(store.setError);
});

store.doEmailChange = action(function doEmailChange() {
  console.log("store.js: store.doEmailChange is called")
  store.startAction();
  return store.user
    .update({ email_change_token: store.email_change_token })
    .then(
      action((user) => {
        store.user = user;
        store.email_change_token = null;
        store.message = "email_changed";
        store.saving = false;
      })
    )
    .catch(store.setError);
});

store.verifyToken = action(function verifyToken(type, token) {
  console.log("store.js: store.verifyToken is called")
  console.log(type)
  console.log(token)
  const gotrue = store.gotrue;
  store.modal.isOpen = true;

  switch (type) {
    case "confirmation":
      store.startAction();
      store.modal.page = "signup";
      gotrue
        .confirm(token, store.remember)
        .then(
          action((user) => {
            store.user = user;
            store.saving = false;
          })
        )
        .catch(
          action((err) => {
            console.error(err);
            store.message = "verfication_error";
            store.modal.page = "signup";
            store.saving = false;
          })
        );
      break;
    case "email_change":
      store.email_change_token = token;
      store.modal.page = "message";
      if (store.user) {
        store.doEmailChange();
      } else {
        store.modal.page = "login";
      }
      break;
    case "invite":
      store.modal.page = type;
      store.invite_token = token;
      break;
    case "recovery":
      store.startAction();
      store.modal.page = type;
      store.gotrue
        .recover(token, store.remember)
        .then((user) => {
          store.saving = false;
          store.recovered_user = user;
        })
        .catch((err) => {
          store.saving = false;
          store.error = err;
          store.modal.page = "login";
        });
      break;
    default:
      store.error = "Unkown token type";
  }
});

store.requestPasswordRecovery = action(function requestPasswordRecovery(email) {
  console.log("store.js: store.requestPasswordRecovery is called")
  console.log(email)
  store.startAction();
  store.gotrue
    .requestPasswordRecovery(email)
    .then(
      action(() => {
        store.message = "password_mail";
        store.saving = false;
      })
    )
    .catch(store.setError);
});

store.openModal = action(function open(page) {
  console.log("store.js: store.openModal is called")
  console.log(page)
  store.modal.page = page;
  store.modal.isOpen = true;
});

store.closeModal = action(function close() {
  console.log("store.js: store.closeModal is called")
  store.modal.isOpen = false;
  store.error = null;
  store.message = null;
  store.saving = false;
});

store.translate = action(function translate(key) {
  return getTranslation(key, store.locale);
});

export default store;

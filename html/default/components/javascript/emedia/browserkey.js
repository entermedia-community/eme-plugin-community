/*
 * browserkey.js — passwordless browser login with a key that never leaves the browser.
 *
 * - Every browser is remembered: on the first page load after any login it creates a non-extractable key
 *   pair with WebCrypto, keeps the private key in IndexedDB and registers only the public key
 *   (registerkey.json). Scripts, including injected ones, can ask the browser to sign but cannot read it.
 * - On a page load where nobody is logged in, a stored key signs a login (token.json grant_type=key) which
 *   starts the server session. There is no persistent login cookie.
 * - Logging out deletes the key here and revokes it on the server: logout links (id starting with "emelogout")
 *   call emeBrowserKey.logout() from ui-components.js (#emelogout), which loads this script in logout mode
 *   (window.emeBrowserKeyMode = "logout": no auto sign-in or key registration) on pages that do not have it.
 * - getToken() gives other scripts (desktop app, API calls) a 7 day Bearer token from the same key.
 * - Submitting the emailed-code form (any form with a templogincode field) makes a fresh key pair: the old key is
 *   deleted here, the code and the new public key go to login.json in one call, and the key_id it returns is
 *   stored with the private key. The old key is then revoked on the server.
 *
 * Ed25519 is used when the browser has it, otherwise ECDSA P-256. Everything quietly does nothing when
 * WebCrypto/IndexedDB are missing (plain http pages, private windows), so the code login keeps working.
 */
(function () {
	"use strict";

	// Pages loaded by ajax can include this script again; one copy is enough
	if (window.emeBrowserKey) return;

	// Loaded only to log out (ui-components.js sets window.emeBrowserKeyMode = "logout" before $.ajax loads
	// it, where there is no script element to read): skip the page-load sign-in / registration
	var MODE = window.emeBrowserKeyMode || null;

	var DB_NAME = "emebrowserkey",
		STORE = "keys",
		RECORD = "current";

	function log() {
		if (window.console && console.info)
			console.info.apply(
				console,
				["[browserkey]"].concat([].slice.call(arguments)),
			);
	}

	function supported() {
		return !!(
			window.isSecureContext &&
			window.crypto &&
			crypto.subtle &&
			window.indexedDB
		);
	}

	function config() {
		var app = document.getElementById("application");
		return {
			mediadb: app ? app.getAttribute("data-mediadbappid") : null,
			userid: app ? app.getAttribute("data-userid") : null,
		};
	}

	function endpoint(name) {
		return "/" + config().mediadb + "/services/authentication/" + name;
	}

	/* ---------- encoding ---------- */
	function b64url(buffer) {
		var bytes = new Uint8Array(buffer),
			s = "";
		for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
		return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
	}

	function randomNonce() {
		var bytes = new Uint8Array(16);
		crypto.getRandomValues(bytes);
		return Array.prototype.map
			.call(bytes, function (b) {
				return ("0" + b.toString(16)).slice(-2);
			})
			.join("");
	}

	/* ---------- IndexedDB (stores the CryptoKey object itself, which is how it stays non-extractable) ---------- */
	function openDb() {
		return new Promise(function (resolve, reject) {
			var req = indexedDB.open(DB_NAME, 1);
			req.onupgradeneeded = function () {
				req.result.createObjectStore(STORE);
			};
			req.onsuccess = function () {
				resolve(req.result);
			};
			req.onerror = function () {
				reject(req.error);
			};
		});
	}

	function dbRun(mode, action) {
		return openDb().then(function (db) {
			return new Promise(function (resolve, reject) {
				var tx = db.transaction(STORE, mode),
					result = action(tx.objectStore(STORE));
				tx.oncomplete = function () {
					db.close();
					resolve(result && result.result);
				};
				tx.onerror = function () {
					db.close();
					reject(tx.error);
				};
			});
		});
	}

	function loadRecord() {
		return dbRun("readonly", function (s) {
			return s.get(RECORD);
		});
	}
	function saveRecord(rec) {
		return dbRun("readwrite", function (s) {
			return s.put(rec, RECORD);
		});
	}
	function deleteRecord() {
		return dbRun("readwrite", function (s) {
			return s.delete(RECORD);
		});
	}

	/* ---------- keys ---------- */
	var ED = { name: "Ed25519" };
	var EC = { name: "ECDSA", namedCurve: "P-256" };

	function generate() {
		return crypto.subtle.generateKey(ED, false, ["sign", "verify"]).then(
			function (pair) {
				return { alg: "Ed25519", pair: pair };
			},
			function () {
				return crypto.subtle
					.generateKey(EC, false, ["sign", "verify"])
					.then(function (pair) {
						return { alg: "P-256", pair: pair };
					});
			},
		);
	}

	function sign(record, message) {
		var algo =
			record.alg === "Ed25519" ? ED : { name: "ECDSA", hash: "SHA-256" };
		return crypto.subtle
			.sign(algo, record.privateKey, new TextEncoder().encode(message))
			.then(b64url);
	}

	function post(url, fields) {
		return fetch(url, {
			method: "POST",
			credentials: "same-origin",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				Accept: "application/json",
			},
			body: new URLSearchParams(fields).toString(),
		}).then(function (r) {
			if (r.status === 401) {
				log("server rejected the key; deleting local record");
				return deleteRecord().then(function () {
					return {};
				});
			}
			return r.json().catch(function () {
				return {};
			});
		});
	}

	/* ---------- public operations ---------- */

	// Needs a logged in session (e.g. right after a code login). Stores the private key; uploads the public key.
	function register(label) {
		var userid = config().userid;
		if (!supported() || !userid) return Promise.resolve(false);
		log("registering a key for", userid);
		var made;
		return generate()
			.then(function (g) {
				made = g;
				return crypto.subtle.exportKey("spki", g.pair.publicKey);
			})
			.then(function (spki) {
				return post(endpoint("registerkey.json"), {
					publickey: b64url(spki),
					label: label || (navigator.userAgent || "Browser").slice(0, 80),
				});
			})
			.then(function (res) {
				if (!res.key_id) {
					log(
						"registration refused:",
						res.error_description || res.error || "no key_id returned",
					);
					return false;
				}
				return saveRecord({
					userid: userid,
					keyid: res.key_id,
					alg: made.alg,
					privateKey: made.pair.privateKey,
				}).then(function () {
					log("registered key", res.key_id, "(" + made.alg + ")");
					return true;
				});
			})
			.catch(function (e) {
				log("registration failed:", e);
				return false;
			});
	}

	var cachedToken = null; // { value, expires }

	// Signs a login. With createSession the server session is started too (page loads); otherwise only a token is returned.
	function login(createSession) {
		if (!supported()) return Promise.resolve(null);
		if (!!config().userid) {
			console.warn("User was already logged in:", userid);
			return;
		}
		return loadRecord()
			.then(function (record) {
				if (!record) {
					log("no stored key");
					$("#loginContainer").show();
					return null;
				}
				var ts = String(Date.now()),
					nonce = randomNonce();
				return sign(
					record,
					record.userid + "\n" + record.keyid + "\n" + ts + "\n" + nonce,
				).then(function (signature) {
					var fields = {
						grant_type: "key",
						username: record.userid,
						key_id: record.keyid,
						timestamp: ts,
						nonce: nonce,
						signature: signature,
					};
					if (createSession) fields.createsession = "true";
					return post(endpoint("token.json"), fields).then(function (res) {
						if (res.access_token) {
							cachedToken = {
								value: res.access_token,
								expires: Date.now() + (res.expires_in - 3600) * 1000,
							};
							return res;
						}
						log(
							"key login rejected:",
							res.error_description || res.error || "unknown",
						);
						if (res.error === "invalid_grant")
							return deleteRecord().then(function () {
								return null;
							}); // revoked: forget it
						return null;
					});
				});
			})
			.catch(function (e) {
				log("key login failed:", e);
				return null;
			});
	}

	function getToken() {
		if (cachedToken && cachedToken.expires > Date.now())
			return Promise.resolve(cachedToken.value);
		return login(false).then(function (res) {
			return res ? res.access_token : null;
		});
	}

	// Logout: revoke on the server while the session still exists, then drop the local key.
	function forget() {
		if (!supported()) return Promise.resolve();
		return loadRecord()
			.then(function (record) {
				cachedToken = null;
				if (!record) return null;
				return post(endpoint("revokekey.json"), { keyid: record.keyid })
					.catch(function () {})
					.then(deleteRecord);
			})
			.catch(function () {});
	}

	/* ---------- wiring ---------- */
	function safeSession(fn) {
		try {
			return fn(window.sessionStorage);
		} catch (e) {
			return null;
		}
	}

	function init() {
		if (!supported()) {
			log(
				"not available here (needs https or localhost, WebCrypto and IndexedDB); the code login still works",
			);
			return;
		}

		var userid = config().userid;
		loadRecord()
			.then(function (record) {
				$("#loginContainer").hide();
				if (userid) {
					// Logged in. A key left by a different user is dropped; with no key for this user, make one (once per tab).
					safeSession(function (s) {
						s.removeItem("emeReloaded");
					});
					var mine = record && record.userid === userid;
					if (record && !mine) deleteRecord();
					if (mine) {
						log("logged in as", userid, "with a stored key", record.keyid);
						return;
					}
					// No key for this user yet. After a failed attempt wait a few minutes instead of retrying on every page.
					var failedAt = parseInt(
						safeSession(function (s) {
							return s.getItem("emeRegFailed");
						}) || "0",
						10,
					);
					if (Date.now() - failedAt < 5 * 60 * 1000) {
						log("registration failed recently; will retry later");
						return;
					}
					register().then(function (ok) {
						if (ok)
							safeSession(function (s) {
								s.removeItem("emeRegFailed");
							});
						else
							safeSession(function (s) {
								s.setItem("emeRegFailed", String(Date.now()));
							});
					});
					return;
				}
				// Logged out with a stored key: sign in and reload. Only a sign-in that succeeded but left us logged out
				// (session cookies blocked) is remembered, so that can never loop; a server that was down is simply retried
				// on the next page load.
				if (!record) {
					log("not logged in and no stored key");
					$("#loginContainer").show();
				} else {
					if (
						safeSession(function (s) {
							return s.getItem("emeReloaded");
						})
					) {
						safeSession(function (s) {
							s.removeItem("emeReloaded");
						});
						log(
							"signed in with the key but the session was not kept (cookies blocked?); not retrying",
						);
						return;
					}
					log("not logged in; signing in with stored key", record.keyid);
					login(true).then(function (res) {
						if (!res) return;
						safeSession(function (s) {
							s.setItem("emeReloaded", "1");
						});
						var target = res.redirect; // the page that was refused before the login page appeared
						if (
							!target &&
							/\/authentication\//.test(window.location.pathname)
						) {
							var app = document.getElementById("application");
							var home = app && app.getAttribute("data-apphome");
							if (home) target = home + "/index.html"; // sitting on a login page with nowhere to go back to
						}
						log("signed in; going to", target || "(reloading this page)");
						if (target) window.location.href = target;
						else window.location.reload();
					});
				}
			})
			.catch(function () {});
	}

	// Delete and revoke the key before logging out, otherwise the next visit would sign straight back in.
	// Goes to inHref even if that fails (no IndexedDB, server down).
	function logout(inHref) {
		var go = function () {
			if (inHref) window.location.href = inHref;
		};
		return forget().then(go, go);
	}

	/* ---------- emailed-code login ---------- */

	var CODE_FORM = "form:has(input[name='templogincode'])";

	function submitNatively(form) {
		form.setAttribute("data-browserkey-done", "true");
		HTMLFormElement.prototype.submit.call(form); // skips submit handlers, including this one
	}

	function afterLoginTarget(form) {
		var ok = form.querySelector("input[name='loginokpage']");
		if (ok && ok.value) return ok.value;
		var app = document.getElementById("application");
		var home = app && app.getAttribute("data-apphome");
		return home ? home + "/index.html" : null;
	}

	// Signs in with the code and registers a new key in the same call (login.json). Anything unexpected
	// falls back to the normal form post, so the code login always works.
	function loginWithCode(form) {
		if (!supported() || !config().mediadb) {
			submitNatively(form);
			return Promise.resolve(false);
		}
		var old, made;
		return loadRecord()
			.then(function (record) {
				old = record;
				return record ? deleteRecord() : null; // a login always starts with a new key
			})
			.then(generate)
			.then(function (g) {
				made = g;
				return crypto.subtle.exportKey("spki", g.pair.publicKey);
			})
			.then(function (spki) {
				var fields = new URLSearchParams(new FormData(form));
				fields.set("publickey", b64url(spki));
				fields.set("label", (navigator.userAgent || "Browser").slice(0, 80));
				return fetch(endpoint("login.json"), {
					method: "POST",
					credentials: "same-origin",
					headers: {
						"Content-Type": "application/x-www-form-urlencoded",
						Accept: "application/json",
					},
					body: fields.toString(),
				}).then(function (r) {
					return r.json();
				});
			})
			.then(function (res) {
				var userid = res && res.user && res.user.id;
				if (!res || !res.response || res.response.status !== "ok" || !userid) {
					// Wrong or expired code: let the server render its usual error page
					log("code login refused:", (res && res.error) || "unknown");
					submitNatively(form);
					return false;
				}
				var saved = res.key_id
					? saveRecord({
							userid: userid,
							keyid: res.key_id,
							alg: made.alg,
							privateKey: made.pair.privateKey,
						})
					: Promise.resolve(log("signed in, but no key was registered:", res.key_error || "no key_id"));
				return saved
					.then(function () {
						if (res.key_id) log("signed in with the code; new key", res.key_id, "(" + made.alg + ")");
						if (old && old.keyid && old.keyid !== res.key_id && old.userid === userid) {
							// Signed in now, so the old key can be revoked
							return post(endpoint("revokekey.json"), { keyid: old.keyid }).catch(function () {});
						}
					})
					.then(function () {
						var target = afterLoginTarget(form);
						if (target) window.location.href = target;
						else window.location.reload();
						return true;
					});
			})
			.catch(function (e) {
				log("code login with a new key failed, using the normal login:", e);
				submitNatively(form);
				return false;
			});
	}

	function onCodeFormSubmit(e) {
		var form = e.target;
		if (form.getAttribute("data-browserkey-done") === "true") return; // our own fallback post
		e.preventDefault();
		if (form.getAttribute("data-browserkey-busy") === "true") return; // auto-submit plus a click
		form.setAttribute("data-browserkey-busy", "true");
		loginWithCode(form).then(function () {
			form.removeAttribute("data-browserkey-busy");
		});
	}

	// The OTP inputs auto-submit with jQuery's .submit(), which calls form.submit() without a native submit
	// event, so listen through jQuery when it is there (it also sees normal button submits).
	if (window.jQuery) {
		window.jQuery(document).on("submit", CODE_FORM, onCodeFormSubmit);
	} else {
		document.addEventListener("submit", function (e) {
			if (e.target.querySelector && e.target.querySelector("input[name='templogincode']")) onCodeFormSubmit(e);
		});
	}

	window.emeBrowserKey = {
		supported: supported,
		register: register,
		login: login,
		getToken: getToken,
		forget: forget,
		loginWithCode: loginWithCode,
		logout: logout,
	};

	if (MODE === "logout") return;
	if (document.readyState === "loading")
		document.addEventListener("DOMContentLoaded", init);
	else init();
})();

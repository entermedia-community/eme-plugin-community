/*
 * browserkey.js — passwordless browser login with a key that never leaves the browser.
 *
 * - Every browser is remembered: on the first page load after any login it creates a non-extractable key
 *   pair with WebCrypto, keeps the private key in IndexedDB and registers only the public key
 *   (registerkey.json). Scripts, including injected ones, can ask the browser to sign but cannot read it.
 * - On a page load where nobody is logged in, a stored key signs a login (token.json grant_type=key) which
 *   starts the server session. There is no persistent login cookie.
 * - Logging out deletes the key here and revokes it on the server.
 * - getToken() gives other scripts (desktop app, API calls) a 7 day Bearer token from the same key.
 *
 * Ed25519 is used when the browser has it, otherwise ECDSA P-256. Everything quietly does nothing when
 * WebCrypto/IndexedDB are missing (plain http pages, private windows), so the code login keeps working.
 */
(function () {
	"use strict";

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
			userid: app ? app.getAttribute("data-user") : null,
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
		return loadRecord()
			.then(function (record) {
				if (!record) {
					log("no stored key");
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

		// Logout links delete and revoke the key first, otherwise the next page load would sign straight back in.
		document.addEventListener(
			"click",
			function (e) {
				var a =
					e.target && e.target.closest
						? e.target.closest("a[href*='authentication/logout']")
						: null;
				if (!a) return;
				e.preventDefault();
				forget().then(function () {
					window.location.href = a.href;
				});
			},
			true,
		);

		var userid = config().userid;

		if (!!userid) return;

		loadRecord()
			.then(function (record) {
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
					return;
				}
				if (record) {
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

	window.emeBrowserKey = {
		supported: supported,
		register: register,
		login: login,
		getToken: getToken,
		forget: forget,
	};

	if (document.readyState === "loading")
		document.addEventListener("DOMContentLoaded", init);
	else init();
})();

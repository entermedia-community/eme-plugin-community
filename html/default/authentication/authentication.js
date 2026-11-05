$(document).ready(function () {
	const otpInputs = () => $(".otp");

	lQuery(".otp").livequery("input", function () {
		const $inputs = otpInputs();
		const idx = $inputs.index(this);
		const val = $(this).val().replace(/\D/g, "");
		$(this).val(val);
		if (val && idx < $inputs.length - 1) $inputs.eq(idx + 1).focus();
		checkOtpFilled();
	});

	lQuery(".otp").livequery("keydown", function (e) {
		const $inputs = otpInputs();
		const idx = $inputs.index(this);
		if (e.key === "Backspace" && !$(this).val() && idx > 0)
			$inputs.eq(idx - 1).focus();
	});

	lQuery(".otp").livequery("paste", function (e) {
		const text = (e.originalEvent.clipboardData || window.clipboardData)
			.getData("text")
			.replace(/\D/g, "")
			.slice(0, 6);
		if (!text) return;
		e.preventDefault();
		const $inputs = otpInputs();
		text.split("").forEach((ch, i) => {
			$inputs.eq(i).val(ch);
		});
		$inputs.eq(Math.min(text.length, $inputs.length - 1)).focus();
		checkOtpFilled();
	});

	function checkOtpFilled() {
		const $inputs = otpInputs();
		const filled = $inputs.toArray().every((i) => $(i).val().length === 1);

		var codes = "";
		$(".otp").each(function () {
			codes += $(this).val();
		});
		$("#loginCode").val(codes);
		if (filled) {
			$("#loginBtn").prop("disabled", !filled);
			$("#loginCode").closest("form").submit();
		}
	}

	// Pages loaded by ajax can include this script again; one copy is enough
	if (window.emeBrowserKey) return;

	/*
	 * Key login. An invalid session always lands on nopermission.html, which is where this runs: sign in with the
	 * key stored in IndexedDB and go back into the app, or sign in with the emailed code (which also makes a new key).
	 * The signature used for the login is kept in localStorage for ajax/signedheaders.js, which only reads it:
	 *   emeSignature = {"username":"","key_id":"","timestamp":"","nonce":"","signature":""}
	 * It is reused while its timestamp is under 24h old, otherwise cleared and made again.
	 */
	var DB_NAME = "emebrowserkey",
		STORE = "keys",
		RECORD = "current",
		SIGNATURE_KEY = "emeSignature",
		SIGNATURE_MAX_AGE = 24 * 60 * 60 * 1000;

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

	/* ---------- signature kept for signedheaders.js ---------- */
	function readSignature() {
		try {
			var v = JSON.parse(window.localStorage.getItem(SIGNATURE_KEY));
			return v &&
				v.username &&
				v.key_id &&
				v.timestamp &&
				v.nonce &&
				v.signature
				? v
				: null;
		} catch (e) {
			return null;
		}
	}

	function clearSignature() {
		try {
			window.localStorage.removeItem(SIGNATURE_KEY);
		} catch (e) {}
	}

	function writeSignature(v) {
		try {
			window.localStorage.setItem(SIGNATURE_KEY, JSON.stringify(v));
		} catch (e) {}
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
		clearSignature(); // a signature made with the previous key is no good with this one
		return dbRun("readwrite", function (s) {
			return s.put(rec, RECORD);
		});
	}
	function deleteRecord() {
		clearSignature(); // the signature belongs to the key being deleted
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

	/* ---------- key login ---------- */

	// {username, key_id, timestamp, nonce, signature} for the stored key. Reuses the one in localStorage while it is
	// under 24h old and belongs to this key; otherwise clears it and signs again. Resolves null without a stored key.
	function signedLogin() {
		return loadRecord().then(function (record) {
			if (!record) {
				clearSignature();
				return null;
			}
			var stored = readSignature();
			if (
				stored &&
				stored.key_id === record.keyid &&
				stored.username === record.userid &&
				Date.now() - Number(stored.timestamp) < SIGNATURE_MAX_AGE
			)
				return stored;
			clearSignature();
			var ts = String(Date.now()),
				nonce = randomNonce();
			return sign(
				record,
				record.userid + "\n" + record.keyid + "\n" + ts + "\n" + nonce,
			).then(function (signature) {
				var v = {
					username: record.userid,
					key_id: record.keyid,
					timestamp: ts,
					nonce: nonce,
					signature: signature,
				};
				writeSignature(v);
				return v;
			});
		});
	}

	function homeUrl() {
		var app = document.getElementById("application");
		var siteroot = (app && app.getAttribute("data-siteroot")) || "/";
		var apphome = (app && app.getAttribute("data-apphome")) || "";
		return siteroot + apphome;
	}

	// A signature under 24h old is already known to the server, so no token request is made: one page request that
	// carries it in the X-token headers is enough for the server to start the session (see ajax/signedheaders.js).
	// Resolves true when that worked (we did not end up on the login page again).
	function sessionFromSignature(v) {
		return fetch(homeUrl(), {
			credentials: "same-origin",
			headers: { "X-tokentype": "signature", "X-token": JSON.stringify(v) },
		})
			.then(function (r) {
				return r.ok && !/nopermission|\/authentication\//.test(r.url);
			})
			.catch(function () {
				return false;
			});
	}

	// Signs in with the stored key and starts the server session. Resolves the server's answer, or null.
	function login() {
		if (!supported()) return Promise.resolve(null);
		return loadRecord()
			.then(function (record) {
				if (!record) {
					log("no stored key");
					clearSignature();
					$("#loginContainer").show();
					return null;
				}
				var stored = readSignature();
				if (
					stored &&
					stored.key_id === record.keyid &&
					stored.username === record.userid &&
					Date.now() - Number(stored.timestamp) < SIGNATURE_MAX_AGE
				) {
					log("stored signature is still valid; starting the session with it");
					return sessionFromSignature(stored).then(function (ok) {
						if (ok) return {};
						log("the server did not accept the stored signature; signing again");
						clearSignature();
						return tokenLogin();
					});
				}
				return tokenLogin();
			})
			.catch(function (e) {
				log("key login failed:", e);
				return null;
			});
	}

	// No usable signature: sign a new one and let token.json verify it and start the session
	function tokenLogin() {
		return signedLogin().then(function (v) {
			if (!v) return null;
			return post(endpoint("token.json"), {
				grant_type: "key",
				username: v.username,
				key_id: v.key_id,
				timestamp: v.timestamp,
				nonce: v.nonce,
				signature: v.signature,
				createsession: "true",
			}).then(function (res) {
				if (res.access_token) return res;
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
	}

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
		if (config().userid) return; // already signed in (no permission for the page): nothing to do here

		loadRecord()
			.then(function (record) {
				if (!record) {
					log("not logged in and no stored key");
					clearSignature();
					$("#loginContainer").show();
					return;
				}
				// A sign-in that succeeded but left us logged out (session cookies blocked) is remembered for 30s so it
				// cannot loop; on nopermission.html we always sign in and redirect. A server that was down is simply retried.
				var reloadedAt = parseInt(
					safeSession(function (s) {
						return s.getItem("emeReloaded");
					}) || "0",
					10,
				);
				var onNoPermission = /nopermission/.test(window.location.pathname);
				if (!onNoPermission && Date.now() - reloadedAt < 30 * 1000) {
					safeSession(function (s) {
						s.removeItem("emeReloaded");
					});
					log(
						"signed in with the key but the session was not kept (cookies blocked?); not retrying",
					);
					return;
				}
				log("not logged in; signing in with stored key", record.keyid);
				login().then(function (res) {
					if (!res) return;
					safeSession(function (s) {
						s.setItem("emeReloaded", String(Date.now()));
					});
					// The page that was refused, else the app home.
					var target = res.redirect || homeUrl();
					log("signed in; going to", target);
					window.location.href = target;
				});
			})
			.catch(function () {});
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
					: Promise.resolve(
							log(
								"signed in, but no key was registered:",
								res.key_error || "no key_id",
							),
						);
				return saved
					.then(function () {
						return res.key_id ? signedLogin().catch(function () {}) : null; // headers work on the first page
					})
					.then(function () {
						if (res.key_id)
							log(
								"signed in with the code; new key",
								res.key_id,
								"(" + made.alg + ")",
							);
						if (
							old &&
							old.keyid &&
							old.keyid !== res.key_id &&
							old.userid === userid
						) {
							// Signed in now, so the old key can be revoked
							return post(endpoint("revokekey.json"), {
								keyid: old.keyid,
							}).catch(function () {});
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
			if (
				e.target.querySelector &&
				e.target.querySelector("input[name='templogincode']")
			)
				onCodeFormSubmit(e);
		});
	}

	window.emeBrowserKey = {
		supported: supported,
		login: login,
		signedLogin: signedLogin,
		loginWithCode: loginWithCode,
	};

	if (document.readyState === "loading")
		document.addEventListener("DOMContentLoaded", init);
	else init();
});

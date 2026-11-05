/*
 * signedheaders.js — jQuery plugin: signature auth headers for every ajax request.
 *
 *   $.emeSignedHeaders()        -> { "X-tokentype": "signature", "X-token": "<json>" } or {} (sync, from cache)
 *   $.emeSignedHeaders.ready()  -> Promise that resolves once the cache is filled
 *   $.emeSignedHeaders.clear()  -> forget the cached signature (browserkey.js calls this when its key is deleted)
 *
 * The signature (see AutoLoginByToken, X-tokentype "signature") is made by browserkey.js with the key in IndexedDB.
 * To avoid reading IndexedDB per request it is cached on window.emeSignedHeaders and in localStorage
 * (timestamp, nonce, signature, plus username/key_id which the server needs). The server accepts a signature for
 * 24h, so it is re-signed and localStorage updated once the timestamp is 24h old.
 * browserkey.js is loaded on demand. Without a stored key no headers are added and the session cookie works as before.
 */
(function ($) {
	"use strict";
	if ($.emeSignedHeaders) return;

	var STORE_KEY = "emeSignature",
		MAX_AGE = 24 * 60 * 60 * 1000;
	var pending = null;

	function readStore() {
		try {
			var v = JSON.parse(window.localStorage.getItem(STORE_KEY));
			return v && v.timestamp && v.nonce && v.signature && v.username && v.key_id ? v : null;
		} catch (e) {
			return null;
		}
	}
	function writeStore(v) {
		try {
			window.localStorage.setItem(STORE_KEY, JSON.stringify(v));
		} catch (e) {}
	}
	function fresh(v) {
		return !!v && Date.now() - Number(v.timestamp) < MAX_AGE;
	}
	function toHeaders(v) {
		return { "X-tokentype": "signature", "X-token": JSON.stringify(v) };
	}

	// browserkey.js is only on the login pages, so load it on demand (once) from the app's javascript folder
	var loading = null;
	function loadBrowserKey() {
		if (window.emeBrowserKey) return Promise.resolve(window.emeBrowserKey);
		var app = document.getElementById("application"),
			home = app && app.getAttribute("data-apphome");
		if (home === null || home === undefined) return Promise.resolve(null);
		if (!loading) {
			loading = new Promise(function (resolve) {
				$.ajax({
					url: home + "/components/javascript/emedia/browserkey.js",
					dataType: "script",
					cache: true,
					headers: {},
				}).then(
					function () { resolve(window.emeBrowserKey || null); },
					function () { loading = null; resolve(null); },
				);
			});
		}
		return loading;
	}

	// Re-sign with browserkey.js and refresh both caches
	function refresh() {
		if (pending) return pending;
		pending = loadBrowserKey()
			.then(function (bk) {
				return bk && bk.signLogin ? bk.signLogin() : null;
			})
			.then(function (v) {
				if (v) {
					writeStore(v);
					window.emeSignedHeaders = toHeaders(v);
					window.emeSignedHeadersTimestamp = Number(v.timestamp);
				}
				return v;
			})
			.then(
				function (v) { pending = null; return v; },
				function () { pending = null; return null; },
			);
		return pending;
	}

	// Sync: used as `headers:` in $.ajax options
	function signedHeaders() {
		var ts = window.emeSignedHeadersTimestamp;
		if (window.emeSignedHeaders && ts && Date.now() - ts < MAX_AGE) return window.emeSignedHeaders;
		var stored = readStore();
		if (fresh(stored)) {
			window.emeSignedHeaders = toHeaders(stored);
			window.emeSignedHeadersTimestamp = Number(stored.timestamp);
			return window.emeSignedHeaders;
		}
		refresh(); // 24h old or missing: this request goes without, the next ones carry the new signature
		return {};
	}

	signedHeaders.ready = function () {
		return Promise.resolve(fresh(readStore()) ? true : refresh());
	};
	signedHeaders.clear = function () {
		delete window.emeSignedHeaders;
		delete window.emeSignedHeadersTimestamp;
		try {
			window.localStorage.removeItem(STORE_KEY);
		} catch (e) {}
	};

	$.emeSignedHeaders = signedHeaders;

	// Fill the cache on load, and re-sign every hour so a long-open page never runs past 24h
	$(function () {
		signedHeaders();
		setInterval(signedHeaders, 60 * 60 * 1000);
	});
})(jQuery);

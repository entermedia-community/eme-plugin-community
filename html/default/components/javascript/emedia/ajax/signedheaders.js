/*
 * signedheaders.js — jQuery plugin: signature auth headers for every ajax request.
 *
 *   $.emeSignedHeaders()        -> { "X-tokentype": "signature", "X-token": "<json>" } or {} (sync)
 *   $.emeSignedHeaders.ready()  -> resolved Promise (kept for callers; nothing is loaded any more)
 *   $.emeSignedHeaders.clear()  -> forget the stored signature
 *
 * authentication.js (the login / nopermission page) signs with the key in IndexedDB and keeps
 *   localStorage.emeSignature = {"username":"","key_id":"","timestamp":"","nonce":"","signature":""}
 * This script only reads it. The server accepts a signature for 24h; once it is older it is cleared and requests go
 * without it (the session cookie works as before). If the session is gone the server shows the login page, where
 * authentication.js signs in with the key and makes a new signature.
 */
(function ($) {
	"use strict";
	if ($.emeSignedHeaders) return;

	var STORE_KEY = "emeSignature",
		MAX_AGE = 24 * 60 * 60 * 1000;

	function readStore() {
		try {
			var v = JSON.parse(window.localStorage.getItem(STORE_KEY));
			return v && v.timestamp && v.nonce && v.signature && v.username && v.key_id ? v : null;
		} catch (e) {
			return null;
		}
	}

	function forget() {
		try {
			window.localStorage.removeItem(STORE_KEY);
		} catch (e) {}
	}

	// Sync: used as `headers:` in $.ajax options. Reads localStorage every time, so a signature that another tab
	// replaced, cleared or let expire is never sent.
	function signedHeaders() {
		var v = readStore();
		if (!v) return {};
		if (Date.now() - Number(v.timestamp) >= MAX_AGE) {
			forget();
			return {};
		}
		return { "X-tokentype": "signature", "X-token": JSON.stringify(v) };
	}

	signedHeaders.ready = function () {
		return Promise.resolve(!!readStore());
	};
	signedHeaders.clear = forget;

	$.emeSignedHeaders = signedHeaders;

	// The server refused our signature (key revoked or replaced): stop sending it
	$(document).ajaxError(function (e, xhr, settings) {
		if (xhr.status !== 401) return;
		var h = settings && settings.headers;
		if (h && h["X-token"]) forget();
	});
})(jQuery);

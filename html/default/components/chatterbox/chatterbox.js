jQuery(document).ready(function () {
	"use strict";

	let chatConnection;

	const app = $("#application");
	let appHome = app.data("apphome");
	const home = app.data("home");
	if (home !== undefined) {
		appHome = home + appHome;
	}
	const userid = app.data("user");

	function lookupFunctionName(chatter) {
		//loop chatterbox for messages in reverse order and get data-functionname of the first one that has it. This is the function we will run after the message is sent.
		const messages = chatter.find(".msg-bubble").get().reverse();
		for (let i = 0; i < messages.length; i++) {
			var message = $(messages[i]);
			const fn = message.data("nextfunctionname");
			if (fn) {
				return fn;
			}
		}
		const startup_scenario = chatter.data("startup_scenario");

		if (startup_scenario) {
			return startup_scenario;
		}
		return null;
	}

	function initChatterbox() {
		cancelKeepAlive();
		connect();
		keepAlive();

		lQuery(".chatter-send").livequery("click", function () {
			const button = $(this);
			const chatter = button.closest(".chatterbox");
			const chattermsg = chatter.find("#chatter-msg");
			if (chattermsg.length === 0) {
				return; //no message box?
			}

			let data = chatter.data();
			const sendactions = button.data("sendactions");
			if (sendactions === "sendattachments") {
				const attachform = chatter.find(".chatattachasset");
				if (attachform.length > 0) {
					attachform.find('input[name="chatmessage"]').val(
						chattermsg.val(),
					);
					attachform.trigger("submit");
					chattermsg.val("");
					$(".chatter-attachfile-cancel").trigger("click");
					return;
				}
			}

			data = $.extend({}, data); //So we can edit it
			data.command = button.data("command");
			data.functionname = lookupFunctionName(chatter);
			data.apphome = appHome;
			
			const replytoid = chattermsg.data("replytoid");
			if (replytoid) {
				data.replytoid = replytoid;
			}
			const message = chattermsg.val();
			data.message = message;

			console.log(data);

			const json = JSON.stringify(data);

			if (chatConnection.readyState === chatConnection.CLOSED) {
				connect();
				//IF we do a reconnect render the whole page
			}
			const toggle = button.data("toggle");
			if (toggle === true) {
				$(".chatter-toggle", chatter).toggle();
			}

			if (chattermsg.val() !== "") {
				chatConnection.send(json);

				chattermsg.val("");
				chattermsg.data("replytoid", "");
				$(".chatterboxreplyto", chatter).hide();

				scrollToChat();

				const ses = $(".sessionhistory-item.active");
				if (ses.length > 0) {
					const span = ses.find(".item span");
					if (span.length > 0 && span.text() === "Current Session") {
						span.text(message.substring(0, 25));
					}
				}
			}
		});

		lQuery(".ai-suggest").livequery("click", function () {
			const button = $(this);
			const message = button.text();
			const input = $("#chatter-msg");
			input.val(message);
			input.trigger("focus");
			setTimeout(() => {
				$(".chatter-send").trigger("click");
				button.closest(".msg-bubble").remove();
			});
		});

		lQuery("#chatterboxreplycancel").livequery("click", function () {
			const button = $(this);
			button.closest(".chatterboxreplyto").hide();
		});

		lQuery(".chatter-text").livequery("keydown", function (e) {
			if (e.keyCode === 13 && !e.shiftKey) {
				//$("#chatter-msg").val("");
				e.preventDefault();
				const button = $(this).closest(".chatterbox").find('button[data-command="messagereceived"]');
				button.trigger("click");
				return false;
			} else {
				const scrollHeight = $(this).get(0).scrollHeight;
				if (
					!$(".chatterbox").hasClass("chatterlongtext") &&
					scrollHeight > 30
				) {
					$(".chatterbox").addClass("chatterlongtext");
					scrollToChat();
				}
			}
		});

		lQuery('button[data-command="messagereceived"]').livequery(
			"click",
			function (e) {
				//$("#chatter-msg").val("");
			},
		);

		lQuery(".chatter-save").livequery("click", function (e) {
			e.preventDefault();
			const button = $(this);
			const form = button.closest(".chatter-edit-form");
			const chatdiv = form.find(".chatter-msg-edit");
			const text = chatdiv.html();
			form.find(".chatter-msg-input").val(text);
			/*var button = $('submit');		    	
    	button.trigger("#submit");*/
			form.trigger("submit");
		});

		lQuery("a.ajax-edit-msg").livequery("click", function (e) {
			e.stopPropagation();
			e.preventDefault();
			const editbtn = $(this);
			const targetDiv = editbtn.data("targetdiv");
			const options = editbtn.cleandata();
			options.oemaxlevel = 1;
			const nextpage = editbtn.attr("href");
			$.get(nextpage, options, function (data) {
				//var cell = findclosest($(this), "#" + targetDiv);
				const cell = editbtn.closest("#" + targetDiv);
				cell.replaceWith(data);
				scrollToEdit(targetDiv);
			});
		});

		lQuery("a.appendgoalbutton").livequery("click", function (e) {
			const parent = $(this).closest(".goalstatusopen");
			if (parent) {
			//	parent[0].scrollIntoView();
			}
		});
	}

	function scrollToChat() {
		setTimeout(function () {
			const inside = $(".chatterbox-body-inside");
			if (inside.length > 0) {
				inside.animate({ scrollTop: inside.get(0).scrollHeight }, 30);
			}
		});
	}

	function scrollToEdit(targetDiv) {
		const messagecontainer = $("#" + targetDiv);
		if (messagecontainer.length) {
			messagecontainer.get(0).scrollIntoView();
		}
	}

	function connect() {
		if (chatConnection && chatConnection.readyState !== chatConnection.CLOSED) {
			return;
		}
		const tabID =
			sessionStorage.tabID && sessionStorage.closedLastTab !== "2"
				? sessionStorage.tabID
				: (sessionStorage.tabID = Math.random());
		sessionStorage.closedLastTab = "2";
		$(window).on("pagehide", function () {
			sessionStorage.closedLastTab = "1";
		});

		const protocol = location.protocol;

		let url = `/entermedia/services/websocket/org/entermediadb/websocket/chat/ChatConnection?sessionid=${tabID}&userid=${userid}`;

		//Get the channel
		const channel = $(".chatterbox").data("channel");
		if (channel != null) {
			url = `${url}&channel=${channel}`;
		}

		if (protocol === "https:") {
			chatConnection = new WebSocket(`wss://${location.host}${url}`);
		} else {
			chatConnection = new WebSocket(`ws://${location.host}${url}`);
		}

		chatConnection.addEventListener("message", function (event) {
			$(window).trigger("ajaxsocketautoreload");

			const message = JSON.parse(event.data);
			if (!message) return;

			let messagebody = message.messageplain;
			
			if (messagebody == null || messagebody == undefined || messagebody === "" || messagebody == "null") {
				messagebody = message.message;
			}

			if (messagebody == null || messagebody == undefined || messagebody === "" || messagebody == "null") {
				//messagebody = "New message...";
				return;
			}

			const channelId = message.channel;
			const chatterbox = $(`div.chatterbox[data-channel="${channelId}"]`);

			if (chatterbox.length > 0) 
			{
				// Channel on the screen, update the UI with the new message
				channelUpdateMessage(chatterbox, message);
			}
			if (message.user == userid || message.user == "agent")  //Add messagetype checks
			{
				return;
			}
			if (message.messagetype == "status") return;


			if (isTabActive()) {
				//console.log("Dropped message: " + messagebody);
				return;
			}

			function showNotification() {
				let header = "New Message";
				if (message.name !== undefined) {
					header = message.name;
				}
				if (message.topic !== undefined) {
					header += ` in ${message.topic}`;
				}
				
				
				const notification = new Notification(header, {
					//TODO: URL?
					body: messagebody,
					renotify: false,
					tag: messagebody,
					icon: `${appHome}/theme/images/logo-square.png`,
				});
				
				notification.addEventListener("click", function (event) {
					event.preventDefault(); 
					window.focus();         
					notification.close();  
				});
			}

			/*Check para permissions and ask.*/
			if (Notification.permission === "granted") {
				//showNotification();
			} else if (Notification.permission !== "denied") {
				console.log("Requesting notification permission...");
				//createNotificationSubscription();

				Notification.requestPermission().then((permission) => {
					if (permission === "granted") {
						//showNotification();
					} else {
						console.log("Notification permission denied.");
					}
				});
			} else {
				console.log(
					`Notification Browser permission: ${Notification.permission}`,
				);
				// customToast(message.message, {
				// 	positive: true,
				// 	autohide: false,
				// });
			}
			
		});

		chatConnection.addEventListener("open", function () {
			keepAlive();
			const chatterbox = $(`div.chatterbox[data-channel="${channel}"]`);
			const chatterboxHome = chatterbox.data("chatterboxhome");
			const messagesUrl = chatterboxHome + "/index.html";
			let options = chatterbox.cleandata();
			if (!options) options = {};
			options.oemaxlevel = 1;
			$.get(messagesUrl, options, function (data) {
				var parent = chatterbox.parent();
				chatterbox.replaceWith(data);
				$(document).trigger("domchanged", [$(parent)]);
				scrollToChat();
			});
		});
		chatConnection.addEventListener("close", function () {
			// console.info(new Date().toISOString(), "Chat Connection Closed");
			// console.log("Chat Connection Closed");
		});
		chatConnection.addEventListener("error", function (event) {
			// console.error(new Date().toISOString(), "Chat Connection Error", event);
		});
	}

	function isTabActive() {
		// 1. Fallback check: If document is hidden, the window is definitely not focused
		var isactive = true;
		if (document.hidden) 
		{
			isactive = false;
		}

		// 2. Safely check the top window focus to bypass cross-origin security blocks
		try {
			if (isactive && window.top && window.top.document) 
			{
				isactive = window.top.document.hasFocus();
			}
		} catch (e) {
			// If blocked by CORS, fall back to checking the current frame
			if( isactive)
			{
				isactive = document.hasFocus();
			}
		}
		return isactive;
	}

	const messages = {};

	function channelUpdateMessage(chatterbox, message) {
		//Cancel an existing one
		if (messages[message.messageid]) {
			messages[message.messageid] = setTimeout(function () {
				updateMessage(chatterbox, message);
			}, 1000);
		} else {
			messages[message.messageid] = true;
			updateMessage(chatterbox, message);
		}
	}

	function updateMessage(chatterbox, message) {
		console.info(new Date().toISOString(), message);

		const listArea = chatterbox.find(".chatterbox-message-list");

		const chatterboxHome = chatterbox.data("chatterboxhome");

		let renderMessageUrl = appHome + "/components/chatterbox/message.html";
		if (chatterboxHome.length) {
			renderMessageUrl = chatterboxHome + "/message.html";
		}

		let options = chatterbox.cleandata();
		if (!options) options = {};
		const editdiv = chatterbox.closest(".editdiv");
		if (
			chatterbox.data("includeeditcontext") === undefined ||
			chatterbox.data("includeeditcontext") === true
		) {
			if (editdiv.length > 0) {
				const otherdata = editdiv.cleandata();
				options = {
					...otherdata,
					...options,
				};
			}
		}

		options.id = message.messageid;

		const existing = listArea.find("#chatter-message-" + message.messageid);
		if (existing.length) {
			if (message.command === "messageremoved") {
				existing.remove();
			} else if (message.command === "messagereload") {
				options.chatid = message.messageid;
				$.get(renderMessageUrl, options, function (data) {
					existing.replaceWith(data);
					$(document).trigger("domchanged", [listArea]);
					scrollToChat();
				});
			} else {
				const msgBody = $(existing).find(".msg-body-content");
				if (msgBody.length) {
					msgBody.html(message.message);
					$(document).trigger("domchanged", [msgBody]);
				} else {
					const chatMsg = $(existing).find(".chat-msg");
					chatMsg.html(message.message);
					$(document).trigger("domchanged", [chatMsg]);
				}
				$(existing).data("functionname", message.functionname);
				$(existing).data("nextfunctionname", message.nextfunctionname);
			}

			scrollToChat();
			sortChatterbox(listArea);
			return;
		}

		//scrollToChat();

		$.get(renderMessageUrl, options, function (data) {
			listArea.append(data);
			sortChatterbox(listArea);
			$(document).trigger("domchanged", [listArea]);
			scrollToChat();
		});
	}

	function sortChatterbox(container) {
		//var messages = Array.from(container.querySelectorAll(".msg-bubble"));
		const messages = Array.from(container.find(".msg-bubble"));

		messages
			.sort((a, b) => {
				const dateA = parseInt(a.dataset.createdat);
				const dateB = parseInt(b.dataset.createdat);
				return dateA - dateB;
			})
			.forEach((el) => container.append(el));
	}

	let keepAliveTimeoutID = 0;

	function keepAlive() {
		if (!chatConnection) {
			return;
		}
		const timeout = 20000;
		if (chatConnection.readyState === chatConnection.OPEN) {
			const command = {};
			command.command = "keepalive";

			command.userid = userid;

			const chatter = $(".chatterbox").data("channel");
			command.channel = chatter;

			const json = JSON.stringify(command);
			chatConnection.send(json);
		}

		if (chatConnection.readyState === chatConnection.CLOSED) {
			connect();
			//reloadAll();
		}

		keepAliveTimeoutID = setTimeout(keepAlive, timeout);
	}

	function cancelKeepAlive() {
		if (keepAliveTimeoutID) {
			clearTimeout(keepAliveTimeoutID);
		}
	}

	/*-------Start Push and Notification --------*/

	function urlBase64ToUint8Array(base64String) {
		const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
		const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
		const rawData = window.atob(base64);
		const outputArray = new Uint8Array(rawData.length);
		for (let i = 0; i < rawData.length; ++i) {
			outputArray[i] = rawData.charCodeAt(i);
		}
		return outputArray;
	}

	
	lQuery(".allowchatnotifications").livequery("click", async  function (e) {
		try {
			await createNotificationSubscription();
		} catch (err) {
			console.error("Subscription failed:", err);
		}
	});

	async function createNotificationSubscription() {
		try {
			// 1. Verify browser feature support
			if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
				throw new Error('Push messaging is not supported in this browser.');
			}

			// 2. Request Permission (Must be inside user-click context)
			console.log('1. Requesting notification permission...');
			const permission = await Notification.requestPermission();
			
			if (permission !== 'granted') {
				throw new Error('Notification permission was denied by the user.');
			}

			// 3. Register or locate Service Worker
			console.log('2. Accessing Service Worker...');
			let registration = await navigator.serviceWorker.getRegistration();
			if (!registration) {
				registration = await navigator.serviceWorker.register(apphome + '/sw.js', { scope: apphome + '/' });
			}

			const serviceWorker = await navigator.serviceWorker.ready;

			// 4. Chrome Fix: Always unsubscribe stale/existing push subscriptions first
			const existingSub = await serviceWorker.pushManager.getSubscription();
			if (existingSub) {
				console.log('Clearing existing push subscription...');
				await existingSub.unsubscribe();
			}

			// 5. Fetch the current VAPID public key from the server. Reading it fresh (instead of
			// a copy hardcoded here) avoids a mismatch if the server key was ever regenerated.
			const pushServerPublicKey = await jQuery.ajax({
				type: 'GET',
				url: appHome + '/components/chatterbox/pushnotificationpublickey.html',
				dataType: 'text',
				xhrFields: { withCredentials: true },
				crossDomain: true,
			}).then((text) => text.trim());

			const key = urlBase64ToUint8Array(pushServerPublicKey);
			console.log('3. Subscribing via pushManager: ' + pushServerPublicKey);

			// 6. Create Fresh Push Subscription
			const subscription = await serviceWorker.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: key,
			});

			console.log('Successfully subscribed in Chrome/Firefox!', subscription);

			// 7. Extract raw binary keys correctly for Chrome & Firefox
			const rawKey = subscription.getKey ? subscription.getKey('p256dh') : null;
			const rawAuth = subscription.getKey ? subscription.getKey('auth') : null;

			// Convert ArrayBuffer to URL-Safe Base64 String
			const p256dh = btoa(String.fromCharCode.apply(null, new Uint8Array(rawKey)))
				.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

			const auth = btoa(String.fromCharCode.apply(null, new Uint8Array(rawAuth)))
				.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

			// 8. Save payload to backend
			await jQuery.ajax({
				type: 'POST',
				url: appHome + '/components/chatterbox/pushsubscriptionsave.html',
				data: {
					endpoint: subscription.endpoint,
					p256dh: p256dh,
					auth: auth,
				},
				xhrFields: { withCredentials: true },
				crossDomain: true,
			});

			console.log('Subscription saved to server.');
			return subscription;

		} catch (error) {
			console.error('Subscription process failed:', error);
			throw error;
		}
	}
	


	function validateVapidPublicKey(key) {
    if (typeof key !== 'string' || !key.trim()) {
        return { valid: false, reason: "Key is missing or not a string." };
    }

    // Check for PEM wrapper headers
    if (key.includes("BEGIN") || key.includes("PUBLIC KEY")) {
        return { 
            valid: false, 
            reason: "Key is in PEM format. VAPID public keys must be raw Base64URL strings, not PEM blocks." 
        };
    }

    // Convert Base64URL to standard Base64 for validation
    let base64 = key.trim().replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
        base64 += '=';
    }

    try {
        const rawData = window.atob(base64);
        const bytes = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; i++) {
            bytes[i] = rawData.charCodeAt(i);
        }

        // Must be exactly 65 bytes for a P-256 uncompressed public key
        if (bytes.length !== 65) {
            return { 
                valid: false, 
                reason: `Invalid key length (${bytes.length} bytes). Expected exactly 65 bytes.` 
            };
        }

        // The first byte must be 0x04 (uncompressed point format marker)
        if (bytes[0] !== 0x04) {
            return { 
                valid: false, 
                reason: `Invalid public key prefix byte (0x${bytes[0].toString(16)}). First byte must be 0x04.` 
            };
        }

        return { valid: true, reason: "Valid VAPID Public Key." };

    } catch (e) {
        return { valid: false, reason: "Failed to decode Base64 string: " + e.message };
    }
}

	function hideAttachFile() {
		if ($(".message-attach-box").is(":visible")) {
			$(".message-attach-box").fadeOut(function () {
				$(this).remove();
				$(".chatter-attachfile").removeClass("active");
			});
		}
	}
	function hideEmojiPicker() {
		if ($(".emoji-picker").is(":visible")) {
			$(".emoji-picker").fadeOut(function () {
				$(this).remove();
				$(".chatter-emoji").removeClass("active");
			});
		}
	}

	lQuery("a.chatEmDialog").livequery("click", function (e) {
		e.preventDefault();
		e.stopPropagation();
		$(this).emDialog(function () {
			setTimeout(function () {
				scrollToChat();
			});
		});
	});
	lQuery("#supportchat").livequery("shown.bs.collapse	", function (e) {
		scrollToChat();
	});
	lQuery("#chatter-msg").livequery(function () {
		const $this = $(this);
		setTimeout(function () {
			$this.trigger("focus");
		});
	});

	lQuery(".chatterbox").livequery(function () {
		initChatterbox();
		scrollToChat();
	});

	lQuery(".expandaisearchtable").livequery("click", function (e) {
		e.preventDefault();
		e.stopPropagation();
		$(this).toggleClass("expanded");
		$(this)
			.closest(".aisearchtable-container")
			.find(".aisearchtable")
			.collapse("toggle");
	});

	lQuery(".chat-msg").livequery(function () {
		const emojiparsed = $(this).data("emojiparsed");
		if (emojiparsed) {
			return;
		}
		$(this).data("emojiparsed", true);
		const msgContent = $(this).find(".msg-body-content");
		const reacts = $(this).find("span.emote");
		if (window.parseEmojis !== undefined) {
			if (msgContent.length > 0) {
				window.parseEmojis(msgContent[0]);
			}
			if (reacts.length > 0) {
				window.parseEmojis(reacts[0]);
			}
		}
	});

	let chatSelectionStart = null;

	lQuery(".chatter-emoji").livequery("click", function (e) {
		e.preventDefault();
		e.stopPropagation();
		let textarea = $("#emojipicker").data("textarea");
		if (textarea) {
			textarea = $("#" + textarea);
		} else {
			textarea = $("#chatter-msg");
		}
		chatSelectionStart = textarea.prop("selectionStart");
		hideAttachFile();
		$(this).addClass("active");
		$(this).runAjax();
	});
	lQuery(".chatter-attachfile").livequery("click", function (e) {
		e.preventDefault();
		e.stopPropagation();
		//hideEmojiPicker();
		$(this).hide();
		$(".chatter-send").data("sendactions", "sendattachments");
		const chatterboxMessages = $(this).closest(".chatterbox").find("#chatterboxmessages");
			if (chatterboxMessages.length) {
				chatterboxMessages.removeClass("attachment-preview");
			}

		$(this).runAjax();
		
	});
	lQuery(".chatter-attachfile-cancel").livequery("click", function (e) {
		e.preventDefault();
		e.stopPropagation();
		const chatterboxMessages = $(this).closest(".chatterbox").find("#chatterboxmessages");
		$(".attachfileonchat").html("");
		$(".chatter-attachfile").show();
		$(".chatter-send").data("sendactions", "");
		if (chatterboxMessages.length) {
			chatterboxMessages.removeClass("attachment-preview");
		}
	});

	lQuery("#emojinav a").livequery("click", function (e) {
		e.preventDefault();
		e.stopPropagation();
		const goTo = $(this).data("id");
		if (goTo === "smileys") {
			$(".emoji-wrapper").animate({ scrollTop: 0 }, 500);
			return;
		}
		$(".emoji-wrapper").scrollTop(0);
		const dest =
			$("#" + goTo).offset().top -
			$("#" + goTo)
				.offsetParent()
				.offset().top;
		$(".emoji-wrapper").animate({ scrollTop: dest - 70 }, 500);
	});

	lQuery(".emjbtn").livequery("click", function () {
		let textarea = $("#emojipicker").data("textarea");
		if (textarea) {
			textarea = $("#" + textarea);
		} else {
			textarea = $("#chatter-msg");
		}

		const emoji = $(this).text();
		let prev = textarea.val() || "";
		if (chatSelectionStart != null) {
			prev =
				prev.slice(0, chatSelectionStart) +
				emoji +
				prev.slice(chatSelectionStart);
		} else {
			prev += emoji;
		}

		textarea.val(prev);

		$(".emoji-picker").fadeOut(function () {
			textarea.trigger("focus");
			$(this).remove();
		});
	});
	function hideChatPickers(e) {
		if ($(e.target).closest("#emojipicker").length === 0) {
			hideEmojiPicker();
		}
	}

	lQuery("#closeattachfileonchat").livequery("click", function () {
		hideAttachFile();
	});

	lQuery("window").livequery("click", hideChatPickers);
	lQuery(".modal").livequery("click", hideChatPickers);

	/**Attachments */

	lQuery("a.lightbox").livequery(function () {
		const slb = $(this).simpleLightbox({
			captionSelector: "self",
			captionType: "data",
			captionsData: "caption",
			captionDelay: 250,
			widthRatio: 0.98,
			heightRatio: 0.98,
			overlayOpacity: 1,
			fadeSpeed: 60,
		});

		slb.on("shown.simplelightbox", function () {
			const lang = document.documentElement.lang;
			if (lang) {
				let locales = $(this).data("locales");
				if (locales) {
					if (typeof locales === "string") {
						const txt = document.createElement("textarea");
						txt.innerHTML = locales;
						locales = JSON.parse(txt.value);
					}
					const localeCaption = locales[lang];
					if (localeCaption) {
						$(".sl-caption").html(localeCaption);
					}
				}
			}

			const dl = $(this).data("downloadlink");
			const al = $(this).data("assetlink");
			if (dl || al) {
				$(".simple-lightbox .sl-actions").remove();
				$(".simple-lightbox").append("<div class='sl-actions'></div>");

				if (dl) {
					$(".simple-lightbox .sl-actions").append(
						"<a class='sl-btn sl-dl' href='" + dl + "' target='_blank'></a>",
					);
				}
				//Asset Link

				if (al) {
					$(".simple-lightbox .sl-actions").append(
						"<a class='sl-btn sl-al' href='" + al + "' target='_blank'></a>",
					);
				}
			}
		});
	});

	$(document).on("visibilitychange", function () {
		if (document.visibilityState === "visible") {
			if (chatConnection) {
				keepAlive();
			} else {
				if ($(".chatterbox").length > 0) {
					initChatterbox();
				}
			}
		}
	});
});

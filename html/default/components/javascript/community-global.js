$(document).ready(function () {
	var appdiv = $("#application");
	var apphome = appdiv.data("apphome");
	var finderhome = appdiv.data("finderhome");

	$("#userOffcanvas").on("show.bs.offcanvas", function () {
		$("body").addClass("offcanvas-open");
		$(".community-layout").addClass("offcanvas-open");
	});

	$("#userOffcanvas").on("hide.bs.offcanvas", function () {
		$("body").removeClass("offcanvas-open");
		$(".community-layout").removeClass("offcanvas-open");
	});

	lQuery(".reloadpage").livequery(function () {
		window.location.reload();
	});

	lQuery(".redirecttopage").livequery(function () {
		var url = $(this).data("redirectok");
		window.location.href = url;
	});

	lQuery(".autoclick").livequery("click", function (e) {
		var target = $(this).data("clicktarget");
		if (!target) {
			return;
		}
		if (!target.startsWith("#") && !target.startsWith(".")) {
			target = "." + target;
		}
		if (!$(target).is("a")) {
			return;
		}
		window.location.href = $(target).attr("href");
	});

	lQuery(".__top-flair").livequery(function () {
		$(this)
			.find("a.__close")
			.on("click", function (e) {
				e.preventDefault();
				e.stopPropagation();
				$("#__flair").fadeOut(function () {
					$(this).remove();
				});
			});
	});

	lQuery(".autofill").livequery(function () {
		var $this = $(this);
		if ($this.val().trim().length > 0) return;
		var fillFrom = $(this).data("autofillfrom");
		var form = $(this).closest("form");
		if (!form.length) {
			return;
		}
		var input = form.find(`[name="${fillFrom}"]`);
		if (!input.length) {
			return;
		}
		input.on("input", function () {
			$this.val(
				$(this)
					.val()
					.trim()
					.replace(/\s/g, "-")
					.replace(/[^a-zA-Z0-9-]/g, "")
					.toLowerCase(),
			);
		});
	});

	lQuery(".fader").livequery(function () {
		var _this = $(this);
		if (_this.hasClass("alert-save")) {
			//	_this.prepend('<span class="bi bi-check-circle-fill ns"></span>');
			//	_this.append('<button><span class="bi bi-x-circle ns"></span>');
		} else if (_this.hasClass("alert-error")) {
			//	_this.prepend('<span class="bi bi-info-circle-fill ns"></span>');
			//	_this.append('<button><span class="bi bi-x ns"></span>');
		}
		var timeout = 4000;
		if (_this.hasClass("fade-quick")) {
			timeout = 2000;
		}
		setTimeout(function () {
			_this.fadeOut(500, function () {
				_this.remove();
			});
		}, timeout);
		_this.find("button").click(function () {
			_this.fadeOut(500, function () {
				_this.remove();
			});
		});
	});

	$(document).on("submit", ".antibotform", function (e) {
		e.preventDefault();

		var form = $(this);
		var action = form.attr("action");

		if (action == undefined || action == "/fake") {
			action = form.find("button[type=submit]").data("action");
			if (action == undefined) {
				action = form.find("input[type=submit]").data("action");
			}
			if (action != undefined) {
				form.attr("action", action);
			}
		}

		form.get(0).submit();
	});

	$("#meetingtime").on("change", function () {
		var timeSlot = $("#meetingtime option:selected").val();
		if (timeSlot === "custom") {
			$("#customTimeSlot").collapse("show");
			$(this).prop("required", false);
			$("#datetimepicker").prop("required", true);
		} else {
			$("#customTimeSlot").collapse("hide");
			$(this).prop("required", true);
			$("#datetimepicker").prop("required", false);
		}
	});

	var datetimepicker = $("#datetimepicker");
	if (datetimepicker.length > 0) {
		datetimepicker.datetimepicker({
			inline: true,
			format: "Y-m-d H:i:00 O",
			showTimezone: true,
			minDate: new Date(),
			maxDate: new Date(new Date().setDate(new Date().getDate() + 30)),
		});
	}

	// blockfind iframe picker listener
	window.addEventListener("message", function (event) {
		if (event.origin !== window.location.origin) return;
		if (
			typeof event.data === "object" &&
			event.data.name === "eMediaAssetPicked" &&
			event.data.target !== "htmleditor"
		) {
			var target = event.data.target;
			if (!target) return;

			var targetEl = $("#" + target);
			if (!targetEl.length) return;
			var assetid = event.data.assetid;
			targetEl.val(assetid);
			if (target.startsWith("primarymedia")) {
				var detailId = targetEl.data("detailid");
				var preview = targetEl
					.closest(".assetpicker")
					.find(".render-type-thumbnail");
				preview.html("");

				var img = $("<img>");
				img.attr("src", event.data.assetpicked);
				img.attr("height", "140px");
				img.attr("width", "auto");
				preview.append(img);

				preview.append(
					`<div class="p-1"><a href="#" class="removefieldassetvalue" title="Remove Selected Asset" data-detailid="${detailId}"><i class="bi bi-x"></i></a></div>`,
				);
			}
			var pickermodal = $("#dialogpickerassetpicker");
			if (!pickermodal.length) {
				pickermodal = $("#blockfindpicker").closest(".modal");
			}
			closeemdialog(pickermodal);
		}
	});

	function select2formatResult(emdata) {
		return emdata.name;
	}
	function select2Selected(selectedoption) {
		return selectedoption.name || selectedoption.text;
	}

	function getSelect2Placeholder() {
		var placeholder = $(this).attr("placeholder");
		if (!placeholder) {
			placeholder = $(this).data("placeholder");
		}
		if (!placeholder) {
			placeholder = $(this).find("option[value='']").text();
		}
		if (!placeholder) {
			var label = $(this).closest(".inputformrow").find("label");
			//console.log(label);
			if (label.length) {
				placeholder = label.text().trim();
				if (placeholder) {
					return "Select " + placeholder.toLowerCase();
				}
			}
		}
		if (!placeholder) {
			return "Select an option";
		}
		return placeholder;
	}

	lQuery("select.select2").livequery(function () {
		var theinput = $(this);

		var allowClear = $(this).data("allowclear");
		if (allowClear == undefined) {
			allowClear = true;
		}
		var placeholder = getSelect2Placeholder.call(this);
		if ($.fn.select2) {
			theinput.select2({
				allowClear: allowClear,
				placeholder: placeholder,
				dropdownParent: getDropdownParent(theinput),
			});
			theinput.on("select2:open", function (e) {
				var selectId = $(this).attr("id");
				if (selectId) {
					$(
						".select2-search__field[aria-controls='select2-" +
							selectId +
							"-results']",
					).each(function (key, value) {
						value.focus();
					});
				} else {
					document
						.querySelector(".select2-container--open .select2-search__field")
						.focus();
				}
			});
		}
	});
	/*
		$(".select2simple").select2({
			 minimumResultsForSearch: Infinity
		});
		*/
	lQuery("select.listdropdown").livequery(function () {
		var theinput = $(this);

		var placeholder = getSelect2Placeholder.call(this);

		var allowClear = theinput.data("allowclear");

		if (allowClear == undefined) {
			allowClear = true;
		}
		if ($.fn.select2) {
			theinput = theinput.select2({
				placeholder: placeholder,
				allowClear: allowClear,
				minimumInputLength: 0,
				dropdownParent: getDropdownParent(theinput),
			});
			theinput.on("change", function (e) {
				//console.log("XX changed")
				if (theinput.hasClass("uifilterpicker")) {
					var selectedids = theinput.val();
					if (selectedids) {
						//console.log("XX has class" + selectedids);
						var parent = theinput.closest(".filter-box-options");
						//console.log(parent.find(".filtercheck"));
						parent.find(".filtercheck").each(function () {
							var filter = $(this);
							filter.prop("checked", false); //remove?
						});
						for (i = 0; i < selectedids.length; i++) {
							//$entry.getId()${fieldname}_val
							var selectedid = selectedids[i];
							var fieldname = theinput.data("fieldname");
							var targethidden = $("#" + selectedid + fieldname + "_val");
							targethidden.prop("checked", true);
						}
					}
				}
			});

			theinput.on("select2:open", function (e) {
				var selectId = $(this).attr("id");
				if (selectId) {
					$(
						".select2-search__field[aria-controls='select2-" +
							selectId +
							"-results']",
					).each(function (key, value) {
						value.focus();
					});
				} else {
					document
						.querySelector(".select2-container--open .select2-search__field")
						.focus();
				}
			});
		}
	});

	lQuery("select.listtags").livequery(function () {
		var theinput = $(this);

		var searchtype = theinput.data("searchtype");
		var searchfield = theinput.data("searchfield");
		var catalogid = theinput.data("listcatalogid");
		var sortby = theinput.data("sortby");
		var defaulttext = theinput.data("showdefault");
		if (!defaulttext) {
			defaulttext = "Search";
		}
		var allowClear = $(this).data("allowclear");
		if (allowClear == undefined) {
			allowClear = true;
		}

		var url = theinput.data("url");
		if (!url) {
			url = apphome + "/components/xml/types/autocomplete/tagsearch.txt";
		}

		if ($.fn.select2) {
			theinput.select2({
				tags: true,
				placeholder: defaulttext,
				allowClear: allowClear,
				dropdownParent: getDropdownParent(theinput),
				selectOnBlur: true,
				delay: 150,
				minimumInputLength: 1,
				ajax: {
					// instead of writing
					// the function to
					// execute the request
					// we use Select2's
					// convenient helper
					url: url,
					xhrFields: {
						withCredentials: true,
					},
					crossDomain: true,
					dataType: "json",
					data: function (params) {
						var search = {
							page_limit: 15,
							page: params.page,
						};
						search["field"] = searchfield;
						search["operation"] = "contains";
						search["searchtype"] = searchtype;
						search[searchfield + ".value"] = params.term; // search
						// term
						search["sortby"] = sortby; // search
						// term
						return search;
					},
					processResults: function (data, params) {
						// parse the
						// results
						// into the
						// format
						// expected
						// by
						// Select2.
						params.page = params.page || 1;
						return {
							results: data.rows,
							pagination: {
								more: false,
								// (params.page * 30) <
								// data.total_count
							},
						};
					},
				},
				escapeMarkup: function (m) {
					return m;
				},
				templateResult: select2formatResult,
				templateSelection: select2Selected,
				tokenSeparators: ["|"],
				separator: "|",
			});
			theinput.on("select2:select", function () {
				if ($(this).parents(".ignore").length == 0) {
					$(this).valid();
				}
			});
			theinput.on("select2:unselect", function () {
				if ($(this).parents(".ignore").length == 0) {
					$(this).valid();
				}
			});
		}
	});

	lQuery(".custom-navbar-toggler").livequery("click", function () {
		if ($("#tempNav").hasClass("d-none")) {
			$("#tempNav").removeClass("d-none");
			var bg = "bg-white";
			if ($(this).data("dark")) {
				bg = "bg-dark";
			}
			$("#tempNav").addClass(`d-flex rounded shadow ${bg}`);
			$("#tempNav").css({
				position: "absolute",
				top: "100%",
				right: 0,
				width: 200,
				padding: "10px 16px",
				zIndex: 9999,
				opacity: 0,
			});
			$("#tempNav").animate({ opacity: 1 }, 250);
		} else {
			$("#tempNav").animate({ opacity: 0 }, 200, function () {
				$("#tempNav").removeClass("d-flex");
				$("#tempNav").addClass("d-none");
			});
		}
	});

	$(window).on("resize", function () {
		if (window.innerWidth >= 768) {
			$("#tempNav").removeClass("d-none bg-white bg-dark rounded shadow");
			$("#tempNav").attr("style", "");
		} else {
			$("#tempNav").addClass("d-none");
		}
	});

	$(document).on("click", function (e) {
		if (window.innerWidth >= 768) {
			return;
		}
		if ($(e.target).closest(".custom-navbar-toggler").length) return;
		if (!$(e.target).is($("#tempNav"))) {
			$("#tempNav").animate({ opacity: 0 }, 200, function () {
				$("#tempNav").removeClass("d-flex");
				$("#tempNav").addClass("d-none");
			});
		}
	});

	lQuery(".emoticonmenu span").livequery("click", function () {
		var menuitem = $(this);
		var aparent = $(menuitem.closest(".message-menu").find(".pickemoticon"));
		var saveurl = aparent.data("toggleurl");
		var messageid = aparent.data("messageid");
		var options = aparent.data();
		options.reactioncharacter = menuitem.data("hex");
		$.ajax({
			url: saveurl,
			async: true,
			data: {
				...options,
			},
			success: function (data) {
				$("#chatter-message-" + messageid).replaceWith(data);
			},
		});
	});

	lQuery("select.listautocomplete").livequery(function () {
		// select2
		var theinput = $(this);
		var searchtype = theinput.data("searchtype");
		if (searchtype != undefined) {
			// called twice due to
			// the way it reinserts
			// components
			var searchfield = theinput.data("searchfield");

			var foreignkeyid = theinput.data("foreignkeyid");
			var sortby = theinput.data("sortby");

			var defaulttext = theinput.data("showdefault");
			if (!defaulttext) {
				defaulttext = "Search";
			}
			var defaultvalue = theinput.data("defaultvalue");
			var defaultvalueid = theinput.data("defaultvalueid");
			if (apphome === undefined) {
				apphome = "";
			}
			var url =
				apphome +
				"/components/xml/types/autocomplete/datasearch.txt?" +
				"field=" +
				searchfield +
				"&operation=contains&searchtype=" +
				searchtype;
			if (defaultvalue != undefined) {
				url =
					url +
					"&defaultvalue=" +
					defaultvalue +
					"&defaultvalueid=" +
					defaultvalueid;
			}

			var allowClear = theinput.data("allowclear");
			if (allowClear == undefined) {
				allowClear = true;
			}
			if ($.fn.select2) {
				theinput.select2({
					placeholder: defaulttext,
					allowClear: allowClear,
					minimumInputLength: 0,
					dropdownParent: getDropdownParent(theinput),
					ajax: {
						// instead of writing the
						// function to execute the
						// request we use Select2's
						// convenient helper
						url: url,
						dataType: "json",
						data: function (params) {
							var fkv = theinput
								.closest("form")
								.find("#list-" + foreignkeyid + "value")
								.val();
							if (fkv == undefined) {
								fkv = theinput
									.closest("form")
									.find("#list-" + foreignkeyid)
									.val();
							}
							var search = {
								page_limit: 15,
								page: params.page,
							};
							search[searchfield + ".value"] = params.term; // search
							// term
							if (fkv) {
								search["field"] = foreignkeyid; // search
								// term
								search["operation"] = "matches"; // search
								// term
								search[foreignkeyid + ".value"] = fkv; // search
								// term
							}
							if (sortby) {
								search["sortby"] = sortby; // search
								// term
							}
							return search;
						},
						processResults: function (data, params) {
							// parse the
							// results into
							// the format
							// expected by
							// Select2.
							var rows = data.rows;
							if (theinput.hasClass("selectaddnew")) {
								if (params.page == 1 || !params.page) {
									var addnewlabel = theinput.data("addnewlabel");
									var addnewdata = {
										name: addnewlabel,
										id: "_addnew_",
									};
									rows.unshift(addnewdata);
								}
							}
							// addnew
							params.page = params.page || 1;
							return {
								results: rows,
								pagination: {
									more: false,
									// (params.page * 30) <
									// data.total_count
								},
							};
						},
					},
					escapeMarkup: function (m) {
						return m;
					},
					templateResult: select2formatResult,
					templateSelection: select2Selected,
				});
			}
			// TODO: Remove this?
			theinput.on("change", function (e) {
				if (e.val == "") {
					// Work around for a bug
					// with the select2 code
					var id = "#list-" + theinput.attr("id");
					$(id).val("");
				} else {
					// Check for "_addnew_" show ajax form
					var selectedid = theinput.val();

					if (selectedid == "_addnew_") {
						var clicklink = $("#" + theinput.attr("id") + "add");
						clicklink.trigger("click");

						e.preventDefault();
						theinput.select2("val", "");
						return false;
					}
					if (theinput.hasClass("uifilterpicker")) {
						//Not used?
						//$entry.getId()${fieldname}_val
						var fieldname = theinput.data("fieldname");
						var targethidden = $("#" + selectedid + fieldname + "_val");
						targethidden.prop("checked", true);
					}
					// Check for "_addnew_" show ajax form
					if (theinput.hasClass("selectautosubmit")) {
						if (selectedid) {
							//var theform = $(this).closest("form");
							var theform = $(this).parent("form");
							if (theform.hasClass("autosubmitform")) {
								theform.trigger("submit");
							}
						}
					}
				}
			});

			theinput.on("select2:open", function (e) {
				var selectId = $(this).attr("id");
				if (selectId) {
					$(
						".select2-search__field[aria-controls='select2-" +
							selectId +
							"-results']",
					).each(function (key, value) {
						value.focus();
					});
				} else {
					document
						.querySelector(".select2-container--open .select2-search__field")
						.focus();
				}
			});
		}
	});
	//-
	//List autocomplete multiple and accepting new options
	lQuery("select.listautocompletemulti").livequery(function () {
		// select2
		var theinput = $(this);
		var searchtype = theinput.data("searchtype");
		if (searchtype != undefined) {
			var searchfield = theinput.data("searchfield");

			var foreignkeyid = theinput.data("foreignkeyid");
			var sortby = theinput.data("sortby");

			var defaulttext = theinput.data("showdefault");
			if (!defaulttext) {
				defaulttext = "Search";
			}
			var defaultvalue = theinput.data("defaultvalue");
			var defaultvalueid = theinput.data("defaultvalueid");

			var url =
				apphome +
				"/components/xml/types/autocomplete/datasearch.txt?" +
				"field=" +
				searchfield +
				"&operation=contains&searchtype=" +
				searchtype;
			if (defaultvalue != undefined) {
				url =
					url +
					"&defaultvalue=" +
					defaultvalue +
					"&defaultvalueid=" +
					defaultvalueid;
			}

			var allowClear = theinput.data("allowclear");
			if (allowClear == undefined) {
				allowClear = true;
			}

			theinput.select2({
				placeholder: defaulttext,
				allowClear: allowClear,
				minimumInputLength: 0,
				tags: true,
				dropdownParent: getDropdownParent(theinput),
				ajax: {
					// instead of writing the
					// function to execute the
					// request we use Select2's
					// convenient helper
					url: url,
					dataType: "json",
					data: function (params) {
						var fkv = theinput
							.closest("form")
							.find("#list-" + foreignkeyid + "value")
							.val();
						if (fkv == undefined) {
							fkv = theinput
								.closest("form")
								.find("#list-" + foreignkeyid)
								.val();
						}
						var search = {
							page_limit: 15,
							page: params.page,
						};
						search[searchfield + ".value"] = params.term; // search
						// term
						if (fkv) {
							search["field"] = foreignkeyid; // search
							// term
							search["operation"] = "matches"; // search
							// term
							search[foreignkeyid + ".value"] = fkv; // search
							// term
						}
						if (sortby) {
							search["sortby"] = sortby; // search
							// term
						}
						return search;
					},
					processResults: function (data, params) {
						// parse the
						// results into
						// the format
						// expected by
						// Select2.
						var rows = data.rows;
						return {
							results: rows,
							pagination: {
								more: false,
								// (params.page * 30) <
								// data.total_count
							},
						};
					},
				},
				escapeMarkup: function (m) {
					return m;
				},
				templateResult: select2formatResult,
				templateSelection: select2Selected,
			});

			// TODO: Remove this?
			theinput.on("change", function (e) {
				if (e.val == "") {
					// Work around for a bug
					// with the select2 code
					var id = "#list-" + theinput.attr("id");
					$(id).val("");
				}
			});

			theinput.on("select2:open", function (e) {
				var selectId = $(this).attr("id");
				if (selectId) {
					$(
						".select2-search__field[aria-controls='select2-" +
							selectId +
							"-results']",
					).each(function (key, value) {
						value.focus();
					});
				} else {
					document
						.querySelector(".select2-container--open .select2-search__field")
						.focus();
				}
			});
		}
	});

	lQuery(".submitform").livequery("click", function (e) {
		e.preventDefault();

		var theform = $(this).closest("form");

		var clicked = $(this);
		if (clicked.data("updateaction")) {
			var newaction = clicked.attr("href");
			theform.attr("action", newaction);
		}
		theform.trigger("submit");
		e.stopPropagation();
		return;
	});

	lQuery("form.autosubmit").livequery(function () {
		var form = $(this);

		$("select", form).change(function (e) {
			e.stopPropagation();
			$(form).trigger("submit");
		});
		/* Todo: use onblur
			$("input", form).on("focusout", function (event) {
				$(form).trigger("submit");
			});
			*/
		$("input", form).on("keyup", function (e) {
			//Enter Key handled by default the submit
			if (e.keyCode == 13) {
				return;
			}
			e.preventDefault();
			e.stopPropagation();
			$(form).trigger("submit");
		});
		$(
			'input[type="file"],input[name="date.after"],input[type="checkbox"]',
			form,
		).on("change", function (e) {
			e.stopPropagation();
			$(form).trigger("submit");
		});
	});

	lQuery("#thumbnailPicker").livequery("change", function () {
		var input = $(this);
		var file = input[0].files[0];
		var reader = new FileReader();
		reader.onloadend = function () {
			var img = new Image();
			img.src = reader.result;
			img.onload = function () {
				$("#thumbPreview").html(`<img src="${reader.result}" />`);
				$("#removeThumbnail").show();
			};
		};
		if (file) {
			reader.readAsDataURL(file);
		} else {
			$("#thumbPreview").html("");
			$("#thumbnailPicker").val("");
		}
	});

	lQuery("#removeThumbnail").livequery("click", function () {
		$("#thumbPreview").html("");
		$("#thumbnailPicker").val("");
		$(this).hide();
	});

	function slugify(string) {
		if (string) {
			string = string.trim();
			string = string.replace(/[^a-z0-9]+/gi, "-");
			string = string.replace(/^-+|-+$/g, "");
			string = string.toLowerCase();
			return string.substring(0, 100);
		}
	}

	lQuery(".toggleCommunityDrawer").livequery("click", function () {
		$(".sidebar-right").toggleClass("open");
		$("#community-drawer-mask").show();
	});
	lQuery(".community-drawer-close").livequery("click", function () {
		$(".sidebar-right").removeClass("open");
		$("#community-drawer-mask").hide();
	});

	//Blog Post

	lQuery('.userpostform input[name="name.value"]').livequery(
		"change",
		function () {
			var title = $(this).val();
			var slug = slugify(title);
			$(this).closest("form").find('input[name="urlname.value"]').val(slug);
		},
	);

	lQuery(".copytoclipboard").livequery("click", function (e) {
		e.preventDefault();
		e.stopPropagation();
		var btn = $(this);
		var copytextcontainer = btn.data("copytext");
		var copyText = $("#" + copytextcontainer);
		copyText.trigger("focus");
		copyText.trigger("select");
		document.execCommand("copy");
		var alertdiv = btn.data("targetdiv");
		if (alertdiv) {
			console.log(copyText);
			$("#" + alertdiv)
				.show()
				.fadeOut(2000);
		}
	});
	var browserlanguage = appdiv.data("browserlanguage");
	if (browserlanguage == undefined || browserlanguage == "") {
		browserlanguage = "en";
	}
	lQuery("input.datepicker").livequery("mousedown", function () {
		var trigger = $(this).parent().find(".ui-datepicker-trigger");
		trigger.trigger("click");
	});
	lQuery("input.datepicker").livequery(function () {
		if ($.datepicker) {
			var dpicker = $(this);
			$.datepicker.setDefaults($.datepicker.regional[browserlanguage]);
			$.datepicker.setDefaults(
				$.extend({
					showOn: "button",
					buttonImage:
						"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' fill='%234d5d80' class='bi bi-calendar-plus' viewBox='0 0 16 16'%3E%3Cpath d='M8 7a.5.5 0 0 1 .5.5V9H10a.5.5 0 0 1 0 1H8.5v1.5a.5.5 0 0 1-1 0V10H6a.5.5 0 0 1 0-1h1.5V7.5A.5.5 0 0 1 8 7'/%3E%3Cpath d='M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5M1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4z'/%3E%3C/svg%3E",
					buttonImageOnly: true,
					changeMonth: true,
					changeYear: true,
					yearRange: "1900:2050",
				}),
			); // Move this to the Layouts?

			var targetid = dpicker.data("targetid");
			dpicker.datepicker({
				altField: "#" + targetid,
				altFormat: "yy-mm-dd",
				yearRange: "1900:2050",
				beforeShow: function (input, inst) {
					setTimeout(function () {
						$("#ui-datepicker-div").css("z-index", 100100);
						$("#application").append($("#ui-datepicker-div"));
						// var quickSelect = $("#operationentitydatefindercatalog");
						// quickSelect.css("display", "block");
						// $("#ui-datepicker-div").append(quickSelect);
						//Fix Position if in bootstrap modal
						var modal = $("#modals");
						if (modal.length) {
							var modaltop = $("#modals").offset().top;
							if (modaltop) {
								var dpickertop = dpicker.offset().top;
								dpickertop = dpickertop - modaltop;
								var dpHeight = inst.dpDiv.outerHeight();
								var inputHeight = inst.input ? inst.input.outerHeight() : 0;
								var viewHeight = document.documentElement.clientHeight;
								if (dpickertop + dpHeight + inputHeight > viewHeight) {
									dpickertop = dpickertop - dpHeight;
								}
								inst.dpDiv.css({
									top: dpickertop + inputHeight,
								});
							}
						}
					}, 0);
				},
			});

			var current = $("#" + targetid).val();
			if (current != undefined) {
				// alert(current);
				var date;
				if (current.indexOf("-") > 0) {
					// this is the standard
					current = current.substring(0, 10);
					// 2012-09-17 09:32:28 -0400
					date = $.datepicker.parseDate("yy-mm-dd", current);
				} else {
					date = $.datepicker.parseDate("mm/dd/yy", current); // legacy
				}
				$(this).datepicker("setDate", date);
			}
			$(this).blur(function () {
				var val = $(this).val();
				if (val == "") {
					$("#" + targetid).val("");
				}
			});
		} //datepicker
	});

	//open assets on finder on new window
	lQuery("a.stackedplayer").livequery("click", function (e) {
		e.preventDefault();
		var link = $(this);
		var assetid = link.data("assetid");

		var url = finderhome + "/?assetid=" + assetid;

		window.open(url, "_blank").focus();

		return false;
	});

	// start observing a DOM node
	function handleFooterPosition() {
		var offset = 0;
		if ($(".__top-flair").length > 0) {
			offset = $(".__top-flair").height();
		}
		if (document.body.clientHeight - offset <= $(window).height()) {
			$("footer").css({
				position: "fixed",
				bottom: 0,
				width: "100%",
			});
		} else {
			$("footer").css({
				position: "relative",
				bottom: "auto",
			});
		}
	}
	handleFooterPosition();
	var resizeObserver = new ResizeObserver(handleFooterPosition);
	resizeObserver.observe(document.body);

	//Standard Picker (old emselectresults?)

	lQuery(".pickerresultsgeneral .resultsdivdata").livequery(
		"click",
		function (e) {
			if (!isValidTarget(e)) {
				return true;
			}
			var row = $(this);
			var clickableresultlist = row.closest(".pickerresultsgeneral");
			var rowid = row.data("dataid");
			clickableresultlist.data("dataid", rowid);
			clickableresultlist.runAjax();

			closeemdialog(clickableresultlist.closest(".modal"));
		},
	);

	//Asset picker

	lQuery(".assetpicker .assetInput").livequery("change", function () {
		var input = $(this);
		var detailId = input.data("detailid");
		var assetName = input.val();
		var assets = input.prop("files");
		if (assets.length == 0) return;
		var asset = assets[0];
		if (asset.name) assetName = asset.name;
		var fileReader = new FileReader();
		fileReader.onload = function (e) {
			if (!assetName && e.target.fileName) {
				assetName = e.target.fileName;
			}
			var preview = input
				.closest(".assetpicker")
				.find(".render-type-thumbnail");
			preview.html("");
			if (/\.(jpe?g|png|gif|webp)$/i.test(assetName)) {
				var img = $("<img>");
				img.attr("src", e.target.result);
				img.attr("height", "140px");
				img.attr("width", "auto");
				preview.append(img);
			} else if (/\.(mp4|mov|mpeg|avi)$/i.test(assetName)) {
				var img = $("<i>");
				img.attr("class", "bi bi-film");
				preview.append(img);
			}

			preview.append(
				`<div class="p-1"><span class="mr-2">${assetName}</span><a href="#" class="removefieldassetvalue" title="Remove Selected Asset" data-detailid="${detailId}"><i class="bi bi-x"></i></a></div>`,
			);
		};
		fileReader.readAsDataURL(asset);
	});

	lQuery(".assetpicker .removefieldassetvalue").livequery(
		"click",
		function (e) {
			e.preventDefault();
			var picker = $(this).closest(".assetpicker");
			var detailid = $(this).data("detailid");

			picker.find("#" + detailid + "-preview").html("");
			picker.find("#" + detailid + "-value").val("");
			picker.find("#" + detailid + "-file").val("");

			var theform = $(picker).closest("form");
			theform = $(theform);
			if (theform.hasClass("autosubmit")) {
				theform.trigger("submit");
			}
		},
	);

	lQuery("#savecommunityblog button").livequery("click", function (e) {
		var btn = $(this);
		if (btn.attr("id") == "savePublish" || btn.attr("id") == "saveDraft") {
			e.preventDefault();
			var form = $("#savecommunityblog");
			var poststatus = btn.data("poststatus");
			form.find("#poststatus").val(poststatus);
			form.submit();
		}
	});

	lQuery("form.addproductform").livequery(function (e) {
		var form = $(this);
		var isrecurring = form.find('input[name="recurring.value"]');
		if (isrecurring) {
			form.find('select[name="recurringperiodvalue"]').addClass("isrecurringrequiredfields");
			form.find('input.datepicker-nextbillon').addClass("isrecurringrequiredfields validatehidden");
		}

	});

	$.validator.addClassRules("isrecurringrequiredfields", {
		required: {
			depends: function(element) {
				// Only required if '#other-field' is checked
				var form = $(element).closest("form");
				var isrecurring = form.find('input[name="recurring.value"]').is(":checked");
				return isrecurring;
			}
		}
	});


	toggleUserProperty = function (property, onsuccess) {
		jQuery.ajax({
			url:
				apphome +
				"/components/userprofile/toggleprofileproperty.html?field=" +
				property,
			success: onsuccess,
		});
	};

	lQuery(".toggleuserpreference").livequery("click", function () {
		var preference = $(this).data("userpreference");
		if (preference !== undefined) {
			toggleUserProperty(preference, function () {});
		}
	});

	jQuery(window).on("ajaxsocketautoreload", function () {
		$(".ajaxsocketautoreload").each(function () {
			var cell = $(this);
			var path = cell.data("ajaxpath");
			jQuery.ajax({
				url: path,
				async: false,
				data: {},
				success: function (data) {
					cell.replaceWith(data);
				},
				xhrFields: {
					withCredentials: true,
				},
				crossDomain: true,
			});
		});
	});
}); //document (ready)

function isValidTarget(clickEvent) {
	var target = $(clickEvent.target);
	if (
		target.attr("noclick") == "true" ||
		target.is("input") ||
		target.is("a") ||
		target.closest(".jp-audio").length
	) {
		return false;
	}

	clickEvent.preventDefault();
	clickEvent.stopImmediatePropagation();

	return true;
}

function isInViewport(cell) {
	const rect = cell.getBoundingClientRect();
	var isin =
		rect.top >= 0 &&
		rect.top <= (window.innerHeight || document.documentElement.clientHeight);
	return isin;
}

$(document).ready(function () {
	var lastTypeahead;
	var searchPopupOpened = false;
	var searchInputEmpty = $("#searchInputEmpty");
	var searchLoading = $("#searchLoading");
	var searchNoResult = $("#searchNoResult");
	var searchResult = $("#searchResult");
	var searchResultPlaceholder = $("#searchResultPlaceholder");

	function openSearchPopup() {
		$(".search-popup").css("display", "flex");
		$("#searchInput").focus();
		searchPopupOpened = true;
	}

	$("#searchBtn").on("click", openSearchPopup);
	$(".searchBtn").on("click", openSearchPopup);

	function closeSearchPopup() {
		$(".search-popup").css("display", "none");
		searchPopupOpened = false;
	}

	$("#closeSearch").on("click", closeSearchPopup);

	$(".search-popup").on("click", function (e) {
		if (e.target !== this) return;
		closeSearchPopup();
	});

	$(document).on("keyup", function (e) {
		if (e.key === "Escape" && searchPopupOpened) {
			closeSearchPopup();
		}
	});
	function confirmModalClose(modal) {
		var checkForm = modal.find("form.checkCloseDialog");
		if (!checkForm) {
			closeemdialog(modal);
			trackKeydown = false;
			return true;
		} else {
			var prevent = false;
			$(checkForm)
				.find("input, textarea, select")
				.each(function () {
					if ($(this).attr("type") == "hidden") {
						return true;
					}
					var value = $(this).val();
					if (value) {
						prevent = value.length > 0;
						return false;
					}
				});

			if (prevent && exitWarning) {
				$("#exitConfirmationModal").css("display", "flex");
				return false;
			} else {
				closeemdialog(modal);
				trackKeydown = false;
				return true;
			}
		}
	}

	lQuery("form.checkCloseDialog").livequery(function () {
		trackKeydown = true;
		var modal = $(this).closest(".modal");
		if (modal.length) {
			if (typeof modal.modal == "function") {
				modal.modal({
					backdrop: "static",
					keyboard: false,
				});
			}
			modal.on("mousedown", function (e) {
				e.stopPropagation();
				e.stopImmediatePropagation();
				if (e.currentTarget === e.target) {
					confirmModalClose(modal);
				}
			});
		}
	});

	lQuery("#closeExit").livequery("click", function () {
		$("#exitConfirmationModal").hide();
	});
	lQuery("#confirmExit").livequery("click", function () {
		$("#exitConfirmationModal").hide();
		closeallemdialogs();
		trackKeydown = false;
	});

	lQuery(".entityclose").livequery("mousedown", function (event) {
		event.preventDefault();
		var targetModal = $(this).closest(".modal");
		confirmModalClose(targetModal);
	});

	lQuery(".trim-text").livequery(function (e) {
		var text = $(this).text();
		var check = $(this).closest(".entitymetadatamodal");
		if (check.length > 0) {
			text = text.replace(/</g, "&lt;");
			text = text.replace(/>/g, "&gt;");
			text = text.replace(/(\r\n|\n|\r)/gm, "<br>");
			$(this).html(text);
			return;
		}
		$(this).on("click", function (e) {
			if (
				e.target.classList.contains("see-more") ||
				e.target.classList.contains("see-less")
			) {
				e.stopPropagation();
			}
		});
		var maxLength = $(this).data("max");
		if (text.length <= maxLength) return;
		var minimizedText = text.substring(0, maxLength).trim();
		minimizedText = minimizedText.replace(/</gm, "&lt;");
		minimizedText = minimizedText.replace(/>/gm, "&gt;");
		minimizedText = minimizedText.replace(/(\r\n|\n|\r)/gm, "<br>");
		$(this).html(minimizedText);
		$(this).data("text", text);
		var btn = $(this).parent().find(".see-more");
		btn.html(btn.data("seemore"));
	});

	lQuery(".see-more-btn").livequery("click", function (e) {
		e.preventDefault();
		e.stopImmediatePropagation();
		var textParent = $(this).prev(".trim-text");
		var text = textParent.data("text");
		if (!text) {
			$(this).remove();
			return;
		}
		if ($(this).hasClass("see-more")) {
			text = text.replace(/</gm, "&lt;");
			text = text.replace(/>/gm, "&gt;");
			textParent.html(text.replace(/(\r\n|\n|\r)/gm, "<br>"));
			//textParent.append('<button class="see-less">(...see less)</button>');
			$(this).removeClass("see-more").addClass("see-less");
			$(this).html($(this).data("seeless"));
		} else {
			var maxLength = textParent.data("max");
			if (!maxLength || !text) {
				$(this).remove();
				return;
			}
			var minimizedText = text.substring(0, maxLength).trim();
			minimizedText = minimizedText.replace(/<br>/gm, "\n");
			minimizedText = minimizedText.replace(/</gm, "&lt;");
			minimizedText = minimizedText.replace(/>/gm, "&gt;");
			minimizedText = minimizedText.replace(/(\r\n|\n|\r)/gm, "<br>");
			textParent.html(minimizedText);
			$(this).removeClass("see-less").addClass("see-more");
			$(this).html($(this).data("seemore"));
		}
	});

	lQuery(".see-more-tags-btn").livequery("click", function (e) {
		e.preventDefault();
		e.stopImmediatePropagation();
		var tagsParent = $(this).prev(".tageditor-viewer");
		if ($(this).hasClass("see-more")) {
			$(".seelesstags", tagsParent).css("display", "inline-block");
			$(this).removeClass("see-more").addClass("see-less");
			$(this).html($(this).data("seeless"));
		} else {
			$(".seelesstags", tagsParent).hide();
			$(this).removeClass("see-less").addClass("see-more");
			$(this).html($(this).data("seemore"));
		}
	});

	lQuery("#searchInput").livequery(function () {
		var input = $(this);
		var options = input.data();

		input.on("keyup", function (e) {
			if (e.key.length > 1 || e.key === " ") {
				return;
			}
			var query = input.val().trim();
			options["query"] = query;
			if (!query || query.length < 2) {
				searchInputEmpty.css("display", "block");
				searchLoading.css("display", "none");
				searchNoResult.css("display", "none");
				searchResult.html("");
				searchResultPlaceholder.css("display", "block");
				return;
			} else {
				searchInputEmpty.css("display", "none");
			}

			var loaderTimeout = setTimeout(function () {
				searchLoading.css("display", "flex");
			}, 250);

			if (lastTypeahead) {
				lastTypeahead.abort();
			}

			lastTypeahead = $.ajax({
				url: options.typeaheadurl,
				async: true,
				data: {
					...options,
				},
				timeout: 5000,
				success: function (data) {
					data = data.trim();
					if (data) {
						searchResultPlaceholder.css("display", "none");
						searchResult.html(data);
						searchNoResult.css("display", "none");
					} else {
						searchResult.html("");
						searchNoResult.css("display", "block");
						searchResultPlaceholder.css("display", "block");
					}
				},
				complete: function () {
					clearTimeout(loaderTimeout);
					searchLoading.css("display", "none");
				},
			});
		});
	});

	lQuery(".toggleCheckbox").livequery("change", function (e) {
		var container1 = $(this).data("container1");
		var container2 = $(this).data("container2");
		$("#" + container1 + ", #" + container2).toggleClass("d-none");
	});
});

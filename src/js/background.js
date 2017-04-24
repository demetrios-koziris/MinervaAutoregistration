//jshint esversion: 6


chrome.runtime.onInstalled.addListener(function (details) {

	let currentVersion = chrome.runtime.getManifest().version;

	if (details.reason === "install") {
		console.log("Installed Minerva Autoregistration version " + currentVersion);
		chrome.tabs.create({url: "https://demetrios-koziris.github.io/MinervaAutoregistration"}, function (tab) {
			console.log("New tab launched with https://demetrios-koziris.github.io/MinervaAutoregistration");
		});
	}
	else if (details.reason === "update") {
		let previousVersion = details.previousVersion;
		console.log("Updated Minerva Autoregistration from version " + previousVersion + " to version " + currentVersion);
	}
	
	chrome.runtime.onUpdateAvailable.addListener(function(details) {
	  console.log("Ready to update to version " + details.version);
	  chrome.runtime.reload();
	});
});


// If default popup not set in manifest, clicking the extension icon will load the following page
chrome.browserAction.onClicked.addListener(function(tab) {
	chrome.tabs.create({'url': "https://demetrios-koziris.github.io/MinervaAutoregistration/", 'selected': true});
});
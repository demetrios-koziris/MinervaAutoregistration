/*
Minerva Autoregistration is a Chrome Extension that makes autoregistration possible in Minerva
Copyright (C) 2017 Demetrios Koziris

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License 
as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied 
warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more details.

A copy of the GNU General Public License is provided in the LICENSE.txt file along with this program.  
The GNU General Public License can also be found at <http://www.gnu.org/licenses/>.
*/

//jshint esversion: 6


var url = window.location.href;

let devMode = !('update_url' in chrome.runtime.getManifest());
let logForDebug = ( devMode ? console.log.bind(window.console) : function(){} );
logForDebug("Minerva Autoregistration Debug mode is ON");

var notpermittedMessage = 'Minerva indicates that you are not permitted to register at this time or that this term is not available for registration processing. Please check Minerva to verify this.';
var notloggedinMessage = 'You must be already signed in to Minvera in order to use this feature. Please sign in and then return to this page.';
var defaultErrorMessage = 'Minerva Autoregistration encountered an error while trying to run.';
var courseParsingError = 'McGill Autoregistation encountered an error while trying to parse the submitted course information. Please make sure you are following the correct format and rules.';
var initializationError = 'McGill Autoregistation encountered an error trying to find this course in Minerva. The CRN codes may not be associated with this course, the course or the CRN codes may not exist, or there may be some other error.';
var courseRegistrationError = 'McGill Autoregistation encountered an error while trying to register you for this course.';
var crnMaxMessage = 'There is a maximum of 10 CRN codes that can be submitted in one registration. McGill Enhanced will attempt registration for the first 10 CRN codes detected.';
var pleaseReloadErrorMessage = 'ERROR ENCOUNTERED! Please Reload Minerva Autoregistration!';
var minervaLogin = 'https://horizon.mcgill.ca/pban1/twbkwbis.P_WWWLogin';

var attemptIntervalTime = 15;
var minFreq = 5;
var nextAttemptInterval;


if (url.match(/.+demetrios\-koziris\.github\.io\/MinervaAutoregistration/) && !url.match(/.+demetrios\-koziris\.github\.io\/MinervaAutoregistration\/updating/)||
	url.match(/file\:\/\/\/C\:\/Users\/Demetrios\/GitHub\/MARpage\/MinervaAutoregistration/) && !url.match(/file\:\/\/\/C\:\/Users\/Demetrios\/GitHub\/MARpage\/MinervaAutoregistration\/updating/)) {

	let requires = document.getElementById('requires-message');
	logForDebug('requires.getAttribute(\'version\'): ' + requires.getAttribute('version'));	
	let currentVersion = chrome.runtime.getManifest().version;
	logForDebug('currentVersion: ' + currentVersion);	
	logForDebug(cmpVersions(currentVersion, requires.getAttribute('version')));

	if(cmpVersions(requires.getAttribute('version'), currentVersion) > 0) {
		requires.innerHTML = '<h2>Requires version '+ requires.getAttribute('version') +'</h2><p>You have Minerva Autoregistration version '+ currentVersion +' installed. To update, please go to your extension settings page (chrome://extensions/) or go (Chrome Menu -> Settings -> Extensions), check the Developer mode box in the top right-hand corner, and then click the \'Update extensions now\' button (<a href="https://www.howtogeek.com/64525/how-to-manually-force-google-chrome-to-update-extensions/">Update Instructions Here</a>).</p><div style="text-align:center"><img src="https://www.howtogeek.com/wp-content/uploads/2016/09/dev-mode-2-1.png"></div>';
	}
	else {
		requires.style.display = 'none';
		let logo = document.getElementById('logo-div');
		logo.style.opacity = '0.1';
		document.getElementById('main_content').append(logo);
	
		populateInputWithURLParams();
	
		document.getElementById('results-div').style.display = 'inline';
		document.getElementById('course-div').style.display = 'inline';
		document.getElementById('mar-run-button').style.display = 'inline';
		document.getElementById('results-div').style.display = 'inline';

		setupAutoregistration();
	}
}

function setupAutoregistration() {
	//Define function to execute when autoregister event dispactched
	document.addEventListener('autoregister', function(data) {
		try {
			let course = parseCourse();
			logForDebug(course);
			logForDebug(attemptIntervalTime);

			let minervaCourseURL = "https://horizon.mcgill.ca/pban1/bwskfcls.P_GetCrse_Advanced?rsts=dummy&crn=dummy&term_in=" + course.term + "&sel_subj=dummy&sel_day=dummy&sel_schd=dummy&sel_insm=dummy&sel_camp=dummy&sel_levl=dummy&sel_sess=dummy&sel_instr=dummy&sel_ptrm=dummy&sel_attr=dummy&sel_subj=" + course.subj + "&sel_coll=&sel_crse=" + course.numb + "&sel_title=&sel_schd=&sel_from_cred=&sel_to_cred=&sel_levl=&sel_ptrm=%25&sel_instr=%25&sel_attr=%25&begin_hh=0&begin_mi=0&begin_ap=a&end_hh=0&end_mi=0&end_ap=a&path=1&SUB_BTN=&";
			checkCRNsInMinerva(course, minervaCourseURL);		
		}
		catch(err) {
			console.log(err.stack);
			alert(err.message);
		}
	});
}

function checkCRNsInMinerva(course, minervaCourseURL) {

	const xmlRequestInfo = {
		method: 'GET',
		action: 'xhttp',
		url: minervaCourseURL
	};
	logForDebug(xmlRequestInfo);

	chrome.runtime.sendMessage(xmlRequestInfo, function(data) {
		try {
			htmlParser = new DOMParser();
			htmlDoc = htmlParser.parseFromString(data.responseXML, 'text/html');
			logForDebug(htmlDoc);

			if (htmlDoc.getElementById('mcg_id_submit')) {
				redirect(notloggedinMessage, minervaLogin);
			}
			else {
				let rows = htmlDoc.getElementsByClassName('datadisplaytable')[0].rows;
				let minervaCRNs = [];
				for (let r = 0; r < rows.length; r++) {
					let cols = rows[r].getElementsByClassName('dddefault');
					if (cols.length === 20) {
						minervaCRNs.push(cols[1].firstChild.innerText);
					}
				}
				logForDebug(minervaCRNs);

				if (!isSubSet(new Set(course.crns), new Set(minervaCRNs))) {
					throw new MyError('Submitted CRNs [' + course.crns + '] do not match those found in Minerva for course ' + course.name + ': [' + minervaCRNs + ']');
				}
				else {
					initializeAutoRegistration(course, minervaCourseURL);
				}
			}
		}
		catch (err) {
			console.log(err.stack);
			alert(initializationError + '\nERROR: ' + err.message);
		}
	});
}

function initializeAutoRegistration(course, minervaCourseURL) {
	try {
		disableTextInput();
		setRunButtonToReload();
		
		let attemptRegistration = generateAttemptRegistrationFunction(course, minervaCourseURL);
		//initial attempt
		logToResults('Initiating Minerva Autoregistration for ' + course.name + ' ' + course.term + ' [' +  course.crns + ']');
		setTimeout( attemptRegistration, 1*1000);
	}
	catch (err) {
		console.log(err.stack);
		alert(err.message);
	}
}

function generateAttemptRegistrationFunction(course, minervaCourseURL) {
	function attemptRegistration() {
		logToResults('Preparing Registration Attempt for ' + course.name + ' ' + course.term + ' [' +  course.crns + ']', true);
		
		const xmlRequestInfo = {
			method: 'GET',
			action: 'xhttp',
			url: minervaCourseURL
		};
		logForDebug(xmlRequestInfo);

		chrome.runtime.sendMessage(xmlRequestInfo, function(data) {
			try {
				htmlParser = new DOMParser();
				htmlDoc = htmlParser.parseFromString(data.responseXML, 'text/html');
				// logForDebug(htmlDoc);

				if (htmlDoc.getElementById('mcg_id_submit')) {
					throw new MyError('You are no longer logged into Minerva!');
				}
				else {
					let rows = htmlDoc.getElementsByClassName('datadisplaytable')[0].rows;
					let minervaSeats = {};
					for (let r = 0; r < rows.length; r++) {
						let cols = rows[r].getElementsByClassName('dddefault');
						if (cols.length === 20) {
							let minervaCRN = cols[1].firstChild.innerText;
							minervaSeats[minervaCRN] = cols[12].innerText;
						}
					}
					logForDebug(minervaSeats);

					seatsForAllCRNs = true;
					zeroSeatCRNs = [];
					seatsMessage = "Checking seat availability in Minerva:";
					for (let i = 0; i < course.crns.length; i++) {
						let seats = minervaSeats[course.crns[i]];
						if ( seats <= '0') {
							zeroSeatCRNs.push(course.crns[i]);
							seatsForAllCRNs = false;
						}
						seatsMessage += "<br>CRN " + course.crns[i] + ': ' + seats + ' seats available.';
					}
					if (!seatsForAllCRNs) {
						seatsMessage += '<br>CRNs [' + zeroSeatCRNs + '] have no seats avaiable. Will not proceed with registration attempt.<br>';
						logToResults(seatsMessage);
						setNextAttempt(course, minervaCourseURL);
					}
					else {
						seatsMessage += '<br>All CRNs have seats avaiable. Proceeding with registration attempt.<br>';
						logToResults(seatsMessage);
						register(course);
					}
				}
			}
			catch (err) {
				console.log(err.stack);
				logToResults('<br>' + pleaseReloadErrorMessage + '<br>' + err.message, true);
				alert(courseRegistrationError + '\nERROR: ' + err.message);
			}
		});
	}
	return attemptRegistration;
}

function setNextAttempt(course, minervaCourseURL) {
	let currentTime = new Date().getTime();
	let offsetSeconds = (Math.floor(Math.random()*2*(attemptIntervalTime*10))-(attemptIntervalTime*10))
	let nextAttemptTime = currentTime + (attemptIntervalTime*60)*1000 + offsetSeconds*1000;
	logForDebug(offsetSeconds);
	logForDebug(getTimeRemaining(nextAttemptTime));

  	nextAttemptInterval = setInterval(generateWaitForNextAttemptFunction(nextAttemptTime, course, minervaCourseURL), 200);
}

function generateWaitForNextAttemptFunction(nextAttemptTime, course, minervaCourseURL) {
	let timerLabel = document.getElementById('timer-label');
	timerLabel.style.display = 'inline-block';
	let timerValue = document.getElementById('timer-value');
	timerValue.innerText = getTimeRemaining(nextAttemptTime);
	timerValue.style.display = 'inline-block';

	function waitForNextAttempt() {
		let timeRemaining = getTimeRemaining(nextAttemptTime);
		if (timeRemaining != '00:00') {
			timerValue.innerText = timeRemaining;
		}
		else {
			timerLabel.style.display = 'none';
			timerValue.style.display = 'none';
			clearInterval(nextAttemptInterval);
			let attemptRegistration = generateAttemptRegistrationFunction(course, minervaCourseURL);
			setTimeout( attemptRegistration, 1*1000);
		}
	}
	return waitForNextAttempt;
}

function register(course) {
	logToResults('Attempting Registration for ' + course.name + ' ' + course.term + ' [' +  course.crns + ']', true);

	const minervaRegister = 'https://horizon.mcgill.ca/pban1/bwskfreg.P_AltPin?term_in=' + course.term;
	logForDebug(minervaRegister);
	const xmlRequestInfo = {
		method: 'GET',
		action: 'xhttp',
		url: minervaRegister
	};
	console.log(xmlRequestInfo);

	chrome.runtime.sendMessage(xmlRequestInfo, function(data) {
		try {
			htmlParser = new DOMParser();
			htmlDoc = htmlParser.parseFromString(data.responseXML, 'text/html');
			// logForDebug(htmlDoc);

			infotext = htmlDoc.getElementsByClassName('infotext')[0].innerText.trim(" ");
			if (infotext.includes('Please select one of the following login methods.')) {
				throw new MyError('You are no longer logged into Minerva!');
			}
			else if (infotext.includes('You are not permitted to register at this time.') ||
				     infotext.includes('Term not available for Registration processing.')) {
				throw new MyError(notpermittedMessage);
			}
			else {
				const crnCodes = course.crns;
				registrationForm = htmlDoc.getElementsByTagName('form')[1];
				logForDebug(registrationForm);
				logForDebug($(registrationForm).serialize().split('&'));

				for (let c = 0; c < crnCodes.length && c < 10; c++) {
					htmlDoc.getElementById('crn_id'+(c+1)).value = crnCodes[c];
				}
				logForDebug(registrationForm);
				logForDebug($(registrationForm).serialize().split('&'));

				if (crnCodes.length > 10) {
					alert(crnMaxMessage);
				}
				regURL = 'https://horizon.mcgill.ca/pban1/bwckcoms.P_Regs?' + $(registrationForm).serialize() + '&REG_BTN=Submit+Changes';
				logForDebug(regURL);
				window.open(regURL, '_blank').focus();
			}
		}
		catch (err) {
			console.log(err.stack);
			logToResults('<br>' + pleaseReloadErrorMessage + '<br>' + err.message, true);
			alert(courseRegistrationError + '\nERROR: ' + err.message);
		}
	});
}


//// FUNCTIONS THAT RETURN TO MAIN CONTROL FLOW 

function populateInputWithURLParams() {
	let defaultParams = {
		term: '201901',
		subj: 'MATH',
		numb: '262',
		crns: '3009 12046',
		freq: '15'
	};

	let urlParams = getUrlVars();
	logForDebug(urlParams);

	for (let key in defaultParams) {
		if (key in urlParams) {
			if (key === 'crns') {
				urlParams[key] = urlParams[key].replace(/\%20/g, ' ');
			}
			document.getElementById('course-'+key).value = urlParams[key];
		}
		else {
			document.getElementById('course-'+key).value = defaultParams[key];
		}
	}
}

function parseCourse() {
	try {

		let courseTerm = document.getElementById('course-term').value;
		if (courseTerm == null || !(courseTerm.match(/^20[0-9]{2}0[159]{1}$/))) {
			throw new MyError('Parsing registration term "' + courseTerm + '" from input field failed.');
		}
		
		let courseSubject = document.getElementById('course-subj').value;
		if (courseSubject == null || !(courseSubject.match(/^[A-Z]{3}[A-Z0-9]{1}$/))) {
			throw new MyError('Parsing course subject "' + courseSubject + '" from input field failed.');
		}

		let courseNumber = document.getElementById('course-numb').value;
		if (courseNumber == null || !(courseNumber.match(/^[0-9]{3}$/))) {
			throw new MyError('Parsing course number "' + courseNumber + '" from input field failed.');
		}
		
		let courseCRNs = document.getElementById('course-crns').value.split(' ');
		if (courseCRNs.some(x => x == null || !(x.match(/^[0-9]{3,5}$/)))) {
			throw new MyError('Parsing course CRNs "' + courseCRNs + '" from input field failed.');
		}

		let courseFreq = document.getElementById('course-freq').value;
		if (courseFreq == null || courseFreq < minFreq) {
			throw new MyError('Registration Frequency must not be less than ' + minFreq + ' minutes.');
		}

		attemptIntervalTime = courseFreq;
		let course = {
			term: courseTerm,
			subj: courseSubject,
			numb: courseNumber,
			name: courseSubject + '-' + courseNumber,
			crns: courseCRNs
		};
		return course;
	}
	catch (err) {
		throw new MyError(courseParsingError + '\nERROR: ' + err.message);
	}
}

function disableTextInput() {
	document.getElementById('course-term').disabled = true;
	document.getElementById('course-subj').disabled = true;
	document.getElementById('course-numb').disabled = true;
	document.getElementById('course-crns').disabled = true;
	document.getElementById('course-freq').disabled = true;
}

function setRunButtonToReload() {

	let urlParams = {
		term: document.getElementById('course-term').value,
		subj: document.getElementById('course-subj').value,
		numb: document.getElementById('course-numb').value,
		crns: document.getElementById('course-crns').value,
		freq: document.getElementById('course-freq').value
	};
	let newURL = 'https://demetrios-koziris.github.io/MinervaAutoregistration/' + '?';
	for (let param in urlParams) {
		newURL += param + '=' + urlParams[param] + '&';
	}

	let runButton = document.getElementById('mar-run-button');
	runButton.className += ' reset-mode'; 
	runButton.innerText = 'Reset Minerva Autoregistration';
	runButton.title = 'Click to stop/reset Minerva Autoregistration.';
	runButton.setAttribute('onclick', 'location.href="' + newURL + '"');

	let reloadButton = runButton.cloneNode(true);
	runButton.style.display = 'none';
	document.getElementById('button-div').append(reloadButton);
}


//// FUNCTIONS FOR ERROR HANDLING AND NOTIFYING

function redirect(message, url) {
	alert(message);
	window.open(url, '_blank');
}

function logToResults(message, bold) {
	let resultsBox = document.getElementById('results-box');
	let resultsLength = resultsBox.children.length;
	let first = resultsLength === 0;
	message = (new Date().toLocaleString('en-US', { timeZone: 'America/Montreal' })) + ": " + message;
	console.log(message);
	let newMessageP = document.createElement('p');
	newMessageP.id = 'resultslog-' + resultsLength;
	if (first) {
		message = '<h3>' + message + '</h3>';
	}
	else if (bold) {
		message = '<h4>' + message + '</h4>';
	}
	newMessageP.innerHTML = message;
	resultsBox.append(newMessageP);
	location.href = '#' + newMessageP.id;
}

function MyError() {
	var temp = Error.apply(this, arguments);
	temp.name = this.name = 'MyError';
	this.message = temp.message;
	if (Object.defineProperty) {
		Object.defineProperty(this, 'stack', { 
			get: function() {
				return temp.stack;
			},
			configurable: true // so you can change it if you want
		});
	}
	else {
		this.stack = temp.stack;
	}
}


//// FUNCTION SERVING AS UTILS

function isSubSet(as, bs) {
    for (var a of as) if (!bs.has(a)) return false;
    return true;
}

function getTimeRemaining(nextAttemptTime) {
	var timeRemaining = nextAttemptTime - new Date().getTime();
	if (timeRemaining > 0) {
		let seconds = Math.floor((timeRemaining / 1000) % 60);
		let minutes = Math.floor((timeRemaining / 1000 / 60));
		return ('0' + minutes).slice(-2) + ':' + ('0' + seconds).slice(-2) ;
	}
	else {
		return '00:00';
	}
}

function getUrlVars() {
    var vars = [], hash;
    var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');

    for(var i = 0; i < hashes.length; i++)
        {
         hash = hashes[i].split('=');
         vars.push(hash[0]);
         vars[hash[0]] = hash[1];
         }

     return vars;
}

function cmpVersions (a, b) {
    var i, diff;
    var regExStrip0 = /(\.0+)+$/;
    var segmentsA = a.replace(regExStrip0, '').split('.');
    var segmentsB = b.replace(regExStrip0, '').split('.');
    var l = Math.min(segmentsA.length, segmentsB.length);

    for (i = 0; i < l; i++) {
        diff = parseInt(segmentsA[i], 10) - parseInt(segmentsB[i], 10);
        if (diff) {
            return diff;
        }
    }
    return segmentsA.length - segmentsB.length;
}
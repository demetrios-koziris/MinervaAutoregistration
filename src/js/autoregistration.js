//jshint esversion: 6


var url = window.location.href;

let devMode = !('update_url' in chrome.runtime.getManifest());
let logForDebug = ( devMode ? console.log.bind(window.console) : function(){} );
logForDebug("Minerva Autoregistration Debug mode is ON");


var notpermittedMessage = 'Minerva indicates that you are not permitted to register at this time or that this term is not available for registration processing. Please check Minerva to verify this.';
var notloggedinMessage = 'You must be already signed in to Minvera in order to use this feature. Please sign in and then return to this page.';
var defaultErrorMessage = 'Minerva Autoregistration encountered an error while trying to run.';
var courseParsingError = 'McGill Autoregistation encountered an error while trying to parse the submitted course information. Please make sure you are following the correct format.';
var initializationError = 'McGill Autoregistation encountered an error trying to find this course in Minerva. The CRN codes may not be associated with this course, the course or the CRN codes may not exist, or there may be some other error.';
var courseRegistrationError = 'McGill Autoregistation encountered an error while trying to register you for this course.';
var crnMaxMessage = 'There is a maximum of 10 CRN codes that can be submitted in one registration. McGill Enhanced will attempt registration for the first 10 CRN codes detected.';
var pleaseReloadErrorMessage = 'ERROR ENCOUNTERED! Please Reload Minerva Autoregistration!';
var minervaLogin = 'https://horizon.mcgill.ca/pban1/twbkwbis.P_WWWLogin';
var attemptIntervalTime = 3;
var nextAttemptInterval;

if (url.match(/.+demetrios\-koziris\.github\.io\/MinervaAutoregistration/)) {

	document.getElementById('requires-message').style.display = 'none';
	document.getElementById('mar-run-button').style.display = 'inline';
	document.getElementById('results-div').style.display = 'inline';

	setupAutoregistration();
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

function setupAutoregistration() {
	//Define function to execute when autoregister event dispactched
	document.addEventListener('autoregister', function(data) {
		try {
			let course = parseCourse();
			logForDebug(course);

			let minervaCourseURL = "https://horizon.mcgill.ca/pban1/bwskfcls.P_GetCrse_Advanced?rsts=dummy&crn=dummy&term_in=" + course.term + "&sel_subj=dummy&sel_day=dummy&sel_schd=dummy&sel_insm=dummy&sel_camp=dummy&sel_levl=dummy&sel_sess=dummy&sel_instr=dummy&sel_ptrm=dummy&sel_attr=dummy&sel_subj=" + course.department + "&sel_coll=&sel_crse=" + course.number + "&sel_title=&sel_schd=&sel_from_cred=&sel_to_cred=&sel_levl=&sel_ptrm=%25&sel_instr=%25&sel_attr=%25&begin_hh=0&begin_mi=0&begin_ap=a&end_hh=0&end_mi=0&end_ap=a&path=1&SUB_BTN=&";
			checkCRNsInMinerva(course, minervaCourseURL);		
		}
		catch(err) {
			console.log(err.stack);
			alert(err.message);
		}
	});
}

function parseCourse() {
	try {
		let course = { name: document.getElementById('course-name').value };

		let courseDepartment = course.name.split('-')[0];
		if (courseDepartment == null || !(courseDepartment.match(/^[A-Z]{3}[A-Z0-9]{1}$/))) {
			throw new MyError("Parsing course department from input field failed.");
		}
		course.department = courseDepartment;

		let courseNumber = course.name.split('-')[1];
		if (courseNumber == null || !(courseNumber.match(/^[0-9]{3}$/))) {
			throw new MyError("Parsing course number from input field failed.");
		}
		course.number = courseNumber;

		let courseCRNs = document.getElementById('course-codes').value.split(' ');
		if (courseCRNs.some(x => x == null || !(x.match(/^[0-9]{3,4}$/)))) {
			throw new MyError("Parsing course CRNs from input field failed.");
		}
		course.crns = courseCRNs;

		let courseTerm = document.getElementById('course-term').value;
		if (courseTerm == null || !(courseTerm.match(/^20[0-9]{2}0[159]{1}$/))) {
			throw new MyError("Parsing course term from input field failed.");
		}
		course.term = courseTerm;
		return course;
	}
	catch (err) {
		throw new MyError(courseParsingError + '\nERROR: ' + err.message);
	}
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

			infotext = htmlDoc.getElementsByClassName('infotext')[0].innerText.trim(" ");
			if (infotext.includes('Please select one of the following login methods.')) {
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

				if (!subSet(new Set(course.crns), new Set(minervaCRNs))) {
					throw new MyError('Submitted CRNs [' + course.crns + '] do not match those found in Minerva for course ' + course.name + '.');
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
		setRunButtonToReload();
		disableTextInput();
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

				infotext = htmlDoc.getElementsByClassName('infotext')[0].innerText.trim(" ");
				if (infotext.includes('Please select one of the following login methods.')) {
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
					seatsMessage = "Checking seat availability in Minerva:";
					for (let i = 0; i < course.crns.length; i++) {
						let seats = minervaSeats[course.crns[i]];
						if ( seats === '0') {
							seatsForAllCRNs = false;
						}
						seatsMessage += "<br>CRN " + course.crns[i] + ': ' + seats + ' seats available.';
					}
					if (!seatsForAllCRNs) {
						seatsMessage += '<br>Since not all CRNs have seats avaiable, will not attempt registration.<br>';
						logToResults(seatsMessage);
						setNextAttempt(course, minervaCourseURL);
					}
					else {
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
	let nextAttemptTime = currentTime + attemptIntervalTime*60*1000 + (Math.floor(Math.random()*60)-30)*1000;
  	nextAttemptInterval = setInterval(generateWaitForNextAttemptFunction(nextAttemptTime, course, minervaCourseURL), 1000);
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

function redirect(message, url) {
	alert(message);
	window.open(url, '_blank');
}

function setRunButtonToReload() {
	let runButton = document.getElementById('mar-run-button');
	runButton.style.background = '#db8e8e';
	runButton.innerText = 'Reset Minerva Autoregistration';
	runButton.title = 'Click to stop/reset Minerva Autoregistration by reloading the page.';
	runButton.setAttribute('onclick', 'location.reload();');

	let reloadButton = runButton.cloneNode(true);
	runButton.style.display = 'none';
	document.getElementById('button-div').append(reloadButton);
}

function disableTextInput() {
	document.getElementById('course-name').disabled = true;
	document.getElementById('course-codes').disabled = true;
	document.getElementById('course-term').disabled = true;
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

function subSet(as, bs) {
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
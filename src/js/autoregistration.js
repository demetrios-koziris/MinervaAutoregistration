//jshint esversion: 6


var url = window.location.href;

let devMode = !('update_url' in chrome.runtime.getManifest());
let logForDebug = ( devMode ? console.log.bind(window.console) : function(){} );
logForDebug("Minerva Autoregistration Debug mode is ON");

var notloggedinMessage = 'You must be already signed in to Minvera in order to use this feature. Please sign in and then return to this page.';
var defaultErrorMessage = 'Minerva Autoregistration encountered an error while trying to run.';
var courseParsingError = 'McGill Autoregistation encountered an error while trying to parse the submitted course information. Please make sure you are following the correct format.'
var minervaLogin = 'https://horizon.mcgill.ca/pban1/twbkwbis.P_WWWLogin';


if (url.match(/.+demetrios\-koziris\.github\.io\/MinervaAutoregistration/)) {

	let requiresParagraph = document.getElementById('requires-message');
	requiresParagraph.style.display = 'none';
	let runButton = document.getElementById('mar-run-button');
	runButton.style.display = 'inline';

	setupAutoregistration();
}


function setupAutoregistration() {
	//Define function to execute when autoregister event dispactched
	document.addEventListener('autoregister', function(data) {
		try {
			let course = parseCourse();
			logForDebug(course);
			
			


			setRunButtonToReload();
		}
		catch(err) {
			console.log(err.stack);
			alert(err.message);
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
	runButton.innerText = 'Reload Minerva Autoregistration';
	runButton.title = 'Click to stop/reset Minerva Autoregistration by reloading the page.';
	runButton.setAttribute('onclick', 'location.reload();');

	let reloadButton = runButton.cloneNode(true);
	runButton.style.display = 'none';
	document.getElementById('button-div').append(reloadButton);
}

function parseCourse() {
	try {
		let course = {};
		let courseName = document.getElementById('course-name').value;

		let courseDepartment = courseName.split('-')[0];
		if (courseDepartment == null || !(courseDepartment.match(/^[A-Z]{3}[A-Z0-9]{1}$/))) {
			throw new MyError("Parsing course department from input field failed.");
		}
		course.name = courseName;

		let courseNumber = courseName.split('-')[1];
		if (courseNumber == null || !(courseNumber.match(/^[0-9]{3}$/))) {
			throw new MyError("Parsing course number from input field failed.");
		}
		course.number = courseNumber;

		let courseCRNs = document.getElementById('course-codes').value.split(' ');
		if (courseCRNs.some(x => x == null || !(x.match(/^[0-9]{4}$/)))) {
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
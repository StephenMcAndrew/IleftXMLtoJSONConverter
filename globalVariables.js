/*********************************************
*   This file contains all global variables
**********************************************/

let theTestPlan; // The main testplan object that we will build up from the parsed data in the .planxml files
let testPlanName = "Stephens-Development-TestPlan";
let svnConfigPath = "http://vcs.gentex.com/svn/testers/deployment/exports/products/iLEFT";
let projectPath = ""; // The local directory the .planxml files arr checked out to

// Variables needed for the HTTP request to get the bearer token
let bearerToken; //The bearer token that will be used for the mutation http request
let xhr_Auth = new XMLHttpRequest();
const xhr_TPE_Mutation = new XMLHttpRequest();
let TPE_endpoint = "https://testplaneditor-qa.gentex.com/"; 

let selectedINIs = []; //An array of all the selected ini files
let selectedFiles = []; //An array of all the selected  .planxml files

let output1 = document.getElementById("output1");


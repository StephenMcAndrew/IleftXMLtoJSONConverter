/*********************************************
*   This file contains all global variables
**********************************************/

let theTestPlan; // The main testplan object that we will build up from the parsed data in the .planxml files
let testPlanName = "Stephens-Development-TestPlan";
//let testPlanName = "ILEFT_DEBUG"
let svnConfigPath = "http://vcs.gentex.com/svn/testers/deployment/exports/products/iLEFT";
let projectPath = ""; // The local directory the .planxml files are checked out to
let isCalTestplan = false;

// Variables needed for the HTTP request to get the bearer token
let bearerToken; //The bearer token that will be used for the mutation http request
let xhr_Auth = new XMLHttpRequest();
const xhr_TPE_Mutation = new XMLHttpRequest();
//let TPE_endpoint = "https://testplaneditor.gentex.com/"; //Prod endpoint
let TPE_endpoint = "https://testplaneditor-qa.gentex.com/"; //QA endpoint
//let TPE_endpoint = "http://c-it001-46631.gentex.com:3001/" //JR's machine

if(TPE_endpoint == "https://testplaneditor.gentex.com/") {
    document.getElementById("app_key").value = "IleftXMLtoJSONConverter";
}

let selectedINIs = []; //An array of all the selected ini files
let selectedFiles = []; //An array of all the selected  .planxml files

let output1 = document.getElementById("output1");


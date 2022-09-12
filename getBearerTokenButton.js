/******************************************************************************************************************
*   This file contains all the code related to getting the bearer token needed to send the GraphQL JSON mutation
*******************************************************************************************************************/

let bearerToken; //The bearer token that will be used for the mutation http request
let username; //The valid user name entered by the user
let app_key; //The app specific key needed when making the http request to get the bearer token
let xhr_Auth = new XMLHttpRequest();
let url_Auth; 

function onGetBearerToken() {

  // Get the username and app specific key from the input boxes
  username = document.getElementById("username").value;
  app_key = document.getElementById("app_key").value;

  // Alert the user if either the user name or app key inputs are missing
  if(username == "" || app_key == "") {
    alert("Enter \"User name\" and \"App key\" first.");
    return 0;
  }
  
  // Construnct the url and send the HTTP request to get the bearer token 
  url_Auth = "https://testplaneditor-qa.gentex.com/auth/graphql?user_name=" + username + "&app_specific_key=" + app_key;
  xhr_Auth.open("POST", url_Auth);
  xhr_Auth.send();
}

// Parse the HTTP request response to get the bearer token
xhr_Auth.addEventListener("readystatechange", function() {
  if(this.readyState == 4 && this.status == 200) {
    bearerToken = JSON.parse(this.responseText).token;
    document.getElementById("tokenOut").value = bearerToken;
  }
});

// Coppy the bearer token when the coppy button is pressed
function copyText() {
 var copiedText = document.getElementById("tokenOut").value;

 if (copiedText == "")
 {
    alert("Bearer token is blank. Click the \"Get Bearer Token\" button first.");
    return;
 }

  // Copy the text inside the text field
  navigator.clipboard.writeText(copiedText);

  // Alert the user the text has been copied
  alert("The bearer token has been copied.");
}



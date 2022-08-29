//------------Brearer Token------------//

let bearerToken;
let username;
let app_key;
let xhr_Auth = new XMLHttpRequest();
let url_Auth;

function onGetBearerToken() {

  username = document.getElementById("username").value;
  app_key = document.getElementById("app_key").value;

  if(username == "" || app_key == "") {
    alert("Enter \"User name\" and \"App key\" first.");
    return 0;
  }
  
  url_Auth = "https://testplaneditor-qa.gentex.com/auth/graphql?user_name=" + username + "&app_specific_key=" + app_key;
  xhr_Auth.open("POST", url_Auth);
  xhr_Auth.send();
}

xhr_Auth.addEventListener("readystatechange", function() {
  if(this.readyState == 4 && this.status == 200) {
    bearerToken = JSON.parse(this.responseText).token;
    document.getElementById("tokenOut").value = bearerToken;
  }
});

function copyText() {
 var copiedText = document.getElementById("tokenOut").value;

 if (copiedText == "")
 {
    alert("Bearer token is blank. Click the \"Get Bearer Token\" button first.");
    return;
 }

   /* Copy the text inside the text field */
  navigator.clipboard.writeText(copiedText);

  /* Alert the copied text */
  alert("The bearer token has been copied.");
}



const fileSelector = document.getElementById('file-selector');
const reader = new FileReader();
let dataToSend;
let fileData;
fileSelector.addEventListener("change", function() {
        const file = this.files[0];
        console.log(file);

        const reader = new FileReader();
        reader.readAsText(file);
        reader.onload = function() {
            fileData = reader.result;
            document.getElementById("output1").value = fileData;
          };
    });

const xhr_TPE = new XMLHttpRequest();
const url_TPE =  "https://testplaneditor-qa.gentex.com/graphql";

function onSubmitFile() {
  xhr_TPE.open("POST", url_TPE);
  xhr_TPE.setRequestHeader("Authorization","Bearer " + bearerToken);
  xhr_TPE.setRequestHeader("Content-Type", "application/json");
  dataToSend = {query: fileData, variables: {}}
  xhr_TPE.send(JSON.stringify(dataToSend));
  
}

xhr_TPE.addEventListener("readystatechange", function() {
  if(this.readyState === 4) {
    document.getElementById("output1").value = this.responseText;
  }
});



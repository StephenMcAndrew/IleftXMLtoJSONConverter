/******************************************************************************************************************
*   This file contains all the code related to submitting the converted JSON file to the database
*******************************************************************************************************************/

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
    output1.value = this.responseText;
  }
});
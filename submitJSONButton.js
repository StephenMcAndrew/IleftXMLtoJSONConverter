/******************************************************************************************************************
*   This file contains all the code related to submitting the converted JSON file to the database
*******************************************************************************************************************/

let fileData;
const xhr_TPE = new XMLHttpRequest();
const url_TPE =  "https://testplaneditor-qa.gentex.com/graphql";

function onSubmitFile() {
  
  //Open the XHR object to make the json request and set the needed header info
  xhr_TPE.open("POST", url_TPE);
  xhr_TPE.setRequestHeader("Authorization","Bearer " + bearerToken);
  xhr_TPE.setRequestHeader("Content-Type", "application/json");

  theTestPlanJSstr = JSONstr_To_JSstr(templateTPDocStr);

  const my_uuid = uuid_api.get();
  let metaDataStr = `jobUuid: "${my_uuid}", metadata: { revisionLabel: "", commitMessage: "Commit through GraphQL Mutation", softwareVersion: "1.0.0"}`;
  
  let dataToSend = {query: "mutation {saveTestPlanDocument( domain: Engineering, document: " + theTestPlanJSstr + ", " + metaDataStr + ")}", variables: {}};
  console.log(JSON.stringify(dataToSend));
  document.getElementById("output1").value = JSON.stringify(dataToSend);
  xhr_TPE.send(JSON.stringify(dataToSend));
  
}

//This function takes a JSON string (eg. all object keys are strings with quotes around them) and 
// convertes it to a JavaScript object string (eg. removes the quotes around the keys).
// We need this because the mutation JSON contains the testplan document as a sting in this format
const JSONstr_To_JSstr = (JSONstr) => JSONstr.replace(/("[A-Za-z0-9]+":)/g, (match) => match.replace(/"/g,''))


xhr_TPE.addEventListener("readystatechange", function() {
  if(this.readyState === 4) {
    output1.value = this.responseText;
  }
});

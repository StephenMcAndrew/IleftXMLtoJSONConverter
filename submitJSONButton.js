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

  //theTestPlanJSstr = JSONstr_To_JSstr(templateTPDocStr);
  theTestPlanJSstr = theTestPlan.getDocObjAsJSstr();

  const my_uuid = uuid_api.get();
  let metaDataStr = `jobUuid: "${my_uuid}", metadata: { revisionLabel: "", commitMessage: "Commit through GraphQL Mutation", softwareVersion: "1.0.0"}`;
  
  let dataToSend = {query: "mutation {saveTestPlanDocument( domain: Engineering, document: " + theTestPlanJSstr + ", " + metaDataStr + ")}", variables: {}};
  
  document.getElementById("output1").value = theTestPlan.getDocObjAsJSstr(true);
  //xhr_TPE.send(JSON.stringify(dataToSend));
  
}

xhr_TPE.addEventListener("readystatechange", function() {
  if(this.readyState === 4) {
    output1.value = this.responseText;
  }
});

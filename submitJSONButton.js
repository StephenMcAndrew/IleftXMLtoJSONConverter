/******************************************************************************************************************
*   This file contains all the code related to submitting the converted JSON file to the database
*******************************************************************************************************************/

let fileData;
const xhr_TPE_Mutation = new XMLHttpRequest();
const url_TPE =  "https://testplaneditor-qa.gentex.com/graphql";

function onSubmitFile() {
  
  //Open the XHR object to make the json request and set the needed header info
  xhr_TPE_Mutation.open("POST", url_TPE);
  xhr_TPE_Mutation.setRequestHeader("Authorization","Bearer " + bearerToken);
  xhr_TPE_Mutation.setRequestHeader("Content-Type", "application/json");

  //theTestPlanJSstr = JSONstr_To_JSstr(templateTPDocStr);
  theTestPlanJSstr = theTestPlan.getDocObjAsJSstr();

  //Get the uuid and create the meta data string
  const my_uuid = uuid_api.get();
  let metaDataStr = `jobUuid: "${my_uuid}", metadata: { revisionLabel: "", commitMessage: "Commit through GraphQL Mutation", softwareVersion: "1.0.0"}`;
  
  //Put it all together to create the data to seld
  let dataToSend = {query: "mutation {saveTestPlanDocument( domain: Engineering, document: " + theTestPlanJSstr + ", " + metaDataStr + ")}", variables: {}};
  
  document.getElementById("output1").value = theTestPlan.getDocObjAsJSstr(true);
  xhr_TPE_Mutation.send(JSON.stringify(dataToSend));
}

xhr_TPE_Mutation.addEventListener("readystatechange", function() {
  if(this.readyState === 4) {
    output1.value = this.responseText;
  }
});

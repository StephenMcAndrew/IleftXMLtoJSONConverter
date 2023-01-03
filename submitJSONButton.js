/******************************************************************************************************************
*   This file contains all the code related to submitting the converted JSON file to the database
*******************************************************************************************************************/
function onSubmitFile() {

   //Force add any new config files and commit to svn
   svn.add(`${projectPath}\\generatedConfig`);
  
  //Open the XHR object to make the json request and set the needed header info
  xhr_TPE_Mutation.open("POST", TPE_endpoint + "graphql");
  xhr_TPE_Mutation.setRequestHeader("Authorization","Bearer " + bearerToken);
  xhr_TPE_Mutation.setRequestHeader("Content-Type", "application/json");

  //theTestPlanJSstr = JSONstr_To_JSstr(templateTPDocStr);
  theTestPlanJSstr = theTestPlan.getDocObjAsJSstr();

  //Get the uuid and create the meta data string
  const my_uuid = uuid_api.get();
  let metaDataStr = `jobUuid: "${my_uuid}", metadata: { revisionLabel: "", commitMessage: "Commit through GraphQL Mutation", softwareVersion: "1.0.0"}`;

  //console.log(createMutationStr(my_uuid));
  
  //Put it all together to create the data to seld
  let dataToSend = {query: "mutation {saveTestPlanDocument( domain: Engineering, document: " + theTestPlanJSstr + ", " + metaDataStr + ")}", variables: {}};
  
  document.getElementById("output1").value = theTestPlan.getDocObjAsJSstr(true);
  //console.log(JSON.stringify(dataToSend, null, 2))
  xhr_TPE_Mutation.send(JSON.stringify(dataToSend));

  //submit the config data
  svn.commit(`${projectPath}\\generatedConfig`);
}

xhr_TPE_Mutation.addEventListener("readystatechange", function() {
  if(this.readyState === 4) {
    output1.value = this.responseText;
  }
});

function createMutationStr(my_uuid) {
  let mutationStr = 
  `mutation {
    saveTestPlanDocument (
      domain: Engineering,
      document: ${theTestPlan.getDocObjAsJSstr(true)},
      jobUuid: "${my_uuid}",
      metadata: {
        revisionLabel: "",
        commitMessage: "Commit through GraphQL Mutation",
        softwareVersion: "1.0.0"
      }
    )
  }`
  return mutationStr;
}
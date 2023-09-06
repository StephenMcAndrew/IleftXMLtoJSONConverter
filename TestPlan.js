
class TestPlan {

  constructor(testBinary) {

    // The user name from the input field
    this.username = document.getElementById("username").value;

    // The testplan javascript object 
    this.DocObj = JSON.parse(this.templateTPDocStr(this.username))
    
    this.libraryName; //The main test methods library name. i.e., not "ileft.testmethods.instrumentscontrol".
    this.partNumbers; //An array of all the partnumbers
    this.ecoNumsMaster = new Set(); //A list of all the ECO numbers

    this.ipteRunnerSub_ID; 

    // This is used to keep track of which groupID and bindingCallID goes with which measurement caller
    // Map{[key => MeasurementCallerName value => {library: libraryName, groupID: groupID, bindingCallID: bindingCallID}]}
    this.measurementCallerMap = new Map();

    /* Used to keep track of the wich IDs go with which groups and evaluations. Also keeps tack of each evaluations limits. 
    // If the evaluation is a LIMITCHECK, the boundLimitsMap tells us with limits go with which partnumbers
    {
      groupName: {
        groupID: groupID,
        subTests: map{ 
			    [
				    key => subTestName
				    value => {
					    subTestID: SubTestID,
					    lowLimit: lowLimit,
					    value: value,
					    highLimit: highLimit,
					    type: "LIMITCHECK",
				    	boundLimitsMap: Map{[key => partNumber value => {lowLimit: lowLimit, highLimit: highLimit, value: value}]}
				    }
			    ],
			    ...
		    }
      },
      ...
    }
    */
    this.groupAndEvalMap = {};

    // We treat data collection methods and evaluations differetly. They are generated at regular methods/evaluations rather then measurement type methods/evaluations. This is a list of all the data collect methods iLeft uses 
    this.dataCollectionMethods = ["MyBarCode", "GetExpectedFirmwarePartNumberValue", "GetExpectedFpgaFirmwarePartNumberValue", "GetExpectedOverlayPartNumberValue", "GetExpectedOpsManagerPartNumberValue", 
    "ImagerRead316Number", "GetExpectedFirmwareSVNRevision", "GetExpectedOverlaySVNRevision", "VerifyIctPartNumber_RD", "VerifyIctPartNumber", "WriteIctPartNumber", "LotNumber", "GetExpectedFirmwareCrcPartNumberValue",
    "VerifyLaserPartNumber", "GetExpectedTechwellConfigPartNumberValue", "GenericTest"]
  }

  // This method takes a JSON string and converts it to a JavaScript object string. I.g, it removes the "" from the object porperty names.
  static JSONstr_To_JSstr(JSONstr) { return JSONstr.replace(/("[A-Za-z0-9_]+":)/g, (match) => match.replace(/"/g,'')); }

  // Return the the test plan documant as a JavaScript string.
  getDocObjAsJSstr(pretty = false) { return pretty ?  TestPlan.JSONstr_To_JSstr(JSON.stringify(this.DocObj, null, 2)) : TestPlan.JSONstr_To_JSstr(JSON.stringify(this.DocObj)); }

  /* Add all the measurement caller subroutines needed based on the what is used in the selected .planxml files.
  *
  * Param: dciGenLibrariesInfo => A map of the test binary names to the DCIGen info
  * Param: testPlanMethods => An object that hold the master list of all testMethods used from each test binary
  */
  addMeasurementCallers(dciGenLibrariesInfo, testPlanMethods) {

    let bundleNumber = 1; //Keeps track of the number of bundles used in the testplan so we can name them in the doc object
    const universalPartNumberChildren = []; //Keeps track of the groupIDs associated with the measurement subroutines so we can add them as children of the UVPN in the doc obj structure
    const masterListOfFuncNames = []; //Keeps track of all the measurement caller subroutine names used in the doc objec
    const masterListOfLibraries = []; //Keep track of all the libraries used so we can create the bundle management property

    if(isCalTestplan ) {
      //If it doesn't have a main library, it's one of the cal testplans and only uses instrumentcontrol
      this.libraryName = "ileft.testmethods.instrumentcontrol";
    }

    //Loop through each DCIGen library used in the testplans
    dciGenLibrariesInfo.forEach((libraryData, libName) => {

      //Set the testplan's main library name. We'll use this when when creating the init, load, unload, and teardown phases.
      //I'm assuming a testplan only evey uses instrumentcontrol, iptehandler, and it's main product library
      if(libName != "ileft.testmethods.instrumentcontrol" && libName != "ileft.platform.iptehandler" && libName != "gtm.utilities.subversionclient" && libName != "gtm.utilities.qtui") {
        this.libraryName = libName;
      }
    
      //Add the bundle property to the universal part number
      let bundleName = libName + "." + libraryData.versionNumber + "-" + libraryData.platformName;
      masterListOfLibraries.push(bundleName);
      this.DocObj.elements.universalPartNumber.properties["bundle" + bundleNumber.toString()] = this.generateBaseProperty(bundleName, "string", "");
      bundleNumber++;

      // Don't add any meathods fom the iptehandler or the subversionclient library. That's handled when the init, load, unload, and teardown phases are added.
      if(libName != "ileft.platform.iptehandler" && libName != "gtm.utilities.subversionclient" && libName != "gtm.utilities.qtui") {

        //Loop through all the functions in the DCIGen library
        libraryData.functions.forEach(func => {

          //If the function is used in the testplans, we need to add a measurement caller for it
          if (testPlanMethods[libName].includes(func.name)) {
            //Creat the group and binding call ids
            let groupID = this.getGroupID();
            let bindingCallID = this.getBindingCallID();
    
            //Creat the poperty objects
            let MeasurementCallerProps = {};
            let BindingCallProps = {};
    
            //We need each measurement caller to have a unique name. If the testplan is using more then one test binary library, we get get duplicate name.
            let functionName = func.name;
            let i = 2;
            while(masterListOfFuncNames.includes(functionName)){
              functionName = functionName + `_${i.toString()}`;
              i++;
            }
            masterListOfFuncNames.push(functionName); //Keep track of all the used function names
            //Keep track of all the measurement caller names and what library they use. We'll need this when we start adding the subtest evaluations.
            this.measurementCallerMap.set(functionName, {library: libName, groupID: groupID, bindingCallID: bindingCallID}); 
            
            //Generate the measurement caller and binding call properties from the DCIGen params
            func.params.forEach(param => {

              let paramType = (param.type == "bool") ? "boolean" : param.type;
              let measDescription = (param.direction == "OUT" || param.direction == "RETURN") ? "[OUTPUT]" : "[INPUT]";
              let bindingDescription = (param.description + " " + measDescription).trim();

              let measParamValue;
              let bindingParamValue;
  
              //Make sure the measurement and binding call value properties are bound correctly based on whether they are an input or output
              //Make sure the default values are set to the correct type
              if(param.direction == "OUT" || param.direction == "RETURN") {
                measParamValue = `${groupID}.${param.name}`;
  
                if(param.type == "string") {
                  bindingParamValue = "";
                }
                else if(param.type == "int") {
                  bindingParamValue = 0;
                }
                else if(param.type == "double") {
                  bindingParamValue = 0.0;
                }
                else if(param.type == "bool" || param.type == "boolean") {
                  bindingParamValue = false;
                }  
              }
              else {
                bindingParamValue = `${groupID}.${param.name}`;
  
                if(param.name == "arrayIndex" || param.name == "arrayIndexStr") { 
                  bindingParamValue = "%index%";
                }
                else if(param.type == "int") {
                  measParamValue = parseInt(param.default);
                }
                else if (param.type == "double") {
                  measParamValue = parseFloat(param.default);
                }
                else if (param.type == "bool" || param.type == "boolean") {
                  measParamValue = (param.default === 'true' || param.default === '1');
                }
                else {
                  measParamValue = param.default;
                }
              }
                  
              //None of these binding call params are currently use, so we will not add them to the measurement caller group
              if ((param.name != "arrayIndex") && (param.name != "arrayIndexStr") && (param.name != "deferredResults") && (param.name != "formattedResults") && (param.name != "success") && (param.name != "result"))
              {
                //Rename the measurementResult param from the binding call to just measurementResult if needed
                if(param.name == "measurementResultParameter" || param.name == "measurementResultOut" || param.name == "measurementResult") {
                  MeasurementCallerProps["measurementResult"] = this.generateBaseProperty(`${bindingCallID}.${param.name}`, "string", measDescription);
                }
                else {
                  //Create the measurement call subroutine property
                  MeasurementCallerProps[param.name] = this.generateBaseProperty(measParamValue, paramType, measDescription);
                }
              }
              //Creat the bindingcall property
              BindingCallProps[param.name] = this.generateBaseProperty(bindingParamValue, paramType, bindingDescription);
            });
    
            //Create the measurement caller subroutine
            this.DocObj.elements[groupID] = this.generateBaseGroup("group", functionName, "universalPartNumber", "Init", MeasurementCallerProps, true);
            this.DocObj.elements[groupID].retry = this.generateBaseProperty(0, "builtin", "");
            this.DocObj.elements[groupID].loop = this.generateBaseProperty(0, "builtin", "");
  
            //Create the binding call
            this.DocObj.elements[bindingCallID] = this.generateBaseBindingCall("bindingCall", functionName, groupID, "Init", true, BindingCallProps, libName, func.name, true);
      
            //Add the measurement subroutine and binding call to the doc object structure
            this.DocObj.structure[groupID] = this.generateBaseStructure("group", [bindingCallID]);
            this.DocObj.structure[bindingCallID] = this.generateBaseStructure("bindingCall", []);
      
            //Add the measurement call groupID to the list of UPN children
            universalPartNumberChildren.push(groupID);
          }
  
        });
      }
    })

    //Create the bundlemanagement universalPartNumber property
    let bundleManagementValue = "\"";
    masterListOfLibraries.forEach(library => {
      if(library.startsWith("ileft.platform.iptehandler")) {
        bundleManagementValue += `windows-x32-any AKA ipteHandler { ${library} }; `
      } 
      else if(library.startsWith("ileft.testmethods.instrumentcontrol")) {
        bundleManagementValue += `windows-x32-any AKA instruments { ${library} }; `
      } 
      else if(library.startsWith("gtm.utilities.subversionclient")) {
        bundleManagementValue += `windows-x32-vc10 AKA svnClient { ${library} }; `
      }
      else if(library.startsWith("gtm.utilities.qtui")) {
        bundleManagementValue += `windows-x32-vc10 AKA qtui { ${library} }; `
      }
      else {
        bundleManagementValue += `windows-x32-any AKA productLibrary { ${library} }; `
      }
    });
    bundleManagementValue = bundleManagementValue.trim() + "\"";
    this.DocObj.elements.universalPartNumber.bundlemanagement = this.generateBaseProperty(bundleManagementValue, "builtin", "");
  
    //Add all the measurement call subroutine groupIDs to the list of UPN children
    this.DocObj.structure.universalPartNumber.children = this.DocObj.structure.universalPartNumber.children.concat(universalPartNumberChildren);
  }

  /*
  *
  *
  * 
  */
  addInitAndLoad(dciGenLibrariesInfo) {

    //Get the library data for the main project library
    let projectLibraryData = dciGenLibrariesInfo.get(this.libraryName);
    let ipteLibraryData = dciGenLibrariesInfo.get("ileft.platform.iptehandler");
    let subversionclientLibraryData = dciGenLibrariesInfo.get("gtm.utilities.subversionclient");
    let qtuiLibraryData = dciGenLibrariesInfo.get("gtm.utilities.qtui");

    //Generate all the IDs for the init phases
    let Init_FixtureCheck_GroupID = this.getGroupID();
    let ReadJigIDsID = this.getBindingCallID();
    let ValidateJigIDsID = this.getEvaluationID();

    let Init_Exports_GroupID = this.getGroupID();
    let RemoveDirID = this.getBindingCallID();
    let DefaultStationExportID = this.getBindingCallID();

    let Init_ProductLib_GroupID = this.getGroupID();
    let SetupID = this.getBindingCallID();

    let Init_IpteRunnerActive_GroupID = this.getGroupID();
    let CallProcessRunning_ipte_runnerID = this.getEvaluationID();
    let IpteRunnerSubroutine_GroupID = this.getGroupID();
    this.ipteRunnerSub_ID = IpteRunnerSubroutine_GroupID;
    let IsProcessActiveID = this.getBindingCallID();
    let NotifyIfNotRunningIpteRunnerID = this.getEvaluationID();
    let DisplayMessageBoxID = this.getBindingCallID();

    let Init_IPTE_GroupID = this.getGroupID();
    let RunInitializeID = this.getBindingCallID();
    
    //Generate all the IDs for the load phases
    let Load_StartOfTests_GroupID = this.getGroupID();
    let StartOfTestsID = this.getBindingCallID();;

    let Load_IpteRunnerActive_GroupID = this.getGroupID();
    let CallProcessRunning_ipte_runnerID_2 = this.getEvaluationID();

    let Load_IpteWaitForReadyToTest_GroupID = this.getGroupID();
    let RunWaitForReadyToTestID = this.getBindingCallID();

    //We need to add the ProcessRunning_ipte-runner sub routine
    let ipteSubProps = {ipteActive: this.generateBaseProperty(false, "boolean", "")};

    this.DocObj.elements[IpteRunnerSubroutine_GroupID] = this.generateBaseGroup("group", "ProcessRunning_ipte-runner", "universalPartNumber", "Init", ipteSubProps, true);
    this.DocObj.elements[IpteRunnerSubroutine_GroupID].retry = this.generateBaseProperty(0, "builtin", "");
    this.DocObj.elements[IpteRunnerSubroutine_GroupID].loop = this.generateBaseProperty(0, "builtin", "");

    this.DocObj.structure[IpteRunnerSubroutine_GroupID] = this.generateBaseStructure("group", [IsProcessActiveID, NotifyIfNotRunningIpteRunnerID, DisplayMessageBoxID]);
    this.DocObj.structure.universalPartNumber.children.push(IpteRunnerSubroutine_GroupID);

    let IsPorcessActiveParams = this.genPhaseBCProps(ipteLibraryData.functions.get("IsProcessActive").params);
    IsPorcessActiveParams.processName.value = "ipte-runner.exe";

    this.DocObj.elements[IsProcessActiveID] = this.generateBaseBindingCall("bindingCall", "IsProcessActive", IpteRunnerSubroutine_GroupID, "Init", false, IsPorcessActiveParams, "ileft.platform.iptehandler", "IsProcessActive", false)
    this.DocObj.structure[IsProcessActiveID] = this.generateBaseStructure("bindingCall", []);

    let NotifyIpteScript = 
    `runtime.passed = false;

${DisplayMessageBoxID}.skipped = false;
${IpteRunnerSubroutine_GroupID}.ipteActive = ${IsProcessActiveID}.processActive;
    
if( ${IsProcessActiveID}.processActive )
{
  ${DisplayMessageBoxID}.skipped = true;
}
    
runtime.passed = true;`;

    let NotifyIpteEval= this.generateBaseGroup("evaluation", "NotifyIfRunningIpteRunner", IpteRunnerSubroutine_GroupID, "Init", {}, false);
    NotifyIpteEval.evaluationType = this.generateBaseProperty("SCRIPTED", "builtin", "");
    NotifyIpteEval.lowLimit = this.generateBaseProperty("0", "builtin", "");
    NotifyIpteEval.highLimit = this.generateBaseProperty("0", "builtin", "");
    NotifyIpteEval.value = this.generateBaseProperty("0", "builtin", "");
    NotifyIpteEval.runtimeResume = this.generateBaseProperty(false, "builtin", "");
    NotifyIpteEval.updateTestMetrics = this.generateBaseProperty(false, "builtin", "");
    NotifyIpteEval.onEvaluate = this.generateBaseProperty(NotifyIpteScript, "builtin", "");
   
    this.DocObj.elements[NotifyIfNotRunningIpteRunnerID] = NotifyIpteEval;
    this.DocObj.structure[NotifyIfNotRunningIpteRunnerID] = this.generateBaseStructure("evaluation", []);

    let DisplayMessageBoxIDParams = this.genPhaseBCProps(qtuiLibraryData.functions.get("DisplayMessageBox").params);
    DisplayMessageBoxIDParams.cancelButton.value = false;
    DisplayMessageBoxIDParams.closable.value = false;
    DisplayMessageBoxIDParams.mType.value = "critical";
    DisplayMessageBoxIDParams.text.value = "Please launch ipte-runner.exe";
    DisplayMessageBoxIDParams.title.value = "Critical Warning";

    this.DocObj.elements[DisplayMessageBoxID] = this.generateBaseBindingCall("bindingCall", "DisplayMessageBox", IpteRunnerSubroutine_GroupID, "Init", false, DisplayMessageBoxIDParams, "gtm.utilities.qtui", "DisplayMessageBox", false);
    this.DocObj.structure[DisplayMessageBoxID] = this.generateBaseStructure("bindingCall", []);

    //Setup Init_FixtureCheck group
    this.DocObj.elements[Init_FixtureCheck_GroupID] = this.generateBaseGroup("group", "Init_FixtureCheck", "universalPartNumber", "Init", {}, false);
    this.DocObj.structure[Init_FixtureCheck_GroupID] = this.generateBaseStructure("group", [ReadJigIDsID, ValidateJigIDsID]);
    this.DocObj.structure.universalPartNumber.children.push(Init_FixtureCheck_GroupID);

    //Create ReadJigIDs binding Call
    this.DocObj.elements[ReadJigIDsID] = this.generateBaseBindingCall("bindingCall", "ReadJigIDs", Init_FixtureCheck_GroupID, "Init", false, this.genPhaseBCProps(ipteLibraryData.functions.get("ReadJigIDs").params), "ileft.platform.iptehandler", "ReadJigIDs", false);
    this.DocObj.structure[ReadJigIDsID] = this.generateBaseStructure("bindingCall", []);

    let ValidateJigIDsScript = 
    `runtime.passed = true;
    
currentJigSet = "";
var expectedJigs = configuration.fixtureId;
var jigArray = expectedJigs.split( "," );
var currentTop = ${ReadJigIDsID}.jigTop;
var currentBot = ${ReadJigIDsID}.jigBottom;
    
__report__.log( "Expected Jig Ids Raw: " + expectedJigs );
__report__.log( "Jig Array size: " + jigArray.length );
__report__.log( "Current Top Jig: " + currentTop );
__report__.log( "Current Bot Jig: " + currentBot );
    
//Remove any zero padding from current jigs
while( currentTop.substring(0,1) == "0" ) {
  currentTop = currentTop.slice(1);
  //__report__.log( "Current Top Jig Sliced: " + currentTop );
}
    
while( currentBot.substring(0,1) == "0" ) {
  currentBot = currentBot.slice(1);
  //__report__.log( "Current Bot Jig Sliced: " + currentBot );
}
    
// Add "0x" to currentTop and currentBot
currentTop = "0x" + currentTop;
currentBot = "0x" + currentBot;
    
//Top and Bottom Fixture Ids must match
if( currentTop != currentBot ) {
  __report__.log( "Current Top Jig: " + currentTop + " does not match current bottom jig: " + currentBot );
  runtime.passed = false;
}
    
// Check if current fixtures are found in expected fixture list
if( !jigArray.includes( currentTop ) ) {
  __report__.log( "Current Jig Set: " + currentTop + " does not exist in list of expected fixtures: " + expectedJigs );
  runtime.passed = false;
}
    
if( runtime.passed ) {
  currentJigSet = currentTop + "," + currentBot;
  __report__.log("Current Jig Set: " + currentJigSet );
}`;
   
    //Create ValidateJigIDs evaluation Call
    let ValidateJigIDsEval= this.generateBaseGroup("evaluation", "ValidateJigIDs", Init_FixtureCheck_GroupID, "Init", {}, false);
    ValidateJigIDsEval.evaluationType = this.generateBaseProperty("SCRIPTED", "builtin", "");
    ValidateJigIDsEval.lowLimit = this.generateBaseProperty("0", "builtin", "");
    ValidateJigIDsEval.highLimit = this.generateBaseProperty("0", "builtin", "");
    ValidateJigIDsEval.value = this.generateBaseProperty("0", "builtin", "");
    ValidateJigIDsEval.runtimeResume = this.generateBaseProperty(false, "builtin", "");
    ValidateJigIDsEval.updateTestMetrics = this.generateBaseProperty(true, "builtin", "");
    ValidateJigIDsEval.onEvaluate = this.generateBaseProperty(ValidateJigIDsScript, "builtin", "");
    ValidateJigIDsEval.currentJigSet = this.generateBaseProperty("ValidateJigIDsScript", "string", "[OUTPUT]");

   
    this.DocObj.elements[ValidateJigIDsID] = ValidateJigIDsEval;
    this.DocObj.structure[ValidateJigIDsID] = this.generateBaseStructure("evaluation", []);

    //Setup the Init_Exports group
    this.DocObj.elements[Init_Exports_GroupID] = this.generateBaseGroup("group", "Init_Exports", "universalPartNumber", "Init", {}, false);
    this.DocObj.structure[Init_Exports_GroupID] = this.generateBaseStructure("group", [RemoveDirID, DefaultStationExportID]);
    this.DocObj.structure.universalPartNumber.children.push(Init_Exports_GroupID);

    //Create the RemoveDir binding Call
    let RemoveDirProps = this.genPhaseBCProps(projectLibraryData.functions.get("RemoveDir").params);
    RemoveDirProps.dirName.value = "C:\\tester\\iLEFT";

    this.DocObj.elements[RemoveDirID] = this.generateBaseBindingCall("bindingCall", "RemoveDir", Init_Exports_GroupID, "Init", false, RemoveDirProps, this.libraryName, "RemoveDir", false);
    this.DocObj.structure[RemoveDirID] = this.generateBaseStructure("bindingCall", []);

    //Create the DefaultStationExport binding call
    this.DocObj.elements[DefaultStationExportID] = this.generateBaseBindingCall("bindingCall", "DefaultStationExport", Init_Exports_GroupID, "Init", false, this.genPhaseBCProps(subversionclientLibraryData.functions.get("DefaultStationExport").params), "gtm.utilities.subversionclient", "DefaultStationExport", false);
    this.DocObj.structure[DefaultStationExportID] = this.generateBaseStructure("bindingCall", []);
  
    //Set up the Init_ProductLib group
    this.DocObj.elements[Init_ProductLib_GroupID] = this.generateBaseGroup("group", "Init_ProductLib", "universalPartNumber", "Init", {}, false);
    this.DocObj.structure[Init_ProductLib_GroupID] = this.generateBaseStructure("group", [SetupID]);
    this.DocObj.structure.universalPartNumber.children.push(Init_ProductLib_GroupID);

    //Create the Setup binding call
    this.DocObj.elements[SetupID] = this.generateBaseBindingCall("bindingCall", "Setup", Init_ProductLib_GroupID, "Init", false, this.genPhaseBCProps(projectLibraryData.functions.get("Setup").params), this.libraryName, "Setup", false);
    this.DocObj.structure[SetupID] = this.generateBaseStructure("bindingCall", []);
    
    //Setup the Init_IpteRunnerActive group
    this.DocObj.elements[Init_IpteRunnerActive_GroupID] = this.generateBaseGroup("group", "Init_IpteRunnerActive", "universalPartNumber", "Init", {}, false);
    this.DocObj.structure[Init_IpteRunnerActive_GroupID] = this.generateBaseStructure("group", [CallProcessRunning_ipte_runnerID]);
    this.DocObj.structure.universalPartNumber.children.push(Init_IpteRunnerActive_GroupID);

    //Create the CallProcessRunning_ipte-runner evaluation call
    let ipteRunnerEval= this.generateBaseGroup("evaluation", "CallProcessRunner-ipte-runner", Init_IpteRunnerActive_GroupID, "Init", {}, false);
    ipteRunnerEval.evaluationType = this.generateBaseProperty("SCRIPTED", "builtin", "");
    ipteRunnerEval.lowLimit = this.generateBaseProperty("0", "builtin", "");
    ipteRunnerEval.highLimit = this.generateBaseProperty("0", "builtin", "");
    ipteRunnerEval.value = this.generateBaseProperty("0", "builtin", "");
    ipteRunnerEval.runtimeResume = this.generateBaseProperty(false, "builtin", "");
    ipteRunnerEval.updateTestMetrics = this.generateBaseProperty(false, "builtin", "");
    ipteRunnerEval.onEvaluate = this.generateBaseProperty("runtime.passed = true;", "builtin", "");
    ipteRunnerEval.subroutine = this.generateBaseProperty(`${IpteRunnerSubroutine_GroupID}`, "builtin", "");
   
    this.DocObj.elements[CallProcessRunning_ipte_runnerID] = ipteRunnerEval;
    this.DocObj.structure[CallProcessRunning_ipte_runnerID] = this.generateBaseStructure("evaluation", []);
    
    //Set up the Init_IPTE group
    this.DocObj.elements[Init_IPTE_GroupID] = this.generateBaseGroup("group", "Init_IPTE", "universalPartNumber", "Init", {}, false);
    this.DocObj.structure[Init_IPTE_GroupID] = this.generateBaseStructure("group", [RunInitializeID]);
    this.DocObj.structure.universalPartNumber.children.push(Init_IPTE_GroupID);

    //Create the RunInitialize
    let RunInitializeProps = this.genPhaseBCProps(ipteLibraryData.functions.get("RunInitialize").params);
    RunInitializeProps.expectedFixtureIds.value = "configuration.fixtureId";

    this.DocObj.elements[RunInitializeID] = this.generateBaseBindingCall("bindingCall", "RunInitialize", Init_IPTE_GroupID, "Init", false, RunInitializeProps, "ileft.platform.iptehandler", "RunInitialize", false);
    this.DocObj.structure[RunInitializeID] = this.generateBaseStructure("bindingCall", []);

    //------------------------------------------------------------------------

    //Setup the Load_StartOfTests group
    this.DocObj.elements[Load_StartOfTests_GroupID] = this.generateBaseGroup("group", "Load_StartOfTests", "universalPartNumber", "Load", {}, false);
    this.DocObj.structure[Load_StartOfTests_GroupID] = this.generateBaseStructure("group", [StartOfTestsID]);
    this.DocObj.structure.universalPartNumber.children.push(Load_StartOfTests_GroupID);

    //Create the start of tests binding call
    this.DocObj.elements[StartOfTestsID] = this.generateBaseBindingCall("bindingCall", "StartOfTests", Load_StartOfTests_GroupID, "Load", false, this.genPhaseBCProps(projectLibraryData.functions.get("StartOfTests").params), this.libraryName, "StartOfTests", false);
    this.DocObj.structure[StartOfTestsID] = this.generateBaseStructure("bindingCall", []);

    //Setup the Load_IpteRunnerActive group
    this.DocObj.elements[Load_IpteRunnerActive_GroupID] = this.generateBaseGroup("group", "Load_IpteRunnerActive", "universalPartNumber", "Load", {}, false);
    this.DocObj.structure[Load_IpteRunnerActive_GroupID] = this.generateBaseStructure("group", [CallProcessRunning_ipte_runnerID_2]);
    this.DocObj.structure.universalPartNumber.children.push(Load_IpteRunnerActive_GroupID);

    //Create the CallProcessRunning_ipte-runner evaluation call
    let Load_ipteRunnerEval= this.generateBaseGroup("evaluation", "CallProcessRunner-ipte-runner_2", Load_IpteRunnerActive_GroupID, "Load", {}, false);
    Load_ipteRunnerEval.evaluationType = this.generateBaseProperty("SCRIPTED", "builtin", "");
    Load_ipteRunnerEval.lowLimit = this.generateBaseProperty("0", "builtin", "");
    Load_ipteRunnerEval.highLimit = this.generateBaseProperty("0", "builtin", "");
    Load_ipteRunnerEval.value = this.generateBaseProperty("0", "builtin", "");
    Load_ipteRunnerEval.runtimeResume = this.generateBaseProperty(false, "builtin", "");
    Load_ipteRunnerEval.updateTestMetrics = this.generateBaseProperty(false, "builtin", "");
    Load_ipteRunnerEval.onEvaluate = this.generateBaseProperty("runtime.passed = true;", "builtin", "");
    Load_ipteRunnerEval.subroutine = this.generateBaseProperty(`${IpteRunnerSubroutine_GroupID}`, "builtin", "");
   
    this.DocObj.elements[CallProcessRunning_ipte_runnerID_2] = Load_ipteRunnerEval;
    this.DocObj.structure[CallProcessRunning_ipte_runnerID_2] = this.generateBaseStructure("evaluation", []);
    
    //Setup the Load_IpteWaitForReadyToTest group
    this.DocObj.elements[Load_IpteWaitForReadyToTest_GroupID] = this.generateBaseGroup("group", "Load_IpteWaitForReadyToTest", "universalPartNumber", "Load", {}, false);
    this.DocObj.structure[Load_IpteWaitForReadyToTest_GroupID] = this.generateBaseStructure("group", [RunWaitForReadyToTestID]);
    this.DocObj.structure.universalPartNumber.children.push(Load_IpteWaitForReadyToTest_GroupID);

    //Create the start of tests binding call
    this.DocObj.elements[RunWaitForReadyToTestID] = this.generateBaseBindingCall("bindingCall", "RunWaitForReadyTest", Load_IpteWaitForReadyToTest_GroupID, "Load", false, this.genPhaseBCProps(ipteLibraryData.functions.get("RunWaitForReadyToTest").params), "ileft.platform.iptehandler", "RunWaitForReadyToTest", false);
    this.DocObj.structure[RunWaitForReadyToTestID] = this.generateBaseStructure("bindingCall", []);
  }

  addUnloadAndTeardown(dciGenLibrariesInfo) {

    //Get the library data for the main project library
    let projectLibraryData = dciGenLibrariesInfo.get(this.libraryName);
    let ipteLibraryData = dciGenLibrariesInfo.get("ileft.platform.iptehandler");

    //Add a group to log the config data
    let LogConfid_GroupID = this.getGroupID();
    let LogConfigData_ID = this.getBindingCallID();

    this.DocObj.elements[LogConfid_GroupID] = this.generateBaseGroup("group", "LogConfig", "universalPartNumber", "Body", {}, false);
    this.DocObj.structure[LogConfid_GroupID] = this.generateBaseStructure("group", [LogConfigData_ID]);
    this.DocObj.structure.universalPartNumber.children.push(LogConfid_GroupID);

    //Create the LogConfigData binding call
    this.DocObj.elements[LogConfigData_ID] = this.generateBaseBindingCall("bindingCall", "LogConfigData", LogConfid_GroupID, "Body", false, this.genPhaseBCProps(dciGenLibrariesInfo.get(this.libraryName).functions.get("LogConfigData").params), this.libraryName, "LogConfigData", false);
    this.DocObj.structure[LogConfigData_ID] = this.generateBaseStructure("bindingCall", []);

    //Generate all the IDs for the unload phase
    let Unlod_EndOfTest_GroupID = this.getGroupID();
    let EndOfTestsID = this.getBindingCallID();

    let Unload_SendPassFailToIPTE_GroupID = this.getGroupID()
    let DetermineArrayPassFailID = this.getEvaluationID();
    let RunSendArrayPassFailID = this.getBindingCallID();

    //Generate all the IDs for the teardown phase
    let Teardown_GroupID = this.getGroupID();
    let TearDownID = this.getBindingCallID();

    let Teardown_IpteRunnerActive_GroupID = this.getGroupID();
    let CallIpteRunnerID = this.getEvaluationID();

    let Teardown_IpteEndMessage_GroupID = this.getGroupID();
    let RunSendEndMeassageID = this.getGroupID();

    //Setup the Unload_EndOfTests group
    this.DocObj.elements[Unlod_EndOfTest_GroupID] = this.generateBaseGroup("group", "Unload_EndOfTests", "universalPartNumber", "Unload", {}, false);
    this.DocObj.structure[Unlod_EndOfTest_GroupID] = this.generateBaseStructure("group", [EndOfTestsID]);
    this.DocObj.structure.universalPartNumber.children.push(Unlod_EndOfTest_GroupID);

    //Create the EndOfTests binding call
    this.DocObj.elements[EndOfTestsID] = this.generateBaseBindingCall("bindingCall", "EndOfTests", Unlod_EndOfTest_GroupID, "Unload", false, this.genPhaseBCProps(projectLibraryData.functions.get("EndOfTests").params), this.libraryName, "EndOfTests", false);
    this.DocObj.structure[EndOfTestsID] = this.generateBaseStructure("bindingCall", []);
    
    //Setup the Unload_SendPassFailToIPTE group
    this.DocObj.elements[Unload_SendPassFailToIPTE_GroupID] = this.generateBaseGroup("group", "Unload_SendPassFailToIPTE", "universalPartNumber", "Unload", {}, false);
    this.DocObj.structure[Unload_SendPassFailToIPTE_GroupID] = this.generateBaseStructure("group", [DetermineArrayPassFailID, RunSendArrayPassFailID]);
    this.DocObj.structure.universalPartNumber.children.push(Unload_SendPassFailToIPTE_GroupID);

    let PassFailScript = 
    `runtime.passed = false;

var idp = __testMetrics__.isDUTPassing;
var icrp = __testMetrics__.currentRunPassing;
var frp = __testMetrics__.allDUTFormattedResultsPassing();
    
__report__.log( "isDUTPassing: " + idp );
__report__.log( "currentRunPassing: " + icrp );
__report__.log( "formattedResults Passing: " + frp );
    
arrayPassFailStatus = idp && icrp && frp;
    
__report__.log( "arrayPassFailStatus: " + arrayPassFailStatus );
    
runtime.passed = true;`

    //Create the DetermineArrayPassFail evaluation
    let passFailEvalProps = {arrayPassFailStatus: this.generateBaseProperty(false, "boolean", "[OUTPUT] arrayPassFailStatus") };
    let passFailEval = this.generateBaseElement("evaluation", "DetermineArrayPassFail", Unload_SendPassFailToIPTE_GroupID, "Unload", passFailEvalProps)
    passFailEval.evaluationType = this.generateBaseProperty("SCRIPTED", "builtin", "");
    passFailEval.lowLimit = this.generateBaseProperty("0", "builtin", "");
    passFailEval.value = this.generateBaseProperty("0", "builtin", "");
    passFailEval.highLimit = this.generateBaseProperty("0", "builtin", "");
    passFailEval.runtimeResume = this.generateBaseProperty(false, "builtin", "");
    passFailEval.updateTestMetrics = this.generateBaseProperty(false, "builtin", "");
    passFailEval.onEvaluate = this.generateBaseProperty(PassFailScript, "slot", "");

    this.DocObj.elements[DetermineArrayPassFailID] = passFailEval;
    this.DocObj.structure[DetermineArrayPassFailID] = this.generateBaseStructure("evaluation", []);

    //Create the SendArrayPassFail BindingCall
    let sendPassFailProps = this.genPhaseBCProps(ipteLibraryData.functions.get("RunSendArrayPassFail").params);
    sendPassFailProps.arrayPassed.value = DetermineArrayPassFailID + ".arrayPassFailStatus";

    this.DocObj.elements[RunSendArrayPassFailID] = this.generateBaseBindingCall("bindingCall", "SendArrayPassFail", Unload_SendPassFailToIPTE_GroupID, "Unload", false, sendPassFailProps, "ileft.platform.iptehandler", "RunSendArrayPassFail", false);
    this.DocObj.structure[RunSendArrayPassFailID] = this.generateBaseStructure("bindingCall", []);

    //-----------------------------------------------------------------

    //Setup the teardown group
    this.DocObj.elements[Teardown_GroupID] = this.generateBaseGroup("group", "Teardown", "universalPartNumber", "Teardown", {}, false);
    this.DocObj.structure[Teardown_GroupID] = this.generateBaseStructure("group", [TearDownID]);
    this.DocObj.structure.universalPartNumber.children.push(Teardown_GroupID);

    //Create the teardown binding call
    this.DocObj.elements[TearDownID] = this.generateBaseBindingCall("bindingCall", "Teardown", Teardown_GroupID, "Teardown", false, this.genPhaseBCProps(projectLibraryData.functions.get("TearDown").params), this.libraryName, "TearDown", true);
    this.DocObj.structure[TearDownID] = this.generateBaseStructure("bindingCall", []);
   
    //Setup the Teardown_IpteRunnerActive group
    this.DocObj.elements[Teardown_IpteRunnerActive_GroupID] = this.generateBaseGroup("group", "Teardown_IpteRunnerActive", "universalPartNumber", "Teardown", {}, false);
    this.DocObj.structure[Teardown_IpteRunnerActive_GroupID] = this.generateBaseStructure("group", [CallIpteRunnerID]);
    this.DocObj.structure.universalPartNumber.children.push(Teardown_IpteRunnerActive_GroupID);

    //Create the CallProcessRunning_ipte-runner evaluation call
    let Teardown_ipteRunnerEval= this.generateBaseGroup("evaluation", "CallProcessRunner-ipte-runner_3", Teardown_IpteRunnerActive_GroupID, "Teardown", {}, false);
    Teardown_ipteRunnerEval.evaluationType = this.generateBaseProperty("SCRIPTED", "builtin", "");
    Teardown_ipteRunnerEval.lowLimit = this.generateBaseProperty("0", "builtin", "");
    Teardown_ipteRunnerEval.highLimit = this.generateBaseProperty("0", "builtin", "");
    Teardown_ipteRunnerEval.value = this.generateBaseProperty("0", "builtin", "");
    Teardown_ipteRunnerEval.runtimeResume = this.generateBaseProperty(false, "builtin", "");
    Teardown_ipteRunnerEval.updateTestMetrics = this.generateBaseProperty(false, "builtin", "");
    Teardown_ipteRunnerEval.onEvaluate = this.generateBaseProperty("runtime.passed = true;", "builtin", "");
    Teardown_ipteRunnerEval.subroutine = this.generateBaseProperty(`${this.ipteRunnerSub_ID}`, "builtin", "");
   
    this.DocObj.elements[CallIpteRunnerID] = Teardown_ipteRunnerEval;
    this.DocObj.structure[CallIpteRunnerID] = this.generateBaseStructure("evaluation", []);

    //Setup the Teardown_IpteEndMessage group
    this.DocObj.elements[Teardown_IpteEndMessage_GroupID] = this.generateBaseGroup("group", "Teardown_IpteEndMessage", "universalPartNumber", "Teardown", {}, false);
    this.DocObj.structure[Teardown_IpteEndMessage_GroupID] = this.generateBaseStructure("group", [RunSendEndMeassageID]);
    this.DocObj.structure.universalPartNumber.children.push(Teardown_IpteEndMessage_GroupID);

    //Create the RunSendEndMessage binding call
    this.DocObj.elements[RunSendEndMeassageID] = this.generateBaseBindingCall("bindingCall", "RunSendEndMessage", Teardown_IpteEndMessage_GroupID, "Teardown", false, this.genPhaseBCProps(ipteLibraryData.functions.get("RunSendEndMessage").params), "ileft.platform.iptehandler", "RunSendEndMessage", true);
    this.DocObj.structure[RunSendEndMeassageID] = this.generateBaseStructure("bindingCall", []);
  }

  genPhaseBCProps(params, nonDefaultParams = null) {
    let props = {};
    params.forEach(param => {
      let paramType = (param.type == "bool") ? "boolean" : param.type;
      let measDescription = (param.direction == "OUT" || param.direction == "RETURN") ? "[OUTPUT]" : "[INPUT]";
      let bindingDescription = (param.description + " " + measDescription).trim();

      let paramValue;
      if(nonDefaultParams != null){
        paramValue = nonDefaultParams.get(param);
      }
      else {
        paramValue =param.default;
      }

      props[param.name] = this.generateBaseProperty(paramValue, paramType, bindingDescription );
    })

    return props;
  }

  //This should be called every time a new group is created so we increment the group ID number
  getGroupID = (() => {
    let groupIDNumber = 0;
    return () => {groupIDNumber++; return "group" + groupIDNumber.toString();}
  })()

  //This should be called every time a new binding call is created so we increment the binding call ID number
  getBindingCallID = (() => {
    let bindingCallIDNumber = 0;
    return () => {bindingCallIDNumber++; return "bindingCall" + bindingCallIDNumber.toString();}

  })()

  getManagedPartNumberID = (() => {
    let managedPartNumberIDNumber = 0;
    return () => {managedPartNumberIDNumber++; return "managedPartNumber" + managedPartNumberIDNumber.toString();} 
  })()

  getEvaluationID = (() => {
    let evaluationIDNumber = 0;
    return () => {evaluationIDNumber++; return "evaluation" + evaluationIDNumber.toString();}
  })()

  //Every group/binding call obect will have thes properties
  generateBaseElement(type, description = "", parentIdentifier = "", phase = "Body", properties = {}) {
    return {
      type: type,
      description: description,
      modificationTime: newDate.timeNow(),
      parentIdentifier: parentIdentifier,
      phase: phase,
      userName: this.username,
      properties: properties
    }
  }

  generateBaseGroup(type, description, parentIdentifier, phase, properties, skipped) {
    let group = this.generateBaseElement(type, description, parentIdentifier, phase, properties);
    group.skipped = this.generateBaseProperty(skipped, "builtin", "");
    return group;
  }

  generateBaseManagedPartNumber(partNumber, numberOfIndexes){
    let properties = {};

    properties.managed = this.generateBaseProperty("universalPartNumber", "string","" );

    for(let i = 1; i <= numberOfIndexes; i++) {
      properties[`index${i.toString()}`] = this.generateBaseProperty(i.toString(), "int","" );
    }

    let managedPartNumber = this.generateBaseElement("managedPartNumber", `[${partNumber}]`, "station", "", properties );
    delete managedPartNumber.phase;

    managedPartNumber.partNumber = this.generateBaseProperty(partNumber, "string", "");

    managedPartNumber.rows = this.generateBaseProperty(1, "builtin", "");
    
    managedPartNumber.columns = this.generateBaseProperty(numberOfIndexes, "builtin", "");

    //Add the array code properties for threaded indexes. 
    //We do this here because we already have numberOfIndexes and I don't want to change a bunch of stuff  
    this.DocObj.elements.universalPartNumber.arrayType = this.generateBaseProperty("SCRIPTED", "builtin", "");
    this.DocObj.elements.universalPartNumber.arrayCode = this.generateBaseProperty(this.generateArrayCode(numberOfIndexes), "builtin", "");

    return managedPartNumber;
  }

  generateArrayCode(numberOfIndexes) {
    let arrayCode = `\"Array {\\n`

    for(let i = 1; i <= numberOfIndexes; i++) {
      let index = i.toString();
      arrayCode += `    Index { row: 1; column: ${index}; identifier: ${index} }\\n`
    }

    arrayCode += `\\n`;

    for(let i = 1; i <= numberOfIndexes; i++){
      let index = i.toString();
      arrayCode += `    Sequence {\\n        identifier: ${index};\\n        description: \\"Thread ${index}\\";\\n        SerialStep: { steps: [ ${index} ] }\\n    }\\n\\n`        
    }

    arrayCode  = arrayCode.slice(0,-2);

    arrayCode += `}\"`
   
    return arrayCode;
  }

  addPartNumbers(INIs) {

    //We need to keep track of all the part numbers we add so we don't add any more than once
    const masterListOfPartNumbers = [];
    let numberOfIndexes;
   
    //Loop throught the ini files
    INIs.forEach(ini => {
      //Loop through the part number sections in each ini file
      ini.partNumbers.forEach(partNumber => {
        //Get the number of indexes from the ini param
        numberOfIndexes = partNumber.params.get("indexMapping").split(",").length;
        //If this is a part number we have not added yet, add it
        if (!masterListOfPartNumbers.includes(partNumber.seven_o_five)) {
          masterListOfPartNumbers.push(partNumber.seven_o_five);
          //Generate the managed part number and add it to the test plan
          let managedPartNumberID = this.getManagedPartNumberID();
          this.DocObj.elements[managedPartNumberID] = this.generateBaseManagedPartNumber(partNumber.seven_o_five, numberOfIndexes);
          this.DocObj.structure[managedPartNumberID] = this.generateBaseStructure("managedPartNumber", []);

          this.DocObj.elements.universalPartNumber.partNumbers.push(this.generateBaseProperty(partNumber.seven_o_five, "string", ""));

          this.DocObj.structure.station.children.push(managedPartNumberID);
        }
      });
    });

    this.DocObj.elements.universalPartNumber.description = masterListOfPartNumbers.join(", ");
    this.partNumbers = masterListOfPartNumbers;
  }

  addConfiguration(INIs, testPlanArray) {
    let configProps = {};
    const masterConfigArray = [];

    INIs.forEach(ini => {
      ini.partNumbers.forEach(partNumber => {
        partNumber.params.forEach((value, key) => {
          if(!masterConfigArray.includes(key) && key != "description") {
            masterConfigArray.push(key);
            configProps[key] = this.generateBaseProperty("", "string", "");
          }
        })
      })
      ini.sections.forEach(commSection => {
        commSection.params.forEach((value, key) => {
          if(!masterConfigArray.includes(key) && key != "description") {
            masterConfigArray.push(key);
            configProps[key] = this.generateBaseProperty("", "string", "");
          }
        })
      })
    })

    configProps.testerConfigFile = this.generateBaseProperty("", "string", "");
    configProps.nodeMapFile = this.generateBaseProperty("", "string", "");
    configProps.gpDigFile = this.generateBaseProperty("", "string", "");
    configProps.keyenceCommandsetFileName = this.generateBaseProperty("", "string", "");
      
    //Make sure we have a fixture id config. We'll have to manually add these if the inis don't have it.
    if(!configProps.hasOwnProperty("fixtureId")) {
      configProps["fixtureId"] = this.generateBaseProperty("", "string", "");;
    }
  
    //We want to add a "configuration" property to the testplan doc but not the globals/locals doc
    configProps.configuration = this.generateBaseProperty(true, "boolean", "");
  
    this.DocObj.elements.configuration = this.generateBaseElement("configuration", "Configuration", "universalPartNumber", "Init", configProps);
    this.DocObj.structure.universalPartNumber.children.unshift("configuration");
    this.DocObj.structure.configuration = this.generateBaseStructure("configuration", ["configScript"])
  
    this.DocObj.elements.configScript = this.generateBaseElement("evaluation", "configScript", "configuration", "Init", {});
    this.DocObj.elements.configScript.loop = this.generateBaseProperty(0,"builtin", "");
    this.DocObj.elements.configScript.retry = this.generateBaseProperty(0,"builtin", "");
    this.DocObj.elements.configScript.skipped = this.generateBaseProperty(false,"builtin", "");
    this.DocObj.elements.configScript.updateTestMetrics = this.generateBaseProperty(false,"builtin", "");
    this.DocObj.elements.configScript.runtimeResume = this.generateBaseProperty(false,"builtin", "");
    this.DocObj.elements.configScript.value = this.generateBaseProperty("0","builtin", "");
    this.DocObj.elements.configScript.highLimit = this.generateBaseProperty("0.0000e0","builtin", "");
    this.DocObj.elements.configScript.lowLimit = this.generateBaseProperty("0.0000e0","builtin", "");
    this.DocObj.elements.configScript.evaluationType = this.generateBaseProperty("SCRIPTED","builtin", "");
    this.DocObj.elements.configScript.onEvaluate = this.generateBaseProperty("Tue Sep 27 08:21:11 2022","slot", "");
    this.DocObj.structure.configScript = this.generateBaseStructure("evaluation", []);
  
    this.generateConfigFiles(configProps, INIs, testPlanArray);
  }

  generateConfigFiles(configProps, INIs, testPlanArray) {

    let localsMaster = {};

    //Generate the defaults 
    let defaults = {};
    for(var key in configProps) {
      if (configProps.hasOwnProperty(key)) {
        if (key != "configuration"){ defaults[key] = ""; }
      }
    }
  
    //Add the defaults to the localsMaster
    this.partNumbers.forEach(partNum => {
      localsMaster[partNum] = {};
      localsMaster[partNum].Defaults = structuredClone(defaults);
    });

    //Putting everything in the defaults. Making the assumption that we don't have any locked duplicate part numbers for now.
    INIs.forEach(ini => {
      ini.partNumbers.forEach(partNumberSection => {

        let partNum = partNumberSection.seven_o_five;

        partNumberSection.params.forEach((value, key) => {
          if(key != "description") { localsMaster[partNum].Defaults[key] = value; }
        })

        ini.sections.forEach(commSection => {
          commSection.params.forEach((value, key) => { localsMaster[partNum].Defaults[key] = value; })
        })
      })
    })
  
    /*
    INIs.forEach(ini => {     
      ini.partNumbers.forEach(partNumberSection => {
  
        let partNum = partNumberSection.seven_o_five;
        let ecoNum = partNumberSection.params.get("eCNum");
        this.ecoNumsMaster.add(ecoNum);
        let ecoObj = structuredClone(defaults);
  
        partNumberSection.params.forEach((value, key) =>{
          if(key != "description") { ecoObj[key] = value; }
        })
  
        ini.sections.forEach(commSection =>{
          commSection.params.forEach((value, key) =>{
            ecoObj[key] = value;
          })
        })
  
        localsMaster[partNum][ecoNum] = structuredClone(ecoObj);
      })
    })
    */

    //Add the config file key values from the testplan 
      testPlanArray.forEach(testPlan => {
        testPlan.partNumbers.forEach(partNumber => {
          localsMaster[partNumber].Defaults.testerConfigFile = testPlan.testerConfigFile;
          localsMaster[partNumber].Defaults.nodeMapFile = testPlan.nodeMapFile;
          localsMaster[partNumber].Defaults.gpDigFile = testPlan.gpDigFile;
          localsMaster[partNumber].Defaults.keyenceCommandsetFileName = "Keyence_Barcode_Reader.cmdset";
        })
      })

    /*
    //Add the config file key values from the testplan 
      testPlanArray.forEach(testPlan => {
        testPlan.partNumbers.forEach(partNumber => {
          for(let eco in localsMaster[partNumber]) {
            if( eco != "Defaults") {
              localsMaster[partNumber][eco].testerConfigFile = testPlan.testerConfigFile;
              localsMaster[partNumber][eco].nodeMapFile = testPlan.nodeMapFile;
              localsMaster[partNumber][eco].gpDigFile = testPlan.gpDigFile;
              localsMaster[partNumber][eco].keyenceCommandsetFileName = "Keyence_Barcode_Reader.cmdset";
            }
          }
        })
      })
    */


    //TODO this logic is not quite right. If there are multiple locked ECO, we run into issues.
    //I think I need to just throw an error if there are locked ECOs and not convert.

    /*
    let localsMaster_copy = structuredClone(localsMaster);

    // We need to add every ECO to every part number
    this.partNumbers.forEach(partNumber => {

      // Check to see if there is already more than one ECO (besides the Defaults) associated with the part number. If there is, this measn there is a locked ECO.
      let isDoulECO = Object.keys(localsMaster_copy[partNumber]).length > 2;

      // Now we need make sure every part number has every ECO. Every ECO should be the same except if there is a unlocked and locked ECO.
      // If that is the case we need to make sure the other ECOs are copies of the unlocked ECO.
      this.ecoNumsMaster.forEach(ecoNum => {
    
        //Loop through the copy of the global part number
        for(let existingEco in localsMaster_copy[partNumber]){
          if(isDoulECO) {
            if(localsMaster[partNumber][existingEco].ecoReleaseStatus == "true") {
              localsMaster[partNumber][ecoNum] = structuredClone(localsMaster_copy[partNumber][existingEco]);
            }
          }
          else {
            localsMaster[partNumber][ecoNum] = structuredClone(localsMaster_copy[partNumber][existingEco]);
          } 
        }
      })
    })
    */
  
     //Update the checked out svn exports folder incase it was already checked out.
     svn.update(projectPath + "/generatedConfig");
     //Make the the iLEFT station folder is added
     fs.mkdirSync(`${projectPath}\\generatedConfig\\iLEFT`);
    
    for(let partNum in localsMaster) {
  
      //Make sure we create the part number folders
      fs.mkdirSync(`${projectPath}\\generatedConfig\\${partNum}\\iLEFT`)
      //Write the locals to the part number folders
      fs.writeFileSync(`${projectPath}\\generatedConfig\\${partNum}\\iLEFT\\locals.json`, JSON.stringify(localsMaster[partNum], null, 2), "utf-8");
      //Make sure the iLEFT station folder is created
      //fs.mkdirSync(`${projectPath}\\generatedConfig\\${partNum}\\iLEFT`);
      //Make sure we have the empty limits and locals files
      //fs.writeFileSync(`${projectPath}\\generatedConfig\\${partNum}\\iLEFT\\limits.json`, "", "utf-8");
      //fs.writeFileSync(`${projectPath}\\generatedConfig\\${partNum}\\iLEFT\\locals.json`, "", "utf-8");  
    }

    //Force add any new config files and commit to svn
    //svn.add(`${projectPath}\\generatedConfig`);

    //Now we need to copy over the config files
    this.addConfigFiles();
  }

  addConfigFiles() {
    let testMethodFolderName = this.libraryName.replace("ileft.testmethods.", "");
    
    let svnTestMethodsPath = `http://vcs.gentex.com/svn/testers/ea/iLEFT2/TestMethods`;

    const testMethodsLowerCaseMap = new Map( 
      svn.ls(svnTestMethodsPath).split("/").map(folder => {
      return [folder.trim().toLowerCase(), folder.trim()];
      })
    );
  
    if(testMethodsLowerCaseMap.has(testMethodFolderName)) {
      let svnPath = svnTestMethodsPath + `/` + testMethodsLowerCaseMap.get(testMethodFolderName) + `/trunk/resources/`;
      const configFiles = svn.ls(svnPath).split("\n").forEach(file => {
        if(file != "") {
          svn.copy(svnPath + "/" + file.trim(), `${projectPath}\\generatedConfig\\iLEFT`);
        }
      })
    }
    else {
      alert("Could not deduce TestMethods svn folder name. You must copy the contents of the TestMethods resources folder to the newly created \\generatedConfig\\iLEFT folder manually.");
    }
  }

  addTestGroups(testPlanArray) {
    const masterTestGroupList = new Map();
    let firstTestPlan = true;
    let previousGroupId = "";
  
    let lowerCaseMCArray = [];
    this.measurementCallerMap.forEach((value, key) => {
      lowerCaseMCArray.push(key.toLowerCase())
    })

    testPlanArray.forEach(testPlan =>{
      testPlan.testGroups.forEach((testGroup, index, testGroupsArray) => {

        //Add an empty group to jump to on fail
        if(testGroup.name == "TesterHardwareCleanup" && !masterTestGroupList.has("EndILEFT")) {
          let endIleftID = this.getGroupID();
          masterTestGroupList.set("EndILEFT", {groupID: endIleftID, associatedPartNumbers: this.partNumbers, arrayOfSubTests: []});
          let endIleftGroup = this.generateBaseGroup("group", "EndILEFT", "universalPartNumber", "Body", {}, false);
          endIleftGroup.loop = this.generateBaseProperty(0, "builtin", "");
          endIleftGroup.retry = this.generateBaseProperty(0, "builtin", "");
          endIleftGroup.comment = this.generateBaseProperty("EMPTY GROUP FOR JUMP ON FAILURES", "builtin", "");

          this.DocObj.elements[endIleftID] = endIleftGroup;
          this.DocObj.structure[endIleftID] = this.generateBaseStructure("group", []);

          this.DocObj.structure.universalPartNumber.children.push(endIleftID);
          previousGroupId = endIleftID;
        }

        //A measurement subroutine and test group can't have the same name. Rename the test group if it has the same name as a subroutine.
        let uniqueTestGroupName = lowerCaseMCArray.includes(testGroup.name.toLowerCase()) ? testGroup.name + "Group" : testGroup.name;

        //Add the test group if it has not been added yet
        if(!masterTestGroupList.has(uniqueTestGroupName)) {
  
          const newGroupId = this.getGroupID();
          masterTestGroupList.set(uniqueTestGroupName, {groupID: newGroupId, associatedPartNumbers: testPlan.partNumbers, arrayOfSubTests: [testGroup.subTests]});
  
          let theTestGroup = this.generateBaseGroup("group", uniqueTestGroupName, "universalPartNumber", "Body", {}, false);
          theTestGroup.loop = this.generateBaseProperty(0, "builtin", "");
          theTestGroup.retry = this.generateBaseProperty(0, "builtin", "");
  
          this.DocObj.elements[newGroupId] = theTestGroup;
          this.DocObj.structure[newGroupId] = this.generateBaseStructure("group", []);
  
          //We need to insert the groupId in the correct location in the universalPartNumber children array
          if((previousGroupId != "") && (!firstTestPlan) && ((this.DocObj.structure.universalPartNumber.children.findIndex((element) => { return element == previousGroupId; }) + 1) < this.DocObj.structure.universalPartNumber.children.length)) {
            this.DocObj.structure.universalPartNumber.children.splice(this.DocObj.structure.universalPartNumber.children.findIndex((element) => { return element == previousGroupId; }) + 1, 0, newGroupId);
          }
          else {
            this.DocObj.structure.universalPartNumber.children.push(newGroupId);
          }
          previousGroupId = newGroupId;
        }
        else {
          //Add any new associated part number from the testplan
          masterTestGroupList.get(uniqueTestGroupName).associatedPartNumbers = Array.from(new Set(masterTestGroupList.get(uniqueTestGroupName).associatedPartNumbers.concat(testPlan.partNumbers)) );
          masterTestGroupList.get(uniqueTestGroupName).arrayOfSubTests.push(testGroup.subTests);
          previousGroupId = (masterTestGroupList.get(uniqueTestGroupName)).groupID;
        }
      })
      firstTestPlan = false;
    })
    
    masterTestGroupList.forEach((testGroupData, testGroupName, thisMap) => {


      //For each test group, the masterTestGroupList has an array of subtest arrays from each test plan we need to combine them into a single array of subtest that we can use to generate the evaluations.
      let masterSubTestArray = this.combineSubTests(testGroupData.arrayOfSubTests);
      
      //Add the assigned part numbers to the test group
      if(testGroupData.associatedPartNumbers.length < this.partNumbers.length) {
        this.DocObj.elements[testGroupData.groupID].assigned = this.generateBaseProperty(testGroupData.associatedPartNumbers.join(", "), "builtin", ""); 
      }

      this.groupAndEvalMap[testGroupName] = {
        groupID: testGroupData.groupID, 
        subTests: new Map()
      }
      
      masterSubTestArray.forEach(subTest => {

        //If we run into a limitcheck that was only in one test plan and was never merged with another limit check from a different testplan, we need to add the boundLimitsMap
        if(subTest.limitCheckEval == "1") {
          if(!subTest.hasOwnProperty("boundLimitsMap")) {
            subTest.boundLimitsMap = new Map();
            subTest.associatedPartNumbers.forEach(partNum => {
              subTest.boundLimitsMap.set(partNum, {lowLimit: subTest.lowLimit, highLimit: subTest.highLimit, value: subTest.value});
            })  
          }
        }
        // Make an empty boundLimitsMap property for the non limitcheck evals
        else {
          subTest.boundLimitsMap = "";
        }

        //We have to be smart about how find the groupID of the measurement caller we want to use with this evaluation
        let measurementCaller = `${subTest.testMethod}`;
        let i = 2;
        while(subTest.testBinary != this.measurementCallerMap.get(measurementCaller).library) {
          measurementCaller = measurementCaller + `_${i.toString()}`;
          i++;
        }
        let measurementCallerID = this.measurementCallerMap.get(measurementCaller).groupID;
        //let bindingCallID = this.measurementCallerMap.get(measurementCaller).bindingCallID;
  
        //The DCIGen WriteAquiredWaveformToFile_OnFailure method takes a bool as the testFailed param instead of a string like in the old testmethod. 
        //We need to parse the old string param and use that to generate a script that will output a true or false value
        let scriptEvalID = "";
        if(subTest.testMethod == "WriteAquiredWaveformToFile_OnFailure") {
  
          scriptEvalID = this.getEvaluationID();
          let waveformScript = this.generateWaveformSaveScript(subTest.testArgs.get("testFailed"), scriptEvalID);
          console.log(subTest.testArgs.get("testFailed"));
          console.log(waveformScript);
          let evalName = `WaveformScript_${subTest.testArgs.get("waveformID")}`;

          let scriptEval = this.generateBaseGroup("evaluation", evalName, testGroupData.groupID, "Body", {}, false);
          scriptEval.evaluationType = this.generateBaseProperty("SCRIPTED", "builtin", "");
          scriptEval.lowLimit = this.generateBaseProperty("0", "builtin", "");
          scriptEval.highLimit = this.generateBaseProperty("0", "builtin", "");
          scriptEval.value = this.generateBaseProperty("0", "builtin", "");
          scriptEval.runtimeResume = this.generateBaseProperty(true, "builtin", "");
          scriptEval.updateTestMetrics = this.generateBaseProperty(false, "builtin", "");
          scriptEval.onEvaluate = this.generateBaseProperty(waveformScript, "slot", "");
          scriptEval.properties = {testFailed: this.generateBaseProperty("", "boolean", "[OUTPUT]")};

          this.DocObj.elements[scriptEvalID] = scriptEval;
          this.DocObj.structure[scriptEvalID] = this.generateBaseStructure("evaluation", []);
  
          this.DocObj.structure[testGroupData.groupID].children.push(scriptEvalID);

          this.groupAndEvalMap[testGroupName].subTests.set(evalName, { newName: evalName, subTestID: scriptEvalID, lowLimit: scriptEval.lowLimit, highLimit: scriptEval.highLimit, value: scriptEval.value, type: "SCRIPT", boundLimitsMap: subTest.boundLimitsMap});
        }

        const evaluationID = this.getEvaluationID();

        //If the subtest is a campare value type or is a data collect method that returns a true string, we have to convert the existing measurement call subroutine into a regular subroutine.
        //Compare value type tests are always on strings
        if((subTest.compareDataEval == "1" || this.dataCollectionMethods.includes(subTest.testMethod)) & this.DocObj.elements[measurementCallerID].properties.hasOwnProperty("measurementResult")){
          let measurementResult_Copy = structuredClone(this.DocObj.elements[measurementCallerID].properties.measurementResult);
          delete this.DocObj.elements[measurementCallerID].properties.measurementResult;
          this.DocObj.elements[measurementCallerID].properties.dataOutput = measurementResult_Copy;
          this.DocObj.elements[measurementCallerID].properties.dataOutput.type = "string";
        }

        //create the evaluation parameters
        let evaluationProps = {};
        let targetOutput;
        for (var property in this.DocObj.elements[measurementCallerID].properties) {
          
          if( this.DocObj.elements[measurementCallerID].properties.hasOwnProperty(property)) {
            
            evaluationProps[property] = structuredClone(this.DocObj.elements[measurementCallerID].properties[property]);
  
            let propertyValue;
            if(this.DocObj.elements[measurementCallerID].description == "WriteAquiredWaveformToFile_OnFailure" && property == "testFailed") {

              propertyValue = `${scriptEvalID}.testFailed`;
            }
            else if (property == "isSingleUpMode") {
               propertyValue = "%singleupmode%";
            }
            //else if (property == "arrayIndexStr" || property == "arrayIndex") {
            //  propertyValue = "%index%";
            //}
            else if (property == "measurementResult" || property == "dataOutput") {
              propertyValue = structuredClone(this.DocObj.elements[measurementCallerID].properties[property].value);
              targetOutput = property;
            }
            else if (property == "stateIn" && !subTest.testArgs.has("stateIn")) {
              propertyValue = subTest.testArgs.get("stateParameter");
            }
            else if (!subTest.testArgs.has(property)) {
              propertyValue = '';
            }
            else {
              propertyValue = subTest.testArgs.get(property);
            }
            evaluationProps[property].value = propertyValue;
            
          }
        }
      
        console.log("TEST");
        console.log(evaluationProps);
        delete evaluationProps.measurementResult; //We don't need this in the measurement caller eval
        let evaluation = this.generateBaseEvaluation(subTest, testGroupName, testGroupData.groupID, measurementCallerID, `${measurementCallerID}.${targetOutput}`, evaluationProps);
        
        if(subTest.associatedPartNumbers.length < this.partNumbers.length) {
          evaluation.assigned = this.generateBaseProperty(subTest.associatedPartNumbers.join(", "), "builtin", "");
        }
        
        this.DocObj.elements[evaluationID] = evaluation;
        this.DocObj.structure[evaluationID] = this.generateBaseStructure("evaluation", []);
  
        this.DocObj.structure[testGroupData.groupID].children.push(evaluationID);

        let testType = "";
        if(subTest.limitCheckEval == "1") {testType = "LIMITCHECK";}
        else if(subTest.passFailEval == "1") {testType = "PASSFAIL";}
        else if(subTest.exactValEval == "1") {
          if (Number(subTest.value) == 1) {
            testType = "PASSFAIL";
          }
          else {
            testType = "EXACT";
          } 
        }
        else if(subTest.collectDataEval == "1") {testType = "COLLECTION";}
        else if(subTest.compareDataEval == "1") {testType = "STRING";}

        this.groupAndEvalMap[testGroupName].subTests.set(subTest.name, {newName: evaluation.description, subTestID: evaluationID, lowLimt: subTest.lowLimit, highLimit: subTest.highLimit, value: subTest.value, type: testType, boundLimitsMap: subTest.boundLimitsMap});
      })

      //Add the script to init the result file serial number to all F's
      let initSNEvalID = "";
      if(testGroupName == "Cleanup") {
        initSNEvalID = this.getEvaluationID();
        let initSNEvalScript = "// Initialize the result file serial number incase we fail to scan\n\n__report__.setSerialNumber( \"FFFFFFFF\", \"\", 0, 16 );";
        let initSNEvalName = "InitResultFileSerialNumber";

        let initSNEval = this.generateBaseGroup("evaluation", initSNEvalName, testGroupData.groupID, "Body", {}, false);
        initSNEval.evaluationType = this.generateBaseProperty("SCRIPTED", "builtin", "");
        initSNEval.lowLimit = this.generateBaseProperty("0", "builtin", "");
        initSNEval.highLimit = this.generateBaseProperty("0", "builtin", "");
        initSNEval.value = this.generateBaseProperty("0", "builtin", "");
        initSNEval.runtimeResume = this.generateBaseProperty(false, "builtin", "");
        initSNEval.updateTestMetrics = this.generateBaseProperty(false, "builtin", "");
        initSNEval.onEvaluate = this.generateBaseProperty(initSNEvalScript, "builtin", "");
        initSNEval.properties = {testFailed: this.generateBaseProperty("", "boolean", "[OUTPUT]")};

        this.DocObj.elements[initSNEvalID] = initSNEval;
        this.DocObj.structure[initSNEvalID] = this.generateBaseStructure("evaluation", []);
        this.DocObj.structure[testGroupData.groupID].children.push(initSNEvalID);
        this.groupAndEvalMap[testGroupName].subTests.set(initSNEvalName, {newName: initSNEvalName, subTestID: initSNEvalID, lowLimt: initSNEval.lowLimit, highLimit: initSNEval.highLimit, value: initSNEval.value, type: "SCRIPTED", boundLimitsMap: initSNEval.boundLimitsMap});
      }

      //Add the jump on fail script
      if(testGroupName != "EndILEFT" && testGroupName != "TesterHardwareCleanup" && testGroupName != "LogConfig") {
        let jumpOnFailID = this.getEvaluationID();
        let jumpOnFailScript = "runtime.passed = true;\n\nif(!__testMetrics__.isDUTPassing)\n{\n  runtime.passed = false;\n}";
        let jumpOnFailName = `${testGroupName}_Success`;

        let jumpOnFailEval = this.generateBaseGroup("evaluation", jumpOnFailName, testGroupData.groupID, "Body", {}, false);
        jumpOnFailEval.evaluationType = this.generateBaseProperty("SCRIPTED", "builtin", "");
        jumpOnFailEval.lowLimit = this.generateBaseProperty("0", "builtin", "");
        jumpOnFailEval.highLimit = this.generateBaseProperty("0", "builtin", "");
        jumpOnFailEval.value = this.generateBaseProperty("0", "builtin", "");
        jumpOnFailEval.runtimeResume = this.generateBaseProperty(true, "builtin", "");
        jumpOnFailEval.updateTestMetrics = this.generateBaseProperty(true, "builtin", "");
        jumpOnFailEval.onEvaluate = this.generateBaseProperty(jumpOnFailScript, "builtin", "");
        jumpOnFailEval.properties = {testFailed: this.generateBaseProperty("", "boolean", "[OUTPUT]")};
        jumpOnFailEval.jumpOnFail = this.generateBaseProperty(masterTestGroupList.get("EndILEFT").groupID, "builtin", "");

        this.DocObj.elements[jumpOnFailID] = jumpOnFailEval;
        this.DocObj.structure[jumpOnFailID] = this.generateBaseStructure("evaluation", []);
        this.DocObj.structure[testGroupData.groupID].children.push(jumpOnFailID);
        this.groupAndEvalMap[testGroupName].subTests.set(jumpOnFailName, {newName: jumpOnFailName, subTestID: jumpOnFailID, lowLimt: jumpOnFailEval.lowLimit, highLimit: jumpOnFailEval.highLimit, value: jumpOnFailEval.value, type: "SCRIPTED", boundLimitsMap: jumpOnFailEval.boundLimitsMap});
      }
      
      //Add the script to set the result file serial number to the scanned barcode and the eval to set the metadata barcode
      let setSNEvalID = "";
      if(testGroupName == "Scan") {
        setSNEvalID = this.getEvaluationID();
        let myBarcodeBCID =  this.measurementCallerMap.get("MyBarCode").bindingCallID;
        let setSNEvalScript = `// Set the result file serial number to the scanned barcode\n\n__report__.setSerialNumber( ${myBarcodeBCID}.measurementResultOut, "", 0, 16 );`;
        let setSNEvalName = "setResultFileSerialNumber";

        let setSNEval = this.generateBaseGroup("evaluation", setSNEvalName, testGroupData.groupID, "Body", {}, false);
        setSNEval.evaluationType = this.generateBaseProperty("SCRIPTED", "builtin", "");
        setSNEval.lowLimit = this.generateBaseProperty("0", "builtin", "");
        setSNEval.highLimit = this.generateBaseProperty("0", "builtin", "");
        setSNEval.value = this.generateBaseProperty("0", "builtin", "");
        setSNEval.runtimeResume = this.generateBaseProperty(false, "builtin", "");
        setSNEval.updateTestMetrics = this.generateBaseProperty(false, "builtin", "");
        setSNEval.onEvaluate = this.generateBaseProperty(setSNEvalScript, "builtin", "");
        setSNEval.properties = {testFailed: this.generateBaseProperty("", "boolean", "[OUTPUT]")};

        this.DocObj.elements[setSNEvalID] = setSNEval;
        this.DocObj.structure[setSNEvalID] = this.generateBaseStructure("evaluation", []);
        this.DocObj.structure[testGroupData.groupID].children.push(setSNEvalID);
        this.groupAndEvalMap[testGroupName].subTests.set(setSNEvalName, {newName: setSNEvalName, subTestID: setSNEvalID, lowLimt: setSNEval.lowLimit, highLimit: setSNEval.highLimit, value: setSNEval.value, type: "SCRIPTED", boundLimitsMap: setSNEval.boundLimitsMap});
      
        let metaDataBarcodeID = this.getEvaluationID();
        let metaDataBarcodeEval = this.generateBaseGroup("evaluation", "__barcode__", testGroupData.groupID, "Body", {}, false);
        metaDataBarcodeEval.evaluationType = this.generateBaseProperty("COLLECTION", "builtin", "");
        metaDataBarcodeEval.lowLimit = this.generateBaseProperty("0", "builtin", "");
        metaDataBarcodeEval.highLimit = this.generateBaseProperty("0", "builtin", "");
        metaDataBarcodeEval.value = this.generateBaseProperty("0", "builtin", "");
        metaDataBarcodeEval.runtimeResume = this.generateBaseProperty(true, "builtin", "");
        metaDataBarcodeEval.updateTestMetrics = this.generateBaseProperty(true, "builtin", "");
        metaDataBarcodeEval.target = this.generateBaseProperty(`${this.measurementCallerMap.get("MyBarCode").bindingCallID}.measurementResultOut`, "builtin", "");
  
        this.DocObj.elements[metaDataBarcodeID] = metaDataBarcodeEval;
        this.DocObj.structure[metaDataBarcodeID] = this.generateBaseStructure("evaluation", []);
        this.DocObj.structure[testGroupData.groupID].children.push(metaDataBarcodeID);
        this.groupAndEvalMap[testGroupName].subTests.set("__barcode__", {newName: "__barcode__", subTestID: metaDataBarcodeID, lowLimt: metaDataBarcodeEval.lowLimit, highLimit: metaDataBarcodeEval.highLimit, value: metaDataBarcodeEval.value, type: "COLLECTION", boundLimitsMap: metaDataBarcodeEval.boundLimitsMap});

      }
    })
  }

  addLimitsAndGlobals() {

    this.partNumbers.forEach( partNum => {
      let limits = {};
      let globals = {};
      limits[partNum] = [];
      let SpecLimits = [];

      //Make sure the iLEFT station folder is created
      fs.mkdirSync(`${projectPath}\\generatedConfig\\${partNum}\\iLEFT`);

      for(const groupName in this.groupAndEvalMap) {
        this.groupAndEvalMap[groupName].subTests.forEach(subTestData => {
          if(subTestData.type == "LIMITCHECK") {
            if(subTestData.boundLimitsMap.has(partNum)) {
              SpecLimits.push({
                Description: "", 
                HighLimit: subTestData.boundLimitsMap.get(partNum).highLimit,
                IgnoreCalcCheck: false,
                LowLimit: subTestData.boundLimitsMap.get(partNum).lowLimit,
                MeasuredValue: subTestData.boundLimitsMap.get(partNum).value,
                TagName: subTestData.newName
              })
            }
          }
        })
      }

      limits[partNum].push({EcoNum: "Defaults", SpecLimits: SpecLimits});
      globals.Defaults = {};

      this.ecoNumsMaster.forEach(ECO => {
        limits[partNum].push({EcoNum: ECO, SpecLimits: SpecLimits});
        globals[ECO] = {};
      })

      fs.writeFileSync(`${projectPath}\\generatedConfig\\${partNum}\\iLEFT\\limits.json`, JSON.stringify(limits, null, 2), "utf-8");
      fs.writeFileSync(`${projectPath}\\generatedConfig\\${partNum}\\globals.json`, JSON.stringify(globals, null, 2), "utf-8");
    })

    //Force add any new config files and commit to svn
    svn.add(`${projectPath}\\generatedConfig`);
  }
  
  generateWaveformSaveScript(testFailedStr, evaluationID) {
    let waveformSript = `${evaluationID}.testFailed = `;
    testFailedStr.split("|").forEach(testToCheck => {
      const testToCheckArray = testToCheck.split("::");


      if(this.groupAndEvalMap[testToCheckArray[0]].subTests.has(testToCheckArray[1]))
      {
        let evalIDToCheck = this.groupAndEvalMap[testToCheckArray[0]].subTests.get(testToCheckArray[1]).subTestID;
        waveformSript += `!${evalIDToCheck}.runtime.passed || `;
      }
      
    })
    return waveformSript.slice(0,-4) + ";";
  }
  
  combineSubTests(arrayOfSubTests) {
    const masterSubTestMap = new Map();
    const masterSubTestOrder = [];
    let previousSubTest = "";
    let firstArray = true;
    arrayOfSubTests.forEach(subTestArray => {
      subTestArray.forEach(subTest =>{
        if(!masterSubTestMap.has(subTest.name)) {
          masterSubTestMap.set(subTest.name, subTest);

          if((previousSubTest != "") && (!firstArray) && ((masterSubTestOrder.findIndex((element) => {return element == previousSubTest}) + 1) < masterSubTestOrder.length)) {
            masterSubTestOrder.splice(masterSubTestOrder.findIndex((element) => {return element == previousSubTest}) + 1, 0, subTest.name);
          }
          else {
            masterSubTestOrder.push(subTest.name);
          }
          previousSubTest = subTest.name;
        }
        else {

          let merged = false; 
          let oldSubTestName = subTest.name;
          let newSubTestName = oldSubTestName;
          let i = 1;
          while(masterSubTestMap.has(newSubTestName) && !merged)  {
           
            if(this.areSubTestsSimilar(subTest, masterSubTestMap.get(newSubTestName))) {
              masterSubTestMap.set(newSubTestName, this.mergeSimilarSubTests(subTest, masterSubTestMap.get(newSubTestName)));
              merged = true;
            }
            else {
              i++;
              previousSubTest = newSubTestName;
              newSubTestName = oldSubTestName + `_${i.toString()}`;
            }
          }

          if(!merged) {
            subTest.name = newSubTestName;
            masterSubTestMap.set(newSubTestName, subTest);

            if((masterSubTestOrder.findIndex((element) => { return element == previousSubTest } ) + 1) < masterSubTestOrder.length) {
              masterSubTestOrder.splice(masterSubTestOrder.findIndex((element) => { return element == previousSubTest } ) + 1, 0, newSubTestName);
            }
            else {
              masterSubTestOrder.push(newSubTestName);
            }
          }
          previousSubTest = newSubTestName;
        }
      })
      firstArray = false;
    })
    const subTestArrayToReturn = [];
    masterSubTestOrder.forEach(subTestName =>{
      subTestArrayToReturn.push(masterSubTestMap.get(subTestName));
    }) 
    return subTestArrayToReturn;
  }

  areSubTestsSimilar(subtest1, subtest2) {
    let name = subtest1.name == subtest2.name;
    let binary = subtest1.testBinary == subtest2.testBinary;
    let lowLimit = subtest1.lowLimit == subtest2.lowLimit;
    let highLimit = subtest1.highLimit == subtest2.highLimit;
    let limitCheck = subtest1.limitCheckEval == "1" && subtest2.limitCheckEval == "1";
    let args = true;

    subtest1.testArgs.forEach((value, key) => {
      if (subtest2.testArgs.has(key)) {
        args = args && (value == subtest2.testArgs.get(key));
      }
    })

    if((!limitCheck && name && binary && lowLimit && highLimit && args) || (limitCheck && name && binary && args)) {
      return 1;
    }
    else {
      return 0;
    }
  }

  mergeSimilarSubTests(subtest1, subtest2) {

    let mergedSubTests = subtest1;
    if(subtest2.description.length > subtest1.description.length) {
      mergedSubTests.description = subtest2.description;
    }
    if(parseInt(subtest2.loopCount) > parseInt(subtest2.loopCount)) {
      mergedSubTests.loopCount = subtest2.loopCount;
    }
    if(parseInt(subtest2.postDelayMillis) > parseInt(subtest2.postDelayMillis)) {
      mergedSubTests.postDelayMillis = subtest2.postDelayMillis;
    }
    if(parseInt(subtest2.preDelayMillis) > parseInt(subtest2.preDelayMillis)) {
      mergedSubTests.preDelayMillis = subtest2.preDelayMillis;
    }
    if(parseInt(subtest2.retryCount) > parseInt(subtest2.retryCount)) {
      mergedSubTests.retryCount = subtest2.retryCount;
    }
    if(parseInt(subtest2.retryDelayMillis) > parseInt(subtest2.retryDelayMillis)) {
      mergedSubTests.retryDelayMillis = subtest2.retryDelayMillis;
    }
    let limitMiddle = (subtest1.highLimit + subtest1.lowLimit)/2;
    if(Math.abs(limitMiddle - subtest2.value) < Math.abs(limitMiddle - subtest1.value)) {
       mergedSubTests.value = subtest2.value;
    }

    if((subtest1.limitCheckEval == "1" && subtest2.limitCheckEval == "1") && (subtest1.lowLimit != subtest2.lowLimit || subtest1.highLimit != subtest2.highLimit)){

      if(!mergedSubTests.hasOwnProperty("boundLimitsMap")) {
        mergedSubTests.boundLimitsMap = new Map();
        mergedSubTests.lowLimit = "bound";
        mergedSubTests.lowLimit = "bound";
        mergedSubTests.value = "bound";
        subtest1.associatedPartNumbers.forEach( partNum => {
          mergedSubTests.boundLimitsMap.set(partNum, {lowLimit: subtest1.lowLimit, highLimit: subtest1.highLimit, value: subtest1.value})
        })
        subtest2.associatedPartNumbers.forEach( partNum => {
          mergedSubTests.boundLimitsMap.set(partNum, {lowLimit: subtest2.lowLimit, highLimit: subtest2.highLimit, value: subtest2.value})
        })
      }
      else {
        subtest2.associatedPartNumbers.forEach( partNum => {
          if(!mergedSubTests.boundLimitsMap.has(partNum)) {
            mergedSubTests.boundLimitsMap.set(partNum, {lowLimit: subtest2.lowLimit, highLimit: subtest2.highLimit, value: subtest2.value})
          }
        })
      }
    }

    mergedSubTests.associatedPartNumbers = Array.from( new Set(subtest1.associatedPartNumbers.concat(subtest2.associatedPartNumbers)) );

    return mergedSubTests;
  }

  generateBaseEvaluation(subTestObj, testGroupName, parentIdentifier, subroutine, target,  properties = {}) {

    let testType = "";
    if(subTestObj.limitCheckEval == "1") {testType = "LIMITCHECK";}
    else if(subTestObj.passFailEval == "1") {testType = "PASSFAIL";}
    else if(subTestObj.exactValEval == "1") {testType = "EXACT"}
    else if(subTestObj.collectDataEval == "1") {testType = "COLLECTION"}
    else if(subTestObj.compareDataEval == "1") {testType = "STRING"}
    
    //This may need to change. Limit the eval name to 50 characters.
    let evalName = `${testGroupName}_${subTestObj.name}`;
    if (evalName.length > 50) {
      evalName = evalName.substring(0,48) + "__";
    }

    //If you want the subtest names to be prefixed with the testgroup names, use the line below
    let evaluation = this.generateBaseGroup("evaluation", evalName, parentIdentifier, "Body", {}, subTestObj.skipTest == "0" ? false : true);
    //If you want the subtest names to NOT be prefixed with the testgroup names, use the line below
    //let evaluation = this.generateBaseGroup("evaluation", `${subTestObj.name}`, parentIdentifier, "Body", {}, subTestObj.skipTest == "0" ? false : true);
    evaluation.comment = this.generateBaseProperty(subTestObj.description, "builtin", "");
    evaluation.loop = this.generateBaseProperty(parseInt(subTestObj.loopCount), "builtin", "");
    evaluation.retry = this.generateBaseProperty(parseInt(subTestObj.retryCount), "builtin", "");
    evaluation.subroutine = this.generateBaseProperty(subroutine, "builtin", "");
    evaluation.interstitialRetryDelay = this.generateBaseProperty(parseInt(subTestObj.retryDelayMillis), "builtin", "");
    evaluation.preExecuteDelay = this.generateBaseProperty(parseInt(subTestObj.preDelayMillis), "builtin", "");
    evaluation.postExecuteDelay = this.generateBaseProperty(parseInt(subTestObj.postDelayMillis), "builtin", "");
    
    evaluation.evaluationType = this.generateBaseProperty(testType, "builtin", "");
    if(testType == "LIMITCHECK" ) {
      evaluation.value = this.generateBaseProperty("configuration.ev_" + evalName, "builtin", "");
      evaluation.highLimit = this.generateBaseProperty("configuration.hl_" + evalName, "builtin", "");
      evaluation.lowLimit = this.generateBaseProperty("configuration.ll_" + evalName, "builtin", "");

      //Add these to the config element so they can be bound
      this.DocObj.elements.configuration.properties["ll_" + evalName] = this.generateBaseProperty("", "string", "");
      this.DocObj.elements.configuration.properties["hl_" + evalName] = this.generateBaseProperty("", "string", "");
      this.DocObj.elements.configuration.properties["ev_" + evalName] = this.generateBaseProperty("", "string", "");
    }
    else {
      evaluation.value = this.generateBaseProperty(subTestObj.value, "builtin", "");
      evaluation.highLimit = this.generateBaseProperty(subTestObj.highLimit, "builtin", "");
      evaluation.lowLimit = this.generateBaseProperty(subTestObj.lowLimit, "builtin", "");
    }
   
    evaluation.target = this.generateBaseProperty(target, "builtin", "");
    evaluation.skipped = this.generateBaseProperty(false, "builtin", "");
    evaluation.updateTestMetrics = this.generateBaseProperty(true, "builtin", "");
    evaluation.runtimeResume = this.generateBaseProperty(true, "builtin", "");
    evaluation.properties = properties;

    return evaluation;
  }

  generateBaseBindingCall(type, description = "", parentIdentifier = "", phase = "Init", updateTestMetrics = true, properties = {}, library = "", method = "", runtimeResume = true) {
    let bindingCall = this.generateBaseElement(type, description, parentIdentifier, phase, properties);
    bindingCall.loop = this.generateBaseProperty(0, "builtin", "");
    bindingCall.retry = this.generateBaseProperty(0, "builtin", "");
    bindingCall.skipped = this.generateBaseProperty(false, "builtin", "");
    bindingCall.updateTestMetrics = this.generateBaseProperty(updateTestMetrics, "builtin", "");
    bindingCall.runtimeResume = this.generateBaseProperty(runtimeResume, "builtin", "");
    bindingCall.library = this.generateBaseProperty(library, "builtin", "");
    let methodValue;
    if(library == "ileft.testmethods.instrumentcontrol") {
      methodValue = "IleftInstrumentsTestMethods_" + method;
    }
    else if(library == "gtm.utilities.subversionclient") {
      methodValue = "SVNUtils_" + method;
    }
    else if(library == "ileft.platform.iptehandler") {
      methodValue = "iptehandler_" + method;
    }
    else if(library == "gtm.utilities.qtui") {
      methodValue = "QtUiUtils_" + method;
    }
    else {
      methodValue = "TestBinaryServiceImpl_" + method;
    }
    bindingCall.method = this.generateBaseProperty(methodValue, "builtin", "");
    return bindingCall;
  }

  generateBaseProperty(value, type, description = "") {
    return {
      value: value,
      modificationTime: newDate.timeNow(),
      userName: this.username,
      type: type,
      description: description
    }
  }

  generateBaseStructure(type, children) {
    return {
      type: type,
      children: children
    }
  }

  templateTPDocStr(username) {
    return `{
      "elements": {
        "testplan": {
          "type": "testPlan",
          "description": "Test Plan root element",
          "modificationTime": "${newDate.timeNow()}",
          "properties": {},
          "userName": "${username}",
          "parentIdentifier": ""
        },
        "universalPartNumber": {
          "type": "universalPartNumber",
          "description": "",
          "modificationTime": "${newDate.timeNow()}",
          "parentIdentifier": "station",
          "userName": "${username}",
          "partNumbers": [],
          "properties": {
            "universal": {
              "value": true,
              "description": "",
              "modificationTime": "${newDate.timeNow()}",
              "type": "boolean",
              "userName": "${username}"
            }
          }
        },
        "tests": {
          "type": "tests",
          "description": "Tests root element",
          "modificationTime": "${newDate.timeNow()}",
          "parentIdentifier": "testplan",
          "properties": {},
          "userName": "${username}"
        },
        "flow": {
          "type": "flow",
          "description": "Flow root element",
          "modificationTime": "${newDate.timeNow()}",
          "parentIdentifier": "testplan",
          "properties": {},
          "userName": "${username}"
        },
        "station": {
          "type": "station",
          "description": "iLEFT",
          "modificationTime": "${newDate.timeNow()}",
          "parentIdentifier": "tests",
          "properties": {},
          "userName": "${username}"
        },
        "requirements": {
          "type": "requirements",
          "description": "Requirements root element",
          "modificationTime": "${newDate.timeNow()}",
          "parentIdentifier": "testplan",
          "properties": {},
          "userName": "${username}"
        },
        "fixturing": {
          "type": "fixturing",
          "description": "Fixturing root element",
          "modificationTime": "${newDate.timeNow()}",
          "parentIdentifier": "testplan",
          "properties": {},
          "userName": "${username}"
        }
      },
      "structure": {
          "testplan": {
            "type": "testPlan",
            "children": [
              "requirements",
              "tests",
              "fixturing",
              "flow"
            ]
          },
          "universalPartNumber": {
            "type": "universalPartNumber",
            "children": []
          },
          "tests": {
            "type": "tests",
            "children": [
              "station"
            ]
          },
          "flow": {
            "type": "flow",
            "children": []
          },
          "station": {
            "type": "station",
            "children": [
              "universalPartNumber"
            ]
          },
          "requirements": {
            "type": "requirements",
            "children": []
          },
          "fixturing": {
            "type": "fixturing",
            "children": []
          }
        },
    "rootElementIdentifier": "testplan",
    "name": "${testPlanName}"
    }`
  }
}

//Provides a function to generate the current date time in the format expected by TPE 
Date.prototype.timeNow = function() {
  /*year*/ return this.getFullYear() + "-" + 
  /*month*/ (((this.getMonth()+1) < 10)?"0":"") + (this.getMonth()+1) + "-" + 
  /*day*/ ((this.getDate() < 10)?"0":"") + this.getDate() + "T" +
  /*hours*/ ((this.getHours() < 10)?"0":"") + this.getHours() + ":" + 
  /*minutes*/ ((this.getMinutes() < 10)?"0":"") + this.getMinutes() + ":" +
  /*seconds*/ ((this.getSeconds() < 10)?"0":"") + this.getSeconds() + "." + 
  /*milliseconds*/ ((this.getMilliseconds() < 10)?"00":"") + (((this.getMilliseconds() > 10) && (this.getMilliseconds() < 100))?"0":"") + this.getMilliseconds() + "Z";
}

//Create a new Date object
let newDate = new Date();

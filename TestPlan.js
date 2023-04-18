
class TestPlan {

  constructor(testBinary) {

    // The user name from the input field
    this.username = document.getElementById("username").value;

    // The testplan javascript object 
    this.DocObj = JSON.parse(this.templateTPDocStr(this.username))
    
    this.libraryName; //The main test methods library name. i.e., not "ileft.testmethods.instrumentscontrol".
    this.partNumbers; //An array of all the partnumbers
    this.ecoNumsMaster = new Set(); //A list of all the ECO numbers

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
    //Loop through each DCIGen library used in the testplans
    dciGenLibrariesInfo.forEach((libraryData, libraryName) => {

      //Set the testplan's main library name. We'll use this when when creating the init, load, unload, and teardown phases.
      //I'm assuming a testplan only evey uses instrumentcontrol, iptehandler, and it's main product library
      if(libraryName != "ileft.testmethods.instrumentscontrol" && libraryName != "ileft.platform.iptehandler" && libraryName != "gtm.utilities.subversionclient") {
        this.libraryName = libraryName;
      }

      //Add the bundle property to the universal part number
      let bundleName = libraryName + "." + libraryData.versionNumber + "-" + libraryData.platformName;
      masterListOfLibraries.push(bundleName);
      this.DocObj.elements.universalPartNumber.properties["bundle" + bundleNumber.toString()] = this.generateBaseProperty(bundleName, "string", "");
      bundleNumber++;

      // Don't add any meathods fom the iptehandler or the subversionclient library. That's handled when the init, load, unload, and teardown phases are added.
      if(libraryName != "ileft.platform.iptehandler" && libraryName != "gtm.utilities.subversionclient") {
        //Loop through all the functions in the DCIGen library
        libraryData.functions.forEach(func => {
          //If the function is used in the testplans, we need to add a measurement caller for it
          if (testPlanMethods[libraryName].includes(func.name)) {
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
            this.measurementCallerMap.set(functionName, {library: libraryName, groupID: groupID, bindingCallID: bindingCallID}); 
            
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
            this.DocObj.elements[bindingCallID] = this.generateBaseBindingCall("bindingCall", functionName, groupID, "Init", BindingCallProps, libraryName, func.name, true);
      
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

    //Generate all the IDs for the init phase
    let initGroupID = this.getGroupID();
    //let removeDirID = this.getBindingCallID();
    let svnExportID = this.getBindingCallID();
    let setupID = this.getBindingCallID();
    let initializeID = this.getBindingCallID();
    let startMessageID = this.getBindingCallID();


    //Generate all the IDs for the load phase
    let loadGroupID = this.getGroupID();
    let startOfTestsID = this.getBindingCallID();
    let waitForReadyID = this.getBindingCallID();

    //Setup the init group
    this.DocObj.elements[initGroupID] = this.generateBaseGroup("group", "Init", "universalPartNumber", "Init", {}, false);
    this.DocObj.structure[initGroupID] = this.generateBaseStructure("group", [/*removeDirID,*/ svnExportID, setupID, initializeID, startMessageID]);
    this.DocObj.structure.universalPartNumber.children.push(initGroupID);

    //Create the binding calls to remove the old config folder and then copy over the new ones.
    //this.DocObj.elements[removeDirID] = this.generateBaseBindingCall("bindingCall", "RemoveDir", initGroupID, "Init", this.genPhaseBCProps(projectLibraryData.functions.get("RemoveDir").params), this.libraryName, "RemoveDir", false);
    //this.DocObj.structure[removeDirID] = this.generateBaseStructure("bindingCall", []);
    console.log(svnExportID);
    this.DocObj.elements[svnExportID] = this.generateBaseBindingCall("bindingCall", "DefaultStationExport", initGroupID, "Init", this.genPhaseBCProps(subversionclientLibraryData.functions.get("DefaultStationExport").params), "gtm.utilities.subversionclient", "DefaultStationExport", false);
    this.DocObj.structure[svnExportID] = this.generateBaseStructure("bindingCall", []);

    //Create the Setup binding call
    this.DocObj.elements[setupID] = this.generateBaseBindingCall("bindingCall", "Setup", initGroupID, "Init", this.genPhaseBCProps(projectLibraryData.functions.get("Setup").params), this.libraryName, "Setup", false);
    this.DocObj.structure[setupID] = this.generateBaseStructure("bindingCall", []);

    //Create the Initialize bindingcall
    let initProps = this.genPhaseBCProps(ipteLibraryData.functions.get("Initialize").params);
    initProps.expectedFixtureIds.value = "configuration.fixtureId";
    
    this.DocObj.elements[initializeID] = this.generateBaseBindingCall("bindingCall", "Initialize", initGroupID, "Init", initProps, "ileft.platform.iptehandler", "Initialize", false);
    this.DocObj.structure[initializeID] = this.generateBaseStructure("bindingCall", []);

    //Create the Send Start Message binding call
    this.DocObj.elements[startMessageID] = this.generateBaseBindingCall("bindingCall", "SendStartMessage", initGroupID, "Init", this.genPhaseBCProps(ipteLibraryData.functions.get("SendStartMessage").params), "ileft.platform.iptehandler", "SendStartMessage", false);
    this.DocObj.structure[startMessageID] = this.generateBaseStructure("bindingCall", []);

    //------------------------------------------------------------------------

    //Setup the load group
    this.DocObj.elements[loadGroupID] = this.generateBaseGroup("group", "Load", "universalPartNumber", "Load", {}, false);
    this.DocObj.structure[loadGroupID] = this.generateBaseStructure("group", [startOfTestsID, waitForReadyID ]);
    this.DocObj.structure.universalPartNumber.children.push(loadGroupID);

    //Create the start of tests binding call
    this.DocObj.elements[startOfTestsID] = this.generateBaseBindingCall("bindingCall", "StartOfTests", loadGroupID, "Load", this.genPhaseBCProps(projectLibraryData.functions.get("StartOfTests").params), this.libraryName, "StartOfTests", false);
    this.DocObj.structure[startOfTestsID] = this.generateBaseStructure("bindingCall", []);

    //Create the wait for ReadyForToTest binding call
    this.DocObj.elements[waitForReadyID] = this.generateBaseBindingCall("bindingCall", "WaitForReadyToTest", loadGroupID, "Load", this.genPhaseBCProps(ipteLibraryData.functions.get("WaitForReadyToTest").params), "ileft.platform.iptehandler", "WaitForReadyToTest", false);
    this.DocObj.structure[waitForReadyID] = this.generateBaseStructure("bindingCall", []);
  }

  addUnloadAndTeardown(dciGenLibrariesInfo) {

    //Get the library data for the main project library
    let projectLibraryData = dciGenLibrariesInfo.get(this.libraryName);
    let ipteLibraryData = dciGenLibrariesInfo.get("ileft.platform.iptehandler");

    //Generate all the IDs for the unload phase
    let unloadGroupID = this.getGroupID();
    let endOfTestsID = this.getBindingCallID();
    let passFailID = this.getEvaluationID()
    let sendPassFailID = this.getBindingCallID();

    //Generate all the IDs for the teardown phase
    let tearDownGroupID = this.getGroupID();
    let tearDownID = this.getBindingCallID();
    let endMessageID = this.getBindingCallID();

    //Setup the unload group
    this.DocObj.elements[unloadGroupID] = this.generateBaseGroup("group", "Unload", "universalPartNumber", "Unload", {}, false);
    this.DocObj.structure[unloadGroupID] = this.generateBaseStructure("group", [endOfTestsID, passFailID, sendPassFailID]);
    this.DocObj.structure.universalPartNumber.children.push(unloadGroupID);

    //Create the EndOfTests binding call
    this.DocObj.elements[endOfTestsID] = this.generateBaseBindingCall("bindingCall", "EndOfTests", unloadGroupID, "Unload", this.genPhaseBCProps(projectLibraryData.functions.get("EndOfTests").params), this.libraryName, "EndOfTests", false);
    this.DocObj.structure[endOfTestsID] = this.generateBaseStructure("bindingCall", []);

    //Create the DetermineArrayPassFail evaluation
    let passFailEvalProps = {arrayPassFailStatus: this.generateBaseProperty(false, "boolean", "[OUTPUT] arrayPassFailStatus") };
    let passFailEval = this.generateBaseElement("evaluation", "DetermineArrayPassFail", unloadGroupID, "Unload", passFailEvalProps)
    passFailEval.evaluationType = this.generateBaseProperty("SCRIPTED", "builtin", "");
    passFailEval.lowLimit = this.generateBaseProperty("0", "builtin", "");
    passFailEval.value = this.generateBaseProperty("0", "builtin", "");
    passFailEval.highLimit = this.generateBaseProperty("0", "builtin", "");
    passFailEval.runtimeResume = this.generateBaseProperty(true, "builtin", "");
    passFailEval.updateTestMetrics = this.generateBaseProperty(false, "builtin", "");
    passFailEval.onEvaluate = this.generateBaseProperty("arrayPassFailStatus = __testMetrics__.isArrayPassing && __testMetrics__.currentRunPassing;", "slot", "");
    this.DocObj.elements[passFailID] = passFailEval;
    this.DocObj.structure[passFailID] = this.generateBaseStructure("evaluation", []);

    //Create the SendArrayPassFail BindingCall
    let sendPassFailProps = this.genPhaseBCProps(ipteLibraryData.functions.get("SendArrayPassFail").params);
    sendPassFailProps.arrayPassed.value = passFailID + ".arrayPassFailStatus";

    this.DocObj.elements[sendPassFailID] = this.generateBaseBindingCall("bindingCall", "SendArrayPassFail", unloadGroupID, "Unload", sendPassFailProps, "ileft.platform.iptehandler", "SendArrayPassFail", false);
    this.DocObj.structure[sendPassFailID] = this.generateBaseStructure("bindingCall", []);

    //-----------------------------------------------------------------

    //Setup the teardown group
    this.DocObj.elements[tearDownGroupID] = this.generateBaseGroup("group", "Teardown", "universalPartNumber", "Teardown", {}, false);
    this.DocObj.structure[tearDownGroupID] = this.generateBaseStructure("group", [tearDownID, endMessageID]);
    this.DocObj.structure.universalPartNumber.children.push(tearDownGroupID);

    //Create the teardown binding call
    this.DocObj.elements[tearDownID] = this.generateBaseBindingCall("bindingCall", "TearDown", tearDownGroupID, "Teardown", this.genPhaseBCProps(projectLibraryData.functions.get("TearDown").params), this.libraryName, "TearDown", true);
    this.DocObj.structure[tearDownID] = this.generateBaseStructure("bindingCall", []);

    //Create the send end message binding call
    this.DocObj.elements[endMessageID] = this.generateBaseBindingCall("bindingCall", "SendEndMessage", tearDownGroupID, "Teardown", this.genPhaseBCProps(ipteLibraryData.functions.get("SendEndMessage").params), "ileft.platform.iptehandler", "SendEndMessage", true);
    this.DocObj.structure[endMessageID] = this.generateBaseStructure("bindingCall", []);
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

    arrayCode  = arrayCode.slice(0,-1);

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


    //TODO this logic is not quite right. If there are multiple locked ECO, we run into issues.
    //I think I need to just throw an error if there are locked ECOs and not convert.

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
  
     //Update the checked out svn exports folder incase it was already checked out.
     svn.update(projectPath + "/generatedConfig");
     //Make the the iLEFT station folder is added
     fs.mkdirSync(`${projectPath}\\generatedConfig\\iLEFT`);
    
    for(let partNum in localsMaster) {
  
      //Make sure we create the part number folders
      fs.mkdirSync(`${projectPath}\\generatedConfig\\${partNum}`);
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
        if(subTest.testMethod == "WriteAquiredWaveformToFile_OnFailure") {
          const scriptEvalID = this.getEvaluationID();
          let waveformScript = this.generateWaveformSaveScript(subTest.testArgs.get("testFailed"), scriptEvalID);
          let evalName = `WaveformScript_${subTest.testArgs.get("waveformID")}`;

          let scriptEval = this.generateBaseGroup("evaluation", evalName, testGroupData.groupID, "Body", {}, false);
          scriptEval.evaluationType = this.generateBaseProperty("SCRIPTED", "builtin", "");
          scriptEval.lowLimit = this.generateBaseProperty("0", "builtin", "");
          scriptEval.highLimit = this.generateBaseProperty("0", "builtin", "");
          scriptEval.value = this.generateBaseProperty("0", "builtin", "");
          scriptEval.runtimeResume = this.generateBaseProperty(true, "builtin", "");
          scriptEval.updateTestMetrics = this.generateBaseProperty(false, "builtin", "");
          scriptEval.onEvaluate = this.generateBaseProperty(waveformScript, "slot", "");
          scriptEval.properties = {checkIfFailed: this.generateBaseProperty("", "string", "[OUTPUT]")};

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
              propertyValue = false;
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
        else if(subTest.exactValEval == "1") {testType = "EXACT"}
        else if(subTest.collectDataEval == "1") {testType = "COLLECTION"}
        else if(subTest.compareDataEval == "1") {testType = "STRING"}

        this.groupAndEvalMap[testGroupName].subTests.set(subTest.name, {newName: evaluation.description, subTestID: evaluationID, lowLimt: subTest.lowLimit, highLimit: subTest.highLimit, value: subTest.value, type: testType, boundLimitsMap: subTest.boundLimitsMap});
      })
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
  
  generateWaveformSaveScript(checkIfFailedStr, evaluationID) {
    let waveformSript = `${evaluationID}.checkIfFailed = !(`;
    checkIfFailedStr.split("|").forEach(testToCheck => {
      const testToCheckArray = testToCheck.split("::");


      if(this.groupAndEvalMap[testToCheckArray[0]].subTests.has(testToCheckArray[1]))
      {
        let evalIDToCheck = this.groupAndEvalMap[testToCheckArray[0]].subTests.get(testToCheckArray[1]).subTestID;
        waveformSript += `${evalIDToCheck}.runtime.passed || `;
      }
      
    })
    return waveformSript.slice(0,-4) + ");";
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

    if((limitCheck = subtest1.limitCheckEval == "1" && subtest2.limitCheckEval == "1") && (subtest1.lowLimit != subtest2.lowLimit || subtest1.highLimit != subtest2.highLimit)){

      if(!mergedSubTests.hasOwnProperty(boundLimitsMap)) {
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

  generateBaseBindingCall(type, description = "", parentIdentifier = "", phase = "Body", properties = {}, library = "", method = "", runtimeResume = true) {
    let bindingCall = this.generateBaseElement(type, description, parentIdentifier, phase, properties);
    bindingCall.loop = this.generateBaseProperty(0, "builtin", "");
    bindingCall.retry = this.generateBaseProperty(0, "builtin", "");
    bindingCall.skipped = this.generateBaseProperty(false, "builtin", "");
    bindingCall.updateTestMetrics = this.generateBaseProperty(false, "builtin", "");
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

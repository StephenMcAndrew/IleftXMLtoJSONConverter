
class TestPlan {

  constructor(testBinary) {
    this.username = document.getElementById("username").value;
    this.DocObj = JSON.parse(this.templateTPDocStr(this.username));
    this.libraryName = [];
    this.partNumbers;

    // Uses this to keep track of which groupID goes with which measurement caller
    // Map{[key => MeasurementCallerName_Meas value => {library: libraryName, groupID: groupID}]}
    this.measurementCallerMap = new Map();
  }

  //This method takes a JSON string and converts it to a JavaScript object string. I.g, it removes the "" from the object porperty names.
  JSONstr_To_JSstr(JSONstr) { return JSONstr.replace(/("[A-Za-z0-9_]+":)/g, (match) => match.replace(/"/g,'')); }

  //Return the the test plan documant as a JavaScript string.
  getDocObjAsJSstr(pretty = false) { return pretty ?  this.JSONstr_To_JSstr(JSON.stringify(this.DocObj, null, 2)) : this.JSONstr_To_JSstr(JSON.stringify(this.DocObj)); }

  addMeasurementCallers(dciGenLibrariesInfo, testPlanMethods) {

    let bundleNumber = 1;
    const universalPartNumberChildren = [];
    const masterListOfFuncNames = [];

    dciGenLibrariesInfo.forEach((libraryData, libraryName) => {

      //Add the bundle property to the universal part number
      let bundleName = libraryName + "." + libraryData.versionNumber + "-" + libraryData.platformName;
      this.DocObj.elements.universalPartNumber.properties["bundle" + bundleNumber.toString()] = this.generateBaseProperty(bundleName, "string", "");
      bundleNumber++;

      libraryData.functions.forEach(func => {

        if (testPlanMethods[libraryName].includes(func.name)) {
          let groupID = this.getGroupID();
          let bindingCallID = this.getBindingCallID();
  
          let MeasurementCallerProps = {};
          let BindingCallProps = {};
  
          //We need each measurement caller to a unique name. If the testplan is using more then one test binary library, we get get duplicate name.
          let functionName = func.name;
          let i = 2;
          while(masterListOfFuncNames.includes(functionName)){
            functionName = functionName + `_${i.toString()}`;
            i++;
          }
          masterListOfFuncNames.push(functionName);
          this.measurementCallerMap.set(functionName, {library: libraryName, groupID: groupID, bindingCallID: bindingCallID}); //Keep track of all the measurement caller names and what library they use. We'll need this when we start adding the subtest evaluations.
          
          //Generate the measurement caller and binding call properties from the DCIGen params
          func.params.forEach(param => {
            let paramType = (param.type == "bool") ? "boolean" : param.type;
            let measDescription = (param.direction == "OUT" || param.direction == "RETURN") ? "[OUTPUT]" : "[INPUT]";
            let bindingDescription = (param.description + " " + measDescription).trim();
            
            let measParamValue;
            let bindingParamValue;

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
                //measParamValue = "%index%";
                //bindingParamValue = `${groupID}.arrayIndex`
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
              if(param.name == "measurementResultParameter" || param.name == "measurementResultOut") {
                MeasurementCallerProps["measurementResult"] = this.generateBaseProperty(`${bindingCallID}.${param.name}`, "double", measDescription);
              }
              //else if(param.name == "arrayIndexStr") {
              //  MeasurementCallerProps["arrayIndex"] = this.generateBaseProperty(measParamValue, paramType, measDescription);  
              //}
              else {
                MeasurementCallerProps[param.name] = this.generateBaseProperty(measParamValue, paramType, measDescription);
              }
            }

            //If it's an input parameter we need to bind it to the group measurement caller input by setting the property value. Or if its the array index param, we set it to %index%
            //let bindingCallParmPropertyValue = "";
            //if(param.direction == "IN") {
            //  if(param.name == "arrayIndex" || param.name == "arrayIndexStr") { bindingCallParmPropertyValue = "%index%";}
            //  else {bindingCallParmPropertyValue = `${groupID}.${param.name}`;}
            //}
          
            BindingCallProps[param.name] = this.generateBaseProperty(bindingParamValue, paramType, bindingDescription);
          });
  
          this.DocObj.elements[groupID] = this.generateBaseGroup("group", functionName, "universalPartNumber", "Body", MeasurementCallerProps, true);
          this.DocObj.elements[groupID].retry = this.generateBaseProperty(0, "builtin", "");
          this.DocObj.elements[groupID].loop = this.generateBaseProperty(0, "builtin", "");

          this.DocObj.elements[bindingCallID] = this.generateBaseBindingCall("bindingCall", functionName, groupID, "Body", BindingCallProps, libraryName, func.name);
    
          this.DocObj.structure[groupID] = this.generateBaseStructure("group", [bindingCallID]);
          this.DocObj.structure[bindingCallID] = this.generateBaseStructure("bindingCall", []);
    
          universalPartNumberChildren.push(groupID);
        }

      });

    })
  
    this.DocObj.structure.universalPartNumber.children = this.DocObj.structure.universalPartNumber.children.concat(universalPartNumberChildren);
  }
  
  //This should be called every time a new group is created so we increment the group ID number
  groupIDNumber = 0;
  getGroupID() {
    this.groupIDNumber++;
    return "group" + this.groupIDNumber.toString();
  }

  //This should be called every time a new binding call is created so we increment the binding call ID number
  bindingCallIDNumber = 0;
  getBindingCallID() {
    this.bindingCallIDNumber++;
    return "bindingCall" + this.bindingCallIDNumber.toString();
  }

  managedPartNumberIDNumber = 0;
  getManagedPartNumberID() {
    this.managedPartNumberIDNumber++;
    return "managedPartNumber" + this.managedPartNumberIDNumber.toString();
  }

  evaluationIDNumber = 0;
  getEvaluationID() {
    this.evaluationIDNumber++;
    return "evaluation" + this.evaluationIDNumber.toString();
  }

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

  generateBaseGroup(type, description = "", parentIdentifier = "", phase = "Body", properties = {}, skipped = false) {
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
    //delete managedPartNumber.rows.description;
    managedPartNumber.columns = this.generateBaseProperty(numberOfIndexes, "builtin", "");
    //delete managedPartNumber.columns.description;

    managedPartNumber.arrayType = this.generateBaseProperty("SCRIPTED", "builtin", "");
    managedPartNumber.arrayCode = this.generateBaseProperty(this.generateArrayCode(numberOfIndexes), "builtin", "");

    return managedPartNumber;
  }

  generateArrayCode(numberOfIndexes) {
    let arrayCode = `{\"indexes\":[`

    for(let i = 1; i <= numberOfIndexes; i++) {
      let index = i.toString();
      arrayCode += `{\"row\":${index},\"column\":${index},\"description\":\"Index ${index}\",\"enabled\":true,\"identifier\":${index}},`
    }

    arrayCode  = arrayCode.slice(0,-1);
    
    arrayCode += `],\"sequences\":[`
    
    for(let i = 1; i <= numberOfIndexes; i++) {
      let index = i.toString();
      arrayCode += `{\"description\":\"Thread (${index})\",\"identifier\":${index},\"serialSteps\":{\"steps\":[${index}]}},`
    }

    arrayCode  = arrayCode.slice(0,-1);

    arrayCode += `]}`
   
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
        //Get the number od indexes from the ini param
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

 addConfiguration(INIs){
  let configProps = {};
  const masterConfigMap = new Map();
    INIs.forEach(ini => {
      ini.partNumbers.forEach(partNumber => {
        partNumber.params.forEach((value, key) => {
          if(!masterConfigMap.has(key) && key != "description") {
            masterConfigMap.set(key, value);
            configProps[key] = this.generateBaseProperty("", "string", "");
          }
        })
      })
    })

    //We want to add a "configuration" property to the testplan doc but not the globals doc
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

    this.generateGlobalFiles(configProps, INIs);


 }

generateGlobalFiles(configProps, INIs) {
  let globalsMaster = {};
  const ecoNumsMaster = new Set();

  //Generate the defaults 
  let defaults = {};
  for(var key in configProps) {
    if (configProps.hasOwnProperty(key)) {
      if (key != "configuration"){ defaults[key] = ""; }
    }
  }
  //Add the defaults to the globalsMaster
  this.partNumbers.forEach(partNum => {
    globalsMaster[partNum] = {};
    globalsMaster[partNum].Defaults = structuredClone(defaults);
  });

  INIs.forEach(ini => {     
    ini.partNumbers.forEach(partNumberSection => {

      let partNum = partNumberSection.seven_o_five;
      let ecoNum = partNumberSection.params.get("eCNum");
      ecoNumsMaster.add(ecoNum);
      let ecoObj = structuredClone(defaults);

      partNumberSection.params.forEach((value, key) =>{
        ecoObj[key] = value;
      })

      ini.sections.forEach(commSection =>{
        commSection.params.forEach((value, key) =>{
          ecoObj[key] = value;
        })
      })

      globalsMaster[partNum][ecoNum] = ecoObj;
    })
  })

  /*
  //We need sort the ECO numbers
  //Create a int values to the actual ECO name. Also create an array of the ECO int values to sort. 
  const ecoNumArray = [];
  let ecoNumToNameMap = new Map();
  ecoNumsMaster.forEach(ecoName => {
    let ecoNumber = parseInt(ecoName.replace(/\D/g,''));
    ecoNumToNameMap.set(ecoNumber, ecoName);
    ecoNumArray.push(ecoNumber);
  })

  ecoNumArray.sort((a,b) => {return a - b})
  
  console.log(ecoNumArray);
  */

  //Now add every ECO to every part number
  this.partNumbers.forEach(partNumber => {
    ecoNumsMaster.forEach(ecoNum => {
      if (!globalsMaster[partNumber].hasOwnProperty(ecoNum)) {
        for(let existingEco in globalsMaster[partNumber]){
          
          let islocked = globalsMaster[partNumber][existingEco].hasOwnProperty("lockEC") && globalsMaster[partNumber][existingEco].lockEC == "true";

          if(globalsMaster[partNumber].hasOwnProperty(existingEco) && existingEco != "Defaults" && !islocked) {
            globalsMaster[partNumber][ecoNum] = structuredClone(globalsMaster[partNumber][existingEco]);
          }
        }
      }
    })
    
  })

  //Update the checked out svn exports folder incase it was already checked out.
  svn.update(projectPath + "/generatedConfig");
  //Make the the iLEFT station folder is added
  fs.mkdirSync(`${projectPath}\\generatedConfig\\iLEFT`);
  
  for(let partNum in globalsMaster) {

    //Make sure we create the part number folders
    fs.mkdirSync(`${projectPath}\\generatedConfig\\${partNum}`);
    //Write the globals to the part number folders
    fs.writeFileSync(`${projectPath}\\generatedConfig\\${partNum}\\globals.json`, JSON.stringify(globalsMaster[partNum]), "utf-8");
    //Make sure the iLEFT station folder is created
    fs.mkdirSync(`${projectPath}\\generatedConfig\\${partNum}\\iLEFT`);
    //Make sure we have the empty limits and locals files
    fs.writeFileSync(`${projectPath}\\generatedConfig\\${partNum}\\iLEFT\\limits.json`, "", "utf-8");
    fs.writeFileSync(`${projectPath}\\generatedConfig\\${partNum}\\iLEFT\\locals.json`, "", "utf-8");  
  }
}

  addTestGroups(testPlanArray) {
    const masterTestGroupList = new Map();
    let firstTestPlan = true;
    let previousGroupId = "";
    testPlanArray.forEach(testPlan =>{
      testPlan.testGroups.forEach((testGroup, index, testGroupsArray) => {
        //Add the test group if it has not been added yet
        if(!masterTestGroupList.has(testGroup.name)) {

          const newGroupId = this.getGroupID();
          masterTestGroupList.set(testGroup.name, {groupID: newGroupId, associatedPartNumbers: testPlan.partNumbers, arrayOfSubTests: [testGroup.subTests]});

          let theTestGroup = this.generateBaseGroup("group", testGroup.name, "universalPartNumber", "Body", {}, false);
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
          masterTestGroupList.get(testGroup.name).associatedPartNumbers = Array.from(new Set(masterTestGroupList.get(testGroup.name).associatedPartNumbers.concat(testPlan.partNumbers)) );
          masterTestGroupList.get(testGroup.name).arrayOfSubTests.push(testGroup.subTests);
          previousGroupId = (masterTestGroupList.get(testGroup.name)).groupID;
        }
      })
      firstTestPlan = false;
    })

    masterTestGroupList.forEach((testGroupData, testGroupName, thisMap) => {
      //For each test group, the masterTestGroupList has an array of subtest arrays from each test plan we need to combine them into a single array of subtest that we can use to generate the evaluations.
      let masterSubTestArray = this.combineSubTests(testGroupData.arrayOfSubTests);
      //console.log(masterSubTestArray);
      //Add the assigned part numbers to the test group
      if(testGroupData.associatedPartNumbers.length < this.partNumbers.length) {
        this.DocObj.elements[testGroupData.groupID].assigned = this.generateBaseProperty(testGroupData.associatedPartNumbers.join(", "), "builtin", ""); 
      }
      
      masterSubTestArray.forEach(subTest => {
        const evaluationID = this.getEvaluationID();

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

        }
        
        //create the evaluation parameters
        let evaluationProps = {};
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
            else if (property == "measurementResult") {
              propertyValue = 0.0;
            }
            else if (!subTest.testArgs.has(property)) {
              propertyValue = '';
            }
            else {
              propertyValue = subTest.testArgs.get(property);;
            }
            evaluationProps[property].value = propertyValue;
            
          }
        }
      
        let evaluation = this.generateBaseEvaluation(subTest, testGroupName, testGroupData.groupID, measurementCallerID, `${measurementCallerID}.measurementResult`, evaluationProps);
        
        if(subTest.associatedPartNumbers.length < this.partNumbers.length) {
          evaluation.assigned = this.generateBaseProperty(subTest.associatedPartNumbers.join(", "), "builtin", "");
        }
        
        this.DocObj.elements[evaluationID] = evaluation;
        this.DocObj.structure[evaluationID] = this.generateBaseStructure("evaluation", []);

        this.DocObj.structure[testGroupData.groupID].children.push(evaluationID);

      })
    })
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
            let areSimilar = this.areSubTestsSimilar(subTest, masterSubTestMap.get(newSubTestName))
            if(areSimilar) {
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
    let args = true;

    subtest1.testArgs.forEach((value, key) => {
      if (subtest2.testArgs.has(key)) {
        args = args && (value == subtest2.testArgs.get(key));
      }
    })
    return (name && binary && lowLimit && highLimit && args);
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
    mergedSubTests.associatedPartNumbers = Array.from( new Set(subtest1.associatedPartNumbers.concat(subtest2.associatedPartNumbers)) );

    return mergedSubTests;
  }

  generateBaseEvaluation(subTestObj, testGroupName, parentIdentifier, subroutine, target,  properties = {}) {

    let testType = "";
    if(subTestObj.limitCheckEval == "1") {testType = "LIMITCHECK";}
    else if(subTestObj.passFailEval == "1") {testType = "PASSFAIL";}
    else if(subTestObj.exactValEval == "1") {testType = "EXACT"}
    else if(subTestObj.collectDataEval == "1") {testType = "COLLECTION"}
    
    let evaluation = this.generateBaseGroup("evaluation", `${testGroupName}_${subTestObj.name}`, parentIdentifier, "Body", {}, subTestObj.skipTest == "0" ? false : true);
    evaluation.comment = this.generateBaseProperty(subTestObj.description, "builtin", "");
    evaluation.loop = this.generateBaseProperty(parseInt(subTestObj.loopCount), "builtin", "");
    evaluation.retry = this.generateBaseProperty(parseInt(subTestObj.retryCount), "builtin", "");
    evaluation.subroutine = this.generateBaseProperty(subroutine, "builtin", "");
    evaluation.interstitialRetryDelay = this.generateBaseProperty(parseInt(subTestObj.retryDelayMillis), "builtin", "");
    evaluation.preExecuteDelay = this.generateBaseProperty(parseInt(subTestObj.preDelayMillis), "builtin", "");
    evaluation.postExecuteDelay = this.generateBaseProperty(parseInt(subTestObj.postDelayMillis), "builtin", "");
    evaluation.value = this.generateBaseProperty(subTestObj.value, "builtin", "");
    evaluation.highLimit = this.generateBaseProperty(subTestObj.highLimit, "builtin", "");
    evaluation.lowLimit = this.generateBaseProperty(subTestObj.lowLimit, "builtin", "");
    evaluation.evaluationType = this.generateBaseProperty(testType, "builtin", "");
    evaluation.target = this.generateBaseProperty(target, "builtin", "");
    evaluation.skipped = this.generateBaseProperty(false, "builtin", "");
    evaluation.updateTestMetrics = this.generateBaseProperty(true, "builtin", "");
    evaluation.runtimeRusume = this.generateBaseProperty(true, "builtin", "");
    evaluation.properties = properties;

    return evaluation;
  }

  generateBaseBindingCall(type, description = "", parentIdentifier = "", phase = "Body", properties = {}, library = "", method = "") {
    let bindingCall = this.generateBaseElement(type, description, parentIdentifier, phase, properties);
    bindingCall.loop = this.generateBaseProperty(0, "builtin", "");
    bindingCall.retry = this.generateBaseProperty(0, "builtin", "");
    bindingCall.skipped = this.generateBaseProperty(false, "builtin", "");
    bindingCall.updateTestMetrics = this.generateBaseProperty(false, "builtin", "");
    bindingCall.runtimeRusume = this.generateBaseProperty(true, "builtin", "");
    bindingCall.library = this.generateBaseProperty(library, "builtin", "");
    bindingCall.method = this.generateBaseProperty("TestBinaryServiceImpl_" + method, "builtin", "");
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

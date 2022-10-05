class TestPlan {

  constructor(testBinary) {
    this.username = document.getElementById("username").value;
    this.DocObj = JSON.parse(this.templateTPDocStr(this.username));
    this.libraryName = [];
  }

  //This method takes a JSON string and converts it to a JavaScript object string. I.g, it removes the "" from the object porperty names.
  JSONstr_To_JSstr(JSONstr) { return JSONstr.replace(/("[A-Za-z0-9_]+":)/g, (match) => match.replace(/"/g,'')); }

  //Return the the test plan documant as a JavaScript string.
  getDocObjAsJSstr(pretty = false) { return pretty ?  this.JSONstr_To_JSstr(JSON.stringify(this.DocObj, null, 2)) : this.JSONstr_To_JSstr(JSON.stringify(this.DocObj)); }

  
  addMeasurementCallers(dciGenLibrariesInfo) {

    let bundleNumber = 1;
    const universalPartNumberChildren = [];
    const masterListOfFuncNames = [];

    dciGenLibrariesInfo.forEach((libraryData, libraryName) => {

      //Add the bundle property to the universal part number
      let bundleName = libraryName + "." + libraryData.versionNumber + "-" + libraryData.platformName;
      this.DocObj.elements.universalPartNumber.properties["bundle" + bundleNumber.toString()] = this.generateBaseProperty(bundleName, "string", "");
      bundleNumber++;

      libraryData.functions.forEach(func => {

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
        
        //Generate the measurement caller and binding call properties from the DCIGen params
        func.params.forEach(param => {
          let paramType = (param.type == "bool") ? "boolean" : param.type;
          let description = (param.direction == "OUT") ? "[OUTPUT]" : "";
          MeasurementCallerProps[param.name] = this.generateBaseProperty("", paramType, description);;
          BindingCallProps[param.name] = this.generateBaseProperty(groupID + "." + param.name, paramType, description);
        });

        this.DocObj.elements[groupID] = this.generateBaseGroup("group", functionName, "universalPartNumber", "Body", MeasurementCallerProps, true);
        this.DocObj.elements[bindingCallID] = this.generateBaseBindingCall("bindingCall", functionName, groupID, "Body", BindingCallProps, libraryName, func.name);
  
        this.DocObj.structure[groupID] = this.generateBaseStructure("group", [bindingCallID]);
        this.DocObj.structure[bindingCallID] = this.generateBaseStructure("bindingCall", []);
  
        universalPartNumberChildren.push(groupID);
      });

      this.DocObj.structure.universalPartNumber.children = universalPartNumberChildren;

    })

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

  //Every group/binding call obect will have thes properties
  generateBaseElement(type, description = "", parentIdentifier = "", phase = "Body", properties = {}) {
    return {
      type: type,
      description: description,
      modificationTime: newDate.timeNow(),
      parentIdentifier: parentIdentifier,
      userName: this.username,
      phase: phase,
      properties: properties
    }
  }

  generateBaseGroup(type, description = "", parentIdentifier = "", phase = "Body", properties = {}, skipped = false) {
    let group = this.generateBaseElement(type, description, parentIdentifier, phase, properties);
    group.skipped = this.generateBaseProperty(skipped, "builtin", "");
    return group;
  }

  /*
  generateBaseEvaluation(description, parentIdentifier, comment, loop,   ) {
    let testGroup = this.generateBaseGroup("evaluation", description, parentIdentifier, "Body", {}, false);
    testGroup.comment = this.generateBaseProperty(comment, "builtin", "");
    testGroup.loop = this.generateBaseProperty(loop, "builtin", "");

    testGroup.interstitialRetryDelay = this.generateBaseProperty(retryDelay, "builtin", "");
    testGroup.postExecuteDelay = this.generateBaseProperty(postDelay, "builtin", "");
    testGroup.preExecuteDelay = this.generateBaseProperty(preDelay, "builtin", "");
    
    testGroup.try = this.generateBaseProperty(loop, "builtin", "");

  }
  */

  generateBaseBindingCall(type, description = "", parentIdentifier = "", phase = "Body", properties = {}, library = "", method = "") {
    let bindingCall = this.generateBaseElement(type, description, parentIdentifier, phase, properties);
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
          "description": "705-1234-001",
          "modificationTime": "${newDate.timeNow()}",
          "partNumber": {
            "description": "",
            "modificationTime": "${newDate.timeNow()}",
            "type": "string",
            "userName": "${username}",
            "value": "705-1234-001"
          },
          "parentIdentifier": "station",
          "properties": {
            "index1": {
              "value": 1,
              "description": "",
              "modificationTime": "${newDate.timeNow()}",
              "type": "int",
              "userName": "${username}"
            },
            "index2": {
              "value": 2,
              "description": "",
              "modificationTime": "${newDate.timeNow()}",
              "type": "int",
              "userName": "${username}"
            },
            "index3": {
              "value": 3,
              "description": "",
              "modificationTime": "${newDate.timeNow()}",
              "type": "int",
              "userName": "${username}"
            }
          },
          "userName": "${username}",
          "rows": {
            "value": 1,
            "modificationTime": "${newDate.timeNow()}",
            "userName": "${username}",
            "type": "builtin"
          },
          "columns": {
            "value": 3,
            "modificationTime": "${newDate.timeNow()}",
            "userName": "${username}",
            "type": "builtin"
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
    "name": "Stephens-Development-TestPlan"
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

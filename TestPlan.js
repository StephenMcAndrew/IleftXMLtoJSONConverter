//Provides a function to generate the current date time in the format expected by TPE 
Date.prototype.timeNow = function() {
  return this.getFullYear() + "-" +(this.getMonth()+1) + "-" + this.getDate() + "T" + this.getHours() + ":" + this.getMinutes() + ":" + this.getSeconds() + "." + this.getMilliseconds() + "Z";
}

let username = document.getElementById("username").value;

//Create a new Date object
let newDate = new Date();

//The starting point of our testplan 
let templateTPDocStr = `{
  "elements": {
  "testpan": {
    "type": "testPlan",
    "description": "Test Plan root element",
    "modificationTime": "${newDate.timeNow()}",
    "properties": {},
    "userName": "${username}",
    "parentIdentifier": ""
  },
  "universalPartNumber": {
    "type": "legacyPartNumber",
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
      "bundle1": {
        "value": "ileft.testmethods.corefdm2p0commtests.1.0.0-windows-x32-vc10",
        "modificationTime": "${newDate.timeNow()}",
        "userName": "${username}",
        "type": "string",
        "description": ""
      },
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
    "type": "legacyPartNumber",
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


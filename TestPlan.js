 
let theTestPlan = `{
    "elements": {
      "testpan": {
        "type": "testPlan",
        "description": "Test Plan root element",
        "modificationTime": "2021-12-31T15:56:46.000Z",
        "properties": {},
        "userName": "stephen.mcandrew",
        "parentIdentifier": ""
      },
      "universalPartNumber": {
        "type": "legacyPartNumber",
        "description": "705-1234-001",
        "modificationTime": "2022-09-09T15:16:42.000Z",
        "partNumber": {
          "description": "",
          "modificationTime": "2021-12-31T15:56:11.000Z",
          "type": "string",
          "userName": "stephen.mcandrew",
          "value": "705-1234-001"
        },
        "parentIdentifier": "station",
        "properties": {
          "bundle1": {
            "value": "ileft.testmethods.corefdm2p0commtests.1.0.0-windows-x32-vc10",
            "modificationTime": "2021-12-31T15:56:11.000Z",
            "userName": "stephen.mcandrew",
            "type": "string",
            "description": ""
          }
        },
        "userName": "stephen.mcandrew"
      },
      "tests": {
        "type": "tests",
        "description": "Tests root element",
        "modificationTime": "2021-12-31T15:56:46.000Z",
        "parentIdentifier": "testplan",
        "properties": {},
        "userName": "stephen.mcandrew"
      },
      "flow": {
        "type": "flow",
        "description": "Flow root element",
        "modificationTime": "2021-12-31T15:56:46.000Z",
        "parentIdentifier": "testplan",
        "properties": {},
        "userName": "stephen.mcandrew"
      },
      "station": {
        "type": "station",
        "description": "iLEFT",
        "modificationTime": "2021-12-31T15:56:11.000Z",
        "parentIdentifier": "tests",
        "properties": {},
        "userName": "stephen.mcandrew"
      },
      "requirements": {
        "type": "requirements",
        "description": "Requirements root element",
        "modificationTime": "2021-12-31T15:56:46.000Z",
        "parentIdentifier": "testplan",
        "properties": {},
        "userName": "stephen.mcandrew"
      },
      "fixturing": {
        "type": "fixturing",
        "description": "Fixturing root element",
        "modificationTime": "2021-12-31T15:56:46.000Z",
        "parentIdentifier": "testplan",
        "properties": {},
        "userName": "stephen.mcandrew"
      },
      "bindingCall13": {
        "type": "bindingCall",
        "library": {
          "value": "ileft.testmethods.corefdm2p0commtests",
          "modificationTime": "2021-12-31T15:56:11.000Z",
          "userName": "stephen.mcandrew",
          "type": "builtin",
          "description": ""
        },
        "method": {
          "value": "SetPowerSupplyVoltageAndCurrent",
          "modificationTime": "2021-12-31T15:56:11.000Z",
          "userName": "stephen.mcandrew",
          "type": "builtin",
          "description": ""
        },
        "description": "SetPowerSupplyVoltageAndCurrent",
        "modificationTime": "2021-12-31T15:56:11.000Z",
        "parentIdentifier": "group17",
        "properties": {
          "voltage": {
            "value": "group17.voltage",
            "modificationTime": "2021-12-31T15:56:11.000Z",
            "userName": "stephen.mcandrew",
            "type": "string",
            "description": ""
          },
          "result": {
            "value": "0.0",
            "modificationTime": "2021-12-31T15:56:11.000Z",
            "userName": "stephen.mcandrew",
            "type": "double",
            "description": "[OUTPUT]"
          },
          "currentLimit": {
            "value": "group17.currentLimit",
            "modificationTime": "2021-12-31T15:56:11.000Z",
            "userName": "stephen.mcandrew",
            "type": "string",
            "description": ""
          }
        },
        "userName": "stephen.mcandrew",
        "phase": "Body"
      },
      "group17": {
        "type": "group",
        "description": "SetPowerSupplyVoltageAndCurrent",
        "modificationTime": "2021-12-31T15:56:11.000Z",
        "parentIdentifier": "universalPartNumber",
        "properties": {
          "voltage": {
            "value": "",
            "modificationTime": "2021-12-31T15:56:11.000Z",
            "userName": "stephen.mcandrew",
            "type": "string",
            "description": ""
          },
          "measurementResult": {
            "value": "bindingCall13.result",
            "modificationTime": "2021-12-31T15:56:11.000Z",
            "userName": "stephen.mcandrew",
            "type": "double",
            "description": "[OUTPUT]"
          },
          "currentLimit": {
            "value": "",
            "modificationTime": "2021-12-31T15:56:11.000Z",
            "userName": "stephen.mcandrew",
            "type": "string",
            "description": ""
          }
        },
        "userName": "stephen.mcandrew",
        "phase": "Body",
        "skipped": {
          "value": true,
          "modificationTime": "2021-12-31T15:56:11.000Z",
          "userName": "stephen.mcandrew",
          "type": "builtin",
          "description": ""
        }
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
        "children": [
          "group17"
        ]
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
      },
      "bindingCall13": {
        "type": "bindingCall",
        "children": []
      },
      "group17": {
        "type": "group",
        "children": [
          "bindingCall13"
        ]
      }
    },
    "rootElementIdentifier": "testplan",
    "name": "Stephens-Development-TestPlan"
}`




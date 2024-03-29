/********************************************************************************************************************************
*   This file contains all the code related to combining all the selected XML files and connverting them into a single JSON file.
*********************************************************************************************************************************/

/*
* The main function that does the work of reading in the data from the .planxml and ini files and converting it to a json testplan that can be sent to TPE with a GraphQL mutation.
* It basically just calls a bunch of helper functions sequentially. 
*/
async function onConvert() {
    
    //Alert the user if no files have been selected to conver
    if(selectedFiles.length == 0) {
        alert("Please select Ileft .planx files to convert.");
        return 0;
    }

    //Read the .planxml files into stings. The variable xmlStringArray is an array of objects that hold the testplan file name and the xml string.
    const xmlStringArray = await readFilesToStringArray(selectedFiles);
    
    //Read the .ini files into strings. The variable iniStringArray is an array of objects that hold the ini file names and the ini string.
    const iniStringArray = await readFilesToStringArray(selectedINIs);
   
    //Parse the ini strings into and array of ini Javascript objects
    const INIs = parseINIsToJSObjArray(iniStringArray);

    //Your local path to your project
    projectPath = xmlStringArray[0].path.substring(0, xmlStringArray[0].path.lastIndexOf("\\"));

    //Create the testplan export forlder in svn. If it already exists, the mkdir command throws and error and does nothing
    svn.mkdir(svnConfigPath + "/" + testPlanName);
    //Remove the old local folder
    fs.rmSync(projectPath + "\\generatedConfig");
    //Make the local folder that we will check out the exports folder to.
    fs.mkdirSync(projectPath + "\\generatedConfig");
    //Check out the svn exports folder. If it is already checked out, the checkout command throws and error and does nothing.
    svn.checkout(svnConfigPath + "/" + testPlanName, projectPath + "\\generatedConfig");

    //Parse each string in the xmlStringArray into a XMLDoc object. The vaiable xmlDocArray is an array of objects that hold the testplan file name and the xml ducument.
    const xmlDocArray = await parseXMLStringArrayToXMLDocArray(xmlStringArray);

    //Parse each xml doc along with the INI key values into a JavaScript object. 
    const testPlanArray = parseXMLDocsAndINsToJSObjArray(xmlDocArray, INIs);

    //Get all the test binaries used from the xml docs
    const testBinaries = getTestBinaries(xmlDocArray);

    //Get all the methods used in the .planxml test plans. We only want to add measurement callers for the test methods we use from the DCIGen library
    let testPlanMethods = extractTestMethodsFromXMLDocArray(xmlDocArray);

    //Use the GraphQL API to get the DciGen library information of the latest version 
    const dciGenLibrariesInfo = getDciGenLibrariesInfo(testBinaries);

    //Create the TestPlan object
    theTestPlan = new TestPlan();

    //Add all the measurement callers for the test methods used in the testplan. We use the DCIGen library info to create the measurement callers.
    theTestPlan.addMeasurementCallers(dciGenLibrariesInfo, testPlanMethods);

    //Generate the Init and Load phases 
    theTestPlan.addInitAndLoad(dciGenLibrariesInfo);

    //Add all the part numbers from the INIs to the converted testplan
    theTestPlan.addPartNumbers(INIs);

    //Generate the config element. Add all the configuration key value pairs from the ini's. Generate the json globals file.
    theTestPlan.addConfiguration(INIs, testPlanArray);

    //Add all the test groups along with all the subtests
    theTestPlan.addTestGroups(testPlanArray);

    theTestPlan.addLimitsAndGlobals();

    //Generate the Unload and Teardown phases
    theTestPlan.addUnloadAndTeardown(dciGenLibrariesInfo);
    
    
    //console.log(dciGenLibrariesInfo);

    console.log(theTestPlan.DocObj);
    

    console.log(TestPlan.JSONstr_To_JSstr(JSON.stringify(theTestPlan.DocObj, null, 2)));
}

/*
* This function reads each selected .planxml or .ini file into a string. Each xml or ini string is then placed in an object that has a name:"testPlanName.planxml" and 
* str:"The xml string ..." property
*
* Param: selectedFiles => An array of user selected file 
* Return: stringArray => An array of xml string objects [{name:"testPlanName.planxml", str:"The xml string ..."}, ...]
*/
async function readFilesToStringArray(selectedFiles) {
    const stringArray = selectedFiles.map(file => {
        const reader = new FileReader();
        return new Promise( resulve => {
            reader.onload = () => {
                xmlStringObj = {
                    name: file.name,
                    str: reader.result,
                    path: file.path
                };
                resulve(xmlStringObj);
            }
            reader.readAsText(file);
        });
    });
    return await Promise.all(stringArray);
}

/*
* This function takes an array of xml string objects and parses all the strings into xml DOM objects 
*
* Param: xmlStringArray => An array of xml string object [{name:"testPlanName.planxml", str:"The xml string ..."}, ...]
* Return: xmlDocArray => An array of xml doc objects [{name:"testPlanName.planxml", doc:theXmlDomObj{}}, ...]
*/
async function parseXMLStringArrayToXMLDocArray(xmlStringArray) {
    const xmlDocArray = xmlStringArray.map(xml => {
        const xmlParser = new DOMParser();
        return new Promise( resulve => {
            let xmlDocObj = {
                name: xml.name,
                doc: xmlParser.parseFromString(xml.str, "text/xml")
            }
            resulve(xmlDocObj);
        });
    });
    return await Promise.all(xmlDocArray);
}

/*
* This function parses all the xml DOM objects and places all the names of the test binaries used into an array
*
* Param: xmlDocArray => An array of xml doc objects [{name:"testPlanName.planxml", doc:theXmlDomObj{}}, ...]
* Return: masterTestBinaryArray => An array of the test binary names ["binaryName1", "binaryName2", ...]
*/
function getTestBinaries(xmlDocArray)
{
    const masterTestBinaryArray = [];
    xmlDocArray.forEach(xmlDoc => {
        let testBinary_Nodes = xmlDoc.doc.evaluate("/boost_serialization/testPlan/m_testStations/item/m_testBinarySetupArgs//first", xmlDoc.doc, null, XPathResult.ANY_TYPE, null);
        let testBinary_Node = testBinary_Nodes.iterateNext();
        while(testBinary_Node) {
            testBinaryName = testBinary_Node.childNodes[0].nodeValue;
            if(!masterTestBinaryArray.includes(testBinaryName))
            {
                masterTestBinaryArray.push(testBinaryName);
            }
            testBinary_Node = testBinary_Nodes.iterateNext();
        }
    });

    //We also need the IPTE library, SVN client, and qtui
    masterTestBinaryArray.push("ileft.platform.iptehandler");
    masterTestBinaryArray.push("gtm.utilities.subversionclient");
    masterTestBinaryArray.push("gtm.utilities.qtui");

    return masterTestBinaryArray;
}


/*
* This function takes the list of test binaries used in the testplan and makes a GraphQL request to the TPE endpoint to get the DCIGen library information 
*
* Param: testBinaries => An array of the test binary names ["binaryName1", "binaryName2", ...]
* Return: dciGenLibrariesInfo => A map of the test binary names to the DCIGen info 
Map{ 
    [
        key => "binaryName1"
        value => {
            versionNumber: "3.0.0",
            platformName: "windows-x32-any"
            functions: Map{
				[
					key => "TestMethodName"
					value => {
						name: "TestMethodName",
						description: "This test method does something",
						className: "TestBinaryServiceImpl",
						classDescription: "A DCIGen class description"
						params: [
							{
								name: "TestMethodParamName",
								type: "string",
								enumName: "",
								direction: "OUT" (or "IN"),
								description: "this is a parameter"
								default: "";
						
							},
							...
						]
					}
				],
                ...
			}
		}
    ],
	...
}
*/
function getDciGenLibrariesInfo(testBinaries) { 
    const dciGenLibrariesInfo = new Map();
    testBinaries.forEach(testBinary => {
        
        const xhr_TPE = new XMLHttpRequest();

        //Open the XHR object to make the json request and set the needed header info
        xhr_TPE.open("POST", TPE_endpoint + "graphql", false);
        xhr_TPE.setRequestHeader("Authorization","Bearer " + bearerToken);
        xhr_TPE.setRequestHeader("Content-Type", "application/json");

        let dataToSend = {
            query: `query { 
                library( where: { libraryName: "${testBinary}" } ){ 
                    versions{
                        versionNumber
                        platformName
                        functions{
                            name
                            description
                            className
                            classDescription
                            params{
                                name
                                description
                                direction
                                type
                                default
                                enumName
                            }
                        }
                    }
                }
            }`, 
            variables: {}
        };

        console.log(JSON.stringify(dataToSend));

        xhr_TPE.send(JSON.stringify(dataToSend));
        let response = JSON.parse(xhr_TPE.responseText);
        console.log(response);
        const versions = response.data.library.versions;
        dciGenLibrariesInfo.set(testBinary, versions[versions.length - 1]);

        //Instead of having the function objects in an array, we put them in a map for easier searching.
        dciGenLibrariesInfo.get(testBinary).functions = new Map(
            dciGenLibrariesInfo.get(testBinary).functions.map( func => {
                return [func.name, func];
            })
        )    

    });

    return dciGenLibrariesInfo;
}

/*
* This function and an array of ini files string objects and parses the content into a INI object array
* 
* Param: iniStringArray => An array of ini string object {name: "T750bFdm_E0012345.ini", str: "The ini string ..."}
* Return: INIs => An array of INI objects 
[
    {
        fileName: "T750bFdm_E0012345.ini",
        partNumbers: [ 
            {
                seven_o_five: "705-5200-001",
                params: Map{
                    [
                        key => "programId"
                        value => "2178"
                    ],
                    ...
                }
            },
            ...
        ]
        sections: [
            {
                name: "Communications1",
                params: Map{
                    [
                        key => "Hardware"
                        value => "Serial"
                    ],
                    ...
                }
            },
            ...
        ]
    },
    ...
]
*/
function parseINIsToJSObjArray(iniStringArray){
    const INIs = [];
    const regexPartNumber = /^(PARTNUMBER\s*=)/; //Regex for a partnumber section
    const regexSection = /^(\[[A-Za-z0-9_]+\])/; //Regex for a communication section
    const regexParam = /^([A-Za-z0-9_]+\s*=)/; //Regex for a key=value parameter
    iniStringArray.forEach(ini => {
        let iniObj = {};
        iniObj.fileName = ini.name;
        let commSectionCount = 1; //Keep track of the commsections that are not either the main comm settings or the barcode scanner setting

        //Put each line of the ini into and array
        const iniLines = (ini.str.split(/\r?\n/)).map(line =>{
            return line.trim();
        });

        const partNumbersArray = []; //To keep track of the part number sections
        const sectionsArray = []; //To keep track of the communication sections
        let lineIndex = 0;
        while(lineIndex < iniLines.length) {

            let line = iniLines[lineIndex];

            //If the line is not in the form key = value of [SectionName], we can move to the next line 
            if(!(regexParam.test(line) || regexSection.test(line))){ 
                lineIndex++;
                continue 
            }

            //We're at a part number section
            if (regexPartNumber.test(line)) {
                //Get the 705 and add -001
                partNumber = {}
                partNumber.seven_o_five = line.split("=")[1].trim() + "-001";
                
                paramsMap = new Map();//The will hold our key value pairs

                // We use this for the retest count
                paramsMap.set("pARTNUMBER", line.split("=")[1].trim());

                //Get the next line
                lineIndex++;
                line = iniLines[lineIndex];

                //Keep reading key value params until we get to either a new partnumber section or communication section
                while(!regexPartNumber.test(line) && !regexSection.test(line) && lineIndex < iniLines.length) {
                    
                    //If the line is not in the form key = value, we can move to the next line 
                    if(!regexParam.test(line)){
                        lineIndex++;
                        line = iniLines[lineIndex];
                        continue 
                    }

                    //Sometimes we hava a parameter key but no value on the other side
                    if(line.split("=")[1].trim() == null){
                        paramsMap.set((line.split("=")[0].trim()).firstToLowerCase(), "");
                        lineIndex++;
                        line = iniLines[lineIndex];
                        continue 
                    }

                    //Put the key value parameter pair in the map. Keys must start with a lower case letter
                    paramsMap.set((line.split("=")[0].trim()).firstToLowerCase(), line.split("=")[1].trim());
                    lineIndex++;
                    line = iniLines[lineIndex];
                }

                // We change the LockEC param to eclReleaseStatus
                if (paramsMap.has("LockEC") || paramsMap.has("lockEC")) {
                    paramsMap.set("ecoReleaseStatus", paramsMap.get("lockEC") == "true" ? "false" : "true");
                    paramsMap.delete("lockEC");
                } 
                else {
                    paramsMap.set("ecoReleaseStatus", "true" );
                }

                //We want to change the names of the following params a bit. These match what we use in combo better.
                if (paramsMap.has("opsManagerPartNumber")) {
                    paramsMap.set("opsManPartNumber", paramsMap.get("opsManagerPartNumber"));
                    paramsMap.delete("opsManagerPartNumber");
                }
                if (paramsMap.has("opsManagerBOMRevision")) {
                    paramsMap.set("opsManBomRevision", paramsMap.get("opsManagerBOMRevision"));
                    paramsMap.delete("opsManagerBOMRevision");
                }
                if (paramsMap.has("opsManagerVersion")) {
                    paramsMap.set("opsManVersion", paramsMap.get("opsManagerVersion"));
                    paramsMap.delete("opsManagerVersion");
                }

                //We always need to have this
                paramsMap.set("enableOpsManager", "true");

                partNumber.params = paramsMap;
                partNumbersArray.push(partNumber);
            }

            //We're at a section 
            if (regexSection.test(line)) {
                let section = {};

                section.name = line.replace(/\[/g, "").replace(/\]/g, "").trim();

                if(section.name != "Communications" && section.name != "Communications1") {
                    commSectionCount++;
                }

                paramsMap = new Map(); //This will hold our key value pairs

                //Get the next line
                lineIndex++;
                line = iniLines[lineIndex];

                //Keep reading lines until we get to a new section, part number, or the end of the file
                while(!regexPartNumber.test(line) && !regexSection.test(line) && lineIndex < iniLines.length) {
                    //If the line is not in the form key = value, we can move to the next line 
                    if(!regexParam.test(line)){
                        lineIndex++;
                        line = iniLines[lineIndex];
                        continue 
                    }

                    //We need to change some of the paramter names to work with the new DCIGen library
                    //I'm going to make some assumptions. The first comm section is always the main one. The second is always the scanner.
                    let key = (line.split("=")[0].trim()).firstToLowerCase();
                    let value = line.split("=")[1].trim() != null ? line.split("=")[1].trim() : "";

                    if(section.name == "Communications") {
                        if( key == "hardware") {
                            paramsMap.set("opsManProtocol", value);
                        }
                        else {
                            paramsMap.set("opsManProtocal_" + key, value);
                        } 
                    }
                    else if(section.name == "Communications1") {
                        if( key == "hardware") {
                            paramsMap.set("keyenceScannerProtocol", value);
                        }
                        else if( key == "port") {
                            paramsMap.set("keyenceScannerPort", value);
                        }
                        else if( key == "lasedBarcodePrefix") {
                            paramsMap.set("barcodePrefix", value);
                        }
                        else if( key == "expectedBarCodeSize") {
                            paramsMap.set("barcodeSize", value);
                        }
                        else {
                            paramsMap.set("keyenceScannerProtocol_" + key, value);
                        }
                    }
                    else {
                        paramMap.set("comm" + commSectionCount.toString() + key, value);
                    }

                    lineIndex++;
                    line = iniLines[lineIndex];
                }
                section.params = paramsMap;
                sectionsArray.push(section);
            }   
        };
        iniObj.partNumbers = partNumbersArray;
        iniObj.sections = sectionsArray;
        INIs.push(iniObj);
    })
    return INIs;
}

/*
* This functions takes all the test plan data from the .ini and the .planxml files and puts it into a javascrtip object array.
*
* Param: xmlDocArray => An array of xml doc objects [{name:"testPlanName.planxml", doc:theXmlDomObj{}}, ...]
* Param: INIs => An object array that holds all the ini info. See parseINIsToJSObjArray() comments for details.
* Return: convertedTestPlansArray => An array of testplan objects that hold all the relevant .planxml and .ini data
[
    {
        fileName: "700-0766.planxml",
        partNumbers: [700-5200-001, ...],
        testBinaries: ["testBinary1", ...],
        testerConfigFile: Instruments_3up_Reverse.cfg,
        nodeMapFile: NodeMap700-0766.cfg,
        gpDigFile: GP700-0766.cfg,
        testGroups: [
            {
                name: "UUT_Pwr",
                associatedPartNumbers: [700-5200-001, ...],
                subTests: [
                    {
                        name: "Battery13p8",
                        testMethod: "MeasureDcVoltage",
                        description: "Measure Voltage On Battery",
                        compareDataEval: "0",
                        collectDataEval: "0",
                        exactValEval: "0",
                        highLimit: "14.3",
                        value: "13.8",
                        lowLimit: "13.3",
                        limitCheckEval: "0",
                        loopCount: "0",
                        passFailEval: "0",
                        postDelayMillis: "0",
                        preDelayMillis: "0",
                        retryCount: "10",
                        retryDelayMillis "0",
                        skipTest: "0",
                        testBinary: ileft.testmethods.t750bfdmcommtests",
                        associatedPartNumbers: [700-5200-001, ...],
                        testArgs: Map{
                            [
                                key: "minusNode"
                                value: "B00"
                            ],
                            ...
                        }
                    },
                    ...
                ]
            },
            ...
        ]
    },
    ...
]
*/
function parseXMLDocsAndINsToJSObjArray(xmlDocArray, INIs){
    
    const convertedTestPlansArray = [];
    //Loop through each xml document testplan
    xmlDocArray.forEach(xmlDoc => {
       
        let testPlan = {};
        testPlan.fileName = xmlDoc.name;

        //Loop through all the ini objects and get the part numbers associated with the current testplan
        associatedPartNumbers = [];
        INIs.forEach(file => {
            file.partNumbers.forEach(partNumber => {
                let planFile = partNumber.params.get("planFile");
                if(planFile == xmlDoc.name){
                    if(!associatedPartNumbers.includes(partNumber.seven_o_five)) {
                        associatedPartNumbers.push(partNumber.seven_o_five);
                    }   
                }
            })
        })
        testPlan.partNumbers = associatedPartNumbers;

        let configFile_Nodes = xmlDoc.doc.evaluate("/boost_serialization/testPlan/m_testStations/item/m_testBinarySetupArgs/item/second/item", xmlDoc.doc, null, XPathResult.ANY_TYPE, null);
        let configFile_Node = configFile_Nodes.iterateNext();

        while(configFile_Node) {
            const key_value = configFile_Node.childNodes[0].nodeValue.split("=");
            if(key_value[0] == "config_file") {
                testPlan.testerConfigFile = key_value[1];
            }
            else if(key_value[0] == "NodeMap_file") {
                testPlan.nodeMapFile = key_value[1];
            }
            else if(key_value[0] == "GPdig_file") {
                testPlan.gpDigFile = key_value[1];
            }
            configFile_Node = configFile_Nodes.iterateNext();
        }

        //Get the test binaries used by this testplan
        const testBinaryArry  = [];
        let testBinary_Nodes = xmlDoc.doc.evaluate("/boost_serialization/testPlan/m_testStations/item/m_testBinarySetupArgs//first", xmlDoc.doc, null, XPathResult.ANY_TYPE, null);
        let testBinary_Node = testBinary_Nodes.iterateNext();
        while(testBinary_Node) {
            testBinaryArry.push(testBinary_Node.childNodes[0].nodeValue);
            testBinary_Node = testBinary_Nodes.iterateNext();
        }
        testPlan.testBinaries = testBinaryArry;
        
        //Get the test group nodes
        const testGroupArray = [];
        let testGroup_nodes = xmlDoc.doc.evaluate("/boost_serialization/testPlan/m_testStations/item/m_tests/item", xmlDoc.doc, null, XPathResult.ANY_TYPE, null);
        let testGroup_node = testGroup_nodes.iterateNext();

        let hasInitBeenAdded = false;

        //Loop through the test group nodes
        while(testGroup_node){
            let testGroup = {};
            
            testGroup.name = testGroup_node.getElementsByTagName("m_name")[0].childNodes[0].nodeValue;
            testGroup.associatedPartNumbers = associatedPartNumbers;

            const subTestsArray = [];

            //Get the subtest nodes
            let subTest_nodes = xmlDoc.doc.evaluate("m_subTests/item", testGroup_node, null, XPathResult.ANY_TYPE, null);
            let subTest_node = subTest_nodes.iterateNext();

            //Loop through the subtest nodes and extract the needed info
            while(subTest_node) {
                let subTest = {};
                subTest.name = subTest_node.getElementsByTagName("m_name")[0].childNodes[0].nodeValue;
                subTest.description = (subTest_node.getElementsByTagName("m_description")[0].childNodes[0] == null) ? "" : subTest_node.getElementsByTagName("m_description")[0].childNodes[0].nodeValue.trim();
                subTest.testBinary = subTest_node.getElementsByTagName("m_testBinary")[0].childNodes[0].nodeValue;
                subTest.testMethod = subTest_node.getElementsByTagName("m_testMethod")[0].childNodes[0].nodeValue;
                subTest.skipTest = subTest_node.getElementsByTagName("m_skipTest")[0].childNodes[0].nodeValue;
                subTest.passFailEval = subTest_node.getElementsByTagName("m_passFailEval")[0].childNodes[0].nodeValue;
                subTest.limitCheckEval = subTest_node.getElementsByTagName("m_limitCheckEval")[0].childNodes[0].nodeValue;
                subTest.exactValEval = subTest_node.getElementsByTagName("m_exactValEval")[0].childNodes[0].nodeValue;
                subTest.compareDataEval = subTest_node.getElementsByTagName("m_compareDataEval")[0].childNodes[0].nodeValue;
                subTest.collectDataEval = subTest_node.getElementsByTagName("m_collectDataEval")[0].childNodes[0].nodeValue;
                subTest.lowLimit = roundNumString(subTest_node.getElementsByTagName("m_lowLimit")[0].childNodes[0].nodeValue);
                subTest.value = roundNumString(subTest_node.getElementsByTagName("m_value")[0].childNodes[0].nodeValue);
                subTest.highLimit = roundNumString(subTest_node.getElementsByTagName("m_highLimit")[0].childNodes[0].nodeValue);
                subTest.preDelayMillis = subTest_node.getElementsByTagName("m_preDelayMillis")[0].childNodes[0].nodeValue;
                subTest.postDelayMillis = subTest_node.getElementsByTagName("m_postDelayMillis")[0].childNodes[0].nodeValue;
                subTest.loopCount = subTest_node.getElementsByTagName("m_loopCount")[0].childNodes[0].nodeValue;
                subTest.retryCount = subTest_node.getElementsByTagName("m_retryCount")[0].childNodes[0].nodeValue;
                subTest.retryDelayMillis = subTest_node.getElementsByTagName("m_retryDelayMillis")[0].childNodes[0].nodeValue;
                subTest.retryDelayMillis = subTest_node.getElementsByTagName("m_retryDelayMillis")[0].childNodes[0].nodeValue;
                subTest.associatedPartNumbers = associatedPartNumbers;

                //Get the argumant nodes
                const argMap = new Map();
                let testArg_nodes = xmlDoc.doc.evaluate("m_testArgs/item", subTest_node, null, XPathResult.ANY_TYPE, null);
                let testArg_node = testArg_nodes.iterateNext();

                //Loop through the argument nodes and extract the needed info
                while(testArg_node) {
                    let argStr = testArg_node.childNodes[0].nodeValue;
                    let key_value = argStr.split("=");
                    let key = key_value[0].firstToLowerCase();
                    let value = key_value[1];
                    if(key == "state") {
                        key = "stateParameter";
                    }
                    else if(key == "timeout_ms"){
                        key = "timeoutms"
                    }
                    else if(key == "tests_CheckIfFailed"){
                        key = "testFailed"
                    }
                    argMap.set(key, value); 
                    testArg_node = testArg_nodes.iterateNext();
                }

                subTest.testArgs = argMap;
                subTestsArray.push(subTest);
                subTest_node = subTest_nodes.iterateNext();
            }
            
            testGroup.subTests = subTestsArray;
            testGroupArray.push(testGroup);
            testGroup_node = testGroup_nodes.iterateNext();
        }

        testPlan.testGroups = testGroupArray;
        convertedTestPlansArray.push(testPlan);  
    });
    return convertedTestPlansArray;
}

/*
* This function extracts all the test methods used across all the testplans. To keep the TPE testplan as simple as possible,
* we only want to include the used testmethods from the converted DCIGen library.
*
* Param: xmlDocArray => An array of xml doc objects [{name:"testPlanName.planxml", doc:theXmlDomObj{}}, ...]
* Return: masterListOfTestMethods => An object that hold the master list of all testMethods used from each test binary
{
    ileft.testmethods.instrumentcontrol: [MeasureDCVoltage, ...],
    ileft.testmethods.t750bfdmcommtests: [GetBarcodes, ...],
    ...
}
*/
function extractTestMethodsFromXMLDocArray(xmlDocArray) {
    
    let masterListOfTestMethods = {};

    //For each XML doc in the array
    xmlDocArray.forEach(xmlDoc => {
        //Get the list of all the test group nodes in the current doc.
        let testGroup_nodes = xmlDoc.doc.evaluate("/boost_serialization/testPlan/m_testStations/item/m_tests/item", xmlDoc.doc, null, XPathResult.ANY_TYPE, null);
        let testGroup = testGroup_nodes.iterateNext()
        //Loop through the test group nodes
        while(testGroup) {
            //Get the list of sub test nodes in the current test group.
            let subTest_nodes = xmlDoc.doc.evaluate("m_subTests/item", testGroup, null, XPathResult.ANY_TYPE, null);
            let subTest = subTest_nodes.iterateNext()
            //Loop through the subtest nodes
            while(subTest) {

                //Get the test method name and binary
                let testMethodName = subTest.getElementsByTagName("m_testMethod")[0].childNodes[0].nodeValue;
                let testBinaryName = subTest.getElementsByTagName("m_testBinary")[0].childNodes[0].nodeValue;

                //Add them to the master list if they are not already included
                if(!masterListOfTestMethods.hasOwnProperty(testBinaryName))
                {
                    masterListOfTestMethods[testBinaryName] = [testMethodName];
                }
                else if (!masterListOfTestMethods[testBinaryName].includes(testMethodName)) {
                    masterListOfTestMethods[testBinaryName].push(testMethodName); 
                }            
                subTest = subTest_nodes.iterateNext();
            }  
            testGroup = testGroup_nodes.iterateNext();        
        }
    })
   
    return masterListOfTestMethods;
}


//Add a method that makes the first letter of a string lower case to the String object
String.prototype.firstToLowerCase = function() {
    return this.charAt(0).toLowerCase() + this.slice(1);
}

// Takes a string number and rounds to the provided precision. Also works with "e" sientific notation.
function roundNumString(numStr, precision = 5) {
    let splitNumStr = numStr.split("e");
    if (splitNumStr.length > 1){
        //Seems like there should be a better way.
        return parseFloat(parseFloat(splitNumStr[0]).toFixed(precision)).toString() + "e" + splitNumStr[1];
    }
    else {
        return parseFloat(parseFloat(splitNumStr[0]).toFixed(precision)).toString();
    }
}


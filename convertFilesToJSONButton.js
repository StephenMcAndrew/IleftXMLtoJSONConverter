/********************************************************************************************************************************
*   This file contains all the code related to combining all the selected XML files and connverting them into a single JSON file.
*********************************************************************************************************************************/
let theTestPlan;

async function onConvert() {
    
    //Alert the user if no files have been selected to conver
    if(selectedFiles.length == 0) {
        alert("Please select Ileft .planx files to convert.");
        return 0;
    }

    //Read the .planxml files into stings. The variable xmlStringArray is an array of objects that hold the testplan file name and the xml string.
    const xmlStringArray = await readFilesToStringArray(selectedFiles);

    const iniStringArray = await readFilesToStringArray(selectedINIs);

    const INIs = parseINIsToJSObjArray(iniStringArray);

    //Parse each string in the xmlStringArray into a XMLDoc object. The vaiable xmlDocArray is an array of objects that hold the testplan file name and the xml ducument.
    const xmlDocArray = await parseXMLStringArrayToXMLDocArray(xmlStringArray);

    //Pase each xml doc into a JavaScript object. 
    const testPlanArray = parseXMLDocsAndINsToJSObjArray(xmlDocArray,INIs);

    console.log(INIs);
    console.log(testPlanArray);
  
    //Get all the test binaries from the xml docs
    const testBinaries = getTestBinaries(xmlDocArray);

    //Use the GraphQL API to get the DciGen library information of the latest version 
    const dciGenLibrariesInfo = getDciGenLibrariesInfo(testBinaries);
 

    //Create the TestPlan object
    theTestPlan = new TestPlan();

    theTestPlan.addMeasurementCallers(dciGenLibrariesInfo, testPlanArray);
    
    //console.log(dciGenLibrariesInfo);

    //console.log(theTestPlan.DocObj);

    

    //Extract all the test methods from the XML doc objects. 
    //const testMethodsMap = extractTestMethodsFromXMLDocArray(xmlDocArray)

    //theTestPlan.addMeasurementCallers(testMethodsMap);

    //console.log(theTestPlan.JSONstr_To_JSstr(JSON.stringify(theTestPlan.DocObj, null, 2)));


    //theTestPlan.addTestMethods()
}

async function readFilesToStringArray(selectedFiles) {
    const xmlStringArray = selectedFiles.map(file => {
        const reader = new FileReader();
        return new Promise( resulve => {
            reader.onload = () => {
                xmlStringObj = {
                    name: file.name,
                    str: reader.result
                };
                resulve(xmlStringObj);
            }
            reader.readAsText(file);
        });
    });
    return await Promise.all(xmlStringArray);
}
/*
//Read each selected file as a string. All the strings get put into an array.
async function readFilesToXMLStringArray(selectedFiles) {
    const xmlStringArray = selectedFiles.map(file => {
        const reader = new FileReader();
        return new Promise( resulve => {
            reader.onload = () => resulve(reader.result);
            reader.readAsText(file);
        });
    });
    return await Promise.all(xmlStringArray);
}
*/

//Parse each XML string into and XML Doc object. All the XML Doc objects get put into an array.
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
//Parse each XML string into and XML Doc object. All the XML Doc objects get put into an array.
async function parseXMLStringArrayToXMLDocArray(xmlStringArray) {
    const xmlDocArray = xmlStringArray.map(str => {
        const xmlParser = new DOMParser();
        return new Promise( resulve => {
            resulve(xmlParser.parseFromString(str, "text/xml"));
        });
    });
    return await Promise.all(xmlDocArray);
}
*/


//Get all the test binaries used in the test plans
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
    return masterTestBinaryArray;
}


//Use the GraphQL API to get the DciGen library information of the latest version 
function getDciGenLibrariesInfo(testBinaries) { 
    const dciGenLibrariesInfo = new Map();
    testBinaries.forEach(testBinary => {
        
        const xhr_TPE = new XMLHttpRequest();
        const url_TPE =  "https://testplaneditor-qa.gentex.com/graphql";

        //Open the XHR object to make the json request and set the needed header info
        xhr_TPE.open("POST", url_TPE, false);
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

        xhr_TPE.send(JSON.stringify(dataToSend));
        let response = JSON.parse(xhr_TPE.responseText);
        const versions = response.data.library.versions;
        dciGenLibrariesInfo.set(testBinary, versions[versions.length - 1]);
    });
    return dciGenLibrariesInfo;
}

function parseINIsToJSObjArray(iniStringArray){
    const INIs = [];
    const regexPartNumber = /^(PARTNUMBER\s*=)/;
    const regexSection = /^(\[[A-Za-z0-9_]+\])/;
    const regexParam = /^([A-Za-z0-9_]+\s*=)/;
    iniStringArray.forEach(ini => {
        let iniObj = {};
        iniObj.fileName = ini.name;

        const iniLines = (ini.str.split(/\r?\n/)).map(line =>{
            return line.trim();
        });

        const partNumbersArray = [];
        const sectionsArray = [];
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
                
                //The will hold our key value pairs
                paramsMap = new Map();

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

                    if(line.split("=")[1].trim() == null){
                        paramsMap.set(line.split("=")[0].trim(), "");
                        lineIndex++;
                        line = iniLines[lineIndex];
                        continue 
                    }


                    paramsMap.set(line.split("=")[0].trim(), line.split("=")[1].trim());

                    lineIndex++;
                    line = iniLines[lineIndex];
                }

                partNumber.params = paramsMap;

                partNumbersArray.push(partNumber);
            }

            //We're at a section 
            if (regexSection.test(line)) {
                let section = {};
                section.name = line.replace(/\[/g, "").replace(/\]/g, "").trim();

                //The will hold our key value pairs
                paramsMap = new Map();

                //Get the next line
                lineIndex++;
                line = iniLines[lineIndex];

                while(!regexPartNumber.test(line) && !regexSection.test(line) && lineIndex < iniLines.length) {
                    //If the line is not in the form key = value, we can move to the next line 
                    if(!regexParam.test(line)){
                        lineIndex++;
                        line = iniLines[lineIndex];
                        continue 
                    }

                    if(line.split("=")[1].trim() == null){
                        paramsMap.set(line.split("=")[0].trim(), "");
                        lineIndex++;
                        line = iniLines[lineIndex];
                        continue 
                    }


                    paramsMap.set(line.split("=")[0].trim(), line.split("=")[1].trim());

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

function parseXMLDocsAndINsToJSObjArray(xmlDocArray, INIs){
    
    const convertedTestPlansArray = [];
    xmlDocArray.forEach(xmlDoc => {
       
        let testPlan = {};
        testPlan.fileName = xmlDoc.name;

        associatedPartNumbers = [];
        INIs.forEach(file => {
            file.partNumbers.forEach(partNumber => {
                let planFile = partNumber.params.get("PlanFile");
                if(planFile == xmlDoc.name){
                    if(!associatedPartNumbers.includes(partNumber.seven_o_five)) {
                        associatedPartNumbers.push(partNumber.seven_o_five);
                    }   
                }
            })
        })
        testPlan.partNumbers = associatedPartNumbers;

        const testBinaryArry  = [];
        let testBinary_Nodes = xmlDoc.doc.evaluate("/boost_serialization/testPlan/m_testStations/item/m_testBinarySetupArgs//first", xmlDoc.doc, null, XPathResult.ANY_TYPE, null);
        let testBinary_Node = testBinary_Nodes.iterateNext();
        while(testBinary_Node) {
            testBinaryArry.push(testBinary_Node.childNodes[0].nodeValue);
            testBinary_Node = testBinary_Nodes.iterateNext();
        }
        testPlan.testBinaries = testBinaryArry;
        
        const testGroupArray = [];

        let testGroup_nodes = xmlDoc.doc.evaluate("/boost_serialization/testPlan/m_testStations/item/m_tests/item", xmlDoc.doc, null, XPathResult.ANY_TYPE, null);
        let testGroup_node = testGroup_nodes.iterateNext();

        while(testGroup_node){
            let testGroup = {};
            testGroup.name = testGroup_node.getElementsByTagName("m_name")[0].childNodes[0].nodeValue;

            const subTestsArray = [];

            let subTest_nodes = xmlDoc.doc.evaluate("m_subTests/item", testGroup_node, null, XPathResult.ANY_TYPE, null);
            let subTest_node = subTest_nodes.iterateNext();

            while(subTest_node) {
                let subTest = {};
                subTest.name = subTest_node.getElementsByTagName("m_name")[0].childNodes[0].nodeValue;
                subTest.description = (subTest_node.getElementsByTagName("m_description")[0].childNodes[0] == null) ? "" : subTest_node.getElementsByTagName("m_description")[0].childNodes[0].nodeValue;
                subTest.testBinary = subTest_node.getElementsByTagName("m_testBinary")[0].childNodes[0].nodeValue;
                subTest.testMethod = subTest_node.getElementsByTagName("m_testMethod")[0].childNodes[0].nodeValue;
                subTest.skipTest = subTest_node.getElementsByTagName("m_skipTest")[0].childNodes[0].nodeValue;
                subTest.passFailEval = subTest_node.getElementsByTagName("m_passFailEval")[0].childNodes[0].nodeValue;
                subTest.limitCheckEval = subTest_node.getElementsByTagName("m_limitCheckEval")[0].childNodes[0].nodeValue;
                subTest.exactValEval = subTest_node.getElementsByTagName("m_exactValEval")[0].childNodes[0].nodeValue;
                subTest.collectDataEval = subTest_node.getElementsByTagName("m_collectDataEval")[0].childNodes[0].nodeValue;
                subTest.lowLimit = subTest_node.getElementsByTagName("m_lowLimit")[0].childNodes[0].nodeValue;
                subTest.value = subTest_node.getElementsByTagName("m_value")[0].childNodes[0].nodeValue;
                subTest.highLimit = subTest_node.getElementsByTagName("m_highLimit")[0].childNodes[0].nodeValue;
                subTest.preDelayMillis = subTest_node.getElementsByTagName("m_preDelayMillis")[0].childNodes[0].nodeValue;
                subTest.postDelayMillis = subTest_node.getElementsByTagName("m_postDelayMillis")[0].childNodes[0].nodeValue;
                subTest.loopCount = subTest_node.getElementsByTagName("m_loopCount")[0].childNodes[0].nodeValue;
                subTest.retryCount = subTest_node.getElementsByTagName("m_retryCount")[0].childNodes[0].nodeValue;
                subTest.retryDelayMillis = subTest_node.getElementsByTagName("m_retryDelayMillis")[0].childNodes[0].nodeValue;
                subTest.retryDelayMillis = subTest_node.getElementsByTagName("m_retryDelayMillis")[0].childNodes[0].nodeValue;

                let argArray = [];

                let testArg_nodes = xmlDoc.doc.evaluate("m_testArgs/item", subTest_node, null, XPathResult.ANY_TYPE, null);
                let testArg_node = testArg_nodes.iterateNext();

                while(testArg_node) {
                    let testArg = {};
                    let argStr = testArg_node.childNodes[0].nodeValue;
                    let key_value = argStr.split("=");
                    testArg.key = key_value[0];
                    testArg.value = key_value[1];

                    argArray.push(testArg); 
                    testArg_node = testArg_nodes.iterateNext();
                }

                subTest.testArgs = argArray;

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
//Parse each XML string into and JavaScript object. All the JavaScript objects get put into an array.
async function parseXMLStringArrayToJSObjArray(xmlStringArray) {
    const xmlJSObjArray = xmlStringArray.map(str => {
        const xmlStrParser = xml2js.newParser();
        return new Promise( resulve => {
            xmlStrParser.parseString(str, function(err, result){
                resulve(result);
            });  
        });
    });
    return await Promise.all(xmlJSObjArray);
}
*/

/*
function extractTestMethodsFromXMLDocArray(xmlDocArray) {
    
    const masterListOfTestMethods = new Map();

    //For each XML doc in the array
    xmlDocArray.forEach(xmlDoc => {
        //Get the list of all the test group nodes in the current doc.
        let testGroup_nodes = xmlDoc.evaluate("/boost_serialization/testPlan/m_testStations/item/m_tests/item", xmlDoc, null, XPathResult.ANY_TYPE, null);
        let testGroup = testGroup_nodes.iterateNext()
        //Loop through the test group nodes
        while(testGroup) {
            //Get the list of sub test nodes in the current test group.
            let subTest_nodes = xmlDoc.evaluate("m_subTests/item", testGroup, null, XPathResult.ANY_TYPE, null);
            let subTest = subTest_nodes.iterateNext()
            //Loop through the subtest nodes
            while(subTest) {
                //Get the test method name and binary
                let testMethodName = subTest.getElementsByTagName("m_testMethod")[0].childNodes[0].nodeValue;
                let testBinaryName = subTest.getElementsByTagName("m_testBinary")[0].childNodes[0].nodeValue;

                //Get a list of all the test argument nodes
                let testMethodArg_nodes = xmlDoc.evaluate('m_testArgs/item', subTest, null, XPathResult.ANY_TYPE, null);
                let testMethodArg = testMethodArg_nodes.iterateNext();
                
                //Loop through all the test method argumant nodes
                const testMethodArgsNames = [];
                while(testMethodArg) {
                    let name_value = testMethodArg.childNodes[0].nodeValue; //remove whitespace
                    let indexOfEqual = name_value.indexOf('=');
                    if (indexOfEqual != -1)
                    {
                        testMethodArgsNames.push(name_value.substring(0,indexOfEqual));
                    }
                    testMethodArg = testMethodArg_nodes.iterateNext();
                }

                //Create a test method data object with the test binary name and an array of the argument names
                let theTestMethod_data = {
                    testBinary: testBinaryName,
                    testMethodArgs: testMethodArgsNames
                };

                //If the master list of test methods already has the current test method key, we need to check that it uses the same binary and has the same args
                if(masterListOfTestMethods.has(testMethodName))
                {
                    //Check if the current test method uses the same binary as the existing one. If it doesn't we add it. We put a "*" next to it to denote it's a duplicate name.
                    if(masterListOfTestMethods.get(testMethodName).testBinary != testBinaryName) {
                        masterListOfTestMethods.set(testMethodName + "_",theTestMethod_data);
                    }
                    else {
                        //If it does us the same binay, we need to check the args and add any new ones. 
                        testMethodArgsNames.forEach(arg =>{
                            let existingArgs = masterListOfTestMethods.get(testMethodName).testMethodArgs;
                            //If the current test method has an arg that the existing testmethod does not have, we need to add it.
                            if(!existingArgs.includes(arg))
                            {
                                //Add the new are to the list of existing args
                                existingArgs.push(arg);

                                //Make a new test method data object with the updated array of args
                                let theTestMethod_data_new = {
                                    testBinary: testBinaryName,
                                    testMethodArgs: existingArgs
                                };
                                //Set the new object value in the master list
                                masterListOfTestMethods.set(testMethodName, theTestMethod_data_new)
                            }
                        })
                    }
                }
                else
                {
                    //If the test method is not in the master list yet, add it
                    masterListOfTestMethods.set(testMethodName,theTestMethod_data);
                }
                
                subTest = subTest_nodes.iterateNext();
            }  
            testGroup = testGroup_nodes.iterateNext();        
        }
    })
   
    return masterListOfTestMethods;
}
*/

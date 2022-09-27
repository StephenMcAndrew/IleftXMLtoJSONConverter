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

    //Create the TestPlan object
    theTestPlan = new TestPlan();

    //Fisrt, read the .planxml files into a sting array. Each element contains the contents of a .planxml file as a string.
    const xmlStringArray = await readFilesToXMLStringArray(selectedFiles);

    //Then, parse each string in the xmlStringArray into a XMLDoc object and place all of the new objects into an array
    const xmlDocArray = await parseXMLStringArrayToXMLDocArray(xmlStringArray);
  
    //Extract all the test methods from the XML doc objects. 
    const testMethodsMap = extractTestMethodsFromXMLDocArray(xmlDocArray)

    theTestPlan.addMeasurementCallers(testMethodsMap);

    console.log(theTestPlan.JSONstr_To_JSstr(JSON.stringify(theTestPlan.DocObj, null, 2)));


    //theTestPlan.addTestMethods()
}

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


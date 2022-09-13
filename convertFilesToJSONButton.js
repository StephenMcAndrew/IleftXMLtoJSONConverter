/********************************************************************************************************************************
*   This file contains all the code related to combining all the selected XML files and connverting them into a single JSON file.
*********************************************************************************************************************************/
async function onConvert() {
    
    //Fisrt, read the .planxml files into a sting array. Each element contains the contents of a .planxml file as a string.
    const xmlStringArray = await readFilesToXMLStringArray(selectedFiles);

    // Then, parse each string in the xmlStringArray into a XMLDoc object and place all of the new objects into an array
    const xmlDocArray = await parseXMLStringArrayToXMLDocArray(xmlStringArray);

    //Create the initial test plan document from the template JSON string 
    TheTestPlan.document = JSON.parse(TheTestPlan.templateJSONstr);
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
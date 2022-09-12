/********************************************************************************************************************************
*   This file contains all the code related to combining all the selected XML files and connverting them into a single JSON file.
*********************************************************************************************************************************/

let xmlDocs = [];

async function onConvert() {
    
    const xmlStringArray = await readFilesToXMLStringArray(selectedFiles);
    console.log(xmlStringArray);

    const xmlDocArray = await parseXMLStringArrayToXMLDocArray(xmlStringArray);
    console.log(xmlDocArray);

    output1.value = "";

    let testsNode = xmlDocArray[0].getElementsByTagName("m_tests")[0];
    console.log(testsNode);

    for(let i = 0; i < testsNode.childNodes.length; i++)
    {
       if(testsNode.childNodes[i].nodeName == "item")
       {
            console.log(testsNode.childNodes[i].getElementsByTagName("m_name")[0].childNodes[0].nodeValue);  
            //output1.value += testsNode.childNodes[i].getElementsByTagName("m_name")[0].nodeValue + "\n";
       }  
    }
}

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

async function parseXMLStringArrayToXMLDocArray(xmlStringArray) {
    const xmlDocArray = xmlStringArray.map(str => {
        const xmlParser = new DOMParser();
        return new Promise( resulve => {
            resulve(xmlParser.parseFromString(str, "text/xml"));
        });
    });
    return await Promise.all(xmlDocArray);
}
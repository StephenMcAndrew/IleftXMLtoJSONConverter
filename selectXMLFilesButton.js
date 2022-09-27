/**********************************************************************************************************
*   This file contains the code for allowing the user to select the desired .planxml files to be converted
***********************************************************************************************************/

let output1 = document.getElementById("output1");
const fileSelector = document.getElementById('file-selector');
let selectedFiles = [];


function onFileSelector() {
    
    //Alert the user if they have not gotten a bearer token yet
    if(typeof bearerToken == 'undefined') {
        alert("Please acquire a valid bearer token first.");
        return 0;
    }
    //Send out the file selector clicked signal
    document.getElementById('file-selector').click()
}
    
fileSelector.addEventListener("change", function() {

    //Put all the selected files into an array
    output1.value = "Files selected to convert:\n"
    for(let i = 0; i <= this.files.length -1; i++){
        output1.value += this.files[i].name + "\n";
        //console.log(this.files[i]);
        selectedFiles.push(this.files[i]);
    }
});

// Coppy the the text from the output
function copyOutputText() {
    var copiedText = document.getElementById("output1").value;
   
     // Copy the text inside the text field
     navigator.clipboard.writeText(copiedText);
   
     // Alert the user the text has been copied
     //alert("The output text has been copied.");
   }
/**********************************************************************************************************
*   This file contains the code for allowing the user to select the desired .planxml files to be converted
***********************************************************************************************************/

let output1 = document.getElementById("output1");
const fileSelector = document.getElementById('file-selector');
let selectedFiles = [];

fileSelector.addEventListener("change", function() {
    output1.value = "Files selected to convert:\n"
    for(let i = 0; i <= this.files.length -1; i++){
        output1.value += this.files[i].name + "\n";
        console.log(this.files[i]);
        selectedFiles.push(this.files[i]);
    }
});
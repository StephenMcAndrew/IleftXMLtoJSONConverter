const iniSelector = document.getElementById('ini-selector');
let selectedINIs = [];

function onINISelector() {
    
    //Alert the user if they have not gotten a bearer token yet
    if(typeof bearerToken == 'undefined') {
        alert("Please acquire a valid bearer token first.");
        return 0;
    }
    
    //Send out the file selector clicked signal
    document.getElementById('ini-selector').click()
}
    
iniSelector.addEventListener("change", function() {

    //Put all the selected files into an array
    output1.value += "INIs selected to convert:\n"
    for(let i = 0; i <= this.files.length -1; i++){
        output1.value += this.files[i].name + "\n";
        //console.log(this.files[i]);
        selectedINIs.push(this.files[i]);
    }
});
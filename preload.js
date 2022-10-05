const { contextBridge } = require('electron');
const { v1: uuidv1 } = require('uuid');
const  xml2js  = require('xml2js');

contextBridge.exposeInMainWorld('uuid_api', {
    get: () => uuidv1()
}); 

/*
contextBridge.exposeInMainWorld('xml2js', {
    newParser: () => { return new xml2js.Parser() }
});
*/
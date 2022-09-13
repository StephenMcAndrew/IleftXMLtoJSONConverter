const { contextBridge } = require('electron');
const { v1: uuidv1 } = require('uuid');

contextBridge.exposeInMainWorld('uuid_api', {
    get: () => uuidv1()
}); 
const { contextBridge } = require('electron');
const { v1: uuidv1 } = require('uuid');
const  fs = require('fs');
const path = require('path');
const execSync = require('child_process').execSync;


contextBridge.exposeInMainWorld('uuid_api', {
    get: () => uuidv1()
}); 

contextBridge.exposeInMainWorld('path', {
    format: (pathObj) => path.format(pathObj),
});

contextBridge.exposeInMainWorld('fs', {
    writeFileSync: (file, data, option) => fs.writeFileSync(file, data, option),
    mkdirSync: pathStr => fs.mkdirSync(pathStr, { recursive: true }),
    rmSync: dirPath => fs.rmSync(dirPath, {recursive: true, force: true})
});

contextBridge.exposeInMainWorld('svn', {
    mkdir: dirURL => {
        try { execSync(`svn mkdir ${dirURL} -m "Directory added through IleftXMLtoJSONConverter"`, { encoding: 'utf-8' }); }
        catch(e) { console.log(e.message); }
    },
    checkout: (url, path) => {
        try { execSync(`svn checkout ${url} ${path}`, { encoding: 'utf-8' }); }
        catch(e) { console.log(e.message); }
    },
    update: path => {
        try { execSync(`svn update ${path}`, { encoding: 'utf-8' }); }
        catch(e) { console.log(e.message); }
    },
    add: path =>  {
        try { execSync(`svn add ${path} --force`, { encoding: 'utf-8' }); }
        catch(e) { console.log(e.message); }
    },
    commit: path => {
        try { execSync(`svn commit ${path} -q -m "Commit via IleftXMLtoJSONConverter app`, { encoding: 'utf-8' }) }
        catch(e) { console.log(e.message); }
    }
})

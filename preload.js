const { contextBridge } = require('electron');
const { v1: uuidv1 } = require('uuid');
const  fs = require('fs');
const path = require('path');
const { url } = require('inspector');
const execSync = require('child_process').execSync;

contextBridge.exposeInMainWorld('uuid_api', {
    get: () => uuidv1()
}); 

contextBridge.exposeInMainWorld('path', {
    format: (pathObj) => path.format(pathObj),
});
5
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
    checkout: (url, localPath) => {
        try { execSync(`svn checkout ${url} ${localPath}`, { encoding: 'utf-8' }); }
        catch(e) { console.log(e.message); }
    },
    update: localPath => {
        try { execSync(`svn update ${localPath}`, { encoding: 'utf-8' }); }
        catch(e) { console.log(e.message); }
    },
    add: localPath =>  {
        try { execSync(`svn add ${localPath} --force`, { encoding: 'utf-8' }); }
        catch(e) { console.log(e.message); }
    },
    commit: localPath => {
        try { execSync(`svn commit ${localPath} -q -m "Commit via IleftXMLtoJSONConverter app`, { encoding: 'utf-8' }) }
        catch(e) { console.log(e.message); }
    },
    ls: url => {
        try { return execSync(`svn list ${url}`, { encoding: 'utf-8' }).toString() }
        catch(e) { 
            console.log(e.message);  
            return null;
        }
    },
    copy: (src, dst) => {
        try { execSync(`svn copy ${src} ${dst}`, { encoding: 'utf-8' }) }
        catch(e) { console.log(e.message); }
    }
})

const fs=require('node:fs/promises'),path=require('node:path'),{randomUUID}=require('node:crypto'),{RecordingStore}=require('./recording-store');
class IsoStore{
 constructor(){this.stores=new Map();this.starting=false;}
 async begin(directory,sources){if(this.starting||this.stores.size)throw Error('ISO recording is already open.');if(!Array.isArray(sources)||!sources.length||sources.length>8||sources.some(s=>!s||typeof s.id!=='string'||s.id.length>100||typeof s.name!=='string'||s.name.length>200)||new Set(sources.map(s=>s.id)).size!==sources.length)throw Error('Choose 1–8 distinct ISO inputs.');this.starting=true;const created=[];
  try{const folder=path.join(directory,'GEN3D-ISO-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8));await fs.mkdir(folder);for(const [index,source]of sources.entries()){const slug=source.name.replace(/[^a-zA-Z0-9 _-]/g,'_').slice(0,60)||'Input',store=new RecordingStore(),session=await store.begin(path.join(folder,`${String(index+1).padStart(2,'0')}-${slug}.webm`));this.stores.set(session.id,store);created.push({...session,sourceId:source.id,name:source.name});}await fs.writeFile(path.join(folder,'inputs.json'),JSON.stringify({format:'gen3d-iso',createdAt:new Date().toISOString(),inputs:created.map(({sourceId,name,filePath})=>({sourceId,name,file:path.basename(filePath)}))},null,2),{flag:'wx'});return {folder,inputs:created};}
  catch(error){await Promise.all(created.map(row=>this.abort(row.id)));throw error;}finally{this.starting=false;}
 }
 require(id){const store=this.stores.get(id);if(!store)throw Error('ISO recording is no longer open.');return store;}
 append(id,chunk){return this.require(id).append(id,chunk);}
 async finish(id){const store=this.require(id);try{return await store.finish(id);}finally{this.stores.delete(id);}}
 async abort(id){const store=this.stores.get(id);if(!store)return;try{return await store.abort(id);}finally{this.stores.delete(id);}}
 async abortAll(){await Promise.all([...this.stores.keys()].map(id=>this.abort(id)));}
}
module.exports={IsoStore};

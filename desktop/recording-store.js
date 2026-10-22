const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
class RecordingStore {
  constructor() { this.active=null; }
  async begin(filePath) {
    if(this.active) throw Error('A recording is already open.');
    const session={id:randomUUID(),filePath,partialPath:`${filePath}.${randomUUID()}.part`,bytes:0,tail:Promise.resolve(),closing:false,failure:null};
    // Reserve before opening the file so parallel starts cannot race.
    this.active=session;
    try {session.handle=await fs.open(session.partialPath,'wx');return {id:session.id,filePath};}
    catch(error){this.active=null;throw error;}
  }
  requireSession(id) {if(!this.active||this.active.id!==id)throw Error('Recording session is no longer open.');return this.active;}
  async append(id,chunk) {
    const s=this.requireSession(id);
    if(s.closing)throw Error('Recording is finishing.');
    if(!(chunk instanceof ArrayBuffer) && !ArrayBuffer.isView(chunk))throw Error('Invalid recording data.');
    const data=chunk instanceof ArrayBuffer?Buffer.from(chunk):Buffer.from(chunk.buffer,chunk.byteOffset,chunk.byteLength);
    if(!data.length||data.length>64*1024*1024)throw Error('Invalid recording chunk size.');
    const operation=s.tail.then(async()=>{
      if(s.failure)throw s.failure;
      try {
        let offset=0;
        while(offset<data.length){const result=await s.handle.write(data,offset,data.length-offset);if(!result.bytesWritten)throw Error('Disk write made no progress.');offset+=result.bytesWritten;s.bytes+=result.bytesWritten;}
        return {bytes:s.bytes};
      }catch(error){s.failure=error;throw error;}
    });
    s.tail=operation.catch(()=>{});return operation;
  }
  async finish(id) {
    const s=this.requireSession(id);if(s.closing)throw Error('Recording is already finishing.');s.closing=true;
    try {
      await s.tail;
      if(s.failure)throw s.failure;
      if(!s.bytes)throw Error('No recording data was received.');
      await s.handle.sync();await s.handle.close();s.handle=null;
      await fs.rename(s.partialPath,s.filePath);
      return {filePath:s.filePath,bytes:s.bytes};
    } catch(error) {
      await s.handle?.close().catch(()=>{});s.handle=null;
      throw Error(`${error.message} Partial recording retained at ${s.partialPath}`);
    } finally {if(this.active===s)this.active=null;}
  }
  async abort(id) {
    const s=this.requireSession(id);s.closing=true;
    try {await s.tail;await s.handle?.close();s.handle=null;return {partialPath:s.partialPath,bytes:s.bytes};}
    finally {if(this.active===s)this.active=null;}
  }
}
module.exports={RecordingStore};

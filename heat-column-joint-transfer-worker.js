import {compareJointHeatTransfer} from './heat-column-joint-transfer.js';
self.onmessage=event=>{try{self.postMessage({ok:true,result:compareJointHeatTransfer(event.data)});}catch(error){self.postMessage({ok:false,error:error.message});}};

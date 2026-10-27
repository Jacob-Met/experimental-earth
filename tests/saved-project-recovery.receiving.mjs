import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { withBrowserSession } from './support/browser-session.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const runDirectory = process.env.BROWSER_RUN_DIRECTORY;
const active = 'experimental-earth-site-v1', prefix = 'experimental-earth-unreadable-v1-';
const malformed = '{"title":"Field visit — retain original 🌱"\r\n,"unfinished":';
const incompatible = JSON.stringify({ schema:'future-field-project/2', source:'Original site notebook', observations:[1,2,3] }, null, 2);
export async function receiveSavedProjectRecovery({ send, evaluate, baseUrl, exceptions, runDirectory }) {
    await send('Runtime.enable'); await send('Page.enable');
    const observations = [];
    const wait = async (expression, label = expression) => {
      for (let i=0; i<120; i++) {
        try { if (await evaluate(expression)) return; } catch (error) {
          if (!/context|navigat/i.test(error.message)) throw error;
        }
        await delay(50);
      }
      throw Error('App did not become ready: ' + label);
    };
    const ready = "!window.__recoveryTestOldDocument && document.querySelectorAll('#existing-grid .cell').length===48 && document.querySelector('#saved-project-recovery')";
    const reload = async () => {
      await evaluate('window.__recoveryTestOldDocument=true');
      await send('Page.reload', { ignoreCache:true });
      await wait(ready);
    };
    const storage = () => evaluate('Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)]))');
    const title = value => evaluate('(()=>{const input=document.querySelector("#project-title");input.value='+JSON.stringify(value)+';input.dispatchEvent(new Event("change",{bubbles:true}));})()');
    const message = () => evaluate('document.querySelector("#saved-project-recovery-status").textContent');
    const downloads = runDirectory + '/downloads';
    await mkdir(downloads, { recursive:true });
    await send('Browser.setDownloadBehavior', { behavior:'allow', downloadPath:downloads });
    const press = async (key, code, windowsVirtualKeyCode) => {
      await send('Input.dispatchKeyEvent', { type:'keyDown', key, code, windowsVirtualKeyCode, ...(key === 'Enter' ? {text:'\r',unmodifiedText:'\r'} : {}) });
      await send('Input.dispatchKeyEvent', { type:'keyUp', key, code, windowsVirtualKeyCode });
    };
    const download = async (raw, keyboard = false, wrapped = false) => {
      const before = new Set(await readdir(downloads));
      await evaluate('window.__recoveryDownloadClicks=0;document.querySelector("#saved-project-recovery button").addEventListener("click",()=>window.__recoveryDownloadClicks++);');
      if (keyboard) {
        await evaluate('document.querySelector("#saved-project-recovery summary").focus()');
        await press('Tab','Tab',9);
        assert.match(await evaluate('document.activeElement.textContent'), /Download original saved data/);
        assert.notEqual(await evaluate('getComputedStyle(document.activeElement).outlineStyle'), 'none');
        await press('Enter','Enter',13);
      } else await evaluate('document.querySelector("#saved-project-recovery button").click()');
      for (let i=0; i<120; i++) {
        const names = (await readdir(downloads)).filter(name=>!before.has(name)&&name.endsWith('.json'));
        if (names.length) {
          const bytes = await readFile(downloads + '/' + names[0]);
          if (wrapped) {
            const record = JSON.parse(bytes.toString('utf8'));
            assert.equal(record.schema,'experimental-earth-original-text/1');
            assert.equal(record.raw,raw,'the recovery record must retain every original code unit');
          } else assert.deepEqual(bytes, Buffer.from(raw,'utf8'), 'recovery download must contain the exact original UTF-8 data');
          return { filename:names[0], bytes:bytes.length };
        }
        await delay(50);
      }
      throw Error('Recovery download did not complete: ' + JSON.stringify({clicks:await evaluate('window.__recoveryDownloadClicks'),files:await readdir(downloads)}));
    };
    await send('Page.navigate',{ url:baseUrl });
    await wait("document.querySelector('main')");
    await evaluate('localStorage.clear()'); await reload();
    assert.equal(await evaluate('document.querySelector("#saved-project-recovery").hidden'),true);
    const example = JSON.parse((await storage())[active]);
    observations.push({scenario:'fresh workspace',recoveryHidden:true});

    await evaluate('localStorage.setItem('+JSON.stringify(active)+','+JSON.stringify(malformed)+')');
    await reload();
    let retained = await storage();
    const keys = Object.keys(retained).filter(key=>key.startsWith(prefix));
    assert.equal(keys.length,1);
    assert.equal(retained[keys[0]],malformed);
    assert.equal(JSON.parse(retained[active]).title,example.title);
    assert.equal(await evaluate('document.querySelector("#saved-project-recovery").open'),true);
    assert.match(await message(),/original data was retained.*fictional example/i);
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    await delay(100);
    await writeFile(runDirectory+'/recovery-desktop.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
    const downloaded = await download(malformed,true);
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
    await delay(100);
    const narrow = await evaluate('({inner:innerWidth,scroll:document.documentElement.scrollWidth,button:document.querySelector("#saved-project-recovery button").getBoundingClientRect().toJSON()})');
    assert.ok(narrow.scroll<=narrow.inner,'recovery must not cause horizontal overflow');
    assert.ok(narrow.button.height>=44 && narrow.button.left>=0 && narrow.button.right<=390);
    await writeFile(runDirectory+'/recovery-narrow.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
    observations.push({scenario:'malformed source',sourceRetained:true,downloaded,narrow});

    await reload();
    assert.equal(await evaluate('document.querySelector("#saved-project-recovery").hidden'),false);
    assert.equal(await evaluate('document.querySelector("#saved-project-recovery").open'),false);
    assert.match(await message(),/Earlier unreadable saved data/);
    assert.equal((await storage())[keys[0]],malformed);
    observations.push({scenario:'repeat visit',sourceRetained:true,recoveryCollapsed:true});

    await evaluate('localStorage.setItem('+JSON.stringify(active)+','+JSON.stringify(incompatible)+')');
    await reload();
    retained = await storage();
    assert.equal(Object.values(retained).filter(raw=>raw===incompatible).length,1);
    assert.equal(retained[keys[0]],malformed);
    assert.equal(await evaluate('document.querySelectorAll("#saved-project-recovery button").length'),2);
    await title('Continuing the current field visit');
    assert.equal(JSON.parse((await storage())[active]).title,'Continuing the current field visit');
    await evaluate('document.querySelector("#reset").click()');
    assert.equal(JSON.parse((await storage())[active]).title,example.title);
    assert.equal(Object.keys(await storage()).filter(key=>key.startsWith(prefix)).length,2);
    observations.push({scenario:'incompatible source, editing and reset',bothOriginalsRetained:true});

    const illFormedRaw = 'Original code units: \ud800';
    await evaluate('localStorage.clear();localStorage.setItem('+JSON.stringify(active)+','+JSON.stringify(illFormedRaw)+')');
    await reload();
    assert.match(await evaluate('document.querySelector("#saved-project-recovery .recovery-file-note").textContent'),/raw field/);
    const losslessDownload = await download(illFormedRaw, false, true);
    assert.equal(await evaluate('Object.values(localStorage).includes('+JSON.stringify(illFormedRaw)+')'),true);
    observations.push({scenario:'unencodable original text',originalCodeUnitsRetained:true,downloaded:losslessDownload});

    const quotaRaw = '{"fieldNotes":"Keep this source even when storage is full"';
    await evaluate('localStorage.clear();localStorage.setItem('+JSON.stringify(active)+','+JSON.stringify(quotaRaw)+')');
    const quotaFault = await send('Page.addScriptToEvaluateOnNewDocument',{source:
      'const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('+JSON.stringify(prefix)+'))throw new DOMException("Full","QuotaExceededError");return original.call(this,key,value);};'});
    await reload();
    assert.equal((await storage())[active],quotaRaw);
    assert.match(await message(),/original data is unchanged.*saving is paused/i);
    await title('Work remains usable while saving is paused');
    assert.equal((await storage())[active],quotaRaw);
    const beforeExport = new Set(await readdir(downloads));
    await evaluate('document.querySelector("#export").click()');
    let exported = null;
    for (let i=0;i<120;i++) {
      const name=(await readdir(downloads)).find(name=>!beforeExport.has(name)&&name.endsWith('.json'));
      if(name){exported=JSON.parse(await readFile(downloads+'/'+name,'utf8'));break;}
      await delay(50);
    }
    assert.equal(exported?.title,'Work remains usable while saving is paused');
    assert.equal((await storage())[active],quotaRaw);
    assert.equal(await evaluate('document.querySelector("#project-save-status").dataset.saveState'),'unsaved');
    const quotaDownload = await download(quotaRaw);
    observations.push({scenario:'full recovery storage',originalUnchanged:true,savingPaused:true,downloaded:quotaDownload});
    await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:quotaFault.identifier});
    await reload();
    assert.equal(Object.values(await storage()).includes(quotaRaw),true);

    const validRaw = JSON.stringify({...example,title:'Existing field measurements',notes:'Must survive a denied read'});
    await evaluate('localStorage.clear();localStorage.setItem('+JSON.stringify(active)+','+JSON.stringify(validRaw)+')');
    const readFault = await send('Page.addScriptToEvaluateOnNewDocument',{source:
      'window.__recoveryOriginalGetItem=Storage.prototype.getItem;Storage.prototype.getItem=function(key){if(key==='+JSON.stringify(active)+')throw new DOMException("Denied","SecurityError");return window.__recoveryOriginalGetItem.call(this,key);};'});
    await reload();
    assert.match(await message(),/could not be read.*Saving is paused/i);
    await title('Unsaved work after denied read');
    assert.equal(await evaluate('window.__recoveryOriginalGetItem.call(localStorage,'+JSON.stringify(active)+')'),validRaw);
    observations.push({scenario:'denied storage read',originalUnchanged:true,savingPaused:true});
    await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:readFault.identifier});
    await reload();
    assert.equal(await evaluate('document.querySelector("#project-title").value'),'Existing field measurements');
    assert.equal(await evaluate('document.querySelector("#saved-project-recovery").hidden'),true);

    const writeFault = await send('Page.addScriptToEvaluateOnNewDocument',{source:
      'const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='+JSON.stringify(active)+')throw new DOMException("Full","QuotaExceededError");return original.call(this,key,value);};'});
    await reload();
    assert.equal(await evaluate('document.querySelector("#saved-project-recovery").hidden'),true);
    assert.match(await evaluate('document.querySelector("#project-save-status").textContent'),/Browser save failed/);
    await title('Unsaved title under write failure');
    assert.equal(JSON.parse((await storage())[active]).title,'Existing field measurements');
    observations.push({scenario:'normal write failure',originalUnchanged:true,accurateSaveMessage:true});
    await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:writeFault.identifier});
    await reload();

    const later = JSON.stringify({...example,title:'Newer project from another tab'});
    await evaluate('localStorage.setItem('+JSON.stringify(active)+','+JSON.stringify(later)+')');
    await title('Stale tab edit');
    assert.equal((await storage())[active],later);
    assert.match(await message(),/changed in another tab.*paused/i);
    await reload();
    assert.equal(await evaluate('document.querySelector("#project-title").value'),'Newer project from another tab');
    observations.push({scenario:'observed later tab change',laterProjectRetained:true});
    assert.deepEqual(exceptions,[]);
    const report = {observations,exceptions};
    await writeFile(runDirectory+'/recovery-observation.json',JSON.stringify(report,null,2)+'\n');
    return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await withBrowserSession({ root, chromeBin:process.env.CHROME_BIN, runDirectory }, session =>
    receiveSavedProjectRecovery({...session,runDirectory:session.runDirectory}));
  console.log(JSON.stringify(result));
}

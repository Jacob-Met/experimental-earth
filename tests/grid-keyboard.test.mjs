import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {arrowGridIndex} from '../grid-keyboard.js';

const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const page = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('every rectangular neighbor agrees with an independent coordinate oracle', () => {
  let checked = 0;
  for (let width = 1; width <= 18; width++) for (let height = 1; height <= 12; height++) {
    const count = width * height;
    for (let index = 0; index < count; index++) for (const key of ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown']) {
      const x = index % width, y = Math.floor(index / width);
      const shifted = {
        ArrowLeft: [Math.max(0,x-1),y],
        ArrowRight: [Math.min(width-1,x+1),y],
        ArrowUp: [x,Math.max(0,y-1)],
        ArrowDown: [x,Math.min(height-1,y+1)],
      }[key];
      const expected = shifted[1] * width + shifted[0];
      assert.equal(arrowGridIndex(index,width,count,key),expected,`${width}x${height} #${index} ${key}`);
      checked++;
    }
  }
  assert.ok(checked >= 50000, 'spatial reference must span substantial original-grid variation');
});

test('nonarrow keys never navigate and invalid/source-inconsistent geometry is rejected', () => {
  assert.equal(arrowGridIndex(0,4,12,'Enter'),null);
  assert.equal(arrowGridIndex(0,4,12,' '),null);
  assert.equal(arrowGridIndex(0,4,12,'Tab'),null);
  for (const args of [
    [-1,4,12,'ArrowRight'],[12,4,12,'ArrowLeft'],[0,0,12,'ArrowRight'],
    [0,4,11,'ArrowRight'],[0,4,0,'ArrowDown'],[0,NaN,12,'ArrowUp'],
    [0,4,Infinity,'ArrowLeft'],[0,4.5,9,'ArrowRight'],[1.1,4,12,'ArrowRight'],
  ]) assert.throws(() => arrowGridIndex(...args),RangeError);
});

function mountGrid(currentSource = source) {
  const declaration = /^function gridInto\([^)]*\)\s*\{/m.exec(currentSource);
  assert.ok(declaration, 'exercise actual maintained grid renderer');
  const begin = declaration.index, bodyStart = begin + declaration[0].length;
  const nextFunction = /^function\s+[\w$]+\s*\(/m.exec(currentSource.slice(bodyStart));
  assert.ok(nextFunction, 'extract only the renderer before the next top-level function');
  const end = bodyStart + nextFunction.index;
  const grids = {existing: makeGrid(), proposal: makeGrid()};
  const document = {
    activeElement: null,
    createDocumentFragment() {return {items:[],appendChild(button) {this.items.push(button);}};},
    createElement(tag) {assert.equal(tag,'button');return makeButton(document);},
  };
  const project = {
    width: 4,selectedIndex:0,
    existing:Array.from({length:12},() => ({surface:'sealed',elevationM:0})),
    proposal:Array.from({length:12},() => ({surface:'turf',elevationM:0})),
  };
  const SURFACES = {sealed:{label:'Sealed',color:'#bbb'},turf:{label:'Turf',color:'#aaa'}};
  const result = {peakDepthMm:Array(12).fill(0),finalDepthMm:Array(12).fill(0)};
  let activations=0;
  const context = {
    document,project,SURFACES,view:'peak',arrowGridIndex,comparisonState:'ready',
    $:id => grids[id.replace('-grid','')],
    nameCell:index=>String.fromCharCode(65+index%project.width)+(1+Math.floor(index/project.width)),
    numeric:x=>String(x),
    applyBrush(target,index) {
      activations++;
      project.selectedIndex=index;
      context.gridInto('existing',result);
      context.gridInto('proposal',result);
    }
  };
  vm.runInNewContext(currentSource.slice(begin,end)+'\nthis.gridInto=gridInto;',context);
  context.gridInto('existing',result);
  context.gridInto('proposal',result);
  return {grids,document,project,result,context,get activations(){return activations;}};
}

function makeGrid() {
  return {style:{gridTemplateColumns:''},dataset:{},buttons:[],
    querySelector(selector) {
      const match = selector.match(/^\[data-cell-index="(\d+)"\]$/);
      assert.ok(match,selector);
      return this.buttons.find(b=>b.dataset.cellIndex===match[1]) ?? null;
    },
    replaceChildren(fragment) {this.buttons=fragment.items;}
  };
}

function makeButton(document) {
  return {
    type:'',className:'',tabIndex:0,innerHTML:'',dataset:{},attrs:{},handlers:{},
    style:{background:'',setProperty(){}},
    setAttribute(name,value) {this.attrs[name]=value;},
    getAttribute(name) {return this.attrs[name];},
    append() {},
    addEventListener(name,handler) {this.handlers[name]=handler;},
    focus() {document.activeElement=this;},
    press(key) {
      const event={key,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};
      this.handlers.keydown?.(event);
      return event;
    },
    click() {this.handlers.click();}
  };
}

test('actual original maps each expose one tab stop and arrowing cannot repaint', () => {
  const h=mountGrid();
  const existing=h.grids.existing.buttons,proposed=h.grids.proposal.buttons;
  assert.equal(existing.length,12);
  assert.equal(proposed.length,12);
  assert.equal(existing.filter(b=>b.tabIndex===0).length,1);
  assert.equal(proposed.filter(b=>b.tabIndex===0).length,1);
  const before=h.project.selectedIndex;
  const move=existing[0].press('ArrowRight');
  assert.equal(move.defaultPrevented,true);
  assert.equal(h.document.activeElement,existing[1]);
  assert.equal(existing[0].tabIndex,-1);
  assert.equal(existing[1].tabIndex,0);
  assert.equal(h.project.selectedIndex,before);
  assert.equal(h.activations,0);
  assert.equal(existing[1].press('Tab').defaultPrevented,false);
  const stop=existing[1].press('ArrowUp');
  assert.equal(stop.defaultPrevented,true);
  assert.equal(h.document.activeElement,existing[1]);
  assert.equal(proposed.filter(b=>b.tabIndex===0).length,1);
});

test('selecting a focused cell rerenders and restores focus to its new original node', () => {
  const h=mountGrid();
  const old=h.grids.existing.buttons;
  old[0].press('ArrowDown');
  assert.equal(h.document.activeElement,old[4]);
  old[4].click();
  assert.equal(h.activations,1);
  assert.equal(h.project.selectedIndex,4);
  const rebuilt=h.grids.existing.buttons;
  assert.notEqual(rebuilt[4],old[4], 'actual redraw replaces the old node');
  assert.equal(h.document.activeElement,rebuilt[4]);
  assert.equal(rebuilt.filter(b=>b.tabIndex===0).length,1);
  assert.equal(h.grids.proposal.buttons.filter(b=>b.tabIndex===0).length,1);
  assert.equal(h.grids.proposal.buttons[4].tabIndex,0);
});

test('visible instructions explain deliberate activation and both map groups are described', () => {
  assert.match(page,/id="grid-keyboard-help"/);
  for (const id of ['existing-grid', 'proposal-grid']) {
    const described = page.match(new RegExp(`id="${id}"[^>]*aria-describedby="([^"]*)"`));
    assert.ok(described, `${id} must have a description`);
    assert.ok(described[1].split(/\s+/).includes('grid-keyboard-help'), `${id} must retain keyboard instructions`);
  }
  assert.match(page,/arrows alone do not edit either site/);
});

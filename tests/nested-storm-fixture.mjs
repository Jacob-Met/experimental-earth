import{readFileSync}from'node:fs';export function nestedFixture(){return JSON.parse(readFileSync(new URL('./fixtures/nested-storm-original.json',import.meta.url),'utf8'));}

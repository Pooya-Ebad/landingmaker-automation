import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
test('old globally unique types migrate without losing supervisor or guessing an unused counter',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'hamkadeh-migrate-'));process.env.DATA_DIR=dir;
 const legacy=new DatabaseSync(path.join(dir,'app.sqlite'));
 legacy.exec(`CREATE TABLE used_types(type INTEGER PRIMARY KEY,job TEXT NOT NULL);
 CREATE TABLE jobs(id TEXT PRIMARY KEY,created TEXT NOT NULL,updated TEXT NOT NULL,status TEXT NOT NULL,data TEXT NOT NULL,error TEXT,result TEXT);
 CREATE TABLE counter(id INTEGER PRIMARY KEY,next INTEGER NOT NULL);INSERT INTO counter VALUES(1,112292);`);
 legacy.prepare('INSERT INTO jobs VALUES(?,?,?,?,?,?,?)').run('old','2026-11-08','2026-11-08','succeeded',JSON.stringify({supervisor:'rezaei',type:771111}),null,null);
 legacy.prepare('INSERT INTO used_types VALUES(?,?)').run(771111,'old');legacy.close();
 const store=await import('../server/store');assert.equal(store.nextType('rezaei'),771112);assert.equal(store.nextType('doosti'),0);
 assert.equal((store.db.prepare('SELECT supervisor FROM used_types WHERE type=771111').get() as any).supervisor,'rezaei');
 store.db.close();
});

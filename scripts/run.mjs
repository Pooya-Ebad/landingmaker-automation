import {build} from 'esbuild';
import {mkdirSync,readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const mode=process.argv[2]||'start';
mkdirSync('build',{recursive:true});
const options={bundle:true,platform:'node',format:'esm',packages:'external',target:'node24'};
if(mode==='test'){
 await build({...options,entryPoints:['server/index.ts'],outfile:'build/server.js'});
 const files=readdirSync('tests').filter(f=>f.endsWith('.test.ts'));
 await build({...options,entryPoints:files.map(f=>'tests/'+f),outdir:'build/tests'});
 const r=spawnSync(process.execPath,['--test','--test-concurrency=1',...files.map(f=>'build/tests/'+f.replace('.ts','.js'))],{stdio:'inherit'});process.exit(r.status??1);
}else if(mode==='http-check'){
 await build({...options,entryPoints:['scripts/http-check-live.ts'],outfile:'build/http-check-live.js'});await import('../build/http-check-live.js');
}else if(mode==='native-probe'){
 await build({...options,entryPoints:['scripts/native-probe.ts'],outfile:'build/native-probe.js'});await import('../build/native-probe.js');
}else if(mode==='review-real'){
 await build({...options,entryPoints:['scripts/review-darya-real.ts'],outfile:'build/review-darya-real.js'});await import('../build/review-darya-real.js');
}else if(mode==='sandbox'){
 await build({...options,entryPoints:['scripts/safe-sample.ts'],outfile:'build/safe-sample.js'});await import('../build/safe-sample.js');
}else if(mode==='inspect'){
 await build({...options,entryPoints:['scripts/inspect.ts'],outfile:'build/inspect.js'});await import('../build/inspect.js');
}else {
 await build({...options,entryPoints:['server/index.ts'],outfile:'build/server.js'});
 if(mode!=='build')await import('../build/server.js');
}

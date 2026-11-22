import config from './vite.viewer.config.js';
import {writeFileSync} from 'node:fs';
config.plugins.push({name:'build6-module-dump',generateBundle(_,bundle){
 const modules=Object.fromEntries(Object.values(bundle).filter(c=>c.type==='chunk').flatMap(c=>Object.entries(c.modules).map(([id,m])=>[id,m.code])));
 writeFileSync(process.env.BUILD6_DUMP,JSON.stringify(modules,null,2));
}});
export default config;

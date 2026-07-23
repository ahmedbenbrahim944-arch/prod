const fs = require('fs');
const path = require('path');
const R = {'Ã©':'é','Ã¨':'è','Ãª':'ê','Ã«':'ë','Ã ':'à','Ã¢':'â','Ã§':'ç','Ã®':'î','Ã´':'ô','Ã¹':'ù','Ã»':'û','Ã¼':'ü','Ã‰':'É','Ãˆ':'È','ÃŠ':'Ê','Ã€':'À','Ã‚':'Â','Ã‡':'Ç','â€™':"'",'â€œ':'"','â€':'"','â€"':'–','â€¦':'…'};
const EXT=['.ts','.html','.json','.css','.scss'];
function fix(f){let c=fs.readFileSync(f,'utf8'),m=false;for(const[b,g]of Object.entries(R)){if(c.includes(b)){c=c.split(b).join(g);m=true;}}if(m){fs.writeFileSync(f,c,'utf8');console.log('✔',f);}}
function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory()&&e.name!=='node_modules'&&e.name!=='.git')walk(p);else if(e.isFile()&&EXT.includes(path.extname(e.name)))fix(p);}}
walk('./src');console.log('✅ Terminé !');

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const ts=require('typescript');
const baseline=require('./protocol-baseline.json');
function signatures(source){
  const ast=ts.createSourceFile('component.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const found={};
  function visit(node){
    if(ts.isFunctionDeclaration(node)&&node.name&&node.body&& !/^(TokenMarket|CreateTokenForm|ProfilePanel)$/.test(node.name.text)){
      const printer=ts.createPrinter({removeComments:true});
      found[node.name.text]=crypto.createHash('sha256').update(printer.printNode(ts.EmitHint.Unspecified,node,ast)).digest('hex');
    }
    ts.forEachChild(node,visit);
  }
  visit(ast); return found;
}
for(const [file,functions] of Object.entries(baseline)){
  test(file+' preserves existing protocol handlers',()=>{
    const current=signatures(fs.readFileSync(path.join(__dirname,'../components',file),'utf8'));
    for(const [name,hash] of Object.entries(functions))assert.equal(current[name],hash,name+' changed during presentation redesign');
  });
}

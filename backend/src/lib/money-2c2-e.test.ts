import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { assertPrismaIntCents, optionalPrismaIntCents, parsePrismaCentsText, parseReaisInput, sumCents } from "./money";
import { moneyToBbValue } from "../services/bbPixService";
import { registerCatalogRoutes } from "../modules/catalog/catalog.routes";

function response() {
  return { code: 200, body: null as any, status(code: number) { this.code=code;return this; }, json(body: any) { this.body=body;return this; } };
}

test("2C2-E catalog cents reject malformed data and preserve nullable absence", () => {
  assert.equal(optionalPrismaIntCents(12345),12345);
  assert.equal(optionalPrismaIntCents(0),0);
  assert.equal(optionalPrismaIntCents(null),null);
  assert.equal(optionalPrismaIntCents(undefined),null);
  for (const value of [123.45,true,NaN,Infinity,"12345","",2147483648,Number.MAX_SAFE_INTEGER+1]) assert.throws(()=>optionalPrismaIntCents(value));
});

test("2C2-E actual catalog routes reject invalid monetary fields before writes", async (t) => {
  t.mock.method(console, "error", () => {});
  const handlers: Record<string, Function> = {};
  const app = Object.fromEntries(["get","post","put","delete"].map(method=>[method,(path: string,...args: Function[])=>{handlers[`${method} ${path}`]=args.at(-1)!;}]));
  let writes=0;
  const prisma={ catalogService: {
    findUnique:async({where}:any)=>where.code ? null : ({id:1,categoryId:1,name:"Test",code:"TEST",baseAmount:100,pricingMode:"FIXO"}),
    findFirst:async()=>null,
    create:async({data}:any)=>{writes++;return data;},
    update:async({data}:any)=>{writes++;return data;},
  }, serviceCategory: {findUnique:async()=>({id:1})} };
  registerCatalogRoutes({app:app as any,prisma:prisma as any,authMiddleware:()=>{},requireRoles:()=>()=>{}});
  for (const value of [123.45,true,NaN,Infinity,2147483648]) {
    for (const [method,path,body] of [
      ["post","/catalog/services",{categoryId:1,name:"Test",code:"TEST",pricingMode:"FIXO",baseAmount:value}],
      ["put","/catalog/services/:id",{baseAmount:value}],
      ["post","/catalog/services",{categoryId:1,name:"Test",code:"TEST",pricingMode:"FIXO",baseAmount:100,minimumAmount:value}],
      ["put","/catalog/services/:id",{minimumAmount:value}],
      ["put","/catalog/services/:id/pricing-tiers",{tiers:[{unitAmount:100,minimumAmount:value}]}],
      ["put","/catalog/services/:id/pricing-tiers",{tiers:[{unitAmount:value}]}],
    ] as const) {
      const res=response();await handlers[`${method} ${path}`]({body,params:{id:"1"}},res);
      assert.equal(res.code,400,`${method} ${path}`);
      assert.match(res.body.message,/Money/);
    }
  }
  assert.equal(writes,0);
  for (const [method,path] of [["post","/catalog/services"],["put","/catalog/services/:id"]]) {
    const res=response();
    await handlers[`${method} ${path}`]({body:{categoryId:1,name:"Test",code:"TEST",pricingMode:"FIXO",baseAmount:12345,minimumAmount:null},params:{id:"1"}},res);
    assert.equal(res.code,method==="post"?201:200);
    assert.equal(res.body.baseAmount,12345);
    assert.equal(res.body.minimumAmount,null);
  }
  assert.equal(writes,2);
});

test("2C2-E service serializer itself is strict (local only)",()=>{
  for (const [cents,value] of [[1,"0.01"],[150,"1.50"],[12345,"123.45"]] as const) assert.equal(moneyToBbValue(cents),value);
  for (const value of [123.45,Infinity,NaN,0,-1,Number.MAX_SAFE_INTEGER+1]) assert.throws(()=>moneyToBbValue(value));
});

test("2C2-E multipart cents accepts only integer text within Prisma range",()=>{
  assert.equal(parsePrismaCentsText("12345"),12345);
  assert.equal(parsePrismaCentsText("0"),0);
  for (const value of [true,12345,"123.45","1e2","0x10"," ","", "2147483648"]) assert.throws(()=>parsePrismaCentsText(value));
});

// Extract only the real handler AST. Never import server.ts, start a server or instantiate Prisma.
function paymentPlanHandler(prisma: any) {
  const source=ts.createSourceFile("server.ts",fs.readFileSync("src/server.ts","utf8"),ts.ScriptTarget.Latest,true);
  let handler: ts.ArrowFunction | undefined;
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.getText(source)==="app.post" &&
      node.arguments[0] && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text==="/finance/transactions") {
      handler=node.arguments.at(-1) as ts.ArrowFunction;
    }
    ts.forEachChild(node,visit);
  }
  visit(source);assert.ok(handler);
  const js=ts.transpileModule(`const handler = ${handler.getText(source)}; handler;`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  return vm.runInNewContext(js,{prisma,assertPrismaIntCents,parseReaisInput,sumCents,
    toIntMoney:(value:number)=>Math.round(Number(value)),
    normalizeNullableDate:(value:any)=>value?new Date(value):null,
    financeCompetenceFromDate:()=>"2026-09",console});
}

test("2C2-E actual PAYMENT_PLAN rejects minus one cent and returns explicit cent units", async()=>{
  let writes=0;
  const tx={financialTransaction:{create:async({data}:any)=>{writes++;return data;}},auditLog:{create:async()=>{}}};
  const handler=paymentPlanHandler({$transaction:async(fn:Function)=>fn(tx)});
  const base={type:"ENTRADA",source:"SERVICO_AVULSO",description:"Test",amount:123.45,entryDueDate:"2026-10-01"};
  const invalid=response();
  await handler({body:{...base,entryAmount:-0.01,installments:[{amount:123.46,dueDate:"2026-10-01"}]}},invalid);
  assert.equal(invalid.code,400);assert.equal(writes,0);
  const valid=response();
  await handler({body:{...base,entryAmount:1.50,installments:[{amount:121.95,dueDate:"2026-10-01"}]}},valid);
  assert.equal(valid.code,201);
  assert.equal(valid.body.totalAmountCents,12345);
  assert.equal(valid.body.entryAmountCents,150);
  assert.equal(valid.body.balanceAmountCents,12195);
  assert.equal(valid.body.installmentsTotalCents,12195);
  assert.equal(valid.body.totalAmount,123); // compatibility mirror remains in old units
  assert.equal(valid.body.installmentsTotal,12195);
  assert.equal(writes,2);
});

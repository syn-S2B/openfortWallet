import test from 'node:test'
import assert from 'node:assert/strict'
import { waitForVisiblePage } from '../src/wallet-visibility.ts'
class Page extends EventTarget { visibilityState='hidden'; show(){this.visibilityState='visible';this.dispatchEvent(new Event('visibilitychange'))} }
test('Onli approval can complete while hidden; key release waits for returning to this page', async()=>{
 const page=new Page(), controller=new AbortController();let released=false
 const approval=Promise.resolve('ACCEPTED')
 const opening=approval.then(()=>waitForVisiblePage(controller.signal,page)).then(()=>released=true)
 await new Promise(resolve=>setImmediate(resolve));assert.equal(released,false)
 page.show();await opening;assert.equal(released,true)
})
test('closing the wallet while returning from Onli never resumes key release', async()=>{
 const page=new Page(), controller=new AbortController()
 const pending=waitForVisiblePage(controller.signal,page);controller.abort();page.show()
 await assert.rejects(pending,{name:'AbortError'})
 await assert.rejects(waitForVisiblePage(controller.signal,page),{name:'AbortError'})
})

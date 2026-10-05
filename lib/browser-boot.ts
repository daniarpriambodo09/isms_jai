// lib/browser-boot.ts
//
// A small inline script, first thing in <head>, written in plain ES5 so it
// runs in ANY browser — also one that cannot parse the app's bundles:
//
// 1. Fills in the few built-in functions the bundles call that older phones
//    lack (Safari 14–15: Array/String .at, Object.hasOwn, findLast,
//    crypto.randomUUID; before 17.4: Promise.withResolvers). Not
//    structuredClone: pdf.js's legacy build brings a real one, and a
//    stand-in here would stop it from being installed.
//    The build itself is compiled down for those browsers (package.json
//    "browserslist"); these are the runtime gaps syntax compilation can't fix.
// 2. Watches whether the app actually starts. The page is drawn by
//    JavaScript; when it never starts (a browser too old even for this, or a
//    script that failed to load) the visitor used to get an empty page with
//    only the navbar. Now a notice says what is wrong and what to do.
//    components/app-ready.tsx sets window.__ismsReady once React is running.

export const BROWSER_BOOT_SCRIPT = `(function(){
try{
var d=function(o,n,f){if(o&&!o[n])try{Object.defineProperty(o,n,{value:f,writable:true,configurable:true})}catch(e){o[n]=f}};
var at=function(i){i=Math.trunc(i)||0;if(i<0)i+=this.length;return i<0||i>=this.length?undefined:this[i]};
d(Array.prototype,'at',at);d(String.prototype,'at',at);
d(Object,'hasOwn',function(o,k){return Object.prototype.hasOwnProperty.call(o,k)});
d(Array.prototype,'findLast',function(f,t){for(var i=this.length-1;i>=0;i--)if(f.call(t,this[i],i,this))return this[i]});
d(Array.prototype,'findLastIndex',function(f,t){for(var i=this.length-1;i>=0;i--)if(f.call(t,this[i],i,this))return i;return -1});
d(String.prototype,'replaceAll',function(a,b){return typeof a==='string'?this.split(a).join(b):this.replace(a,b)});
if(typeof Promise!=='undefined')d(Promise,'withResolvers',function(){var r={};r.promise=new Promise(function(a,b){r.resolve=a;r.reject=b});return r});
if(window.crypto&&!window.crypto.randomUUID&&window.crypto.getRandomValues)window.crypto.randomUUID=function(){var b=window.crypto.getRandomValues(new Uint8Array(16));b[6]=b[6]&15|64;b[8]=b[8]&63|128;var h='';for(var i=0;i<16;i++){h+=(b[i]+256).toString(16).slice(1);if(i===3||i===5||i===7||i===9)h+='-'}return h};
}catch(e){}
var failed='';
window.addEventListener('error',function(e){var s=e&&e.target&&e.target.src;if(s&&/\\/_next\\//.test(s))failed='berkas';else if(e&&e.message&&/Syntax|Unexpected|Can.t find variable|is not a function/.test(e.message)&&!failed)failed='browser'},true);
setTimeout(function(){
if(window.__ismsReady||document.getElementById('isms-boot-notice'))return;
var box=document.createElement('div');box.id='isms-boot-notice';box.setAttribute('role','alert');
box.style.cssText='position:fixed;left:16px;right:16px;top:96px;z-index:99999;max-width:520px;margin:0 auto;padding:18px 20px;border-radius:16px;background:#fff;border:1px solid #e2c9a6;box-shadow:0 12px 40px rgba(0,0,0,.18);font:15px/1.55 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#22303c';
box.innerHTML='<strong style="display:block;font-size:17px;margin-bottom:6px">Halaman tidak dapat dimuat di browser ini</strong>'+
(failed==='berkas'?'Sebagian berkas portal gagal diunduh. Periksa sambungan ke jaringan kantor, lalu muat ulang halaman.':'Browser atau sistem operasi perangkat ini terlalu lama untuk menjalankan Portal ISMS.')+
'<ul style="margin:10px 0 0;padding-left:20px"><li>Muat ulang halaman ini.</li><li>iPhone / iPad: perbarui iOS ke versi terbaru (Pengaturan &rarr; Umum &rarr; Pembaruan Perangkat Lunak).</li><li>Android: perbarui Chrome dari Play Store.</li><li>Atau buka portal dari komputer.</li></ul>'+
'<button type="button" onclick="location.reload()" style="margin-top:14px;padding:9px 18px;border:0;border-radius:999px;background:#1a3a52;color:#fff;font-weight:600;font-size:14px">Muat ulang</button>';
(document.body||document.documentElement).appendChild(box);
},12000);
})();`

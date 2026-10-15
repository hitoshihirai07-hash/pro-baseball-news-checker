export function setupPWA(notify){
  let installPrompt=null;
  const button=document.getElementById('install-button'),dialog=document.getElementById('install-dialog');
  const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  if(standalone())button.hidden=true;
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;button.hidden=false;});
  window.addEventListener('appinstalled',()=>{installPrompt=null;button.hidden=true;dialog.close();notify('アプリを追加しました');});
  button.addEventListener('click',async()=>{
    if(installPrompt){const prompt=installPrompt;installPrompt=null;try{await prompt.prompt();await prompt.userChoice;}catch{dialog.showModal();}}
    else dialog.showModal();
  });
  if('serviceWorker'in navigator&&window.isSecureContext){
    navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).catch(()=>notify('オフライン利用の準備ができませんでした。オンラインでは利用できます。',true));
  }
}

"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOS, setShowIOS] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone;
    if (standalone) return;
    if (localStorage.getItem("kliik-install-dismissed") === "1") return;

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const timer = window.setTimeout(() => {
      if (isIOS) {
        setShowIOS(true);
        setVisible(true);
      }
    }, 1800);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  const close = () => {
    localStorage.setItem("kliik-install-dismissed", "1");
    setVisible(false);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") setVisible(false);
  };

  if (!visible) return null;

  return (
    <div style={{position:"fixed",left:16,right:16,bottom:"calc(18px + env(safe-area-inset-bottom))",zIndex:99999,maxWidth:520,margin:"0 auto",background:"#fff",color:"#111",borderRadius:24,padding:"16px 18px",boxShadow:"0 18px 55px rgba(0,0,0,.35)",fontFamily:"inherit"}}>
      <button onClick={close} aria-label="Fermer" style={{position:"absolute",right:12,top:9,border:0,background:"transparent",fontSize:25,cursor:"pointer"}}>×</button>
      <div style={{display:"flex",gap:13,alignItems:"center",paddingRight:24}}>
        <img src="/logo.png" alt="KLIIK" style={{width:58,height:58,borderRadius:14,objectFit:"cover"}} />
        <div><strong style={{fontSize:18}}>Installe KLIIK</strong><div style={{fontSize:14,opacity:.68,marginTop:2}}>Accède aux jeux directement depuis ton écran d’accueil.</div></div>
      </div>
      {showIOS ? (
        <div style={{marginTop:13,fontSize:14,lineHeight:1.45,background:"#f3f3f5",borderRadius:15,padding:"11px 13px"}}>Sur iPhone : touche <b>Partager</b> puis <b>Sur l’écran d’accueil</b> et <b>Ajouter</b>.</div>
      ) : (
        <button onClick={install} style={{width:"100%",marginTop:13,border:0,borderRadius:16,padding:"13px 16px",fontSize:16,fontWeight:900,background:"#fff500",color:"#111",cursor:"pointer"}}>INSTALLER KLIIK</button>
      )}
    </div>
  );
}

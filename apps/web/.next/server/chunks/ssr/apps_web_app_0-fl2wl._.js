module.exports=[92221,a=>{"use strict";a.s(["Providers",()=>b]);let b=(0,a.i(11857).registerClientReference)(function(){throw Error("Attempted to call Providers() from the server but Providers is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"[project]/apps/web/app/providers.tsx","Providers")},57752,a=>{"use strict";var b=a.i(92221);a.n(b)},28992,a=>{"use strict";var b=a.i(7997),c=a.i(57752);let d=`
(() => {
  try {
    const saved = localStorage.getItem("supershot-theme");
    const theme = saved === "dark" || saved === "light"
      ? saved
      : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
  } catch {}
})();
`;a.s(["default",0,function({children:a}){return(0,b.jsxs)("html",{lang:"en",suppressHydrationWarning:!0,children:[(0,b.jsxs)("head",{children:[(0,b.jsx)("link",{rel:"preconnect",href:"https://fonts.googleapis.com"}),(0,b.jsx)("link",{rel:"preconnect",href:"https://fonts.gstatic.com",crossOrigin:"anonymous"}),(0,b.jsx)("link",{href:"https://fonts.googleapis.com/css2?family=Roboto+Flex:opsz,wght@8..144,300..800&display=swap",rel:"stylesheet"}),(0,b.jsx)("script",{dangerouslySetInnerHTML:{__html:d}})]}),(0,b.jsx)("body",{children:(0,b.jsx)(c.Providers,{children:a})})]})},"metadata",0,{title:"supershot.fun on Arc",description:"Permissionless token launches and onchain markets on Arc",icons:{icon:"/icon.svg",shortcut:"/icon.svg",apple:"/icon.svg"}}])},44665,function(a){a.n(a.i(28992))}];

//# sourceMappingURL=apps_web_app_0-fl2wl._.js.map
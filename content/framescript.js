const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

var shiftDown = false;

function AddSearchProvider(engineURL) {
  var mm = content.QueryInterface(Ci.nsIInterfaceRequestor)
                 .getInterface(Ci.nsIDocShell)
                 .QueryInterface(Ci.nsIInterfaceRequestor)
                 .getInterface(Ci.nsIContentFrameMessageManager);
  if (shiftDown) {
    mm.sendAsyncMessage("opensearchxml@kaply.com:Search:SaveEngine", {
      pageURL: content.document.documentURIObject.spec,
      engineURL
    });
  } else {
    mm.sendAsyncMessage("Search:AddEngine", {
      pageURL: content.document.documentURIObject.spec,
      engineURL
    });
  }
}

var documentObserver = {
  observe: function observe(subject, topic, data) {
    if (subject instanceof Ci.nsIDOMWindow && topic == 'content-document-global-created') {
      var win = subject.wrappedJSObject;
      subject.wrappedJSObject.external.AddSearchProvider = AddSearchProvider
      win.addEventListener("click", processClick, true);
    }
  }
}

Services.obs.addObserver(documentObserver, "content-document-global-created", false);
addEventListener("unload", function() {
  Services.obs.removeObserver(documentObserver, "content-document-global-created", false);
})

function processClick(event) {
  shiftDown = event.shiftKey;
}

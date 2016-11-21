const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "NetUtil",
                                  "resource://gre/modules/NetUtil.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "FileUtils",
                                  "resource://gre/modules/FileUtils.jsm");

function install(aData, aReason) {}

function uninstall(aData, aReason) {}

function startup(aData, aReason) {
  Services.obs.addObserver(observer, "chrome-document-global-created", false);
  let globalMM = Cc["@mozilla.org/globalmessagemanager;1"].getService(Ci.nsIMessageListenerManager);
  globalMM.loadFrameScript("chrome://opensearchxml/content/framescript.js", true);
  Services.mm.addMessageListener("opensearchxml@kaply.com:Search:SaveEngine", saveSearchEngine);
  let enumerator = Services.wm.getEnumerator("navigator:browser");
  while (enumerator.hasMoreElements()) {
    let win = enumerator.getNext().QueryInterface(Ci.nsIDOMWindow);
    if (win.document.readyState === "complete")
      loadIntoWindow(win);
    else
      win.addEventListener("load", function() {
        win.removeEventListener("load", arguments.callee, false);
        loadIntoWindow(win);
      })
  }
  Services.wm.addListener(windowListener);
}

function shutdown(aData, aReason) {
  Services.obs.removeObserver(observer, "chrome-document-global-created", false);
  Services.mm.removeMessageListener("opensearchxml@kaply.com:Search:SaveEngine", saveSearchEngine);
  Services.wm.removeListener(windowListener);

  let enumerator = Services.wm.getEnumerator("navigator:browser");
  while (enumerator.hasMoreElements()) {
    let win = enumerator.getNext().QueryInterface(Ci.nsIDOMWindow);
    unloadFromWindow(win);
  }
}

function onCommand(event) {
  var fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
  fp.init(event.target.ownerDocument.defaultView, "", Ci.nsIFilePicker.modeOpen);
  fp.appendFilters(Ci.nsIFilePicker.filterXML);
  if (fp.show() == Ci.nsIFilePicker.returnOK && fp.fileURL.spec && fp.fileURL.spec.length > 0) {
    Services.search.addEngine(fp.fileURL.spec, 0, null, false);
  }
}

function onCommand2(event) {
  if (event.originalTarget.className != "addengine-item") {
    return;
  }
  if (!event.shiftKey) {
    return;
  }
  event.stopPropagation();
  event.preventDefault();
  var engineURL = event.originalTarget.getAttribute("uri");
  saveSearchEngine({target: null, data: {pageURL: null, engineURL: engineURL}});
}

var observer = {
  observe: function observe(subject, topic, data) {
    switch (topic) {
      case "chrome-document-global-created":
        var win = subject.QueryInterface(Components.interfaces.nsIDOMWindow);
        win.addEventListener("load", function(event) {
          win.removeEventListener("load", arguments.callee, false);
          var doc = event.target;
          var url = doc.location.href.split("?")[0].split("#")[0].toLowerCase();
          switch (url) {
            case "about:preferences":
            case "chrome://browser/content/preferences/in-content/preferences.xul":
              var removeEngineButton = doc.getElementById("removeEngineButton");
              var addEngineButton = doc.createElement("button");
              addEngineButton.setAttribute("id", "addEngineButton");
              addEngineButton.setAttribute("label", "Add");
              addEngineButton.addEventListener("command", onCommand, false);
              removeEngineButton.parentNode.insertBefore(addEngineButton, removeEngineButton);
          }
        }, false);
        break;
    }
  }
}

function saveSearchEngine({ target: browser, data: { pageURL, engineURL } }) {
  var splitURL = engineURL.split("/");
  var fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
  var win = Services.wm.getMostRecentWindow("navigator:browser");
  fp.init(win, "", Ci.nsIFilePicker.modeSave);
  fp.defaultString = splitURL[splitURL.length-1];
  fp.appendFilters(Ci.nsIFilePicker.filterXML);
  if (fp.show() != Ci.nsIFilePicker.returnCancel && fp.fileURL.spec && fp.fileURL.spec.length > 0) {
    var uri = Services.io.newURI(engineURL, null, null);
    var channel = Services.io.newChannelFromURI(uri);
    var downloader = Cc["@mozilla.org/network/downloader;1"].createInstance(Ci.nsIDownloader);
    var listener = {
      onDownloadComplete: function(downloader, request, ctxt, status, result) {}
    }
    downloader.init(listener, fp.file);
    channel.asyncOpen(downloader, null);
  }
}

function loadIntoWindow(window) {
  if (!window || window.document.documentElement.getAttribute("windowtype") != "navigator:browser")
    return;
  window.addEventListener("command", onCommand2, false);
}

function unloadFromWindow(window) {
  if (!window || window.document.documentElement.getAttribute("windowtype") != "navigator:browser")
    return;
  window.removeEventListener("command", onCommand2, false);
}


var windowListener = {
  onOpenWindow: function(window) {
    let domWindow = window.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
    domWindow.addEventListener("load", function() {
      domWindow.removeEventListener("load", arguments.callee, false);
      loadIntoWindow(domWindow);
    }, false);
  },
  onCloseWindow: function(window) {
    let domWindow = window.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
    unloadFromWindow(domWindow);
  },
  onWindowTitleChange: function(window) {}
};

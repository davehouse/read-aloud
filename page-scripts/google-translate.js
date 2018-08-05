(function() {
  var getToken = findGetToken();
  var engine = new TtsEngine();
  var contentScript;

  loadScript("https://assets.lsdsoftware.com/read-aloud/page-scripts/messaging.js")
    .then(function() {
      contentScript = new RpcPeer(new DocumentMessagingPeer("GoogleTranslateToContentScript", "GoogleTranslateToPageScript"));
      contentScript.onInvoke = function(method) {
        var args = Array.prototype.slice.call(arguments, 1);
        if (method == "speak") {
          return engine.speak(args[0], args[1], function(err) {
            contentScript.invoke("onEvent", err ? {type:"error", errorMessage: err.message} : {type:"end"});
          })
        }
        else if (engine[method]) return engine[method].apply(engine, args);
        else throw new Error("Unknown method " + method);
      }
    })
    .then(function() {
      if (!getToken) contentScript.invoke("onReady", false);
      else {
        return loadScript("https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js")
          .then(loadCss.bind(null, "https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/themes/smoothness/jquery-ui.css"))
          .then(loadScript.bind(null, "https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js"))
          .then(getUserPermissionDialog)
          .then(function() {contentScript.invoke("onReady", true)})
          .then(showKeepOpenMessage)
      }
    })

  function findGetToken() {
    for (var prop in window)
      if (typeof window[prop] == 'function' && window[prop].toString().indexOf('fromCharCode(116)') != -1)
        return window[prop];
  }

  function TtsEngine() {
    var audio = document.createElement("AUDIO");
    var prefetchAudio = document.createElement("AUDIO");
    var isSpeaking = false;

    this.speak = function(utterance, options, onEnd) {
      return new Promise(function(fulfill, reject) {
        if (!options.volume) options.volume = 1;
        if (!options.rate) options.rate = 1;
        audio.pause();
        audio.volume = options.volume;
        audio.defaultPlaybackRate = options.rate * 1.1;
        audio.oncanplay = function() {
          audio.play();
          isSpeaking = true;
        };
        audio.onplay = function() {
          audio.onerror = function() {
            isSpeaking = false;
            onEnd(audio.error);
          };
          fulfill();
        };
        audio.onerror = function() {
          isSpeaking = false;
          reject(audio.error);
        };
        audio.onended = function() {
          isSpeaking = false;
          onEnd();
        };
        audio.src = getAudioUrl(utterance, options.lang);
        audio.load();
      })
    };
    this.isSpeaking = function() {
      return isSpeaking;
    };
    this.pause =
    this.stop = function() {
      audio.pause();
    };
    this.resume = function() {
      audio.play();
    };
    this.prefetch = function(utterance, options) {
      prefetchAudio.src = getAudioUrl(utterance, options.lang);
      prefetchAudio.load();
    };
    this.setNextStartTime = function() {
    };
    function getAudioUrl(utterance, lang, voiceName) {
      return "/translate_tts?ie=UTF-8&q=" + encodeURIComponent(utterance) + "&tl=" + lang + "&total=1&idx=0&textlen=" + utterance.length + "&tk=" + getToken(utterance) + "&client=t&prev=input";
    }
  }

  function getUserPermissionDialog() {
    return new Promise(function(fulfill) {
      jQuery("<div title='Permission Requested'><p>Read Aloud would like to use Google Translate for text-to-speech.</p></div>")
        .dialog({
          width: 400,
          modal: true,
          buttons: {
            Allow: function() {
              $(this).dialog("close");
              fulfill();
            }
          },
          appendTo: document.body
        })
    })
  }

  function showKeepOpenMessage() {
    jQuery("<div title='Notice'><p>Please keep this web page open.</p></div>")
      .dialog({
        width: 400,
        modal: true,
        closeOnEscape: false,
        open: function(event, ui) {
          $(".ui-dialog-titlebar-close", ui.dialog | ui).hide();
        }
      })
  }

  function loadCss(url) {
    var link = document.createElement("LINK");
    document.head.appendChild(link);
    link.setAttribute("type", "text/css");
    link.setAttribute("rel", "stylesheet");
    link.setAttribute("href", url);
    return Promise.resolve();
  }

  function loadScript(url) {
    return ajaxGet(url).then(eval);
  }

  function ajaxGet(url) {
    return new Promise(function(fulfill, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.onreadystatechange = function() {
        if (xhr.readyState == XMLHttpRequest.DONE) {
          if (xhr.status == 200) fulfill(xhr.responseText);
          else reject(new Error(xhr.responseText));
        }
      };
      xhr.send(null);
    })
  }
})()

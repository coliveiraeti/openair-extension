var openairExtension = (function() {
    var debug = true;
    var timer = null;
    var dialogTimer = null;
    var currentExtensionTimers = [];
    var observer = null;
    var dialogNotes = null;
    var activeDialogControl = null;

    var start = function() {
        window.addEventListener('unload', stop);
        initObserver();
        startExtensionTimer();
    }

    var stop = function() {
        stopObserver();
        stopExtensionTimer();
        info('Extension stopped');
    }

    var initObserver = function() {
        var targetNode = document.getElementsByTagName('body')[0];
        var config = { childList: true };
        var callback = function(mutationsList) {
            for (var mutation of mutationsList) {
                if (mutation.type !== 'childList') { 
                    continue; 
                }

                manageDialogEvents(mutation.addedNodes, function() { 
                    startDialogActiveSourceChecker();
                    info('dialog opened'); 
                });
                manageDialogEvents(mutation.removedNodes, function() { 
                    activeDialogControl = null;
                    info('dialog closed'); 
                });
            }
        };
        
        observer = new MutationObserver(callback);
        startObserver(targetNode, config);
    }

    var manageDialogEvents = function(nodes, callback) {
        for (var i = 0; i < nodes.length; i++) {
            if (typeof nodes.item(i).tagName === 'undefined' || nodes.item(i).tagName.toUpperCase() !== 'DIV') {
                continue;
            }
            if (!nodes.item(i).className.toUpperCase().includes('DIALOGBLOCK')) {
                continue;
            }
            callback();
            break;
        }
    }

    var startObserver = function(targetNode, config) {
        observer.observe(targetNode, config);
        info('observer started');
    }

    var stopObserver = function() {
        observer.disconnect();
        info('observer stopped');
    }    
  
    var startDialogActiveSourceChecker = function() {
        dialogTimer = window.setInterval(function() { 
            if (isDialogActiveSourceAvailable()) {
                doDialogCustomizations();                
                stopDialogActiveSourceChecker();
            }
        }, 10);
    }

    var startExtensionTimer = function() {
        timer = window.setInterval(function() { 
            for (var i = 0; i < currentExtensionTimers.length; i++) {
                if (currentExtensionTimers[i].active < 0) continue;
                currentExtensionTimers[i].seconds++;
                
                if (activeDialogControl === null) continue;
                displayCurrentTimer(currentExtensionTimers[i].name, currentExtensionTimers[i].seconds);
            }
        }, 1000);
    }

    var stopDialogActiveSourceChecker = function() {
        window.clearInterval(dialogTimer);
    }

    var stopExtensionTimer = function() {
        window.clearInterval(timer);
    }    

    var isDialogActiveSourceAvailable = function() {
        if (document.getElementsByClassName('activeDialogControl').length > 0) {
            activeDialogControl = document.getElementsByClassName('activeDialogControl')[0];
            return true;
        }
        return false;
    }

    var doDialogCustomizations = function() {
        fakeDialogButtons();

        dialogNotes = document.getElementById('tm_notes');
        var group = dialogNotes.closest('.dialogControlGroup');
        var newControlGroup = group.cloneNode(false);
        var timerControlGroup = group.cloneNode(false);

        newControlGroup.innerHTML = getNewDialogTemplate();
        if (newControlGroup.innerHTML.length > 0)
        {
            group.style.display = 'none';
            group.parentElement.insertBefore(newControlGroup, group);
        }

        var timerHtml = '<label class="dialogControlLabel" for="ext_timer">Timer</label>';
        timerHtml += '<div class="dialogControls">';
        timerHtml += '<input id="ext_timer" class="ext-timer-oa" type="text" data-timer="' + activeDialogControl.id + '" value="" readonly="readonly">';
        timerHtml += '<button id="ext_btn_timer" class="btn-oa">Start</button>';
        timerHtml += '</div>';
        timerControlGroup.innerHTML = timerHtml;
        timerControlGroup.classList.add('dialogControlGroup-timer');
        group.parentElement.insertBefore(timerControlGroup, group.parentElement.lastElementChild);
        document.getElementById('ext_btn_timer').addEventListener('click', function(){
            manageExtensionTimer();
            updateTimerButton();
        });
        displayCurrentTimer(activeDialogControl.id);
        updateTimerButton();

        populateNewDialogTemplate();
    }

    var manageExtensionTimer = function() {
        var exists = 0;
        for (var i = 0; i < currentExtensionTimers.length; i++) {
            if (currentExtensionTimers[i].name === activeDialogControl.id) {
                currentExtensionTimers[i].active = currentExtensionTimers[i].active * -1;
                exists = 1;
                break;
            }
        }
        if (exists === 1) return;
        currentExtensionTimers.push({ name: activeDialogControl.id, seconds: 0, active: 1 });
    }

    var displayCurrentTimer = function(name, seconds) {
        var timerInput = document.querySelector('input[data-timer="' + name + '"]');
        if (timerInput === null) return;
        if (typeof seconds === 'undefined') {
            for (var i = 0; i < currentExtensionTimers.length; i++) {
                if (currentExtensionTimers[i].name === name) {
                    seconds = currentExtensionTimers[i].seconds;
                    break;
                }
            }
            if (typeof seconds === 'undefined') {
                seconds = 0;
            }
        }
        timerInput.value = formatSecondsIntoTime(seconds);
    }

    var updateTimerButton = function() {
        var text = 'Start';
        var button = document.getElementById('ext_btn_timer');
        for (var i = 0; i < currentExtensionTimers.length; i++) {
            if (currentExtensionTimers[i].name !== activeDialogControl.id) continue;
            if (currentExtensionTimers[i].active > 0) {
                text = 'Stop';
                button.classList.add('btn-oa-warn');
            }
            else {
                button.classList.remove('btn-oa-warn');
            }
            break;            
        }
        button.innerText = text;
    }

    var formatSecondsIntoTime = function(seconds) {
        var date = new Date(null);
        date.setSeconds(seconds);
        return date.toISOString().substr(11,8);
    }

    var fakeDialogButtons = function() {
        var okButton = document.querySelector('div.dialogHeaderButtons button.dialogOkButton');
        var closeAndSaveButton = document.querySelector('div.dialogHeaderButtons button.dialogCloseAndSaveButton');

        var script = 'var client = document.getElementById("ext_client").value.length > 0 ? document.getElementById("ext_client").value : "NA";';
        script += 'var jira = document.getElementById("ext_jira").value.length > 0 ? document.getElementById("ext_jira").value : "NA";';
        script += 'var prod = document.getElementById("ext_prod").value.length > 0 ? document.getElementById("ext_prod").value : "NA";';
        script += 'var desc = document.getElementById("ext_desc").value.length > 0 ? document.getElementById("ext_desc").value : "NA";';
        script += 'var temp = client + " / " + jira + " / " + prod + " - " + desc;'
        script += 'return temp === "NA / NA / NA - NA" ? "" : temp;';

        cloneButton(okButton, script);
        cloneButton(closeAndSaveButton, script);
    }

    var getNewDialogTemplate = function() {
        var html = '<label class="dialogControlLabel" for="ext_client">Client</label>';
        html += '<div class="dialogControls"><input id="ext_client" type="text"></div>';
        html += '<label class="dialogControlLabel" for="ext_jira">Jira #</label>';
        html += '<div class="dialogControls"><input id="ext_jira" type="text"></div>';
        html += '<label class="dialogControlLabel" for="ext_prod">Product</label>';
        html += '<div class="dialogControls"><input id="ext_prod" type="text"></div>';
        html += '<label class="dialogControlLabel" for="ext_desc">Description</label>';
        html += '<div class="dialogControls"><textarea id="ext_desc" rows="2" cols="50" wrap="soft"></textarea></div>';        
        return html;
    }

    var populateNewDialogTemplate = function() {
        var script = 'var notes = "' + dialogNotes.value + '";';

        script += 'var re = /\s*[\/\;-]\s*/g;';
        script += 'var chunks = notes.split(re);';
        script += 'document.getElementById("ext_client").value = chunks.length > 0 ? chunks[0] : "";';
        script += 'document.getElementById("ext_jira").value = chunks.length > 1 ? chunks[1] : "";';
        script += 'document.getElementById("ext_prod").value = chunks.length > 2 ? chunks[2] : "";';
        script += 'document.getElementById("ext_desc").value = chunks.length > 3 ? chunks[3] : "";';
        new Function(script)();
    }

    var cloneButton = function(source, script) {
        var clone = source.cloneNode(true);
        source.parentElement.insertBefore(clone, source);
        clone.addEventListener('click', function(){
            dialogNotes.value = new Function(script)();
            source.click();
        });
        source.style.display = 'none';
    }

    var info = function(message) {
        if (!debug) return;
        console.info(message);
    }
  
    return {
        start: function() {
            info('Extension started');
            start();
        }
    };
  
 })();

 openairExtension.start();
/**
 * Vinya — content publisher.
 *
 * Committed at apps-script/Code.gs. Paste changes into Extensions -> Apps Script
 * on the "Vinya — site content" spreadsheet.
 *
 * Setup, once:
 *   1. Project Settings -> Script Properties -> add GH_TOKEN (fine-grained PAT,
 *      gsalao/vinya only, Contents: read and write).
 *   2. Triggers -> Add Trigger -> onEditInstallable -> From spreadsheet -> On edit.
 *      This must be an INSTALLABLE trigger. A simple onEdit(e) runs unauthorized
 *      and cannot call UrlFetchApp at all, so the dispatch would silently never
 *      fire.
 */

var REPO = 'gsalao/vinya';
var DEBOUNCE_MS = 30 * 1000;
var MACHINE_TABS = ['Status', 'Inquiries'];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Vinya')
    .addItem('Publish now', 'firePublish')
    .addToUi();
}

function onEditInstallable(e) {
  var tab = e.range.getSheet().getName();
  // A status write must not trigger a publish, which would trigger another status
  // write, and so on.
  if (MACHINE_TABS.indexOf(tab) !== -1) return;

  cancelPending();
  ScriptApp.newTrigger('firePublish').timeBased().after(DEBOUNCE_MS).create();
  setStatus('Edit noted — publishing in about 30 seconds.');
}

/** Delete-then-create is what makes this a debounce rather than a fixed window:
 *  each edit pushes the deadline out. It also keeps the trigger count at one,
 *  well under the twenty-per-script limit. */
function cancelPending() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'firePublish') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

function firePublish() {
  cancelPending(); // one-shot triggers do not remove themselves
  setStatus('Publishing…');

  var token = PropertiesService.getScriptProperties().getProperty('GH_TOKEN');
  if (!token) {
    // Owner-facing: no mention of GitHub, tokens or Script Properties — none of
    // those are things she can act on. Route her straight to the developer.
    setStatus('Not published: the site\'s publishing connection is not set up. Your change was saved, but the website has not been updated. This is not something you can fix — contact your developer.');
    return;
  }

  var response = UrlFetchApp.fetch('https://api.github.com/repos/' + REPO + '/dispatches', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' },
    payload: JSON.stringify({ event_type: 'content-update' }),
    muteHttpExceptions: true
  });

  var code = response.getResponseCode();
  if (code !== 204) {
    // 401 means the token expired, which will happen once a year and is otherwise
    // completely invisible: the owner edits, nothing happens, and nobody knows why.
    // Owner-facing message: no mention of GitHub. The code is kept because it is
    // useless to her but valuable to whoever she calls.
    setStatus('Not published: the system that publishes your change could not be reached (error ' + code + '). Your change was saved, but the website has not been updated. This is not something you can fix — contact your developer.');
  }
}

function setStatus(text) {
  var sheet = SpreadsheetApp.getActive().getSheetByName('Status');
  if (sheet) sheet.getRange('B2').setValue(text);
}

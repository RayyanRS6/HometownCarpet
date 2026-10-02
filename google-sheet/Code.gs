/**
 * Hometown Carpet Care: saves every website form into this Google Sheet.
 *
 * Paste this whole file into Extensions > Apps Script of the sheet, run setup() once,
 * then deploy it as a Web app (Execute as: Me, Who has access: Anyone) and put the
 * /exec URL into SHEET_URL in src/site.js.
 *
 * WhatsApp alerts (optional): add the WhatsApp agent's API key under Project Settings >
 * Script Properties as WHATSAPP_API_KEY (never in this file), message the agent once on
 * WhatsApp, then run connectWhatsApp(). Every new form is then also sent to you there.
 */

var WHATSAPP_API = 'https://api.whatsapp.com/agent/v1';

// One tab per website form. `keys` are the field names the website sends, in column order.
var TABS = {
  booking: {
    name: 'Bookings',
    alert: '🧽 New booking',
    headers: ['Submitted', 'First Name', 'Last Name', 'Phone', 'Email', 'Address', 'Service', 'Details', 'Date', 'Time', 'Notes'],
    keys: ['firstName', 'lastName', 'phone', 'email', 'address', 'service', 'details', 'date', 'time', 'notes']
  },
  quote: {
    name: 'Quote Requests',
    alert: '💬 New quote request',
    headers: ['Submitted', 'Name', 'Phone', 'Email', 'Service', 'Rooms / Items', 'Preferred Date', 'Message'],
    keys: ['name', 'phone', 'email', 'service', 'count', 'date', 'message']
  }
};

// Run this once from the Apps Script editor: it creates the tabs and asks for permission.
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone('America/Chicago');
  Object.keys(TABS).forEach(function (key) { getSheet(TABS[key]); });

  var blank = ss.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0) ss.deleteSheet(blank);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var data = JSON.parse(e.postData.contents);
    var tab = TABS[data.form];
    if (!tab) throw new Error('Unknown form: ' + data.form);

    var row = tab.keys.map(function (key) { return asText(data[key]); });
    getSheet(tab).appendRow([new Date()].concat(row));
    notifyWhatsApp(alertText(tab, data));
    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// Opening the web app URL in a browser shows this, which is a quick way to check the deployment.
function doGet() {
  return ContentService.createTextOutput('Hometown Carpet Care forms are connected to this sheet.');
}

function getSheet(tab) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(tab.name);
  if (!sheet) {
    sheet = ss.insertSheet(tab.name);
    sheet.appendRow(tab.headers);
    sheet.getRange(1, 1, 1, tab.headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// The leading apostrophe keeps what visitors typed as plain text: phone numbers stay as typed,
// and nothing they enter can run as a spreadsheet formula.
function asText(value) {
  var text = value == null ? '' : String(value).trim();
  return text ? "'" + text : '';
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------------- WhatsApp alerts (Meta's WhatsApp Agent Platform API) ---------------- */

// Run once from the editor. An agent can only message its creator, and learns the creator's
// WhatsApp id from a message they send it, so this waits up to 5 minutes for one.
function connectWhatsApp() {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty('WHATSAPP_API_KEY');
  if (!key) throw new Error('Add WHATSAPP_API_KEY under Project Settings > Script Properties first.');

  var offset = null;
  var stopAt = Date.now() + 5 * 60 * 1000;
  while (Date.now() < stopAt) {
    var res = UrlFetchApp.fetch(
      WHATSAPP_API + '/updates?timeout=25&limit=100' + (offset == null ? '' : '&offset=' + offset),
      { headers: { Authorization: 'Bearer ' + key }, muteHttpExceptions: true }
    );
    if (res.getResponseCode() === 204) { Utilities.sleep(4000); continue; } // nothing yet; Meta allows 15 polls a minute
    if (res.getResponseCode() !== 200) throw new Error('WhatsApp replied ' + res.getResponseCode() + ': ' + res.getContentText());

    var body = JSON.parse(res.getContentText());
    offset = body.next_offset;
    var sender = lastSender(body);
    if (!sender) continue;

    // Meta only delivers to the agent's creator, so a successful send also confirms it's you.
    var sent = sendWhatsApp(key, sender, '✅ Connected! New website bookings and quote requests will show up here.');
    if (sent.getResponseCode() < 300) {
      props.setProperty('WHATSAPP_USER_ID', sender);
      console.log('Connected. Alerts will go to ' + sender + '.');
      return;
    }
    console.warn('Could not message ' + sender + ': ' + sent.getContentText());
  }
  throw new Error('No WhatsApp message reached the agent. Send it a message, then run connectWhatsApp again.');
}

// Never throws: a WhatsApp problem must not stop the form being saved.
function notifyWhatsApp(text) {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty('WHATSAPP_API_KEY');
  var to = props.getProperty('WHATSAPP_USER_ID');
  if (!key || !to) return;
  try {
    var res = sendWhatsApp(key, to, text);
    if (res.getResponseCode() >= 300) console.error('WhatsApp alert failed: ' + res.getContentText());
  } catch (err) {
    console.error('WhatsApp alert failed: ' + err);
  }
}

function sendWhatsApp(key, to, text) {
  return UrlFetchApp.fetch(WHATSAPP_API + '/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + key },
    payload: JSON.stringify({ messaging_product: 'whatsapp', to: to, type: 'text', text: { body: text } }),
    muteHttpExceptions: true
  });
}

// The form's filled-in fields, labelled with the sheet's column names. WhatsApp caps a message at 4096 characters.
function alertText(tab, data) {
  var lines = ['*' + tab.alert + '*'];
  tab.keys.forEach(function (key, i) {
    var value = data[key] == null ? '' : String(data[key]).trim();
    if (value) lines.push('*' + tab.headers[i + 1] + ':* ' + value);
  });
  return lines.join('\n').slice(0, 4000);
}

function lastSender(body) {
  var sender = null;
  (body.entry || []).forEach(function (entry) {
    (entry.changes || []).forEach(function (change) {
      ((change.value || {}).messages || []).forEach(function (message) {
        if (/^user:\d+$/.test(message.from)) sender = message.from;
      });
    });
  });
  return sender;
}

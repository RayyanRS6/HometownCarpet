/**
 * Hometown Carpet Care: saves every website form into this Google Sheet.
 *
 * Paste this whole file into Extensions > Apps Script of the sheet, run setup() once,
 * then deploy it as a Web app (Execute as: Me, Who has access: Anyone) and put the
 * /exec URL into SHEET_URL in src/site.js.
 *
 * WhatsApp alerts (optional): each person who wants them creates their own WhatsApp agent and
 * adds its API key under Project Settings > Script Properties (never in this file) as
 * WHATSAPP_API_KEY, WHATSAPP_API_KEY_2, and so on. Run connectWhatsApp() and have them message
 * their agent while it runs. Every new form is then sent to everyone connected.
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

// An agent can only message its creator, so everyone who wants alerts has their own agent and key.
// Run this from the editor after adding a key: it connects every WHATSAPP_API_KEY… that isn't
// connected yet. To reconnect someone, delete their WHATSAPP_USER_ID… property and run it again.
function connectWhatsApp() {
  var contacts = whatsAppContacts();
  if (!contacts.length) throw new Error('Add WHATSAPP_API_KEY under Project Settings > Script Properties first.');
  var waiting = contacts.filter(function (c) { return !c.to; });
  if (!waiting.length) { console.log('Every WhatsApp key is already connected.'); return; }

  var stopAt = Date.now() + 5 * 60 * 1000; // Apps Script stops any run at 6 minutes
  waiting.forEach(function (contact) { connectContact(contact, stopAt); });
}

// The agent learns its creator's WhatsApp id from a message they send it. Messages sent before
// this starts listening aren't delivered to it, so the message has to be sent while it runs.
function connectContact(contact, stopAt) {
  console.log('Listening on ' + contact.keyProp + '. Whoever created that agent should send it a message on WhatsApp now.');
  var offset = null;
  while (Date.now() < stopAt) {
    var started = Date.now();
    var res = UrlFetchApp.fetch(
      WHATSAPP_API + '/updates?timeout=25&limit=100' + (offset == null ? '' : '&offset=' + offset),
      { headers: { Authorization: 'Bearer ' + contact.key }, muteHttpExceptions: true }
    );
    if (res.getResponseCode() === 204) {
      // Nothing yet. A poll normally waits 25 s; only pause if it came back early (Meta allows 15 polls a minute).
      if (Date.now() - started < 4000) Utilities.sleep(4000);
      continue;
    }
    if (res.getResponseCode() !== 200) throw new Error(contact.keyProp + ': WhatsApp replied ' + res.getResponseCode() + ': ' + res.getContentText());

    var body = JSON.parse(res.getContentText());
    offset = body.next_offset;
    var sender = lastSender(body);
    if (!sender) {
      if ((body.entry || []).length) console.log('Got an update with no message in it: ' + res.getContentText().slice(0, 500));
      continue;
    }
    console.log('Got a message from ' + sender + '. Replying to confirm…');

    // Meta only delivers to the agent's creator, so a successful send also confirms who it is.
    var sent = UrlFetchApp.fetchAll([whatsAppMessage(contact.key, sender, '✅ Connected! New website bookings and quote requests will show up here.')])[0];
    if (sent.getResponseCode() < 300) {
      PropertiesService.getScriptProperties().setProperty(contact.idProp, sender);
      console.log(contact.keyProp + ' is connected. Alerts will go to ' + sender + '.');
      return;
    }
    console.warn('Could not message ' + sender + ': ' + sent.getContentText());
  }
  throw new Error('No WhatsApp message reached the agent for ' + contact.keyProp + '. Run connectWhatsApp again and send it a message while it runs.');
}

// Never throws: a WhatsApp problem must not stop the form being saved.
function notifyWhatsApp(text) {
  var contacts = whatsAppContacts().filter(function (c) { return c.to; });
  if (!contacts.length) return;
  try {
    var results = UrlFetchApp.fetchAll(contacts.map(function (c) { return whatsAppMessage(c.key, c.to, text); }));
    results.forEach(function (res, i) {
      if (res.getResponseCode() >= 300) console.error('WhatsApp alert via ' + contacts[i].keyProp + ' failed: ' + res.getContentText());
    });
  } catch (err) {
    console.error('WhatsApp alert failed: ' + err);
  }
}

// Every WHATSAPP_API_KEY… property, paired with the WHATSAPP_USER_ID… it was connected to (null until then).
function whatsAppContacts() {
  var all = PropertiesService.getScriptProperties().getProperties();
  return Object.keys(all).sort()
    .filter(function (name) { return /^WHATSAPP_API_KEY(_\w+)?$/.test(name) && all[name].trim(); })
    .map(function (name) {
      var idProp = name.replace('WHATSAPP_API_KEY', 'WHATSAPP_USER_ID');
      return { keyProp: name, key: all[name].trim(), idProp: idProp, to: all[idProp] || null };
    });
}

function whatsAppMessage(key, to, text) {
  return {
    url: WHATSAPP_API + '/messages',
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + key },
    payload: JSON.stringify({ messaging_product: 'whatsapp', to: to, type: 'text', text: { body: text } }),
    muteHttpExceptions: true
  };
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

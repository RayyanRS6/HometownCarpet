/**
 * Hometown Carpet Care: saves every website form into this Google Sheet.
 *
 * Paste this whole file into Extensions > Apps Script of the sheet, run setup() once,
 * then deploy it as a Web app (Execute as: Me, Who has access: Anyone) and put the
 * /exec URL into SHEET_URL in src/site.js.
 */

// One tab per website form. `keys` are the field names the website sends, in column order.
var TABS = {
  booking: {
    name: 'Bookings',
    headers: ['Submitted', 'First Name', 'Last Name', 'Phone', 'Email', 'Address', 'Service', 'Details', 'Date', 'Time', 'Notes'],
    keys: ['firstName', 'lastName', 'phone', 'email', 'address', 'service', 'details', 'date', 'time', 'notes']
  },
  quote: {
    name: 'Quote Requests',
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

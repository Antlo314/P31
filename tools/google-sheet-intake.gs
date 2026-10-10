/**
 * P31 Collective: website applications → this Google Sheet.
 *
 * Every "Join P31 Collective" application sent from thep31collective.org/join is added as a
 * new row here. Rows are matched to this sheet's column headings by question
 * (e.g. "First and Last Name", "Email Address"), so an existing sheet keeps its layout.
 * Anything the sheet has no column for gets a new column at the end.
 *
 * Set up once, signed in to the Google account that owns P31's sheet (or one with edit access):
 *   1. Open the sheet → Extensions → Apps Script. Delete what's there and paste this whole file.
 *   2. Change TOKEN below to a long random phrase only you know (letters and numbers, 30+ characters).
 *      If the rows should go to a specific tab, put its name in SHEET_NAME.
 *   3. Save, then Deploy → New deployment → type "Web app".
 *      Execute as: Me.  Who has access: Anyone.  Deploy, and allow access when Google asks.
 *   4. Copy the Web app URL (ends in /exec). In Supabase → Edge Functions → Secrets add:
 *        JOIN_SHEET_URL   = that URL
 *        JOIN_SHEET_TOKEN = the same phrase as TOKEN
 * "Anyone" only means the website can reach it: without the token it adds nothing.
 */
const TOKEN = 'CHANGE-ME-to-a-long-random-phrase';
const SHEET_NAME = ''; // the tab to add rows to; leave '' for the first tab

// Other headings a sheet might use for the same question.
const ALIASES = {
  'first and last name': ['name', 'full name', 'first and last name'],
  'name of your business or ministry': ['business', 'business name', 'business or ministry', 'ministry'],
  'email address': ['email', 'e mail'],
  'phone number': ['phone', 'phone number', 'cell', 'mobile'],
  'city state': ['city', 'city state', 'location'],
  'birthday month day': ['birthday', 'birth date', 'date of birth'],
  'social media handle s': ['social media', 'socials', 'instagram', 'social media handles'],
  'timestamp': ['timestamp', 'date', 'submitted'],
};

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!TOKEN || TOKEN.indexOf('CHANGE-ME') === 0 || body.token !== TOKEN) return reply({ ok: false, error: 'token' });
    const row = body.row || {};
    const keys = Object.keys(row);
    lock.waitLock(20000);

    const book = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = SHEET_NAME ? book.getSheetByName(SHEET_NAME) : book.getSheets()[0];
    if (!sheet) return reply({ ok: false, error: 'no tab named ' + SHEET_NAME });
    if (sheet.getLastRow() === 0) sheet.appendRow(keys);

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
    const used = {};
    const pick = (heading) => {
      const h = norm(heading);
      if (!h) return null;
      return keys.find((k) => !used[k] && norm(k) === h)
        || keys.find((k) => !used[k] && (ALIASES[norm(k)] || []).indexOf(h) !== -1)
        || null;
    };
    const values = headers.map((heading) => {
      const k = pick(heading);
      if (!k) return '';
      used[k] = true;
      return row[k];
    });
    keys.filter((k) => !used[k]).forEach((k) => {
      sheet.getRange(1, headers.length + 1).setValue(k);
      headers.push(k);
      values.push(row[k]);
    });
    sheet.appendRow(values);
    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (ignored) { /* not held */ }
  }
}

// Open the web app URL in a browser to check it's live.
function doGet() {
  return reply({ ok: true, ready: TOKEN.indexOf('CHANGE-ME') !== 0 });
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

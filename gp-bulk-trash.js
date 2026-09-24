/* This script moves EVERYTHING in a Google Photos library to the trash, straight from the browser.
// It selects what is visible in the grid, clicks "Move to trash", confirms, repeats - simple enough.
//
// Items go to Google's TRASH (kept for 60 days), they are NOT deleted permanently - if you have that need, let me know.
//
// Usage:
//   1. Open https://photos.google.com (or /archive for the Archive) in the account to empty.
//   2. F12 -> Console -> paste this whole file -> Enter.
//      Any Chromium browser should work.
//      Some browsers may ask you to type "allow pasting" first - keep that in mind. I do reccommend you read and understand the script beforehand.
//   3. Type the account's email when prompted, to confirm it is the right account.
//   Stop at any time by typing   '__stopBulkTrash = true'   in the console.
//
// This drives Google's UI, which changes without notice. If a button is not found the
// script stops and says which one; nothing is trashed in that batch.
*/
(async () => {
  // ---- Settings ----------------------------------------------------------------------
  const BATCHES = Infinity;       // set to 1 for a single test batch
  const MAX_PER_BATCH = 500;      // selections per batch (Google balks around 2000 from my experience)
  const PAUSE_BETWEEN_MS = 2500;  // time for the grid to redraw between batches
  // Label of the trash button, in the languages Google Photos uses. Add yours if missing.
  const RX_TRASH = new RegExp('^(' + [
    'move to trash', 'delete',                        // en
    'mover para o lixo', 'mover para a lixeira',      // pt-PT, pt-BR
    'mover a la papelera', 'eliminar',                // es
    'placer dans la corbeille', 'supprimer',          // fr
    'in den papierkorb verschieben', 'löschen',       // de
    'sposta nel cestino', 'elimina',                  // it
    'verplaatsen naar prullenbak', 'verwijderen',     // nl
  ].join('|') + ')\\b', 'i');
  // ------------------------------------------------------------------------------------

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const visible = e => e && e.offsetParent !== null;
  const waitFor = async (fn, ms = 10000) => {
    for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(200)) {
      const r = fn(); if (r) return r;
    }
    return null;
  };
  const findButton = (root, rx) => [...root.querySelectorAll('button, [role="button"]')].find(b =>
    visible(b) && (rx.test(b.getAttribute('aria-label') || '') || rx.test((b.textContent || '').trim())));

  // Confirm the account first: running this in the wrong account is the easiest mistake!!
  const account = [...document.querySelectorAll('a[aria-label], button[aria-label]')]
    .map(e => e.getAttribute('aria-label')).find(l => /@/.test(l)) || '(not found)';
  const answer = prompt(`Active account:\n${account}\n\nType this account's email to confirm:`);
  if (!answer || !account.toLowerCase().includes(answer.trim().toLowerCase())) {
    console.warn('Cancelled: the email does not match the active account.'); return;
  }

  window.__stopBulkTrash = false;
  let total = 0, empty = 0;
  for (let n = 1; n <= BATCHES && !window.__stopBulkTrash; n++) {
    // Re-query on every click: the first click switches the page into selection mode and
    // Google redraws the grid, detaching any elements found before it.
    let misses = 0;
    for (let i = 0; i < MAX_PER_BATCH && misses < 5; i++) {
      const c = [...document.querySelectorAll('[role="checkbox"][aria-checked="false"]')].find(visible);
      if (!c) break;
      c.click();
      if (!await waitFor(() => c.getAttribute('aria-checked') === 'true' || !c.isConnected, 1500)) misses++;
    }
    const selected = document.querySelectorAll('[role="checkbox"][aria-checked="true"]').length;
    if (!selected) {
      // The grid can take a while to reload after a batch: retry a few times.
      if (++empty > 3) { console.log('Nothing left to select - library looks empty (reload to confirm).'); break; }
      console.log(`Nothing visible, waiting for the grid (${empty}/3)...`);
      n--; await sleep(4000); continue;
    }
    empty = 0;

    const trash = await waitFor(() => findButton(document, RX_TRASH), 5000);
    if (!trash) { console.error('Could not find the "Move to trash" button. Stopped; nothing trashed in this batch.'); break; }
    trash.click();

    const confirm = await waitFor(() => {
      const d = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].find(visible);
      return d && findButton(d, RX_TRASH);
    }, 8000);
    if (!confirm) { console.error('The confirmation dialog did not appear. Stopped - check the screen.'); break; }
    confirm.click();

    await waitFor(() => !document.querySelector('[role="checkbox"][aria-checked="true"]'), 30000);
    total += selected;
    console.log(`Batch ${n}: ${selected} moved to trash (total ${total})`);
    window.scrollTo(0, 0);
    await sleep(PAUSE_BETWEEN_MS);
  }
  console.log(`Done. ${total} items moved to trash in this run.`);
})();

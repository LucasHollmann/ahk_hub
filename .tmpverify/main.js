const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, 'out.txt');
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const w = new BrowserWindow({ width: 960, height: 640, show: false });
  await w.loadFile(path.join(__dirname, 'page.html'));
  const js = fs.readFileSync(path.join(__dirname, 'probe.js'), 'utf8');
  let r;
  try { r = await w.webContents.executeJavaScript(js, true); }
  catch (e) { r = 'ERR: ' + (e && e.stack || e); }
  fs.writeFileSync(OUT, String(r));
  app.exit(0);
});

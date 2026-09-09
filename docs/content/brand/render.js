const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const jobs = [
    { file: 'vine-avatar.html', out: 'ivy-avatar-512.png', w: 512,  h: 512, sel: '.mark' },
    { file: 'vine-header.html', out: 'ivy-header-1500x500.png', w: 1500, h: 500, sel: '.hdr' },
  ];
  const dir = process.argv[2];
  for (const j of jobs) {
    const p = await b.newPage({ viewport: { width: j.w, height: j.h }, deviceScaleFactor: 2 });
    await p.goto('file://' + dir + '/' + j.file);
    await p.waitForTimeout(300);
    await p.locator(j.sel).screenshot({ path: dir + '/' + j.out });
    console.log('wrote', j.out);
    await p.close();
  }
  await b.close();
})();

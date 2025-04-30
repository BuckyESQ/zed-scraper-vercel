import chromium from 'chrome-aws-lambda';
import puppeteer from 'puppeteer-core';

export default async function handler(req, res) {
  const { url, go } = req.query;
  if (!url) {
    return res.status(400).send('Missing ?url=');
  }
  if (!go) {
    return res
      .status(200)
      .send('Ready to scrape—scroll your page then append &go=true');
  }

  // Launch headless chrome bundled with Vercel:
  const execPath = await chromium.executablePath;
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: execPath,
    headless: chromium.headless,
  });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle2' });

    // Scroll to load everything:
    let prevHeight = await page.evaluate(() => document.body.scrollHeight);
    while (true) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      // use a plain timeout instead of waitForTimeout:
      await new Promise(r => setTimeout(r, 1000));
      const newHeight = await page.evaluate(() => document.body.scrollHeight);
      if (newHeight === prevHeight) break;
      prevHeight = newHeight;
    }

    // Grab all /assets/ links:
    const links = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href*="/assets/"]'));
      const set = new Set();
      anchors.forEach(a => {
        const clean = a.href.split('?')[0];
        set.add(clean);
      });
      return Array.from(set);
    });

    return res.status(200).json({ count: links.length, links });
  } catch (err) {
    return res.status(500).send(err.toString());
  } finally {
    await browser.close();
  }
}
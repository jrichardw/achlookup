const express = require('express');
const chromium = require('@sparticuz/chromium');
// Dynamically require the appropriate Puppeteer package
const puppeteer = process.env.NODE_ENV === 'production' ? require('puppeteer-core') : require('puppeteer');


const app = express();
const port = process.env.PORT || 3000;

app.get('/api/bankInfo', async (req, res) => {
    const { aba } = req.query;

    if (typeof aba !== "string") {
        console.log("Invalid ABA routing number format");
        return res.status(400).json({ error: "ABA routing number must be a string" });
    }

    console.log("Request received");
    console.log("Initiating puppeteer");

    const LOCAL_CHROME_EXECUTABLE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

    let browser = null;
    try {
        const launchOptions = process.env.NODE_ENV === 'production' ? {
            args: chromium.args,
            executablePath: await chromium.executablePath(),
            headless: true,
        } : {};

        browser = await puppeteer.launch(launchOptions);
        
        const page = await browser.newPage();
        
        await page.goto(`https://www.frbservices.org/EPaymentsDirectory/achResults.html?bank=&aba=${aba}`, { waitUntil: 'networkidle0' });
        console.log("Page loaded");

        // puppeteer logic
        const agreeButton = await page.$("#agree_terms_use");
        if (agreeButton) {
            console.log("Agree button found, clicking...");
            await agreeButton.click();
            await page.waitForNavigation({ waitUntil: 'networkidle0' });
            console.log("Navigation after agree completed");
        } else {
            console.log("No agree button found, proceeding with scraping");
        }

        const data = await page.evaluate(() => {
            console.log("Evaluating page content for data extraction");
            const routingNumber = document.querySelector("tr#result_row_1 td:nth-child(2)").innerText.trim().replace(/\D/g, "");
            const name = document.querySelector("tr#result_row_1 td:nth-child(3)").innerText.trim();
            const city = document.querySelector("tr#result_row_1 td:nth-child(4)").innerText.trim();
            const state = document.querySelector("tr#result_row_1 td:nth-child(5)").innerText.trim();
            return { routingNumber, name, city, state };
        });

        console.log("Data extraction successful", data);
        await browser.close();
        res.status(200).json(data);
    } catch (error) {
        console.error("An error occurred during data extraction", error);
        if (browser !== null) await browser.close();
        res.status(500).json({ error: "Failed to fetch data" });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

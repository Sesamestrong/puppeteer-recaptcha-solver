const axios = require('axios')
const https = require('https')
const moment = require('moment');

function rdn(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
};

const solve = (page, key, useOldModel) =>
    new Promise(async (resolve, reject) => {
        const getFrameByUrl = async (url, context = page) => {
            await context.waitForSelector('iframe[src*="' + url + '"]');
            return context.frames().find(frame => frame.url().includes(url));
        };
        try {

            const recaptchaFrame = await getFrameByUrl("api2/anchor");

            recaptchaFrame.waitForSelector('#recaptcha-anchor[aria-checked="true"]').then(async i => resolve(
                await (await (await page.$('#g-recaptcha-response')).getProperty("value"))));
            const checkbox = await recaptchaFrame.$('#recaptcha-anchor')
            await checkbox.click({
                delay: rdn(30, 150),
            });


            const imageFrame = await getFrameByUrl("api2/bframe");
            await imageFrame.waitForFunction(() => {
                const img = document.querySelector('.rc-image-tile-wrapper img')
                return img && img.complete;
            });

            const audioButton = await imageFrame.$('#recaptcha-audio-button')
            await audioButton.click({
                delay: rdn(30, 150),
            });

            const httsAgent = new https.Agent({
                rejectUnauthorized: false
            });
            const apiOptions = {
                httsAgent,
                method: 'post',
                url: 'https://api.wit.ai/speech?v=' + (useOldModel ? "20170304" : moment().subtract(2, "days").format('YYYYMMDD')),
                headers: {
                    Authorization: `Bearer ${key}`,
                    'Content-Type': 'audio/mpeg3'
                },
            };

            //TODO check if it gives us a mean error
            const audioLinkSelector = '.rc-audiochallenge-tdownload-link';
            await imageFrame.waitForSelector(audioLinkSelector);

            const audioLink = await (await (await imageFrame.$(audioLinkSelector)).getProperty('href')).jsonValue();

            const audioBytes = await imageFrame.evaluate(audioLink => {
                return (async () => {
                    const response = await window.fetch(audioLink);
                    const buffer = await response.arrayBuffer();
                    return Array.from(new Uint8Array(buffer));
                })();
            }, audioLink);
            const response = await axios({ ...apiOptions,
                data: new Uint8Array(audioBytes).buffer,
            });

            const audioTranscript = response.data._text.trim();
            const input = await imageFrame.$('#audio-response');
            await input.click({
                delay: rdn(30, 150),
            });
            await input.type(audioTranscript, {
                delay: rdn(30, 75),
            });

            const verifyButton = await imageFrame.$('#recaptcha-verify-button');
            await verifyButton.click({
                delay: rdn(30, 150),
            });

            await recaptchaFrame.waitForSelector('#recaptcha-anchor[aria-checked="true"]');

        } catch (e) {
            console.log(e);
            return '';
        }

    });

module.exports = {
    solve: (key, useOldModel) => (page) => solve(page, key, useOldModel),
    rdn
};

const puppeteer = require('puppeteer');

async function delay(time) {
    return new Promise(function(resolve) {
        setTimeout(resolve, time);
    });
}

async function takeScreenshot(username) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.setViewport({
        width: 375,
        height: 812,
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true
    });

    const url = `https://www.instagram.com/${username}/`;
    await page.goto(url);
    await page.waitForSelector('._aa_y._aa_z'); // Certifique-se de que essa classe está atualizada
    await delay(2000);

    try {
        // Tenta remover o elemento, se ele existir
        await page.evaluate(() => {
            const elementsToRemove = ['._acus', '.xoegz02']; // Adicione ou atualize as classes conforme necessário
            elementsToRemove.forEach(selector => {
                const el = document.querySelector(selector);
                if (el) el.remove();
            });
        });
    } catch (error) {
        console.error("Erro ao remover elementos: ", error);
    }

    await page.screenshot({ path: `./prints/${username}.png` });
    await browser.close();
}

async function checkAndScreenshotUsernames(username) {
    const data = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
    {
      headers: {
        authority: "www.instagram.com",
        accept: "*/*",
        "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        cookie:
          "csrftoken=6VaDebQQw7jme4TLGTLWmc; dpr=1.25; ig_did=50DB6954-04F9-4807-8532-CC104CB4FD5B; ig_nrcb=1; datr=kzWdZfCchdw7uF82DGbcGmKW; mid=ZZ01lAALAAEFiOErwtnV0tsPUwWK",
        dpr: "1.25",
        referer: `https://www.instagram.com/${username}/`,
        "sec-ch-prefers-color-scheme": "light",
        "sec-ch-ua":
          '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        "sec-ch-ua-full-version-list":
          '"Not_A Brand";v="8.0.0.0", "Chromium";v="120.0.6099.200", "Google Chrome";v="120.0.6099.200"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-model": '""',
        "sec-ch-ua-platform": '"Windows"',
        "sec-ch-ua-platform-version": '"15.0.0"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "viewport-width": "982",
        "x-asbd-id": "129477",
        "x-csrftoken": "6VaDebQQw7jme4TLGTLWmc",
        "x-ig-app-id": "936619743392459",
        "x-ig-www-claim": "0",
        "x-requested-with": "XMLHttpRequest",
      },
    }
  );
    const json = await data.json();
    const url = json?.data?.user?.bio_links[0]?.url;
    console.log(`URL do perfil de ${username}: ${url}`);

    if(!url || !url.includes("app.assis.co")) {
        takeScreenshot(username);
    }
}

// Exemplo de uso
const usernames = ['andreocunha', 'casalboeira', 'arturocunha'];
for(const username of usernames) {
    checkAndScreenshotUsernames(username);
}

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const qrcode = require("qrcode");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const csv = require('csv-parser');
const { Readable } = require('stream');
const puppeteer = require('puppeteer');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const client = new Client({
  authStrategy: new LocalAuth(),
});

app.use(express.static(__dirname));

client.on("qr", (qr) => {
  qrcode.toDataURL(qr, (err, url) => {
    if (err) {
      console.error("Erro ao gerar QR Code", err);
      return;
    }
    io.emit('qr', url);
  });
});

client.on("ready", () => {
  console.log("Client is ready!");
  io.emit('ready');
});

io.on('connection', (socket) => {
    socket.on('processCSV', async (content) => {
        const results = [];
        const stream = Readable.from(content);
        stream.pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', async () => {
                const browser = await puppeteer.launch({
                    headless: false,
                    args: ["--no-sandbox", "--disable-setuid-sandbox"],
                });
                console.log(results);
                await loginToInstagram(browser);
                
                for (const row of results) {
                    await checkAndSendMessages(row, browser);
                }
                socket.emit('messageStatus', 'Processamento concluído');
            });
    });
});

async function checkAndSendMessages(row, browser) {
    const { phone, name, instagram, link } = row; // Corrigido de number para phone
    const hasLink = await checkInstagramProfile(instagram, browser);
    if (!hasLink) {
        const message = `Olá ${name}! Tudo bem? Aqui é a Assis, estava olhando seu perfil no Insta rs e vi que você ainda não colocou seu link da Assis lá! Adicionando o seu link do perfil ${link} você terá mais chances de receber oportunidades! 😍`;
        const chatId = phone.includes("@c.us") ? phone : phone.substring(1) + "@c.us";
        const imagePath = await takeScreenshot(instagram, browser);
        const media = MessageMedia.fromFilePath(imagePath);
        await client.sendMessage(chatId, media, { caption: message });
        await client.sendMessage(chatId, "Se precisar de ajuda para adicionar o link, estou à disposição! 😊");
    }
}

async function checkInstagramProfile(username, browser) {
    try {
        const page = await browser.newPage();
        await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: 'networkidle2' });
        // Ajuste o seletor abaixo conforme necessário para encontrar o link no perfil
        const link = await page.evaluate(() => {
            const element = document.querySelector('a[href*="app.assis.co"]');
            return element ? element.href : null;
        });

        console.log(`URL do perfil de ${username}: ${link}`);
        await page.close();
        return link && link.includes("app.assis.co");
    } catch (error) {
        console.error(`Erro ao verificar o perfil do Instagram: ${error}`);
        return false;
    }
}


async function delay(time) {
    return new Promise(function(resolve) {
        setTimeout(resolve, time);
    });
}

async function takeScreenshot(username, browser) {
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
    
    // O resto da sua lógica de captura de tela
    const imagePath = `./prints/${username}.png`; // Certifique-se de que a pasta prints exista
    await page.screenshot({ path: imagePath });
    return imagePath;
}

async function loginToInstagram(browser) {
    const page = await browser.newPage();
    await page.goto("https://www.instagram.com", { waitUntil: "networkidle2" });
  
    console.log("Por favor, faça login no Instagram e feche a aba de login...");
  
    // Espera o usuário fazer login no Instagram
    await page.waitForNavigation({ waitUntil: "networkidle2" });
  
    console.log("Login bem-sucedido, continuando o script...");
  
    // Fecha a aba de login após o login ser confirmado
    await page.close();
  }

client.initialize();

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});